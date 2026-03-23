const { z } = require("zod");

const syncCoverageActivitySchema = z.object({
  topicId: z.string().length(24),
  signalType: z.enum([
    "watched",
    "revision_done",
    "practice_correct",
    "practice_incorrect",
    "test_mastered",
    "test_failed"
  ])
});

const manualCoverageSchema = z.object({
  topicId: z.string().length(24)
});

const coverageStateQuerySchema = z.object({
  subjectId: z.string().length(24).optional(),
  classLevel: z.enum(["11", "12"]).optional()
});

module.exports = {
  syncCoverageActivitySchema,
  manualCoverageSchema,
  coverageStateQuerySchema
};
