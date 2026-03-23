const { z } = require("zod");
const env = require("../config/env");

function isLlmConfigured() {
  return Boolean(env.llmApiKey && env.llmModel && env.llmBaseUrl);
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function isOpenRouterBaseUrl(baseUrl) {
  return /openrouter\.ai/i.test(String(baseUrl || ""));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function extractJsonString(content) {
  if (typeof content !== "string") {
    return "";
  }

  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function requestLlmJson({ systemPrompt, userPrompt, temperature = 0.2, maxTokens = 1600 }) {
  if (!isLlmConfigured()) {
    throw new Error("LLM is not configured");
  }

  const baseUrl = normalizeBaseUrl(env.llmBaseUrl);
  const endpoint = `${baseUrl}/chat/completions`;
  const isOpenRouter = isOpenRouterBaseUrl(baseUrl);
  const shouldUseJsonMode =
    typeof env.llmForceJsonMode === "boolean" ? env.llmForceJsonMode : !isOpenRouter;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.llmApiKey}`
  };

  if (isOpenRouter && env.llmSiteUrl) {
    headers["HTTP-Referer"] = env.llmSiteUrl;
  }
  if (isOpenRouter && env.llmAppName) {
    headers["X-Title"] = env.llmAppName;
  }

  const body = {
    model: env.llmModel,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  if (shouldUseJsonMode) {
    body.response_format = { type: "json_object" };
  }

  if (env.llmReasoningEnabled) {
    body.reasoning = { enabled: true };
  }

  const controller = new globalThis.AbortController();
  const timeoutMs = Math.max(2000, Number(env.llmTimeoutMs) || 45000);
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await globalThis.fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${details.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const jsonText = extractJsonString(content);
  const parsed = safeJsonParse(jsonText);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM did not return valid JSON content");
  }

  return parsed;
}

async function getStructuredLlmOutput({
  schema,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens
}) {
  if (!(schema instanceof z.ZodType)) {
    throw new Error("schema must be a Zod schema");
  }

  const raw = await requestLlmJson({ systemPrompt, userPrompt, temperature, maxTokens });
  return schema.parse(raw);
}

module.exports = {
  isLlmConfigured,
  getStructuredLlmOutput
};
