function weekStartUTC(value = new Date()) {
  const date = new Date(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function weeklySeconds(signals, weekStart) {
  return signals.reduce((total, signal) => {
    const buckets = signal.activeTimeSecondsByWeek;
    const seconds = buckets instanceof Map ? buckets.get(weekStart) : buckets?.[weekStart];
    return total + (Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
  }, 0);
}

function summarizeWeeklyGoal(goalMinutes, signals, now = new Date()) {
  const weekStart = weekStartUTC(now);
  const weeklyGoalMinutes = Number.isInteger(goalMinutes) && goalMinutes > 0 ? goalMinutes : null;
  const learningSeconds = weeklySeconds(signals, weekStart);
  const learningMinutes = Math.floor(learningSeconds / 60);
  const remainingMinutes = weeklyGoalMinutes === null ? null : Math.max(Math.ceil((weeklyGoalMinutes * 60 - learningSeconds) / 60), 0);
  const completionPercentage = weeklyGoalMinutes === null ? 0 : Math.min(Math.round(learningSeconds / (weeklyGoalMinutes * 60) * 100), learningSeconds >= weeklyGoalMinutes * 60 ? 100 : 99);
  return {
    weekStart,
    weeklyGoalMinutes,
    learningSeconds,
    learningMinutes,
    remainingMinutes,
    completionPercentage,
    goalStatus: weeklyGoalMinutes === null ? "not_set" : learningSeconds >= weeklyGoalMinutes * 60 ? "completed" : "in_progress",
  };
}

module.exports = { weekStartUTC, summarizeWeeklyGoal };
