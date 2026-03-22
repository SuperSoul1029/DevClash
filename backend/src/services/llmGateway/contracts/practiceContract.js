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

module.exports = {
  contractKey: "practice.nextset.v1",
  outputType: "practice.questions",
  schemaVersion: "1.0.0",
  payloadSchema: practiceSetPayloadSchema,
  buildPrompts: () => {
    throw new Error("Practice contract prompts are not wired yet");
  }
};
