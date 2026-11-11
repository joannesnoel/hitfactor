// Plain-language label + colour for a match status, shared by the shooter-facing
// screens (the raw values like "registration" / "scoring" read as jargon).
const LABELS: Record<string, string> = {
  draft: 'Not open yet',
  registration: 'Sign-up open',
  active: 'Live',
  scoring: 'Scoring',
  final: 'Finished',
  archived: 'Archived',
};

const COLORS: Record<string, string> = {
  draft: 'grey',
  registration: 'blue',
  active: 'green',
  scoring: 'orange',
  final: 'purple',
  archived: 'grey-7',
};

export function matchStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function matchStatusColor(status: string): string {
  return COLORS[status] ?? 'grey';
}

interface DatedMatch {
  start_date: string;
  end_date?: string | null;
  status: string;
}

/**
 * Whether a match belongs in the "happening now / coming up" group: it hasn't
 * finished by date (a multi-day match counts until its last day) and hasn't been
 * marked Finished or Archived. Everything else is history, whatever its status —
 * a long-past match left on "Scoring" must not outrank an upcoming one.
 */
export function isUpcomingMatch(m: DatedMatch, today: string): boolean {
  if (m.status === 'final' || m.status === 'archived') return false;
  return (m.end_date || m.start_date) >= today;
}

/** Upcoming first (soonest date first), then past (newest first). */
export function sortYourMatches<T extends DatedMatch>(matches: T[], today: string): T[] {
  const upcoming = matches
    .filter((m) => isUpcomingMatch(m, today))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = matches
    .filter((m) => !isUpcomingMatch(m, today))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return [...upcoming, ...past];
}
