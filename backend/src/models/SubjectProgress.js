const mongoose = require("mongoose");

const subjectProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true
    },
    totalTopics: {
      type: Number,
      min: 0,
      default: 0
    },
    coveredTopics: {
      type: Number,
      min: 0,
      default: 0
    },
    uncoveredTopics: {
      type: Number,
      min: 0,
      default: 0
    },
    completionCount: {
      type: Number,
      min: 0,
      default: 0
    },
    practicedQuestions: {
      type: Number,
      min: 0,
      default: 0
    },
    practicedCorrect: {
      type: Number,
      min: 0,
      default: 0
    },
    practiceAccuracy: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    testsTaken: {
      type: Number,
      min: 0,
      default: 0
    },
    cumulativeTestScore: {
      type: Number,
      min: 0,
      default: 0
    },
    cumulativeTestMaxScore: {
      type: Number,
      min: 0,
      default: 0
    },
    averageTestPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

subjectProgressSchema.index({ userId: 1, subjectId: 1 }, { unique: true });
subjectProgressSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("SubjectProgress", subjectProgressSchema);
