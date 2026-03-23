const { z } = require("zod");

const youtubeExplainSchema = z.object({
  url: z.string().trim().url().max(2048)
});

const youtubeJobParamsSchema = z.object({
  jobId: z.string().trim().min(1)
});

module.exports = {
  youtubeExplainSchema,
  youtubeJobParamsSchema
};