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

module.exports = {
  contractKey: "tests.generate.v1",
  outputType: "tests.questions",
  schemaVersion: "1.0.0",
  payloadSchema: testGenerationPayloadSchema,
  buildPrompts: () => {
    throw new Error("Test generation contract prompts are not wired yet");
  }
};
