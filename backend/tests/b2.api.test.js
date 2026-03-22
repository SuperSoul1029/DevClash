const request = require("supertest");
const {
  app,
  setupTestDb,
  teardownTestDb,
  resetTestDb
} = require("./helpers/testApp");

let authToken;
let topicId;
let subjectId;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await resetTestDb();

  const signupRes = await request(app).post("/api/auth/signup").send({
    fullName: "Planner Student",
    email: "planner@example.com",
    password: "password123"
  });

  authToken = signupRes.body.token;

  const subjectRes = await request(app)
    .post("/api/subjects")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Physics",
      code: "PHY",
      classLevel: "11",
      description: "Class 11 Physics"
    });

  subjectId = subjectRes.body.subject._id;

  const topicRes = await request(app)
    .post("/api/topics")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      subjectId,
      classLevel: "11",
      chapter: "Motion",
      name: "Motion in a Straight Line",
      slug: "motion-straight-line",
      prerequisiteTopicIds: []
    });

  topicId = topicRes.body.topic._id;
});

describe("Phase B2 API", () => {
  test("retention event updates and state endpoint returns tracked topic", async () => {
    const recordRes = await request(app)
      .post("/api/retention/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        topicId,
        source: "practice",
        outcome: "correct",
        confidence: 0.8,
        timeSpentSec: 95
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.retention.retentionScore).toBeGreaterThan(0);

    const stateRes = await request(app)
      .get("/api/retention/state")
      .set("Authorization", `Bearer ${authToken}`);

    expect(stateRes.status).toBe(200);
    expect(stateRes.body.states.length).toBe(1);
    expect(stateRes.body.states[0].topicId).toBe(topicId);
  });

  test("coverage sync and manual overrides merge correctly", async () => {
    const syncRes = await request(app)
      .post("/api/coverage/sync-activity")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        topicId,
        signalType: "practice_correct"
      });

    expect(syncRes.status).toBe(201);
    expect(syncRes.body.coverage.autoCoverageScore).toBeGreaterThan(0);

    const markRes = await request(app)
      .post("/api/coverage/manual-mark")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ topicId });

    expect(markRes.status).toBe(200);
    expect(markRes.body.coverage.effectiveCovered).toBe(true);

    const unmarkRes = await request(app)
      .post("/api/coverage/manual-unmark")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ topicId });

    expect(unmarkRes.status).toBe(200);
    expect(unmarkRes.body.coverage.effectiveCovered).toBe(false);

    const stateRes = await request(app)
      .get(`/api/coverage/state?subjectId=${subjectId}&classLevel=11`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(stateRes.status).toBe(200);
    expect(stateRes.body.state.length).toBe(1);
    expect(stateRes.body.state[0].manualCoverage).toBe("uncovered");
  });

  test("planner generate, status update, and progress overview work", async () => {
    await request(app)
      .post("/api/retention/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        topicId,
        source: "revision",
        outcome: "incorrect",
        confidence: 0.3,
        timeSpentSec: 60
      });

    const planRes = await request(app)
      .get("/api/planner/daily?regenerate=true")
      .set("Authorization", `Bearer ${authToken}`);

    expect(planRes.status).toBe(200);
    expect(planRes.body.plan.tasks.length).toBeGreaterThan(0);

    const taskId = planRes.body.plan.tasks[0]._id;

    const completeRes = await request(app)
      .post(`/api/planner/tasks/${taskId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "completed" });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.task.status).toBe("completed");

    const overviewRes = await request(app)
      .get("/api/progress/overview")
      .set("Authorization", `Bearer ${authToken}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.overview.totalTrackedTopics).toBeGreaterThan(0);
  });
});
