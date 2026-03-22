const express = require("express");
const plannerController = require("../controllers/plannerController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  dailyPlanQuerySchema,
  updatePlannerTaskStatusSchema,
  rebalancePlanSchema,
  generateCustomPlanSchema
} = require("../validators/plannerValidators");

const router = express.Router();

router.get("/daily", requireAuth, validate(dailyPlanQuerySchema, "query"), plannerController.getDailyPlan);
router.post(
  "/tasks/:taskId/status",
  requireAuth,
  validate(updatePlannerTaskStatusSchema),
  plannerController.updatePlannerTaskStatus
);
router.post("/rebalance", requireAuth, validate(rebalancePlanSchema), plannerController.rebalancePlan);
router.post(
  "/generate-custom",
  requireAuth,
  validate(generateCustomPlanSchema),
  plannerController.generateCustomPlan
);

module.exports = router;
