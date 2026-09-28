// Defensive deduplication for legacy imports; the live schema already enforces
// one LearningSignal per student/course/lesson. Never return student identities.
function latestStudentSignals(signals) {
  const latest = new Map();
  const time = signal => new Date(signal.aiPrediction?.predictedAt || signal.updatedAt || 0).getTime() || 0;
  for (const signal of signals) {
    if (!signal.student) continue;
    const key = `${signal.course}:${signal.lessonId}:${signal.student}`;
    if (!latest.has(key) || time(signal) > time(latest.get(key))) latest.set(key, signal);
  }
  return [...latest.values()];
}
function lessonBehavior(signals) {
  const cohort = latestStudentSignals(signals);
  const metrics = {};
  for (const field of ['pauseCount', 'replayCount', 'activeTimeSeconds', 'visitCount']) {
    const values = cohort.map(s => s[field]).filter(value => Number.isSafeInteger(value) && value >= 0);
    metrics[field] = { total: values.length >= 5 ? values.reduce((sum, value) => sum + value, 0) : null, studentCount: values.length };
  }
  return { cohortStudents: cohort.length, metrics };
}
module.exports = { latestStudentSignals, lessonBehavior };
