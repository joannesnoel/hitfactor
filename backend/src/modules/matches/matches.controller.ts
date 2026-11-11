import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'node:crypto';
import { eq, and, isNull, sql } from 'drizzle-orm';
import {
  createMatchSchema,
  updateMatchSchema,
  hostUpdateMatchSchema,
  joinMatchSchema,
  assignMatchOfficerSchema,
  assignStageOfficerSchema,
  addRegistrationSchema,
  updateRegistrationSchema,
  isValidDivisionForOrg,
  getDivisionsForOrg,
  divisionAllowsMajor,
  computeScore,
  MATCH_LEVEL_OFFICIAL_ROLES,
} from '@hitfactor/shared';
import type { Organization, PowerFactor, ScoringType } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { matches, stages, matchAdmins, matchOfficers, stageOfficers, users, registrations, scores, matchRecomputeState } from '../../db/schema.js';
import { normalizeShooterName, cleanDisplayName } from '../import/shooter-identity.js';
import { isMatchHost, loadMatchMembership } from './match-authz.js';
import {
  accessFlagsFor,
  canViewMatch,
  canRegisterIntoMatch,
  isJoinableStatus,
  redactMatch,
  visibleMatchesFor,
} from './match-visibility.js';

/** URL-safe invite token for a private match's QR/deep link. */
function generateJoinToken(): string {
  return randomBytes(9).toString('base64url'); // 12 chars, [A-Za-z0-9_-]
}

async function isMatchAdmin(
  matchId: string,
  userId: string
): Promise<boolean> {
  const [admin] = await db
    .select({ id: matchAdmins.id })
    .from(matchAdmins)
    .where(
      and(eq(matchAdmins.match_id, matchId), eq(matchAdmins.user_id, userId))
    )
    .limit(1);
  return !!admin;
}

export async function listMatches(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { status } = request.query as { status?: string };

  let query = db.select().from(matches);

  if (status) {
    query = query.where(eq(matches.status, status)) as typeof query;
  }

  const result = await query;

  // Private matches (and their invite tokens) are only for people involved.
  const isGlobalAdmin = request.user.roles.includes('admin');
  const membership = await loadMatchMembership(request.user.id);
  return reply.send(
    visibleMatchesFor(result, request.user.id, isGlobalAdmin, membership)
  );
}

export async function getMatch(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);

  if (!match) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Match not found',
    });
  }

  // A private match is only visible to people involved; to anyone else it
  // doesn't exist. The invite token is further limited to the host/admins.
  const membership = await loadMatchMembership(request.user.id, id);
  const flags = accessFlagsFor(
    match,
    request.user.id,
    request.user.roles.includes('admin'),
    membership
  );
  if (!canViewMatch(match.is_private, flags)) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Match not found',
    });
  }

  const matchStages = await db
    .select()
    .from(stages)
    .where(eq(stages.match_id, id));

  return reply.send({ ...redactMatch(match, flags), stages: matchStages });
}

export async function createMatch(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = createMatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const isGlobalAdmin = request.user.roles.includes('admin');

  // Two kinds of match, kept deliberately separate:
  //  - Admin-created (public): uses the match_admins / match_officers machinery,
  //    creator becomes match admin + MA, as before.
  //  - Shooter-created (private): a lightweight, self-hosted match. Always
  //    private, gets an invite token, and has NO admin/officer rows — the host's
  //    sole authority is matches.created_by (see isMatchHost).
  if (!isGlobalAdmin) {
    const [match] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        is_private: true,
        // Hosted matches are always Level I.
        level: 'I',
        join_token: generateJoinToken(),
        // A host wants their casual match open to invitees immediately.
        registration_open: true,
        // Live from creation so scores auto-recompute (the recompute sweep only
        // sweeps 'active'/'scoring' matches) — casual matches have no draft
        // lifecycle to step through.
        status: 'active',
        created_by: request.user.id,
      })
      .returning();
    return reply.status(201).send(match);
  }

  const [match] = await db
    .insert(matches)
    .values({
      ...parsed.data,
      // A private admin match still gets an invite token so it can be shared.
      join_token: parsed.data.is_private ? generateJoinToken() : null,
      created_by: request.user.id,
    })
    .returning();

  // Add creator as match admin (permission table)
  await db.insert(matchAdmins).values({
    match_id: match.id,
    user_id: request.user.id,
  });

  // Add creator as MA (official role)
  await db
    .insert(matchOfficers)
    .values({ match_id: match.id, user_id: request.user.id, role: 'MA' })
    .onConflictDoNothing();

  return reply.status(201).send(match);
}

/**
 * Public preview of a private match by its invite token — enough to render the
 * "Join <match>?" page to a guest who may not have an account yet. No auth.
 */
export async function getJoinPreview(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { token } = request.params as { token: string };

  const [match] = await db
    .select({
      id: matches.id,
      name: matches.name,
      start_date: matches.start_date,
      end_date: matches.end_date,
      location: matches.location,
      organization: matches.organization,
      status: matches.status,
      registration_open: matches.registration_open,
      created_by: matches.created_by,
    })
    .from(matches)
    .where(and(eq(matches.join_token, token), eq(matches.is_private, true)))
    .limit(1);

  if (!match) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'This invite link is invalid or has expired.',
    });
  }

  const [host] = await db
    .select({ display_name: users.display_name })
    .from(users)
    .where(eq(users.id, match.created_by))
    .limit(1);

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(eq(registrations.match_id, match.id));

  return reply.send({
    id: match.id,
    name: match.name,
    start_date: match.start_date,
    end_date: match.end_date,
    location: match.location,
    organization: match.organization,
    status: match.status,
    // Not open for joining once the match is past/before its joinable statuses,
    // so the join page shows "registration closed".
    registration_open: match.registration_open && isJoinableStatus(match.status),
    host_name: host?.display_name ?? null,
    participant_count: count,
    divisions: getDivisionsForOrg(match.organization as Organization),
  });
}

/**
 * Authenticated self-registration into a private match via its invite token.
 * Idempotent: if the user already has a registration in this match, it's
 * returned instead of creating a duplicate.
 */
export async function joinMatch(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { token } = request.params as { token: string };
  const parsed = joinMatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const [match] = await db
    .select({
      id: matches.id,
      organization: matches.organization,
      registration_open: matches.registration_open,
      status: matches.status,
    })
    .from(matches)
    .where(and(eq(matches.join_token, token), eq(matches.is_private, true)))
    .limit(1);

  if (!match) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'This invite link is invalid or has expired.',
    });
  }

  if (!isJoinableStatus(match.status)) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'This match is not accepting new shooters.',
    });
  }

  if (!match.registration_open) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Registration for this match is closed.',
    });
  }

  if (
    !isValidDivisionForOrg(
      match.organization as Organization,
      parsed.data.division
    )
  ) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: `Division "${parsed.data.division}" is not valid for ${match.organization}.`,
    });
  }

  // Default to Minor; reject Major for a Minor-only division.
  const powerFactor = parsed.data.power_factor ?? 'Minor';
  if (powerFactor === 'Major' && !divisionAllowsMajor(parsed.data.division)) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: `Division "${parsed.data.division}" is Minor only.`,
    });
  }

  // Already registered? Return the existing registration (idempotent join).
  const [existing] = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.match_id, match.id),
        eq(registrations.user_id, request.user.id)
      )
    )
    .limit(1);
  if (existing) {
    return reply.status(200).send({ match_id: match.id, registration: existing });
  }

  const [me] = await db
    .select({ display_name: users.display_name })
    .from(users)
    .where(eq(users.id, request.user.id))
    .limit(1);

  const [registration] = await db
    .insert(registrations)
    .values({
      match_id: match.id,
      user_id: request.user.id,
      shooter_name: me?.display_name ?? 'Shooter',
      division: parsed.data.division,
      power_factor: powerFactor,
    })
    .returning();

  return reply.status(201).send({ match_id: match.id, registration });
}

export async function updateMatch(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  // Check authorization — a match admin, the global admin, or the private
  // match's host.
  const isAdmin = await isMatchAdmin(id, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');
  const isHost = await isMatchHost(id, request.user.id);

  if (!isAdmin && !isGlobalAdmin && !isHost) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to update this match',
    });
  }

  // A host who is not also an admin gets the restricted schema: they can't
  // make the match public, change its level/organization, or archive it.
  const hostOnly = isHost && !isAdmin && !isGlobalAdmin;
  const parsed = (hostOnly ? hostUpdateMatchSchema : updateMatchSchema).safeParse(
    request.body
  );
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const [updated] = await db
    .update(matches)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(matches.id, id))
    .returning();

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Match not found',
    });
  }

  return reply.send(updated);
}

export async function deleteMatch(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  // Check authorization — a match admin, the global admin, or the private
  // match's host.
  const isAdmin = await isMatchAdmin(id, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');
  const isHost = await isMatchHost(id, request.user.id);

  if (!isAdmin && !isGlobalAdmin && !isHost) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to delete this match',
    });
  }

  const [deleted] = await db
    .delete(matches)
    .where(eq(matches.id, id))
    .returning();

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Match not found',
    });
  }

  return reply.status(204).send();
}

export async function assignOfficer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const isAdmin = await isMatchAdmin(id, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');
  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to manage officers for this match',
    });
  }

  const body = request.body as Record<string, unknown>;
  const role = body.role as string;

  // Determine if this is a match-level or stage-level role
  const isMatchLevel = (MATCH_LEVEL_OFFICIAL_ROLES as readonly string[]).includes(role);

  if (isMatchLevel) {
    const parsed = assignMatchOfficerSchema.safeParse(body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { user_id, role: officerRole } = parsed.data;

    // Upsert match officer with role
    await db
      .insert(matchOfficers)
      .values({ match_id: id, user_id, role: officerRole })
      .onConflictDoNothing();

    // Update role if already exists
    await db
      .update(matchOfficers)
      .set({ role: officerRole })
      .where(
        and(eq(matchOfficers.match_id, id), eq(matchOfficers.user_id, user_id))
      );

    // If assigning as MA, also add to matchAdmins for permission checks
    if (officerRole === 'MA') {
      await db
        .insert(matchAdmins)
        .values({ match_id: id, user_id })
        .onConflictDoNothing();
    }

    return reply.status(201).send({ message: `${officerRole} assigned` });
  } else {
    const parsed = assignStageOfficerSchema.safeParse(body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { user_id, role: officerRole, stage_ids } = parsed.data;

    // Also add as match officer for sync purposes
    await db
      .insert(matchOfficers)
      .values({ match_id: id, user_id, role: officerRole })
      .onConflictDoNothing();

    // Remove existing stage assignments for this officer+role in this match
    await db
      .delete(stageOfficers)
      .where(
        and(
          eq(stageOfficers.match_id, id),
          eq(stageOfficers.user_id, user_id),
          eq(stageOfficers.role, officerRole),
        )
      );

    // Insert new stage assignments with role
    await db.insert(stageOfficers).values(
      stage_ids.map((stage_id) => ({
        match_id: id,
        stage_id,
        user_id,
        role: officerRole,
      })),
    );

    return reply.status(201).send({ message: `${officerRole} assigned to ${stage_ids.length} stage(s)` });
  }
}

export async function listOfficers(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  // Match-level officials (MA, MM, ACMO, CSPO, SPO, CO, LO)
  const officers = await db
    .select({
      id: matchOfficers.id,
      match_id: matchOfficers.match_id,
      user_id: matchOfficers.user_id,
      role: matchOfficers.role,
      display_name: users.display_name,
      email: users.email,
    })
    .from(matchOfficers)
    .innerJoin(users, eq(matchOfficers.user_id, users.id))
    .where(eq(matchOfficers.match_id, id));

  // Stage-level assignments (SCMO, MO)
  const stageAssignments = await db
    .select({
      id: stageOfficers.id,
      match_id: stageOfficers.match_id,
      stage_id: stageOfficers.stage_id,
      user_id: stageOfficers.user_id,
      role: stageOfficers.role,
      display_name: users.display_name,
      email: users.email,
    })
    .from(stageOfficers)
    .innerJoin(users, eq(stageOfficers.user_id, users.id))
    .where(eq(stageOfficers.match_id, id));

  return reply.send({ officers, stage_assignments: stageAssignments });
}

export async function removeOfficer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id, userId } = request.params as { id: string; userId: string };

  const isAdmin = await isMatchAdmin(id, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');
  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized',
    });
  }

  // Remove stage assignments first, then match officer
  await db
    .delete(stageOfficers)
    .where(
      and(eq(stageOfficers.match_id, id), eq(stageOfficers.user_id, userId))
    );

  await db
    .delete(matchOfficers)
    .where(
      and(eq(matchOfficers.match_id, id), eq(matchOfficers.user_id, userId))
    );

  return reply.status(204).send();
}

// ─── Registrations (admin manual add / remove) ──────────────────────────────

/**
 * Manually register a shooter into a match. Used to populate private matches
 * (which shooters can't self-discover) and to add walk-ins to any match.
 * Links an existing account when `user_id` is given; otherwise resolves or
 * creates an unclaimed shooter from the name (same identity model as import).
 */
export async function addRegistration(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId } = request.params as { id: string };

  const isAdmin =
    (await isMatchAdmin(matchId, request.user.id)) ||
    request.user.roles.includes('admin') ||
    (await isMatchHost(matchId, request.user.id));

  const parsed = addRegistrationSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }
  const { user_id, shooter_name, division, power_factor, member_number, classification } =
    parsed.data;

  const [match] = await db
    .select({
      organization: matches.organization,
      registration_open: matches.registration_open,
      is_private: matches.is_private,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Match not found',
    });
  }

  // Private matches are joined via the invite token (joinMatch), never by
  // self-registering here — only an admin or the host may add people directly.
  if (!canRegisterIntoMatch(match.is_private, isAdmin)) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'This match is private — join it with an invite link',
    });
  }

  // Non-admins may only self-register, and only while registration is open.
  // (Private matches are excluded above for non-admins; they join via the invite
  // token.) Admins can add anyone, any time.
  if (!isAdmin && !match.registration_open) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Registration is closed for this match',
    });
  }

  if (!isValidDivisionForOrg(match.organization as Organization, division)) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: `Division "${division}" is not offered by ${match.organization}`,
    });
  }

  // Resolve the shooter account. A non-admin can only register themselves. An
  // admin may pass an existing user_id, or omit it to resolve/create an
  // unclaimed shooter from the name (same identity model as import).
  let userId: string;
  if (!isAdmin) {
    userId = request.user.id;
  } else if (user_id) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, user_id))
      .limit(1);
    if (!u) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Shooter account not found',
      });
    }
    userId = u.id;
  } else {
    const norm = normalizeShooterName(shooter_name);
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.normalized_name, norm))
      .limit(1);
    if (existing) {
      userId = existing.id;
    } else {
      const [created] = await db
        .insert(users)
        .values({
          display_name: cleanDisplayName(shooter_name),
          normalized_name: norm,
          member_number: member_number ?? null,
          email: null,
          password_hash: null,
          claimed: false,
          roles: ['shooter'],
        })
        .returning({ id: users.id });
      userId = created.id;
    }
  }

  // A shooter can't be entered twice in the same division with the same member
  // number (matches the DB unique constraint).
  const [dupe] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.match_id, matchId),
        eq(registrations.user_id, userId),
        eq(registrations.division, division),
        member_number
          ? eq(registrations.member_number, member_number)
          : isNull(registrations.member_number)
      )
    )
    .limit(1);
  if (dupe) {
    return reply.status(409).send({
      statusCode: 409,
      error: 'Conflict',
      message: 'This shooter is already registered in that division',
    });
  }

  const [registration] = await db
    .insert(registrations)
    .values({
      match_id: matchId,
      user_id: userId,
      shooter_name: cleanDisplayName(shooter_name),
      member_number: member_number ?? null,
      division,
      power_factor,
      classification: classification ?? null,
    })
    .returning();

  return reply.status(201).send(registration);
}

/** Remove a registration (e.g. an accidentally-added shooter). Cascades to the
 * shooter's scores for this match. */
export async function removeRegistration(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, registrationId } = request.params as {
    id: string;
    registrationId: string;
  };

  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');
  const isHost = await isMatchHost(matchId, request.user.id);
  if (!isAdmin && !isGlobalAdmin && !isHost) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to remove shooters from this match',
    });
  }

  await db
    .delete(registrations)
    .where(
      and(
        eq(registrations.id, registrationId),
        eq(registrations.match_id, matchId)
      )
    );

  return reply.status(204).send();
}

/** Edit a registration (e.g. a host fixing a shooter's division / power factor).
 * Validates the division/PF combination and, if either changed, recomputes the
 * shooter's existing scores and marks the match for results recompute. */
export async function updateRegistration(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, registrationId } = request.params as {
    id: string;
    registrationId: string;
  };

  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');
  const isHost = await isMatchHost(matchId, request.user.id);
  if (!isAdmin && !isGlobalAdmin && !isHost) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to edit shooters in this match',
    });
  }

  const parsed = updateRegistrationSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const [reg] = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.id, registrationId),
        eq(registrations.match_id, matchId)
      )
    )
    .limit(1);
  if (!reg) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Registration not found',
    });
  }

  const [match] = await db
    .select({ organization: matches.organization })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  const newDivision = parsed.data.division ?? reg.division;
  const newPf = (parsed.data.power_factor ?? reg.power_factor) as PowerFactor;

  if (!isValidDivisionForOrg(match!.organization as Organization, newDivision)) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: `Division "${newDivision}" is not valid for ${match!.organization}.`,
    });
  }
  if (newPf === 'Major' && !divisionAllowsMajor(newDivision)) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: `Division "${newDivision}" is Minor only.`,
    });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.division !== undefined) patch.division = parsed.data.division;
  if (parsed.data.power_factor !== undefined) patch.power_factor = parsed.data.power_factor;
  if (parsed.data.member_number !== undefined) patch.member_number = parsed.data.member_number;
  if (parsed.data.classification !== undefined) patch.classification = parsed.data.classification;

  const [updated] = await db
    .update(registrations)
    .set(patch)
    .where(eq(registrations.id, registrationId))
    .returning();

  // If division or PF changed, keep this shooter's already-entered scores in
  // sync (division + PF are snapshotted onto each score and drive the points),
  // then flag the match so standings recompute.
  const divChanged = parsed.data.division !== undefined && parsed.data.division !== reg.division;
  const pfChanged = parsed.data.power_factor !== undefined && parsed.data.power_factor !== reg.power_factor;
  if (divChanged || pfChanged) {
    const scoreRows = await db
      .select()
      .from(scores)
      .where(eq(scores.registration_id, registrationId));
    for (const s of scoreRows) {
      const [stage] = await db
        .select({ scoring_type: stages.scoring_type })
        .from(stages)
        .where(eq(stages.id, s.stage_id))
        .limit(1);
      const computed = computeScore(
        {
          alpha_count: s.alpha_count,
          charlie_count: s.charlie_count,
          delta_count: s.delta_count,
          miss_count: s.miss_count,
          no_shoot_count: s.no_shoot_count,
          procedural_count: s.procedural_count,
          steel_hits: s.steel_hits,
          steel_misses: s.steel_misses,
          time: Number(s.time),
          power_factor: newPf,
          dqed: s.dqed,
          dnf: s.dnf,
        },
        (stage?.scoring_type ?? 'comstock') as ScoringType
      );
      await db
        .update(scores)
        .set({
          division: newDivision,
          power_factor: newPf,
          raw_points: computed.raw_points,
          penalty_points: computed.penalty_points,
          total_points: computed.total_points,
          hit_factor: computed.hit_factor.toString(),
          modified_at: new Date(),
          modified_by: request.user.id,
        })
        .where(eq(scores.id, s.id));
    }
    const now = new Date();
    await db
      .insert(matchRecomputeState)
      .values({ match_id: matchId, scores_changed_at: now })
      .onConflictDoUpdate({
        target: matchRecomputeState.match_id,
        set: { scores_changed_at: now },
      });
  }

  return reply.send(updated);
}
