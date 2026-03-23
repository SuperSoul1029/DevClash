const request = require("supertest");
const {
  app,
  setupTestDb,
  teardownTestDb,
  resetTestDb
} = require("./helpers/testApp");

let authToken;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await resetTestDb();

  const signupRes = await request(app).post("/api/auth/signup").send({
    fullName: "Tutor Student",
    email: "tutor@example.com",
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

  const subjectId = subjectRes.body.subject._id;

  await request(app)
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
});

describe("Phase B4 API", () => {
  test("tutor endpoint rejects invalid short question payload", async () => {
    const response = await request(app)
      .post("/api/tutor/query")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        question: "abc"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
    expect(Array.isArray(response.body.details)).toBe(true);
  });

  test("tutor endpoint returns grounded citations when context is found", async () => {
    const response = await request(app)
      .post("/api/tutor/query")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        question: "How should I revise motion in a straight line for exams?",
        classLevel: "11",
        subject: "Physics"
      });

    expect(response.status).toBe(200);
    expect(response.body.response.abstained).toBe(false);
    expect(response.body.response.citations.length).toBeGreaterThan(0);
    expect(response.body.response.citations[0]).toHaveProperty("label");
    expect(response.body.response.citations[0]).toHaveProperty("sourceType");
    expect(response.body.response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.body.response.confidence).toBeLessThanOrEqual(1);
  });

  test("tutor endpoint abstains when query has no matching grounded context", async () => {
    const response = await request(app)
      .post("/api/tutor/query")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        question: "Explain polymerase chain reaction denaturation annealing and extension details",
        classLevel: "12",
        subject: "Biology"
      });

    expect(response.status).toBe(200);
    expect(response.body.response.abstained).toBe(true);
    expect(response.body.response.citations).toEqual([]);
    expect(response.body.response.confidence).toBeLessThan(0.5);
  });

  test("youtube explain flow completes async job and exposes result schema", async () => {
    const startRes = await request(app)
      .post("/api/media/youtube/explain")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        url: "https://www.youtube.com/watch?v=kinematics-low-quality"
      });

    expect(startRes.status).toBe(202);
    expect(startRes.body.job.status).toBe("queued");

    const jobId = startRes.body.job.jobId;

    let finalStatus = "queued";
    let lastPayload;

    for (let index = 0; index < 15; index += 1) {
      const pollRes = await request(app)
        .get(`/api/media/youtube/explain/${jobId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(pollRes.status).toBe(200);
      finalStatus = pollRes.body.job.status;
      lastPayload = pollRes.body.job;

      if (finalStatus === "completed") {
        break;
      }

      await sleep(30);
    }

    expect(finalStatus).toBe("completed");
    expect(lastPayload.result.overview).toBeTruthy();
    expect(Array.isArray(lastPayload.result.bullets)).toBe(true);
    expect(Array.isArray(lastPayload.result.keyConcepts)).toBe(true);
    expect(Array.isArray(lastPayload.result.revisionCards)).toBe(true);
  });

  test("jobs endpoint returns async job state", async () => {
    const startRes = await request(app)
      .post("/api/media/youtube/explain")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        url: "https://youtu.be/kinematics-intro"
      });

    const localJobId = startRes.body.job.jobId;

    const jobRes = await request(app)
      .get(`/api/jobs/${localJobId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(jobRes.status).toBe(200);
    expect(jobRes.body.job.type).toBe("youtube.explain");
    expect(["queued", "processing", "completed", "failed"]).toContain(jobRes.body.job.status);
  });

  test("health endpoint reports queue and database checks", async () => {
    const healthRes = await request(app).get("/api/health");

    expect(healthRes.status).toBe(200);
    expect(healthRes.body.success).toBe(true);
    expect(healthRes.body.checks.database.ready).toBe(true);
    expect(["in-memory", "bullmq"]).toContain(healthRes.body.checks.queue.mode);
  });
});