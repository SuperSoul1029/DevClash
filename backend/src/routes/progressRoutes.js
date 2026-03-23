const express = require("express");
const progressController = require("../controllers/progressController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/overview", requireAuth, progressController.getProgressOverview);
router.get("/ledger", requireAuth, progressController.getProgressLedger);

module.exports = router;
