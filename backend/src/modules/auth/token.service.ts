import { randomBytes, createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { emailTokens } from '../../db/schema.js';

export type TokenPurpose = 'verify' | 'reset';

export const TOKEN_TTL: Record<TokenPurpose, number> = {
  verify: 24 * 60 * 60 * 1000, // 24h
  reset: 60 * 60 * 1000, // 1h
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a single-use token for a user + purpose. Stores only the sha256 hash;
 * returns the plaintext to email. Any prior unused tokens of the same purpose
 * for the user are invalidated (consumed) so only the newest link works.
 */
export async function createToken(
  userId: string,
  purpose: TokenPurpose
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db
    .update(emailTokens)
    .set({ used_at: new Date() })
    .where(
      and(
        eq(emailTokens.user_id, userId),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.used_at)
      )
    );
  await db.insert(emailTokens).values({
    user_id: userId,
    purpose,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + TOKEN_TTL[purpose]),
  });
  return token;
}

/**
 * Validate + consume a token. Returns the user id if the token is unused,
 * unexpired, and matches the purpose; otherwise null. Marks it used.
 */
export async function consumeToken(
  purpose: TokenPurpose,
  token: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: emailTokens.id, user_id: emailTokens.user_id })
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.token_hash, hashToken(token)),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.used_at),
        gt(emailTokens.expires_at, new Date())
      )
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(emailTokens)
    .set({ used_at: new Date() })
    .where(eq(emailTokens.id, row.id));
  return row.user_id;
}
