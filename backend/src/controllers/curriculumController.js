const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const Subject = require("../models/Subject");
const Topic = require("../models/Topic");

const listSubjects = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.classLevel) {
    filter.classLevel = req.query.classLevel;
  }

  const subjects = await Subject.find(filter).sort({ classLevel: 1, name: 1 });
  res.json({ success: true, subjects });
});

const createSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.create(req.body);
  res.status(201).json({ success: true, subject });
});

const getSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.subjectId);
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  res.json({ success: true, subject });
});

const updateSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.subjectId, req.body, { new: true });
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  res.json({ success: true, subject });
});

const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndDelete(req.params.subjectId);
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  await Topic.deleteMany({ subjectId: subject._id });
  res.json({ success: true, deletedId: subject._id });
});

const listTopics = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.subjectId) {
    filter.subjectId = req.query.subjectId;
  }
  if (req.query.classLevel) {
    filter.classLevel = req.query.classLevel;
  }

  const topics = await Topic.find(filter)
    .populate("subjectId", "name code classLevel")
    .sort({ classLevel: 1, chapter: 1, name: 1 });

  res.json({ success: true, topics });
});

const createTopic = asyncHandler(async (req, res) => {
  const { subjectId, prerequisiteTopicIds } = req.body;

  const subject = await Subject.findById(subjectId);
  if (!subject) {
    throw new AppError("Invalid subjectId", 400);
  }

  const validPrereqIds = (prerequisiteTopicIds || []).map((id) => new mongoose.Types.ObjectId(id));

  const topic = await Topic.create({
    ...req.body,
    prerequisiteTopicIds: validPrereqIds
  });

  res.status(201).json({ success: true, topic });
});

const getTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.topicId).populate("subjectId", "name code classLevel");
  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  res.json({ success: true, topic });
});

const updateTopic = asyncHandler(async (req, res) => {
  const update = { ...req.body };

  if (update.prerequisiteTopicIds) {
    update.prerequisiteTopicIds = update.prerequisiteTopicIds.map((id) => new mongoose.Types.ObjectId(id));
  }

  const topic = await Topic.findByIdAndUpdate(req.params.topicId, update, { new: true });
  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  res.json({ success: true, topic });
});

const deleteTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findByIdAndDelete(req.params.topicId);
  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  res.json({ success: true, deletedId: topic._id });
});

module.exports = {
  listSubjects,
  createSubject,
  getSubject,
  updateSubject,
  deleteSubject,
  listTopics,
  createTopic,
  getTopic,
  updateTopic,
  deleteTopic
};
