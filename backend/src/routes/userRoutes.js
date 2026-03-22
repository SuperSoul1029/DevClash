const express = require("express");
const userController = require("../controllers/userController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { upsertProfileSchema } = require("../validators/userValidators");

const router = express.Router();

router.use(requireAuth);

router.get("/me/profile", userController.getMyProfile);
router.put("/me/profile", validate(upsertProfileSchema), userController.upsertMyProfile);

module.exports = router;
