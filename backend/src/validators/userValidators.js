const { z } = require("zod");

const upsertProfileSchema = z.object({
  classLevel: z.enum(["11", "12"]),
  targetExam: z.string().min(2).max(80),
  timezone: z.string().min(2).max(100)
});

module.exports = {
  upsertProfileSchema
};
