const { executeGatewayRequest, isGatewayConfigured } = require("../services/llmGateway");
const { logWarn } = require("./logger");

let transcriptFetcherPromise;

async function getTranscriptFetcher() {
  if (!transcriptFetcherPromise) {
    transcriptFetcherPromise = import("youtube-transcript/dist/youtube-transcript.esm.js")
      .then((moduleRef) => {
        if (typeof moduleRef.fetchTranscript === "function") {
          return moduleRef.fetchTranscript;
        }

        if (moduleRef.YoutubeTranscript?.fetchTranscript) {
          return moduleRef.YoutubeTranscript.fetchTranscript.bind(moduleRef.YoutubeTranscript);
        }

        throw new Error("youtube-transcript fetch API not found");
      })
      .catch((error) => {
        transcriptFetcherPromise = null;
        throw error;
      });
  }

  return transcriptFetcherPromise;
}

function extractVideoHandle(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return "learning-video";
    }

    if (segments[0] === "shorts" && segments[1]) {
      return segments[1];
    }

    return segments.at(-1) || "learning-video";
  } catch (_error) {
    return "learning-video";
  }
}

function buildFallbackPayload(videoHandle, reason = "Transcript quality was insufficient") {
  return {
    overview:
      "The source transcript could not be processed reliably, so this output uses a deterministic revision strategy to keep the learner moving.",
    bullets: [
      "Start with concept framing: identify definition, governing rule, and one solved example.",
      "Turn each major segment into a compact question-answer card and attempt active recall after each card.",
      "Run spaced checks at day 1, day 3, and day 7 to stabilize recall of formulas, assumptions, and exceptions.",
      "Finish with one timed medium problem and one hard transfer problem to validate understanding."
    ],
    keyConcepts: [
      "Concept decomposition",
      "Error-focused correction",
      "Spaced retrieval",
      "Transfer practice"
    ],
    revisionCards: [
      {
        title: `Fallback card: ${videoHandle}`,
        prompt: "What is the most testable idea from this lesson, and where does it fail?",
        answer: "State the idea, one boundary condition, and one exam-style application in under 30 seconds."
      }
    ],
    summary: `Fallback mode activated: ${String(reason).slice(0, 200)}.`,
    transcriptQuality: "low",
    fallbackUsed: true
  };
}

function normalizeTranscriptRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      if (!row) {
        return "";
      }

      if (typeof row === "string") {
        return row.trim();
      }

      if (typeof row.text === "string") {
        return row.text.trim();
      }

      return "";
    })
    .filter(Boolean);
}

function toWordCount(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildTranscriptExcerpt(segments) {
  const joined = segments.join(" ").replace(/\s+/g, " ").trim();
  const maxChars = 12000;
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
}

async function fetchTranscriptSegments(url, videoHandle) {
  const fetchTranscript = await getTranscriptFetcher();
  const candidates = [url, videoHandle].filter(Boolean);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const rows = await fetchTranscript(candidate);
      const normalized = normalizeTranscriptRows(rows);
      if (normalized.length > 0) {
        return normalized;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function generateYoutubeExplanation(url) {
  const videoHandle = extractVideoHandle(url);

  let transcriptSegments = [];
  try {
    transcriptSegments = await fetchTranscriptSegments(url, videoHandle);
  } catch (error) {
    logWarn("youtube.transcript.fetch_failed", {
      sourceUrl: url,
      videoHandle,
      message: error.message
    });
    return buildFallbackPayload(videoHandle, error.message);
  }

  const transcriptExcerpt = buildTranscriptExcerpt(transcriptSegments);
  const transcriptWordCount = toWordCount(transcriptExcerpt);
  const transcriptSegmentCount = transcriptSegments.length;

  if (!transcriptExcerpt || transcriptWordCount < 80) {
    return buildFallbackPayload(videoHandle, "Transcript was too short to derive reliable concepts");
  }

  if (!isGatewayConfigured()) {
    return buildFallbackPayload(videoHandle, "LLM Gateway is not configured");
  }

  const response = await executeGatewayRequest({
    contractKey: "media.youtube.explain.v1",
    input: {
      sourceUrl: url,
      videoHandle,
      transcriptWordCount,
      transcriptSegmentCount,
      transcriptExcerpt
    },
    temperature: 0.25,
    maxTokens: 2400
  });

  if (!response.ok || !response.data) {
    const reason = response.debug?.error?.message || "LLM Gateway YouTube generation failed";
    logWarn("youtube.llm.fallback", {
      sourceUrl: url,
      videoHandle,
      reason,
      status: response.status
    });
    return buildFallbackPayload(videoHandle, reason);
  }

  return {
    ...response.data,
    fallbackUsed: false
  };
}

module.exports = {
  generateYoutubeExplanation
};