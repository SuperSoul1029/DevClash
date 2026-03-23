const { z } = require("zod");

const createSubjectSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  classLevel: z.enum(["11", "12"]),
  description: z.string().max(1000).optional().default("")
});

const updateSubjectSchema = createSubjectSchema.partial();

const createTopicSchema = z.object({
  subjectId: z.string().length(24),
  classLevel: z.enum(["11", "12"]),
  chapter: z.string().min(2).max(120),
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(140),
  prerequisiteTopicIds: z.array(z.string().length(24)).optional().default([])
});

const updateTopicSchema = createTopicSchema.partial();

module.exports = {
  createSubjectSchema,
  updateSubjectSchema,
  createTopicSchema,
  updateTopicSchema
};
