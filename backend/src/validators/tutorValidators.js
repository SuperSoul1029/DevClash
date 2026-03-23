const { z } = require("zod");

const tutorQuerySchema = z.object({
  question: z.string().trim().min(5).max(1200),
  classLevel: z.enum(["11", "12"]).optional(),
  subject: z.string().trim().min(2).max(120).optional()
});

module.exports = {
  tutorQuerySchema
};