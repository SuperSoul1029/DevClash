const mongoose = require("mongoose");

const topicProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
      index: true
    },
    retentionScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 35
    },
    nextReviewAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastReviewedAt: {
      type: Date,
      default: null
    },
    lastOutcome: {
      type: String,
      enum: ["correct", "incorrect", "skipped", "completed", null],
      default: null
    },
    streak: {
      type: Number,
      min: 0,
      default: 0
    },
    totalReviews: {
      type: Number,
      min: 0,
      default: 0
    },
    totalCorrect: {
      type: Number,
      min: 0,
      default: 0
    },
    totalIncorrect: {
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
    lastTestPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    autoCoverageScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    manualCoverage: {
      type: String,
      enum: ["covered", "uncovered", null],
      default: null
    },
    manualCoverageUpdatedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

topicProgressSchema.index({ userId: 1, topicId: 1 }, { unique: true });
topicProgressSchema.index({ userId: 1, nextReviewAt: 1, retentionScore: 1 });
topicProgressSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("TopicProgress", topicProgressSchema);
