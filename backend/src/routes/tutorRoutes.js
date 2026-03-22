const express = require("express");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { tutorQuerySchema } = require("../validators/tutorValidators");
const { queryTutor } = require("../controllers/tutorController");

const router = express.Router();

router.post("/query", requireAuth, validate(tutorQuerySchema), queryTutor);

module.exports = router;