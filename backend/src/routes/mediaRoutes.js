const express = require("express");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { startYoutubeExplain, getYoutubeExplainJob } = require("../controllers/mediaController");
const { youtubeExplainSchema, youtubeJobParamsSchema } = require("../validators/mediaValidators");

const router = express.Router();

router.post("/youtube/explain", requireAuth, validate(youtubeExplainSchema), startYoutubeExplain);
router.get("/youtube/explain/:jobId", requireAuth, validate(youtubeJobParamsSchema, "params"), getYoutubeExplainJob);

module.exports = router;