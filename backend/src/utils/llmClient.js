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

function truncateText(value, maxLength = 1200) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function withRawOutput(error, rawOutput) {
  if (rawOutput) {
    error.llmRawOutput = truncateText(rawOutput);
  }
  return error;
}

function shouldRetryWithoutSystemPrompt(status, details) {
  const code = Number(status);
  if (code !== 400) {
    return false;
  }

  const text = String(details || "").toLowerCase();
  return (
    text.includes("developer instruction is not enabled") ||
    text.includes("system instruction is not enabled") ||
    text.includes("unsupported value: 'system'")
  );
}

function buildUserOnlyPrompt(systemPrompt, userPrompt) {
  return [
    "Follow these instructions strictly:",
    String(systemPrompt || "").trim(),
    "",
    "Task input:",
    String(userPrompt || "").trim()
  ]
    .filter(Boolean)
    .join("\n");
}

function contentToText(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        if (part && typeof part.content === "string") {
          return part.content;
        }
        if (part && typeof part.output_text === "string") {
          return part.output_text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content === "object") {
    if (typeof content.text === "string") {
      return content.text;
    }
    if (typeof content.content === "string") {
      return content.content;
    }
    return JSON.stringify(content);
  }

  return "";
}

function findBalancedJsonSlices(text) {
  const slices = [];
  const stack = [];
  let start = -1;
  let inString = false;
  let escape = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === "{" || ch === "[") {
      if (stack.length === 0) {
        start = index;
      }
      stack.push(ch === "{" ? "}" : "]");
      continue;
    }

    if (stack.length > 0 && ch === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0 && start >= 0) {
        slices.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return slices;
}

function extractJsonCandidates(content) {
  const text = contentToText(content).trim();
  if (!text) {
    return [];
  }

  const candidates = [];
  const seen = new Set();

  const pushCandidate = (value) => {
    if (!value) {
      return;
    }

    const candidate = String(value).trim();
    if (!candidate || seen.has(candidate)) {
      return;
    }

    seen.add(candidate);
    candidates.push(candidate);
  };

  if (text.startsWith("{") || text.startsWith("[")) {
    pushCandidate(text);
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    pushCandidate(fencedMatch[1]);
  }

  const slices = findBalancedJsonSlices(text).sort((left, right) => right.length - left.length);
  slices.forEach(pushCandidate);

  pushCandidate(text);
  return candidates;
}

function extractJsonString(content) {
  const candidates = extractJsonCandidates(content);
  for (const candidate of candidates) {
    if (safeJsonParse(candidate)) {
      return candidate;
    }
  }

  return contentToText(content).trim();
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
    if (shouldRetryWithoutSystemPrompt(response.status, details)) {
      const fallbackBody = {
        ...body,
        messages: [{ role: "user", content: buildUserOnlyPrompt(systemPrompt, userPrompt) }]
      };

      response = await globalThis.fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(fallbackBody),
        signal: controller.signal
      });
    } else {
      throw withRawOutput(
        new Error(`LLM request failed (${response.status}): ${details.slice(0, 500)}`),
        details
      );
    }
  }

  if (!response.ok) {
    const details = await response.text();
    throw withRawOutput(
      new Error(`LLM request failed (${response.status}): ${details.slice(0, 500)}`),
      details
    );
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const content = message?.content ?? message?.tool_calls?.[0]?.function?.arguments;

  let parsed;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    parsed = content;
  } else {
    const jsonText = extractJsonString(content);
    parsed = safeJsonParse(jsonText);
  }

  if (!parsed || typeof parsed !== "object") {
    const contentSnippet = contentToText(content);
    const responseSnippet = truncateText(JSON.stringify(message || data || {}));
    throw withRawOutput(
      new Error("LLM did not return valid JSON content"),
      contentSnippet || responseSnippet
    );
  }

  return parsed;
}

function resolveLlmRequestConfig(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || env.llmBaseUrl);
  const isOpenRouter = isOpenRouterBaseUrl(baseUrl);

  const forceJsonMode =
    typeof options.forceJsonMode === "boolean" ? options.forceJsonMode : env.llmForceJsonMode;
  const shouldUseJsonMode = typeof forceJsonMode === "boolean" ? forceJsonMode : !isOpenRouter;

  const config = {
    endpoint: `${baseUrl}/chat/completions`,
    model: options.model || env.llmModel,
    apiKey: options.apiKey || env.llmApiKey,
    timeoutMs: Math.max(2000, Number(options.timeoutMs) || Number(env.llmTimeoutMs) || 45000),
    siteUrl: options.siteUrl || env.llmSiteUrl,
    appName: options.appName || env.llmAppName,
    reasoningEnabled:
      typeof options.reasoningEnabled === "boolean"
        ? options.reasoningEnabled
        : Boolean(env.llmReasoningEnabled),
    shouldUseJsonMode,
    isOpenRouter
  };

  return config;
}

async function requestLlmJsonWithOptions({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1600,
  options
}) {
  const config = resolveLlmRequestConfig(options);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`
  };

  if (config.isOpenRouter && config.siteUrl) {
    headers["HTTP-Referer"] = config.siteUrl;
  }
  if (config.isOpenRouter && config.appName) {
    headers["X-Title"] = config.appName;
  }

  const body = {
    model: config.model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  if (config.shouldUseJsonMode) {
    body.response_format = { type: "json_object" };
  }

  if (config.reasoningEnabled) {
    body.reasoning = { enabled: true };
  }

  const controller = new globalThis.AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), config.timeoutMs);

  let response;
  try {
    response = await globalThis.fetch(config.endpoint, {
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
    if (shouldRetryWithoutSystemPrompt(response.status, details)) {
      const fallbackBody = {
        ...body,
        messages: [{ role: "user", content: buildUserOnlyPrompt(systemPrompt, userPrompt) }]
      };

      response = await globalThis.fetch(config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(fallbackBody),
        signal: controller.signal
      });
    } else {
      throw withRawOutput(
        new Error(`LLM request failed (${response.status}): ${details.slice(0, 500)}`),
        details
      );
    }
  }

  if (!response.ok) {
    const details = await response.text();
    throw withRawOutput(
      new Error(`LLM request failed (${response.status}): ${details.slice(0, 500)}`),
      details
    );
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const content = message?.content ?? message?.tool_calls?.[0]?.function?.arguments;

  let parsed;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    parsed = content;
  } else {
    const jsonText = extractJsonString(content);
    parsed = safeJsonParse(jsonText);
  }

  if (!parsed || typeof parsed !== "object") {
    const contentSnippet = contentToText(content);
    const responseSnippet = truncateText(JSON.stringify(message || data || {}));
    throw withRawOutput(
      new Error("LLM did not return valid JSON content"),
      contentSnippet || responseSnippet
    );
  }

  return parsed;
}

async function getStructuredLlmOutput({
  schema,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
  options
}) {
  if (!(schema instanceof z.ZodType)) {
    throw new Error("schema must be a Zod schema");
  }

  const raw = options
    ? await requestLlmJsonWithOptions({
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        options
      })
    : await requestLlmJson({ systemPrompt, userPrompt, temperature, maxTokens });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `${path}: ${issue.message}`;
      })
      .slice(0, 4)
      .join("; ");

    throw withRawOutput(
      new Error(`LLM response failed schema validation${summary ? ` (${summary})` : ""}`),
      JSON.stringify(raw)
    );
  }

  return parsed.data;
}

module.exports = {
  isLlmConfigured,
  getStructuredLlmOutput
};
