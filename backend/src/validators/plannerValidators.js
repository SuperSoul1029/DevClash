const { z } = require("zod");

const dailyPlanQuerySchema = z.object({
  date: z.string().datetime().optional(),
  regenerate: z.enum(["true", "false"]).optional()
});

const weeklyPlanQuerySchema = z.object({
  date: z.string().datetime().optional()
});

const generateWeeklyPlanSchema = z.object({
  weekStart: z.string().datetime().optional(),
  selectedTopicIds: z.array(z.string().min(1)).max(60).optional().default([]),
  regenerate: z.boolean().optional().default(false)
});

const updatePlannerTaskStatusSchema = z.object({
  status: z.enum(["todo", "completed", "skipped"])
});

const rebalancePlanSchema = z.object({
  date: z.string().datetime().optional()
});

const customPlanTopicSchema = z.object({
  topicId: z.string().min(1),
  intent: z.enum(["cover", "revise"]),
  familiarity: z.enum(["new", "basic", "strong"]),
  preferredDate: z.string().datetime().optional()
});

const generateCustomPlanSchema = z.object({
  goalText: z.string().trim().min(5).max(300),
  timeframeDays: z.number().int().min(1).max(30),
  selectedTopics: z.array(customPlanTopicSchema).min(1).max(30)
});

module.exports = {
  dailyPlanQuerySchema,
  weeklyPlanQuerySchema,
  generateWeeklyPlanSchema,
  updatePlannerTaskStatusSchema,
  rebalancePlanSchema,
  generateCustomPlanSchema
};
