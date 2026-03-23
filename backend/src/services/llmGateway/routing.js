const env = require("../../config/env");

const ROUTING_PRESETS = {
  fast: {
    model: env.llmGatewayRouteFastModel || env.llmModel,
    temperature: 0.2,
    maxTokens: 1400
  },
  balanced: {
    model: env.llmGatewayRouteBalancedModel || env.llmModel,
    temperature: 0.25,
    maxTokens: 2200
  },
  quality: {
    model: env.llmGatewayRouteQualityModel || env.llmModel,
    temperature: 0.3,
    maxTokens: 4200
  }
};

function getRoutingPreset(policy) {
  const key = ROUTING_PRESETS[policy] ? policy : "balanced";
  return {
    policy: key,
    ...ROUTING_PRESETS[key]
  };
}

function mergeExecutionConfig({
  contract,
  temperature,
  maxTokens
}) {
  const routePolicy = contract?.routing?.policy || "balanced";
  const preset = getRoutingPreset(routePolicy);

  const resolvedTemperature =
    Number.isFinite(temperature) && temperature >= 0 ? Number(temperature) : preset.temperature;
  const resolvedMaxTokens =
    Number.isFinite(maxTokens) && maxTokens > 0 ? Number(maxTokens) : preset.maxTokens;

  return {
    routePolicy: preset.policy,
    model: preset.model,
    temperature: resolvedTemperature,
    maxTokens: resolvedMaxTokens,
    llmOptions: {
      model: preset.model
    }
  };
}

module.exports = {
  getRoutingPreset,
  mergeExecutionConfig
};
