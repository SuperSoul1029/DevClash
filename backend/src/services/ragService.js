const crypto = require("crypto");
const env = require("../config/env");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const { logWarn } = require("../utils/logger");

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with"
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/-\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 2 && !STOPWORDS.has(token));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function overlapScore(text, queryTokens) {
  if (!text || queryTokens.length === 0) {
    return 0;
  }

  const haystack = String(text).toLowerCase();
  let score = 0;
  queryTokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += 1;
    }
  });

  return score / queryTokens.length;
}

function splitIntoChunks(text, { chunkChars = 1200, overlapChars = 220 } = {}) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const segments = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkChars);
    const slice = normalized.slice(cursor, end).trim();
    if (slice) {
      segments.push(slice);
    }

    if (end >= normalized.length) {
      break;
    }

    cursor = Math.max(0, end - overlapChars);
  }

  return segments;
}

function buildCitationLabel(chunk) {
  const source = chunk.sourceLabel || "Knowledge Base";
  const tail = chunk.chunkIndex !== undefined ? ` (chunk ${Number(chunk.chunkIndex) + 1})` : "";
  return `${source}${tail}`;
}

async function createEmbedding(text) {
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${env.openaiBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.ragEmbeddingModel,
      input: text
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Embedding API failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  return payload?.data?.[0]?.embedding || null;
}

async function tryVectorSearch(embedding, filters, topK) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return [];
  }

  const queryFilter = {};
  if (filters.classLevel) {
    queryFilter.classLevel = filters.classLevel;
  }
  if (filters.subject) {
    queryFilter.subject = { $regex: escapeRegExp(filters.subject), $options: "i" };
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: env.ragVectorIndexName,
        path: "embedding",
        queryVector: embedding,
        numCandidates: Math.max(topK * 8, 20),
        limit: topK,
        ...(Object.keys(queryFilter).length > 0 ? { filter: queryFilter } : {})
      }
    },
    {
      $project: {
        sourceType: 1,
        sourceId: 1,
        sourceLabel: 1,
        sourceUrl: 1,
        classLevel: 1,
        subject: 1,
        text: 1,
        chunkIndex: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ];

  return KnowledgeChunk.aggregate(pipeline);
}

async function lexicalChunkSearch(question, filters, topK) {
  const queryTokens = tokenize(question);

  const mongoFilter = {};
  if (filters.classLevel) {
    mongoFilter.classLevel = filters.classLevel;
  }
  if (filters.subject) {
    mongoFilter.subject = { $regex: escapeRegExp(filters.subject), $options: "i" };
  }

  const records = await KnowledgeChunk.find(mongoFilter)
    .select("sourceType sourceId sourceLabel sourceUrl classLevel subject text chunkIndex")
    .limit(220)
    .lean();

  return records
    .map((chunk) => ({
      ...chunk,
      score: overlapScore(chunk.text, queryTokens)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

async function curriculumFallback(question, filters, topK) {
  const topicQuery = {};
  if (filters.classLevel) {
    topicQuery.classLevel = filters.classLevel;
  }

  const subjectQuery = {};
  if (filters.subject) {
    subjectQuery.name = { $regex: escapeRegExp(filters.subject), $options: "i" };
  }
  if (filters.classLevel) {
    subjectQuery.classLevel = filters.classLevel;
  }

  const subjects = await Subject.find(subjectQuery).select("_id name").lean();
  if (subjects.length > 0) {
    topicQuery.subjectId = { $in: subjects.map((item) => item._id) };
  }

  const subjectMap = new Map(subjects.map((item) => [String(item._id), item.name]));
  const topics = await Topic.find(topicQuery).select("_id name chapter subjectId classLevel").limit(80).lean();
  const queryTokens = tokenize(question);

  return topics
    .map((topic) => {
      const topicText = `${topic.name} ${topic.chapter} ${subjectMap.get(String(topic.subjectId)) || ""}`;
      return {
        sourceType: "curriculum_topic",
        sourceId: String(topic._id),
        sourceLabel: `${subjectMap.get(String(topic.subjectId)) || "Subject"} - ${topic.chapter} - ${topic.name}`,
        sourceUrl: "",
        classLevel: topic.classLevel,
        subject: subjectMap.get(String(topic.subjectId)) || "",
        text: `Topic: ${topic.name}. Chapter: ${topic.chapter}. Subject: ${subjectMap.get(String(topic.subjectId)) || ""}.`,
        chunkIndex: 0,
        score: overlapScore(topicText, queryTokens)
      };
    })
    .filter((topic) => topic.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

function buildPrompt(question, chunks) {
  const context = chunks
    .map((chunk, index) => `Citation ${index + 1}: ${buildCitationLabel(chunk)}\n${chunk.text}`)
    .join("\n\n");

  return [
    "You are a grounded study tutor.",
    "Rules:",
    "1) Use only the supplied context.",
    "2) If context is insufficient, explicitly say so.",
    "3) Keep the answer concise and exam-focused.",
    "4) Reference claims using [citation N] markers.",
    "",
    `Student question: ${question}`,
    "",
    "Context:",
    context
  ].join("\n");
}

function splitSentences(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 35);
}

function summarizeChunkForQuestion(chunk, queryTokens) {
  const sentences = splitSentences(chunk.text || "");
  if (sentences.length === 0) {
    return "";
  }

  let bestSentence = "";
  let bestScore = -1;

  sentences.forEach((sentence) => {
    const score = overlapScore(sentence, queryTokens);
    const lengthPenalty = sentence.length > 260 ? 0.06 : 0;
    const finalScore = score - lengthPenalty;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestSentence = sentence;
    }
  });

  if (bestScore <= 0) {
    return "";
  }

  return bestSentence;
}

function deterministicAnswer(question, chunks) {
  const queryTokens = tokenize(question);
  const evidence = chunks
    .slice(0, 3)
    .map((chunk, index) => ({
      citation: index + 1,
      line: summarizeChunkForQuestion(chunk, queryTokens)
    }))
    .filter((item) => item.line);

  if (evidence.length === 0) {
    return "I found relevant chapter context, but I need a slightly more specific question (for example, definition, formula, or error-analysis type) to give a clean answer.";
  }

  const conceptLine = evidence[0].line;
  const supportLine = evidence[1]?.line || "Use the NCERT definition first, then solve one short numerical for retention.";
  const revisionLine =
    evidence[2]?.line || "Revise by writing one formula card and one unit/dimension check from this topic.";

  return [
    `Question: ${question}`,
    "",
    "Concept (from retrieved NCERT context):",
    `- ${conceptLine} [citation ${evidence[0].citation}]`,
    `- ${supportLine} [citation ${evidence[1]?.citation || evidence[0].citation}]`,
    "",
    "Quick revision step:",
    `- ${revisionLine} [citation ${evidence[2]?.citation || evidence[0].citation}]`
  ].join("\n");
}

async function generateGroundedAnswer(question, chunks) {
  if (!env.openaiApiKey) {
    return deterministicAnswer(question, chunks);
  }

  const response = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.ragChatModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return only grounded educational guidance." },
        { role: "user", content: buildPrompt(question, chunks) }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Tutor chat API failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return normalizeText(content) || deterministicAnswer(question, chunks);
}

async function generateBestEffortAnswer(question) {
  if (!env.openaiApiKey) {
    return null;
  }

  const response = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.ragChatModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a concise school tutor. Give clear conceptual explanation and one quick example. Do not invent citations."
        },
        {
          role: "user",
          content: `Question: ${question}`
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Tutor fallback API failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  return normalizeText(payload?.choices?.[0]?.message?.content || "");
}

async function retrieveKnowledge(question, filters = {}) {
  const topK = Number(filters.topK || env.ragTopK || 4);
  let chunks = [];

  const chunkCount = await KnowledgeChunk.estimatedDocumentCount();
  if (chunkCount > 0) {
    try {
      const embedding = await createEmbedding(question);
      if (embedding) {
        chunks = await tryVectorSearch(embedding, filters, topK);
      }
    } catch (error) {
      logWarn("rag.vector_search.unavailable", { message: error.message });
    }

    if (chunks.length === 0) {
      chunks = await lexicalChunkSearch(question, filters, topK);
    }
  }

  if (chunks.length === 0) {
    chunks = await curriculumFallback(question, filters, topK);
  }

  return chunks;
}

async function queryTutorWithRag({ question, classLevel, subject }) {
  const chunks = await retrieveKnowledge(question, { classLevel, subject });

  if (chunks.length === 0) {
    if (env.openaiApiKey) {
      try {
        const bestEffort = await generateBestEffortAnswer(question);
        if (bestEffort) {
          return {
            answer:
              `${bestEffort} Note: no direct match was found in your ingested knowledge base, so this is a best-effort tutor explanation.`,
            confidence: 0.45,
            abstained: false,
            citations: [
              {
                id: "citation-1",
                sourceType: "model_general",
                sourceId: "",
                label: "Model best-effort answer (no KB match)",
                sourceUrl: ""
              }
            ]
          };
        }
      } catch (error) {
        logWarn("rag.best_effort.fallback_failed", { message: error.message });
      }
    }

    return {
      answer:
        "I cannot confidently answer this from the available knowledge base. Please refine your query with chapter and class context.",
      confidence: 0.2,
      abstained: true,
      citations: []
    };
  }

  let answer;
  try {
    answer = await generateGroundedAnswer(question, chunks);
  } catch (error) {
    logWarn("rag.answer_generation.fallback", { message: error.message });
    answer = deterministicAnswer(question, chunks);
  }

  const citations = chunks.map((chunk, index) => ({
    id: `citation-${index + 1}`,
    sourceType: chunk.sourceType || "unknown",
    sourceId: String(chunk.sourceId || ""),
    label: buildCitationLabel(chunk),
    sourceUrl: chunk.sourceUrl || ""
  }));

  const avgScore =
    chunks.reduce((acc, chunk) => acc + Number(chunk.score || 0), 0) / Math.max(1, chunks.length);

  return {
    answer,
    confidence: Number(Math.min(0.95, Math.max(0.35, avgScore)).toFixed(2)),
    abstained: false,
    citations
  };
}

async function upsertKnowledgeFromText({
  text,
  sourceType = "text",
  sourceId = "",
  sourceLabel = "Knowledge Source",
  sourceUrl = "",
  classLevel = "",
  subject = "",
  tags = [],
  ingestBatch = ""
}) {
  const chunks = splitIntoChunks(text);
  if (chunks.length === 0) {
    return { inserted: 0, sourceId };
  }

  const safeSourceId = sourceId || crypto.createHash("sha1").update(`${sourceLabel}-${Date.now()}`).digest("hex");
  let inserted = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunkText = chunks[index];

    let embedding = [];
    try {
      const embedded = await createEmbedding(chunkText);
      if (Array.isArray(embedded)) {
        embedding = embedded;
      }
    } catch (error) {
      logWarn("rag.ingest.embedding_failed", {
        sourceLabel,
        chunkIndex: index,
        message: error.message
      });
    }

    await KnowledgeChunk.findOneAndUpdate(
      {
        sourceType,
        sourceId: safeSourceId,
        chunkIndex: index
      },
      {
        $set: {
          sourceLabel,
          sourceUrl,
          classLevel,
          subject,
          tags,
          text: chunkText,
          embedding,
          tokenCount: tokenize(chunkText).length,
          ingestBatch
        }
      },
      {
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    inserted += 1;
  }

  return { inserted, sourceId: safeSourceId };
}

module.exports = {
  queryTutorWithRag,
  upsertKnowledgeFromText
};
