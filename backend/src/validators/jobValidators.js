const { z } = require("zod");

const jobParamsSchema = z.object({
  jobId: z.string().trim().min(1)
});

module.exports = {
  jobParamsSchema
};