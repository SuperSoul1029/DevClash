const { z } = require("zod");

const practiceSetPayloadSchema = z.object({
  questions: z.array(
    z.object({
      topicId: z.string().min(1),
      type: z.enum(["mcq", "trueFalse"]),
      prompt: z.string().min(10).max(320),
      options: z.array(z.string().min(1).max(180)).min(2).max(4),
      whyAssigned: z.string().min(8).max(220)
    })
  )
});

function buildPracticePrompts({ count, topics }) {
  const systemPrompt = [
    "You are an adaptive exam coach for class 11/12 students.",
    "Generate targeted remedial practice questions in strict JSON envelope format.",
    "Use only provided topicIds and avoid answer-key leakage.",
    "Return only a JSON object with keys: outputType, schemaVersion, payload, meta."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate adaptive practice set",
      count,
      topics,
      outputRules: {
        envelope: {
          outputType: "practice.questions",
          schemaVersion: "1.0.0",
          payloadShape: {
            questions: [
              {
                topicId: "string",
                type: "mcq|trueFalse",
                prompt: "string",
                options: ["string"],
                whyAssigned: "string"
              }
            ]
          },
          metaShape: {
            notes: "optional string",
            confidence: "optional 0..1 number"
          }
        },
        mustUseOnlyProvidedTopicIds: true,
        ifTypeTrueFalseRequireTwoOptions: ["True", "False"]
      }
    },
    null,
    2
  );

  return { systemPrompt, userPrompt };
}

module.exports = {
  contractKey: "practice.nextset.v1",
  outputType: "practice.questions",
  schemaVersion: "1.0.0",
  family: "practice",
  description: "Generate adaptive practice set aligned to weakest topics",
  lifecycle: {
    stage: "active",
    introducedAt: "2026-03-23"
  },
  routing: {
    policy: "fast"
  },
  payloadSchema: practiceSetPayloadSchema,
  buildPrompts: buildPracticePrompts
};
