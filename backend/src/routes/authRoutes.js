const express = require("express");
const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { signupSchema, loginSchema } = require("../validators/authValidators");

const router = express.Router();

router.post("/signup", validate(signupSchema), authController.signup);
router.post("/login", validate(loginSchema), authController.login);
router.get("/me", requireAuth, authController.me);

module.exports = router;
