// Use the same fields as ChallengeService.result(); do not silently turn missing data into zero.
export function formatChallengeSummary(challenge) {
  const triggered = challenge?.remaining_triggered;
  const pending = challenge?.remaining_needs_review;
  if (!Number.isInteger(triggered) || triggered < 0 || !Number.isInteger(pending) || pending < 0) {
    return "检查状态不完整，请重新计算；当前不能确认本关目标。";
  }
  const label = challenge.status === "goal_met" ? "本关布局目标已完成" : "本关布局目标尚未完成";
  return `${label}；仍有${triggered}项已触发、${pending}项待核查。未覆盖范围另见覆盖说明，不表示家庭安全。`;
}
