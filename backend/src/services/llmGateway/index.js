const { z } = require("zod");
const env = require("../../config/env");
const { getStructuredLlmOutput, isLlmConfigured } = require("../../utils/llmClient");
const { getContract, listContracts } = require("./contracts/registry");

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
      model: env.llmModel,
      providerBaseUrl: env.llmBaseUrl
    }
  };
}

async function executeGatewayRequest({
  contractKey,
  input,
  temperature = 0.2,
  maxTokens = 1800
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

  if (!isLlmConfigured()) {
    response.status = "llm_not_configured";
    response.debug.error = {
      code: "LLM_NOT_CONFIGURED",
      message: "LLM is not configured"
    };
    return response;
  }

  const envelopeSchema = buildEnvelopeSchema(contract);
  const prompts = contract.buildPrompts(input);

  try {
    const envelope = await getStructuredLlmOutput({
      schema: envelopeSchema,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      temperature,
      maxTokens
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
        rawOutput: null
      }
    };
  } catch (error) {
    response.status = "validation_failed";
    response.debug.error = {
      code: "GATEWAY_VALIDATION_FAILED",
      message: String(error?.message || "Gateway validation failed").slice(0, 500)
    };
    response.debug.rawOutput = String(error?.llmRawOutput || "").slice(0, 2500) || null;
    return response;
  }
}

module.exports = {
  executeGatewayRequest,
  isGatewayConfigured: isLlmConfigured,
  listGatewayContracts: listContracts
};
