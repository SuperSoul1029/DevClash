const express = require("express");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  generateExamSchema,
  startExamSchema,
  saveExamSchema,
  submitExamSchema,
  resultParamsSchema,
  testHistoryQuerySchema
} = require("../validators/testValidators");
const {
  getGeneratedExams,
  generateExam,
  startExam,
  saveExamAttempt,
  submitExamAttempt,
  getExamResult,
  getTestHistory
} = require("../controllers/testController");

const router = express.Router();

router.get("/", requireAuth, getGeneratedExams);
router.post("/generate", requireAuth, validate(generateExamSchema), generateExam);
router.post("/start", requireAuth, validate(startExamSchema), startExam);
router.post("/save", requireAuth, validate(saveExamSchema), saveExamAttempt);
router.post("/submit", requireAuth, validate(submitExamSchema), submitExamAttempt);
router.get("/result/:attemptId", requireAuth, validate(resultParamsSchema, "params"), getExamResult);
router.get("/history", requireAuth, validate(testHistoryQuerySchema, "query"), getTestHistory);

module.exports = router;
