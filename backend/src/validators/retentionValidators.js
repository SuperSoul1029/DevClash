const { z } = require("zod");

const recordRetentionEventSchema = z.object({
  topicId: z.string().length(24),
  source: z.enum(["revision", "practice", "test", "planner_task", "manual"]),
  outcome: z.enum(["correct", "incorrect", "skipped", "completed"]),
  accuracy: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  timeSpentSec: z.number().min(0).optional(),
  occurredAt: z.string().datetime().optional()
});

const retentionStateQuerySchema = z.object({
  topicId: z.string().length(24).optional()
});

module.exports = {
  recordRetentionEventSchema,
  retentionStateQuerySchema
};
