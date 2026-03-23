const plannerContract = require("./plannerContract");
const practiceContract = require("./practiceContract");
const testGenerationContract = require("./testGenerationContract");
const youtubeExplainContract = require("./youtubeExplainContract");

const contracts = [plannerContract, practiceContract, testGenerationContract, youtubeExplainContract];

function validateContract(contract) {
  if (!contract?.contractKey || !contract?.outputType || !contract?.schemaVersion) {
    throw new Error("Invalid LLM contract: missing contract identity fields");
  }

  if (typeof contract.buildPrompts !== "function") {
    throw new Error(`Invalid LLM contract ${contract.contractKey}: buildPrompts is required`);
  }

  if (!contract.payloadSchema) {
    throw new Error(`Invalid LLM contract ${contract.contractKey}: payloadSchema is required`);
  }

  const stage = contract.lifecycle?.stage || "active";
  if (!["active", "deprecated"].includes(stage)) {
    throw new Error(
      `Invalid LLM contract ${contract.contractKey}: lifecycle.stage must be active or deprecated`
    );
  }

  const policy = contract.routing?.policy || "balanced";
  if (!["fast", "balanced", "quality"].includes(policy)) {
    throw new Error(
      `Invalid LLM contract ${contract.contractKey}: routing.policy must be fast, balanced, or quality`
    );
  }
}

contracts.forEach(validateContract);

const contractsByKey = new Map(contracts.map((contract) => [contract.contractKey, contract]));

function getContract(contractKey) {
  return contractsByKey.get(contractKey) || null;
}

function listContracts() {
  return contracts.map((contract) => ({
    contractKey: contract.contractKey,
    outputType: contract.outputType,
    schemaVersion: contract.schemaVersion,
    family: contract.family || "general",
    description: contract.description || "",
    lifecycle: {
      stage: contract.lifecycle?.stage || "active",
      introducedAt: contract.lifecycle?.introducedAt || null,
      deprecatedAt: contract.lifecycle?.deprecatedAt || null,
      supersededBy: contract.lifecycle?.supersededBy || null
    },
    routing: {
      policy: contract.routing?.policy || "balanced"
    }
  }));
}

function getDeprecatedContractMap() {
  return listContracts()
    .filter((contract) => contract.lifecycle.stage === "deprecated")
    .reduce((accumulator, contract) => {
      accumulator[contract.contractKey] = {
        deprecatedAt: contract.lifecycle.deprecatedAt,
        supersededBy: contract.lifecycle.supersededBy
      };
      return accumulator;
    }, {});
}

module.exports = {
  getContract,
  listContracts,
  getDeprecatedContractMap
};
