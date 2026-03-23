const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

function parseBoolean(value, defaultValue = false) {
  const raw = clean(value);
  if (raw === undefined || raw === null || raw === "") {
    return defaultValue;
  }

  const normalized = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseNullableBoolean(value) {
  const raw = clean(value);
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  return parseBoolean(raw, false);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/devclash",
  jwtSecret: process.env.JWT_SECRET || "devclash-local-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  redisUrl: process.env.REDIS_URL || "",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120),
  llmApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "",
  llmBaseUrl:
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://openrouter.ai/api/v1",
  llmModel: process.env.LLM_MODEL || "openai/gpt-4o-mini",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 45000),
  llmAppName: process.env.LLM_APP_NAME || "",
  llmSiteUrl: process.env.LLM_SITE_URL || "",
  llmReasoningEnabled: parseBoolean(process.env.LLM_REASONING_ENABLED, false),
  llmForceJsonMode: parseNullableBoolean(process.env.LLM_FORCE_JSON_MODE),
  llmGatewayMaxAttempts: Number(process.env.LLM_GATEWAY_MAX_ATTEMPTS || 2),
  llmGatewayRepairEnabled: parseBoolean(process.env.LLM_GATEWAY_REPAIR_ENABLED, true),
  llmGatewayEnableInTests: parseBoolean(process.env.LLM_GATEWAY_ENABLE_IN_TESTS, false),
  llmGatewayAllowDeprecatedContracts: parseBoolean(
    process.env.LLM_GATEWAY_ALLOW_DEPRECATED_CONTRACTS,
    false
  ),
  llmGatewayRouteFastModel: process.env.LLM_GATEWAY_ROUTE_FAST_MODEL || "",
  llmGatewayRouteBalancedModel: process.env.LLM_GATEWAY_ROUTE_BALANCED_MODEL || "",
  llmGatewayRouteQualityModel: process.env.LLM_GATEWAY_ROUTE_QUALITY_MODEL || "",
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "",
  openaiBaseUrl:
    process.env.OPENAI_BASE_URL ||
    process.env.LLM_BASE_URL ||
    "https://api.openai.com/v1",
  ragEmbeddingModel: process.env.RAG_EMBEDDING_MODEL || "text-embedding-3-small",
  ragChatModel: process.env.RAG_CHAT_MODEL || "gpt-4o-mini",
  ragVectorIndexName: process.env.RAG_VECTOR_INDEX_NAME || "knowledge_chunks_vector",
  ragTopK: Number(process.env.RAG_TOP_K || 4)
};

module.exports = env;
