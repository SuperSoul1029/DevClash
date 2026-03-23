const request = require("supertest");
const { app, setupTestDb, teardownTestDb, resetTestDb } = require("./helpers/testApp");

let authToken;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  authToken = null;
});

async function signupAndLogin() {
  const signupRes = await request(app).post("/api/auth/signup").send({
    fullName: "Test User",
    email: "test@example.com",
    password: "password123"
  });

  authToken = signupRes.body.token;
  return signupRes;
}

describe("Phase B1 API", () => {
  test("health endpoint returns ok", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("auth signup/login/me flow works", async () => {
    const signupRes = await signupAndLogin();
    expect(signupRes.status).toBe(201);

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "password123"
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("test@example.com");
  });

  test("profile read/update works", async () => {
    await signupAndLogin();

    const getRes = await request(app)
      .get("/api/users/me/profile")
      .set("Authorization", `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);

    const putRes = await request(app)
      .put("/api/users/me/profile")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ classLevel: "12", targetExam: "NEET", timezone: "Asia/Kolkata" });

    expect(putRes.status).toBe(200);
    expect(putRes.body.profile.classLevel).toBe("12");
  });

  test("subject and topic CRUD works", async () => {
    await signupAndLogin();

    const subjectRes = await request(app)
      .post("/api/subjects")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Physics",
        code: "PHY",
        classLevel: "11",
        description: "Class 11 Physics"
      });

    expect(subjectRes.status).toBe(201);
    const subjectId = subjectRes.body.subject._id;

    const listSubjectsRes = await request(app).get("/api/subjects?classLevel=11");
    expect(listSubjectsRes.status).toBe(200);
    expect(listSubjectsRes.body.subjects.length).toBe(1);

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

    expect(topicRes.status).toBe(201);

    const listTopicsRes = await request(app).get(`/api/topics?subjectId=${subjectId}`);
    expect(listTopicsRes.status).toBe(200);
    expect(listTopicsRes.body.topics.length).toBe(1);
  });
});
