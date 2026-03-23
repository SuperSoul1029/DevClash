const request = require("supertest");
const TopicProgress = require("../src/models/TopicProgress");
const {
  app,
  setupTestDb,
  teardownTestDb,
  resetTestDb
} = require("./helpers/testApp");

let authToken;
let topicOneId;
let topicTwoId;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await resetTestDb();

  const signupRes = await request(app).post("/api/auth/signup").send({
    fullName: "Exam Student",
    email: "exam@example.com",
    password: "password123"
  });

  authToken = signupRes.body.token;

  const subjectRes = await request(app)
    .post("/api/subjects")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Chemistry",
      code: "CHE",
      classLevel: "11",
      description: "Class 11 Chemistry"
    });

  const subjectId = subjectRes.body.subject._id;

  const topicOneRes = await request(app)
    .post("/api/topics")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      subjectId,
      classLevel: "11",
      chapter: "Atomic Structure",
      name: "Bohr Model",
      slug: "bohr-model",
      prerequisiteTopicIds: []
    });

  topicOneId = topicOneRes.body.topic._id;

  const topicTwoRes = await request(app)
    .post("/api/topics")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      subjectId,
      classLevel: "11",
      chapter: "Chemical Bonding",
      name: "VSEPR Theory",
      slug: "vsepr-theory",
      prerequisiteTopicIds: []
    });

  topicTwoId = topicTwoRes.body.topic._id;
});

describe("Phase B3 API", () => {
  test("exam lifecycle enforces post-submit answer key reveal", async () => {
    const generateRes = await request(app)
      .post("/api/tests/generate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        difficulty: "mixed",
        questionCount: 8,
        durationMin: 30,
        typeMix: {
          mcq: 50,
          trueFalse: 25,
          caseStudy: 25
        },
        includeTopics: ["Bohr Model", "VSEPR Theory"],
        negativeMarking: {
          enabled: true,
          value: 0.25
        }
      });

    expect(generateRes.status).toBe(201);
    expect(generateRes.body.exam.questions.length).toBe(8);
    expect(generateRes.body.exam.questions[0].correctOptionIndex).toBeUndefined();
    expect(generateRes.body.exam.questions[0].explanation).toBeUndefined();

    const examId = generateRes.body.exam._id;

    const startRes = await request(app)
      .post("/api/tests/start")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ examId });

    expect(startRes.status).toBe(201);
    expect(startRes.body.attempt.status).toBe("in_progress");
    expect(startRes.body.exam.questions[0].correctOptionIndex).toBeUndefined();

    const attemptId = startRes.body.attempt._id;
    const firstQuestion = startRes.body.exam.questions[0];
    const secondQuestion = startRes.body.exam.questions[1];

    const saveRes = await request(app)
      .post("/api/tests/save")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        attemptId,
        elapsedSec: 42,
        responses: [
          {
            questionId: firstQuestion.questionId,
            selectedOptionIndex: 0,
            confidence: 0.7,
            timeSpentSec: 18
          },
          {
            questionId: secondQuestion.questionId,
            selectedOptionIndex: 1,
            confidence: 0.5,
            timeSpentSec: 11
          }
        ]
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.attempt.savedResponses).toBeGreaterThan(0);

    const lockedResultRes = await request(app)
      .get(`/api/tests/result/${attemptId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(lockedResultRes.status).toBe(403);

    const submitRes = await request(app)
      .post("/api/tests/submit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ attemptId, elapsedSec: 240 });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.submission.status).toBe("submitted");

    const resultRes = await request(app)
      .get(`/api/tests/result/${attemptId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.result.review.length).toBe(8);
    expect(resultRes.body.result.review[0].correctOptionIndex).toBeGreaterThanOrEqual(0);
    expect(typeof resultRes.body.result.review[0].explanation).toBe("string");
  });

  test("practice next-set targets weak topics after poor submission", async () => {
    const generateRes = await request(app)
      .post("/api/tests/generate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ questionCount: 6, durationMin: 20 });

    const examId = generateRes.body.exam._id;

    const startRes = await request(app)
      .post("/api/tests/start")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ examId });

    const attemptId = startRes.body.attempt._id;

    const wrongResponses = startRes.body.exam.questions.map((question) => ({
      questionId: question.questionId,
      selectedOptionIndex: 99,
      confidence: 0.3,
      timeSpentSec: 8
    }));

    const submitRes = await request(app)
      .post("/api/tests/submit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ attemptId, responses: wrongResponses, elapsedSec: 120 });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.submission.incorrectCount).toBeGreaterThan(0);

    const nextSetRes = await request(app)
      .post("/api/practice/next-set")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ count: 5 });

    expect(nextSetRes.status).toBe(200);
    expect(nextSetRes.body.set.questions.length).toBe(5);
    expect(nextSetRes.body.set.weakTopics.length).toBeGreaterThan(0);
    expect(nextSetRes.body.set.questions[0].whyAssigned).toContain("weak performance");

    const weakIds = new Set(nextSetRes.body.set.weakTopics.map((topic) => topic.topicId));
    expect(weakIds.has(topicOneId) || weakIds.has(topicTwoId)).toBe(true);
  });

  test("practice submit records topic practice metrics", async () => {
    const submitRes = await request(app)
      .post("/api/practice/submit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        topicId: topicOneId,
        questionCount: 6,
        attemptedCount: 5,
        correctCount: 4,
        totalTimeSec: 230,
        avgConfidence: 0.72
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.session.correctCount).toBe(4);
    expect(submitRes.body.ledger.practicedQuestions).toBe(5);
    expect(submitRes.body.ledger.practicedCorrect).toBe(4);

    const row = await TopicProgress.findOne({ topicId: topicOneId });
    expect(row).toBeTruthy();
    expect(row.practicedQuestions).toBe(5);
    expect(row.practicedCorrect).toBe(4);
    expect(row.retentionScore).toBeGreaterThanOrEqual(0);
  });
});
