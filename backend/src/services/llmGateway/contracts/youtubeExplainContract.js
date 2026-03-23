const { z } = require("zod");

const youtubeExplainerPayloadSchema = z.object({
  overview: z.string().min(20).max(800),
  bullets: z.array(z.string().min(8).max(260)).min(3).max(8),
  keyConcepts: z.array(z.string().min(2).max(90)).min(3).max(8),
  revisionCards: z
    .array(
      z.object({
        title: z.string().min(3).max(140),
        prompt: z.string().min(8).max(220),
        answer: z.string().min(8).max(260)
      })
    )
    .min(1)
    .max(5),
  summary: z.string().min(20).max(520),
  transcriptQuality: z.enum(["good", "medium", "low"])
});

function buildYoutubeExplainPrompts({ sourceUrl, videoHandle, transcriptWordCount, transcriptSegmentCount, transcriptExcerpt }) {
  const systemPrompt = [
    "You are an academic explainer for class 11/12 students.",
    "Read the provided YouTube transcript excerpt and generate structured revision output.",
    "Do not invent details that are unsupported by the transcript.",
    "Keep bullets concise, exam-oriented, and practical.",
    "Return only one JSON object with keys: outputType, schemaVersion, payload, meta."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate transcript-grounded YouTube explainer output",
      sourceUrl,
      videoHandle,
      transcript: {
        segmentCount: transcriptSegmentCount,
        wordCount: transcriptWordCount,
        excerpt: transcriptExcerpt
      },
      outputRules: {
        envelope: {
          outputType: "youtube.explainer",
          schemaVersion: "1.0.0",
          payloadShape: {
            overview: "string",
            bullets: ["string"],
            keyConcepts: ["string"],
            revisionCards: [
              {
                title: "string",
                prompt: "string",
                answer: "string"
              }
            ],
            summary: "string",
            transcriptQuality: "good|medium|low"
          },
          metaShape: {
            notes: "optional string",
            confidence: "optional 0..1 number"
          }
        },
        constraints: {
          bulletsRange: "3..8",
          keyConceptsRange: "3..8",
          revisionCardsRange: "1..5",
          noMarkdown: true,
          noCitationsArray: true
        }
      }
    },
    null,
    2
  );

  return { systemPrompt, userPrompt };
}

module.exports = {
  contractKey: "media.youtube.explain.v1",
  outputType: "youtube.explainer",
  schemaVersion: "1.0.0",
  family: "media",
  description: "Generate transcript-grounded YouTube explainer payload",
  lifecycle: {
    stage: "active",
    introducedAt: "2026-03-23"
  },
  routing: {
    policy: "balanced"
  },
  payloadSchema: youtubeExplainerPayloadSchema,
  buildPrompts: buildYoutubeExplainPrompts
};