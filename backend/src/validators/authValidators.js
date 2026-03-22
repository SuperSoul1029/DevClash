const { z } = require("zod");

const signupSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  role: z.enum(["student", "mentor", "admin"]).optional()
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72)
});

module.exports = {
  signupSchema,
  loginSchema
};
