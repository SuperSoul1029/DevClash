const { z } = require("zod");

const testGenerationPayloadSchema = z.object({
  questions: z.array(
    z.object({
      topicId: z.string().min(1),
      type: z.enum(["mcq", "trueFalse", "caseStudy"]),
      difficulty: z.enum(["easy", "medium", "hard"]),
      prompt: z.string().min(12).max(420),
      options: z.array(z.string().min(1).max(220)).min(2).max(4),
      correctOptionIndex: z.number().int().min(0).max(3),
      explanation: z.string().min(12).max(500),
      marks: z.number().min(0.5).max(4).optional()
    })
  )
});

function buildTestGenerationPrompts({ settings, requestedQuestionCount, requiredTypeOrder, requiredTypeCounts, negativeMarksPerWrong, allowedTopics }) {
  const systemPrompt = [
    "You are an exam item writer for class 11/12 competitive prep.",
    "Generate fresh, pedagogically valid questions in strict JSON envelope format.",
    "Use only provided topicIds and return objective items with options and correctOptionIndex.",
    "Avoid ambiguous wording and keep explanations concise but useful.",
    "Return only a JSON object with keys: outputType, schemaVersion, payload, meta."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate custom exam questions",
      settings,
      requestedQuestionCount,
      requiredTypeOrder,
      requiredTypeCounts,
      negativeMarksPerWrong,
      allowedTopics,
      outputRules: {
        envelope: {
          outputType: "tests.questions",
          schemaVersion: "1.0.0",
          payloadShape: {
            questions: [
              {
                topicId: "string",
                type: "mcq|trueFalse|caseStudy",
                difficulty: "easy|medium|hard",
                prompt: "string",
                options: ["string"],
                correctOptionIndex: "number",
                explanation: "string",
                marks: "number"
              }
            ]
          },
          metaShape: {
            notes: "optional string",
            confidence: "optional 0..1 number"
          }
        },
        forTrueFalseOptionsMustBe: ["True", "False"],
        optionsCountRule: {
          mcq: 4,
          caseStudy: 4,
          trueFalse: 2
        },
        mustUseOnlyProvidedTopicIds: true
      }
    },
    null,
    2
  );

  return { systemPrompt, userPrompt };
}

module.exports = {
  contractKey: "tests.generate.v1",
  outputType: "tests.questions",
  schemaVersion: "1.0.0",
  family: "tests",
  description: "Generate custom exam question sets with blueprint constraints",
  lifecycle: {
    stage: "active",
    introducedAt: "2026-03-23"
  },
  routing: {
    policy: "quality"
  },
  payloadSchema: testGenerationPayloadSchema,
  buildPrompts: buildTestGenerationPrompts
};
