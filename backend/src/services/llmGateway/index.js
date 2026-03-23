const { z } = require("zod");
const env = require("../../config/env");
const { getStructuredLlmOutput, isLlmConfigured } = require("../../utils/llmClient");
const { logWarn } = require("../../utils/logger");
const {
  getContract,
  listContracts,
  getDeprecatedContractMap
} = require("./contracts/registry");
const { mergeExecutionConfig } = require("./routing");

function buildEnvelopeSchema(contract) {
  return z.object({
    outputType: z.literal(contract.outputType),
    schemaVersion: z.literal(contract.schemaVersion),
    payload: contract.payloadSchema,
    meta: z
      .object({
        notes: z.string().max(400).optional(),
        confidence: z.number().min(0).max(1).optional(),
        diagnostics: z.record(z.any()).optional()
      })
      .passthrough()
      .optional()
  });
}

function buildBaseResponse({ contractKey, outputType, schemaVersion }) {
  return {
    ok: false,
    status: "failed",
    contract: {
      contractKey,
      outputType,
      schemaVersion
    },
    data: null,
    envelope: null,
    debug: {
      error: null,
      rawOutput: null,
      attemptCount: 0,
      attempts: [],
      routePolicy: "balanced",
      model: env.llmModel,
      providerBaseUrl: env.llmBaseUrl,
      contractLifecycle: {
        stage: "active",
        supersededBy: null
      }
    }
  };
}

function isDeprecatedContract(contract) {
  return contract?.lifecycle?.stage === "deprecated";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function collectEnvelopeCandidateNodes(value, bucket = []) {
  if (!value || typeof value !== "object") {
    return bucket;
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "outputType") &&
    Object.prototype.hasOwnProperty.call(value, "schemaVersion") &&
    Object.prototype.hasOwnProperty.call(value, "payload")
  ) {
    bucket.push(value);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectEnvelopeCandidateNodes(item, bucket));
    return bucket;
  }

  Object.values(value).forEach((item) => collectEnvelopeCandidateNodes(item, bucket));
  return bucket;
}

function findBalancedObjectSlices(text) {
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

    if (ch === "{") {
      if (stack.length === 0) {
        start = index;
      }
      stack.push("}");
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

function tryExtractEnvelopeFromRaw(rawOutput, envelopeSchema) {
  const text = String(rawOutput || "").trim();
  if (!text) {
    return null;
  }

  const direct = safeJsonParse(text);
  const directCandidates = collectEnvelopeCandidateNodes(direct);
  for (const candidate of directCandidates) {
    const parsed = envelopeSchema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data;
    }
  }

  const slices = findBalancedObjectSlices(text).sort((left, right) => right.length - left.length);
  for (const slice of slices) {
    const parsedSlice = safeJsonParse(slice);
    if (!parsedSlice || typeof parsedSlice !== "object") {
      continue;
    }

    const candidates = collectEnvelopeCandidateNodes(parsedSlice);
    for (const candidate of candidates) {
      const parsed = envelopeSchema.safeParse(candidate);
      if (parsed.success) {
        return parsed.data;
      }
    }
  }

  return null;
}

function toErrorSummary(error, fallbackCode = "GATEWAY_VALIDATION_FAILED") {
  return {
    code: fallbackCode,
    message: String(error?.message || "Gateway validation failed").slice(0, 500)
  };
}

function isRetriableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    /429|500|502|503|504/.test(message) ||
    message.includes("rate limit") ||
    message.includes("rate-limit") ||
    message.includes("too many requests") ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("network")
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function computeRetryDelayMs(attemptIndex) {
  const baseDelayMs = 350;
  const cappedAttempt = Math.max(1, Math.min(5, Number(attemptIndex) || 1));
  return baseDelayMs * cappedAttempt;
}

function isRequestFailureError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("llm request failed");
}

function buildRepairPrompts({ contract, input, rawOutput, attemptIndex, primaryErrorMessage }) {
  if (typeof contract.buildRepairPrompts === "function") {
    return contract.buildRepairPrompts({
      input,
      rawOutput,
      attemptIndex,
      primaryErrorMessage
    });
  }

  const basePrompts = contract.buildPrompts(input);
  const systemPrompt = [
    "You repair malformed LLM outputs into a strict JSON envelope.",
    "Return only one JSON object that satisfies the required envelope and payload schema.",
    "Do not add markdown, comments, or extra prose."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Repair malformed gateway output",
      contract: {
        contractKey: contract.contractKey,
        outputType: contract.outputType,
        schemaVersion: contract.schemaVersion
      },
      originalInput: input,
      originalSystemPrompt: basePrompts.systemPrompt,
      originalUserPrompt: basePrompts.userPrompt,
      primaryErrorMessage,
      malformedOutput: String(rawOutput || "").slice(0, 3000),
      outputRules: {
        mustReturnOnlyJsonObject: true,
        envelope: {
          outputType: contract.outputType,
          schemaVersion: contract.schemaVersion,
          payload: "must satisfy contract payload schema",
          meta: {
            notes: "optional string",
            confidence: "optional 0..1 number",
            diagnostics: "optional object"
          }
        }
      }
    },
    null,
    2
  );

  return { systemPrompt, userPrompt };
}

async function executeGatewayRequest({
  contractKey,
  input,
  temperature,
  maxTokens,
  maxAttempts,
  repairEnabled
}) {
  const contract = getContract(contractKey);
  if (!contract) {
    return {
      ok: false,
      status: "contract_not_found",
      contract: {
        contractKey,
        outputType: null,
        schemaVersion: null
      },
      data: null,
      envelope: null,
      debug: {
        error: {
          code: "CONTRACT_NOT_FOUND",
          message: `Unknown LLM contract: ${contractKey}`
        },
        rawOutput: null,
        model: env.llmModel,
        providerBaseUrl: env.llmBaseUrl
      }
    };
  }

  const response = buildBaseResponse({
    contractKey: contract.contractKey,
    outputType: contract.outputType,
    schemaVersion: contract.schemaVersion
  });

  response.debug.contractLifecycle = {
    stage: contract.lifecycle?.stage || "active",
    supersededBy: contract.lifecycle?.supersededBy || null
  };

  if (isDeprecatedContract(contract) && !env.llmGatewayAllowDeprecatedContracts) {
    response.status = "contract_deprecated";
    response.debug.error = {
      code: "CONTRACT_DEPRECATED",
      message: `Contract ${contract.contractKey} is deprecated${
        contract.lifecycle?.supersededBy ? `; use ${contract.lifecycle.supersededBy}` : ""
      }`
    };
    return response;
  }

  const executionConfig = mergeExecutionConfig({
    contract,
    temperature,
    maxTokens
  });
  response.debug.routePolicy = executionConfig.routePolicy;
  response.debug.model = executionConfig.model;

  const retryLimit = Math.max(1, Math.min(4, Number(maxAttempts ?? env.llmGatewayMaxAttempts) || 2));
  const shouldRepair =
    typeof repairEnabled === "boolean" ? repairEnabled : Boolean(env.llmGatewayRepairEnabled);

  if (!isLlmConfigured()) {
    response.status = "llm_not_configured";
    response.debug.error = {
      code: "LLM_NOT_CONFIGURED",
      message: "LLM is not configured"
    };
    return response;
  }

  if (env.nodeEnv === "test" && !env.llmGatewayEnableInTests) {
    response.status = "llm_disabled_for_tests";
    response.debug.error = {
      code: "LLM_DISABLED_FOR_TESTS",
      message: "LLM Gateway is disabled in test environment"
    };
    return response;
  }

  const envelopeSchema = buildEnvelopeSchema(contract);
  const prompts = contract.buildPrompts(input);

  for (let attemptIndex = 1; attemptIndex <= retryLimit; attemptIndex += 1) {
    response.debug.attemptCount = attemptIndex;

    try {
      const envelope = await getStructuredLlmOutput({
        schema: envelopeSchema,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        temperature: executionConfig.temperature,
        maxTokens: executionConfig.maxTokens,
        options: executionConfig.llmOptions
      });

      return {
        ...response,
        ok: true,
        status: "success",
        data: envelope.payload,
        envelope,
        debug: {
          ...response.debug,
          error: null,
          rawOutput: null,
          attempts: [
            ...response.debug.attempts,
            {
              attempt: attemptIndex,
              stage: "primary_parse",
              ok: true
            }
          ]
        }
      };
    } catch (primaryError) {
      const primaryRaw = String(primaryError?.llmRawOutput || "").slice(0, 2500) || null;
      const requestFailure = isRequestFailureError(primaryError);

      response.debug.attempts.push({
        attempt: attemptIndex,
        stage: "primary_parse",
        ok: false,
        error: toErrorSummary(primaryError)
      });

      if (!requestFailure) {
        const extractedEnvelope = tryExtractEnvelopeFromRaw(primaryRaw, envelopeSchema);
        if (extractedEnvelope) {
          response.debug.attempts.push({
            attempt: attemptIndex,
            stage: "envelope_extract",
            ok: true
          });
          return {
            ...response,
            ok: true,
            status: "success_after_extract",
            data: extractedEnvelope.payload,
            envelope: extractedEnvelope,
            debug: {
              ...response.debug,
              error: null,
              rawOutput: null
            }
          };
        }

        response.debug.attempts.push({
          attempt: attemptIndex,
          stage: "envelope_extract",
          ok: false,
          error: {
            code: "ENVELOPE_EXTRACT_FAILED",
            message: "Could not extract a valid contract envelope from raw model output"
          }
        });
      }

      if (shouldRepair && !requestFailure) {
        const repairPrompts = buildRepairPrompts({
          contract,
          input,
          rawOutput: primaryRaw,
          attemptIndex,
          primaryErrorMessage: String(primaryError?.message || "")
        });

        try {
          const repairedEnvelope = await getStructuredLlmOutput({
            schema: envelopeSchema,
            systemPrompt: repairPrompts.systemPrompt,
            userPrompt: repairPrompts.userPrompt,
            temperature: 0,
            maxTokens: executionConfig.maxTokens,
            options: executionConfig.llmOptions
          });

          response.debug.attempts.push({
            attempt: attemptIndex,
            stage: "repair",
            ok: true
          });

          return {
            ...response,
            ok: true,
            status: "success_after_repair",
            data: repairedEnvelope.payload,
            envelope: repairedEnvelope,
            debug: {
              ...response.debug,
              error: null,
              rawOutput: null
            }
          };
        } catch (repairError) {
          response.debug.attempts.push({
            attempt: attemptIndex,
            stage: "repair",
            ok: false,
            error: toErrorSummary(repairError, "GATEWAY_REPAIR_FAILED")
          });

          response.debug.error = toErrorSummary(repairError, "GATEWAY_REPAIR_FAILED");
          response.debug.rawOutput = String(repairError?.llmRawOutput || "").slice(0, 2500) || primaryRaw;
        }
      } else {
        response.debug.error = toErrorSummary(primaryError);
        response.debug.rawOutput = primaryRaw;
      }

      const retriable = isRetriableError(primaryError);
      const hasAttemptsLeft = attemptIndex < retryLimit;
      const shouldRetry = hasAttemptsLeft && retriable;

      if (!shouldRetry) {
        break;
      }

      logWarn("llm.gateway.retry", {
        contractKey: contract.contractKey,
        attempt: attemptIndex,
        retryLimit,
        reason: response.debug.error?.message || "Unknown gateway retry reason"
      });

      await delay(computeRetryDelayMs(attemptIndex));
    }
  }

  response.status = "validation_failed";
  response.debug.error = response.debug.error || {
    code: "GATEWAY_VALIDATION_FAILED",
    message: "Gateway validation failed"
  };

  logWarn("llm.gateway.failed", {
    contractKey: contract.contractKey,
    status: response.status,
    attemptCount: response.debug.attemptCount,
    errorCode: response.debug.error.code,
    errorMessage: response.debug.error.message
  });

  return response;
}

function getGatewaySummary() {
  return {
    configured: isLlmConfigured(),
    maxAttempts: env.llmGatewayMaxAttempts,
    repairEnabled: env.llmGatewayRepairEnabled,
    enableInTests: env.llmGatewayEnableInTests,
    allowDeprecatedContracts: env.llmGatewayAllowDeprecatedContracts,
    routing: {
      defaultModel: env.llmModel,
      fastModel: env.llmGatewayRouteFastModel || env.llmModel,
      balancedModel: env.llmGatewayRouteBalancedModel || env.llmModel,
      qualityModel: env.llmGatewayRouteQualityModel || env.llmModel
    },
    contracts: listContracts(),
    deprecatedContracts: getDeprecatedContractMap()
  };
}

module.exports = {
  executeGatewayRequest,
  isGatewayConfigured: isLlmConfigured,
  listGatewayContracts: listContracts,
  getGatewaySummary
};
