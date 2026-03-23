const express = require("express");
const coverageController = require("../controllers/coverageController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  syncCoverageActivitySchema,
  manualCoverageSchema,
  coverageStateQuerySchema
} = require("../validators/coverageValidators");

const router = express.Router();

router.post(
  "/sync-activity",
  requireAuth,
  validate(syncCoverageActivitySchema),
  coverageController.syncCoverageActivity
);
router.post("/manual-mark", requireAuth, validate(manualCoverageSchema), coverageController.manualMarkCovered);
router.post("/manual-unmark", requireAuth, validate(manualCoverageSchema), coverageController.manualUnmarkTopic);
router.post("/manual-reset", requireAuth, validate(manualCoverageSchema), coverageController.manualResetTopic);
router.post("/revision-inc", requireAuth, validate(manualCoverageSchema), coverageController.manualIncrementRevision);
router.post("/revision-dec", requireAuth, validate(manualCoverageSchema), coverageController.manualDecrementRevision);
router.get("/state", requireAuth, validate(coverageStateQuerySchema, "query"), coverageController.getCoverageState);

module.exports = router;
