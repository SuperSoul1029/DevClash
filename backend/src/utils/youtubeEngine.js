const { z } = require("zod");
const { getStructuredLlmOutput } = require("./llmClient");
const { logError, logInfo } = require("./logger");

function extractVideoHandle(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).at(-1) || "learning-video";
  } catch (_error) {
    return "learning-video";
  }
}

function buildFallbackPayload(videoHandle, reason) {
  return {
    overview:
      "The source transcript quality was low, so this summary uses reliable fallback guidance focused on revision strategy and core concept clarity.",
    bullets: [
      "Start with concept framing: identify the core definition, governing law, and one worked example.",
      "Convert every major segment into a 2-line revision card with a trigger question and compact answer.",
      "Use spaced checkpoints at 1 day, 3 days, and 7 days to stabilize memory for key formulas and exceptions.",
      "Re-attempt one medium and one hard problem after revision to verify transfer, not just recall."
    ],
    keyConcepts: [
      "Concept decomposition",
      "Error-driven revision",
      "Spaced retrieval",
      "Application transfer"
    ],
    revisionCards: [
      {
        title: `Fallback card: ${videoHandle}`,
        prompt: "What is the single most testable concept from this lesson?",
        answer: "State the concept, a boundary condition, and one application example in under 30 seconds."
      }
    ],
    summary:
      "Fallback mode produced a study-ready abstraction because transcript confidence was insufficient for high-fidelity extraction.",
    transcriptQuality: "low",
    fallbackReason: reason || "Transcript quality was too low for reliable extraction.",
    fallbackUsed: true
  };
}

function buildStandardPayload(videoHandle, reason) {
  return {
    overview:
      "This lesson explains a core exam concept through intuition first, then applies it through worked scenarios and common pitfalls.",
    bullets: [
      `The lesson around ${videoHandle} starts by defining core terms and constraints before introducing derivations.`,
      "It contrasts a correct reasoning path with a frequent shortcut mistake that causes score loss under timed conditions.",
      "A practical problem-solving template is provided: identify givens, choose principle, solve, and validate units/logic.",
      "The closing section emphasizes retention through active recall prompts and mixed-difficulty practice."
    ],
    keyConcepts: ["Core principle", "Boundary conditions", "Worked example", "Common trap"],
    revisionCards: [
      {
        title: `Concept lens: ${videoHandle}`,
        prompt: "How would you explain this topic to a junior student in 20 seconds?",
        answer: "Define the principle, provide one direct example, and name one trap to avoid."
      },
      {
        title: "Exam transfer",
        prompt: "What changes when the question adds a new constraint?",
        answer: "Re-check assumptions first, then update formula/approach and test with a quick sanity check."
      }
    ],
    summary:
      "The video is best used as concept setup plus guided application, then reinforced using spaced short-form recall.",
    transcriptQuality: "unknown",
    fallbackReason: reason || "Live transcript extraction is not wired in this build; deterministic template output was used.",
    fallbackUsed: true
  };
}

const youtubeExplainerSchema = z.object({
  overview: z.string(),
  bullets: z.array(z.string()),
  keyConcepts: z.array(z.string()),
  revisionCards: z.array(
    z.object({
      title: z.string(),
      prompt: z.string(),
      answer: z.string()
    })
  ),
  summary: z.string()
});

async function generateYoutubeExplanation(url) {
  const videoHandle = extractVideoHandle(url);
  const normalized = String(url || "").toLowerCase();

  // Fallback Situation 1: Emulating a transcript failure
  if (normalized.includes("force-error")) {
    throw new Error("Transcript extraction failed for the source URL (forced error for debugging)");
  }

  // Fallback Situation 2: Emulating a low-quality transcript
  if (normalized.includes("low-quality") || normalized.includes("fallback")) {
    return buildFallbackPayload(videoHandle, "[DEBUG] Expected Fallback: URL triggered 'low-quality' or 'fallback' simulation.");
  }

  let transcriptFragments = [];
  try {
    const { YoutubeTranscript } = await import("youtube-transcript/dist/youtube-transcript.esm.js");
    const rawTranscript = await YoutubeTranscript.fetchTranscript(url);
    if (!rawTranscript || rawTranscript.length === 0) {
      throw new Error("Transcript returned empty");
    }
    // Limit to the first ~400 fragments to avoid huge token limit issues for now
    transcriptFragments = rawTranscript.slice(0, 400).map((t) => t.text);
  } catch (error) {
    logError("youtubeEngine.transcript_fetch_failed", { url, message: error.message });
    return buildStandardPayload(
      videoHandle,
      `[DEBUG] Fetching real transcript failed: ${error.message}. Returning fallback.`
    );
  }

  const transcriptText = transcriptFragments.join(" ");
  if (transcriptText.length < 50) {
    return buildFallbackPayload(videoHandle, "[DEBUG] Live transcript was too brief/low-quality for reliable extraction.");
  }

  const systemPrompt = `You are an expert learning assistant. Given a video transcript, you must extract its key concepts and create a study guide.
Your output must be structured exactly as requested in JSON format.
The output should contain:
- overview: A 1-2 sentence plain-English summary.
- bullets: 3-5 concise, detailed bullet points outlining the video content.
- keyConcepts: 3-5 high-signal concept tags (short phrases).
- revisionCards: 2-3 active recall cards with 'title', 'prompt' (a trigger question), and 'answer' (compact).
- summary: A final 1 sentence conclusion on how best to use this material.`;
  
  const userPrompt = `Generate a study explainer based on the following YouTube transcript text:\n\n${transcriptText}`;

  try {
    logInfo("youtubeEngine.calling_llm", { videoHandle, maxTokensEstimate: transcriptText.length });
    const aiResult = await getStructuredLlmOutput({
      schema: youtubeExplainerSchema,
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 1600
    });

    return {
      ...aiResult,
      transcriptQuality: "high",
      fallbackReason: null,
      fallbackUsed: false
    };
  } catch (error) {
    logError("youtubeEngine.llm_generation_failed", { videoHandle, message: error.message });
    return buildStandardPayload(
      videoHandle,
      `[DEBUG] LLM generation from real transcript failed: ${error.message}. Returning fallback.`
    );
  }
}

module.exports = {
  generateYoutubeExplanation
};