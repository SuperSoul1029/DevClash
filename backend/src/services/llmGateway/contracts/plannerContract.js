const { z } = require("zod");

const plannerTaskPayloadSchema = z.object({
  tasks: z.array(
    z.object({
      topicId: z.string().min(1),
      title: z.string().min(3).max(140),
      taskType: z.enum(["review", "practice", "learn"]),
      priorityScore: z.number().min(0).max(100),
      estimatedMinutes: z.number().int().min(10).max(60),
      reason: z.string().min(5).max(220)
    })
  )
});

function buildPlannerPrompts({ dateISO, maxTasks, mode, rebalanceContext, candidates }) {
  const systemPrompt = [
    "You are an adaptive study planner for JEE/NEET style preparation.",
    "Generate a balanced one-day plan and return strict JSON in the required envelope.",
    "Use only the provided candidate topicIds.",
    "Prioritize weak retention, low coverage, recent incorrect outcomes, and overdue review windows.",
    "Keep reasoning concise and practical for a student.",
    "Return only a JSON object with keys: outputType, schemaVersion, payload, meta."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate daily planner tasks",
      dateISO,
      maxTasks,
      mode,
      rebalanceContext,
      outputRules: {
        envelope: {
          outputType: "planner.tasks",
          schemaVersion: "1.0.0",
          payloadShape: {
            tasks: [
              {
                topicId: "string",
                title: "string",
                taskType: "review|practice|learn",
                priorityScore: "0..100",
                estimatedMinutes: "10..60",
                reason: "string"
              }
            ]
          },
          metaShape: {
            notes: "optional string",
            confidence: "optional 0..1 number"
          }
        },
        mustUseOnlyProvidedTopicIds: true,
        uniqueTopics: true
      },
      candidates
    },
    null,
    2
  );

  return { systemPrompt, userPrompt };
}

module.exports = {
  contractKey: "planner.daily.tasks.v1",
  outputType: "planner.tasks",
  schemaVersion: "1.0.0",
  payloadSchema: plannerTaskPayloadSchema,
  buildPrompts: buildPlannerPrompts
};
