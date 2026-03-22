const { z } = require("zod");

const practiceNextSetSchema = z.object({
  count: z.number().int().min(3).max(20).optional(),
  includeTopicIds: z.array(z.string().length(24)).max(60).optional(),
  excludeTopicIds: z.array(z.string().length(24)).max(60).optional(),
  includeTopics: z.array(z.string().trim().min(1)).max(60).optional(),
  excludeTopics: z.array(z.string().trim().min(1)).max(60).optional()
});

const practiceSubmitSchema = z
  .object({
    topicId: z.string().length(24),
    questionCount: z.number().int().min(1).max(50),
    attemptedCount: z.number().int().min(0).max(50),
    correctCount: z.number().int().min(0).max(50),
    totalTimeSec: z.number().min(0).max(7200).optional(),
    avgConfidence: z.number().min(0).max(1).optional()
  })
  .superRefine((value, ctx) => {
    if (value.attemptedCount > value.questionCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attemptedCount"],
        message: "Attempted count cannot exceed question count"
      });
    }

    if (value.correctCount > value.attemptedCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctCount"],
        message: "Correct count cannot exceed attempted count"
      });
    }
  });

module.exports = {
  practiceNextSetSchema,
  practiceSubmitSchema
};
