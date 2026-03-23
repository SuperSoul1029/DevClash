const MS_IN_DAY = 24 * 60 * 60 * 1000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toStartOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function toEndOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function computeCoverageStatus(manualCoverage, autoCoverageScore) {
  if (manualCoverage === "covered") {
    return true;
  }
  if (manualCoverage === "uncovered") {
    return false;
  }
  return autoCoverageScore >= 0.6;
}

function computeRetentionUpdate(progress, event) {
  const previousScore = progress?.retentionScore ?? 35;
  const previousStreak = progress?.streak ?? 0;
  const totalReviews = (progress?.totalReviews ?? 0) + 1;

  const confidenceInput = Number.isFinite(event.confidence) ? event.confidence : 0.6;
  const confidence = clamp(confidenceInput, 0, 1);

  const qualityByOutcome = {
    correct: 1,
    completed: 0.8,
    skipped: 0.35,
    incorrect: 0.15
  };

  const quality = qualityByOutcome[event.outcome] ?? 0.4;
  const weightedDelta = Math.round(30 * quality + 10 * (confidence - 0.5));
  const retentionScore = clamp(Math.round(previousScore * 0.7 + weightedDelta), 0, 100);

  const streak = event.outcome === "correct" || event.outcome === "completed" ? previousStreak + 1 : 0;
  const intervalDays = clamp(Math.round(retentionScore / 15) + streak, 1, 30);

  const nextReviewAt = new Date((event.occurredAt || new Date()).getTime() + intervalDays * MS_IN_DAY);

  const totalCorrect =
    (progress?.totalCorrect ?? 0) + (event.outcome === "correct" || event.outcome === "completed" ? 1 : 0);
  const totalIncorrect = (progress?.totalIncorrect ?? 0) + (event.outcome === "incorrect" ? 1 : 0);

  let autoCoverageScore = progress?.autoCoverageScore ?? 0;
  if (event.outcome === "correct" || event.outcome === "completed") {
    autoCoverageScore = clamp(autoCoverageScore + 0.15, 0, 1);
  } else if (event.outcome === "incorrect") {
    autoCoverageScore = clamp(autoCoverageScore - 0.08, 0, 1);
  } else {
    autoCoverageScore = clamp(autoCoverageScore - 0.03, 0, 1);
  }

  return {
    retentionScore,
    streak,
    totalReviews,
    totalCorrect,
    totalIncorrect,
    nextReviewAt,
    lastReviewedAt: event.occurredAt || new Date(),
    lastOutcome: event.outcome,
    autoCoverageScore
  };
}

function applyCoverageSignal(progress, signalType) {
  const deltaBySignal = {
    watched: 0.1,
    revision_done: 0.2,
    practice_correct: 0.18,
    practice_incorrect: -0.08,
    test_mastered: 0.25,
    test_failed: -0.12
  };

  const delta = deltaBySignal[signalType] ?? 0;
  const nextScore = clamp((progress?.autoCoverageScore ?? 0) + delta, 0, 1);
  return nextScore;
}

function computePlannerPriority(progress, date) {
  const retention = progress?.retentionScore ?? 35;
  const autoCoverage = progress?.autoCoverageScore ?? 0;
  const dueDate = progress?.nextReviewAt ? new Date(progress.nextReviewAt) : null;
  const dueNow = dueDate ? dueDate <= toEndOfDay(date) : true;

  let priorityScore = 20;
  if (dueNow) {
    priorityScore += 25;
  }

  priorityScore += Math.round(((100 - retention) / 100) * 40);
  priorityScore += Math.round((1 - autoCoverage) * 20);

  if (progress?.manualCoverage === "uncovered") {
    priorityScore += 20;
  }
  if (progress?.manualCoverage === "covered") {
    priorityScore -= 10;
  }

  return clamp(priorityScore, 0, 100);
}

function plannerReason(progress, priorityScore, date) {
  const reasons = [];
  const dueDate = progress?.nextReviewAt ? new Date(progress.nextReviewAt) : null;

  if (!dueDate || dueDate <= toEndOfDay(date)) {
    reasons.push("review due");
  }
  if ((progress?.retentionScore ?? 35) < 55) {
    reasons.push("low retention");
  }
  if ((progress?.autoCoverageScore ?? 0) < 0.6) {
    reasons.push("coverage gap");
  }
  if (progress?.manualCoverage === "uncovered") {
    reasons.push("manual unmark");
  }

  if (reasons.length === 0) {
    reasons.push("routine maintenance");
  }

  return `${reasons.join(", ")} (priority ${priorityScore})`;
}

module.exports = {
  clamp,
  toStartOfDay,
  toEndOfDay,
  computeCoverageStatus,
  computeRetentionUpdate,
  applyCoverageSignal,
  computePlannerPriority,
  plannerReason
};
