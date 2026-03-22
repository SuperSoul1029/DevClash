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
  nodeEnv: clean(process.env.NODE_ENV) || "development",
  port: Number(clean(process.env.PORT) || 5000),
  mongoUri:
    clean(process.env.MONGO_URI) ||
    clean(process.env.MONGODB_URI) ||
    "mongodb://127.0.0.1:27017/devclash",
  jwtSecret: clean(process.env.JWT_SECRET) || "devclash-local-secret",
  jwtExpiresIn: clean(process.env.JWT_EXPIRES_IN) || "7d",
  llmApiKey: clean(process.env.LLM_API_KEY) || "",
  llmBaseUrl: clean(process.env.LLM_BASE_URL) || "https://api.openai.com/v1",
  llmModel: clean(process.env.LLM_MODEL) || "gpt-4o-mini",
  llmTimeoutMs: Number(clean(process.env.LLM_TIMEOUT_MS) || 45000),
  llmAppName: clean(process.env.LLM_APP_NAME) || "DevClash AI Retention",
  llmSiteUrl: clean(process.env.LLM_SITE_URL) || "",
  llmReasoningEnabled: parseBoolean(process.env.LLM_REASONING_ENABLED, false),
  llmForceJsonMode: parseNullableBoolean(process.env.LLM_FORCE_JSON_MODE),
  redisUrl: clean(process.env.REDIS_URL) || "",
  rateLimitWindowMs: Number(clean(process.env.RATE_LIMIT_WINDOW_MS) || 60000),
  rateLimitMax: Number(clean(process.env.RATE_LIMIT_MAX) || 120)
};

module.exports = env;
