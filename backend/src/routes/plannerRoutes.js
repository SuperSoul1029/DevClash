const express = require("express");
const plannerController = require("../controllers/plannerController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  dailyPlanQuerySchema,
  weeklyPlanQuerySchema,
  generateWeeklyPlanSchema,
  updatePlannerTaskStatusSchema,
  rebalancePlanSchema,
  generateCustomPlanSchema
} = require("../validators/plannerValidators");

const router = express.Router();

router.get("/weekly", requireAuth, validate(weeklyPlanQuerySchema, "query"), plannerController.getWeeklyPlan);
router.post(
  "/generate-weekly",
  requireAuth,
  validate(generateWeeklyPlanSchema),
  plannerController.generateWeeklyPlan
);
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
