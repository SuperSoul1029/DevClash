const express = require("express");
const retentionController = require("../controllers/retentionController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { recordRetentionEventSchema, retentionStateQuerySchema } = require("../validators/retentionValidators");

const router = express.Router();

router.post(
  "/events",
  requireAuth,
  validate(recordRetentionEventSchema),
  retentionController.recordRetentionEvent
);
router.get("/state", requireAuth, validate(retentionStateQuerySchema, "query"), retentionController.getRetentionState);

module.exports = router;
