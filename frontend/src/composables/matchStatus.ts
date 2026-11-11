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
