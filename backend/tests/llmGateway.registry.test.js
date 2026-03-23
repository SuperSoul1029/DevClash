const { listGatewayContracts, getGatewaySummary } = require("../src/services/llmGateway");

describe("LLM Gateway contract registry", () => {
  test("all contracts publish required lifecycle and routing metadata", () => {
    const contracts = listGatewayContracts();

    expect(contracts.length).toBeGreaterThanOrEqual(3);

    contracts.forEach((contract) => {
      expect(typeof contract.contractKey).toBe("string");
      expect(typeof contract.outputType).toBe("string");
      expect(typeof contract.schemaVersion).toBe("string");
      expect(typeof contract.family).toBe("string");
      expect(typeof contract.description).toBe("string");
      expect(["active", "deprecated"]).toContain(contract.lifecycle.stage);
      expect(["fast", "balanced", "quality"]).toContain(contract.routing.policy);
    });
  });

  test("gateway summary exposes routing map and contract catalog", () => {
    const summary = getGatewaySummary();

    expect(summary).toHaveProperty("routing");
    expect(summary.routing).toHaveProperty("fastModel");
    expect(summary.routing).toHaveProperty("balancedModel");
    expect(summary.routing).toHaveProperty("qualityModel");
    expect(Array.isArray(summary.contracts)).toBe(true);
    expect(summary.contracts.length).toBeGreaterThanOrEqual(3);
  });
});
