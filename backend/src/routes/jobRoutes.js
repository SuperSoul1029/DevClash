const express = require("express");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { getJobStatus } = require("../controllers/jobController");
const { jobParamsSchema } = require("../validators/jobValidators");

const router = express.Router();

router.get("/:jobId", requireAuth, validate(jobParamsSchema, "params"), getJobStatus);

module.exports = router;