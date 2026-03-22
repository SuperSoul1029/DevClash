const plannerContract = require("./plannerContract");
const practiceContract = require("./practiceContract");
const testGenerationContract = require("./testGenerationContract");

const contracts = [plannerContract, practiceContract, testGenerationContract];

const contractsByKey = new Map(contracts.map((contract) => [contract.contractKey, contract]));

function getContract(contractKey) {
  return contractsByKey.get(contractKey) || null;
}

function listContracts() {
  return contracts.map((contract) => ({
    contractKey: contract.contractKey,
    outputType: contract.outputType,
    schemaVersion: contract.schemaVersion
  }));
}

module.exports = {
  getContract,
  listContracts
};
