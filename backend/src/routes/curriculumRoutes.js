const express = require("express");
const curriculumController = require("../controllers/curriculumController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  createSubjectSchema,
  updateSubjectSchema,
  createTopicSchema,
  updateTopicSchema
} = require("../validators/curriculumValidators");

const router = express.Router();

router.get("/subjects", curriculumController.listSubjects);
router.get("/subjects/:subjectId", curriculumController.getSubject);
router.post("/subjects", requireAuth, validate(createSubjectSchema), curriculumController.createSubject);
router.patch("/subjects/:subjectId", requireAuth, validate(updateSubjectSchema), curriculumController.updateSubject);
router.delete("/subjects/:subjectId", requireAuth, curriculumController.deleteSubject);

router.get("/topics", curriculumController.listTopics);
router.get("/topics/:topicId", curriculumController.getTopic);
router.post("/topics", requireAuth, validate(createTopicSchema), curriculumController.createTopic);
router.patch("/topics/:topicId", requireAuth, validate(updateTopicSchema), curriculumController.updateTopic);
router.delete("/topics/:topicId", requireAuth, curriculumController.deleteTopic);

module.exports = router;
