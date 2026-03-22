const express = require("express");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { getNextPracticeSet, submitPracticeSession } = require("../controllers/practiceController");
const { practiceNextSetSchema, practiceSubmitSchema } = require("../validators/practiceValidators");

const router = express.Router();

router.post("/next-set", requireAuth, validate(practiceNextSetSchema), getNextPracticeSet);
router.post("/submit", requireAuth, validate(practiceSubmitSchema), submitPracticeSession);

module.exports = router;
