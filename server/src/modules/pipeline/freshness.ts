/** Freshness rules (design §4.1): expire after 2 missed polls, or past a
 * deadline. Age alone never expires a job — there is no blanket 30-day rule. */
export function shouldExpire(input: { missedPolls: number; deadlineAt: Date | null; now: Date }): { expire: boolean; reason: string | null } {
  if (input.deadlineAt && input.deadlineAt.getTime() < input.now.getTime()) return { expire: true, reason: 'deadline_passed' };
  if (input.missedPolls >= 2) return { expire: true, reason: 'missing_from_source_feed_2_polls' };
  return { expire: false, reason: null };
}
