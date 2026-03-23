const { z } = require("zod");

const typeMixSchema = z.object({
  mcq: z.number().min(0).max(100).optional(),
  trueFalse: z.number().min(0).max(100).optional(),
  caseStudy: z.number().min(0).max(100).optional()
});

const negativeMarkingSchema = z.object({
  enabled: z.boolean().optional(),
  value: z.number().min(0).max(1).optional()
});

const generateExamSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
  questionCount: z.number().int().min(5).max(60).optional(),
  durationMin: z.number().int().min(10).max(240).optional(),
  typeMix: typeMixSchema.optional(),
  includeTopics: z.array(z.string().trim().min(1)).max(60).optional(),
  excludeTopics: z.array(z.string().trim().min(1)).max(60).optional(),
  negativeMarking: negativeMarkingSchema.optional()
});

const startExamSchema = z.object({
  examId: z.string().trim().min(1)
});

const attemptResponseSchema = z.object({
  questionId: z.string().trim().min(1),
  selectedOptionIndex: z.number().int().min(0).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  timeSpentSec: z.number().min(0).optional()
});

const proctoringLogSchema = z.object({
  type: z.string().trim().min(1),
  timestamp: z.string().datetime().optional(),
  details: z.record(z.any()).optional()
});

const saveExamSchema = z.object({
  attemptId: z.string().trim().min(1),
  responses: z.array(attemptResponseSchema).optional(),
  elapsedSec: z.number().int().min(0).optional()
});

const submitExamSchema = z.object({
  attemptId: z.string().trim().min(1),
  responses: z.array(attemptResponseSchema).optional(),
  elapsedSec: z.number().int().min(0).optional(),
  proctoringLogs: z.array(proctoringLogSchema).max(500).optional()
});

const resultParamsSchema = z.object({
  attemptId: z.string().trim().min(1)
});

const testHistoryQuerySchema = z.object({
  topicId: z.string().length(24).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

module.exports = {
  generateExamSchema,
  startExamSchema,
  saveExamSchema,
  submitExamSchema,
  resultParamsSchema,
  testHistoryQuerySchema
};
