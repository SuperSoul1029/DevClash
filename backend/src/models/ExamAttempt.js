const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true
    },
    selectedOptionIndex: {
      type: Number,
      default: null
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    timeSpentSec: {
      type: Number,
      min: 0,
      default: 0
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const topicBreakdownSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true
    },
    topicName: {
      type: String,
      required: true,
      trim: true
    },
    attempted: {
      type: Number,
      default: 0
    },
    correct: {
      type: Number,
      default: 0
    },
    incorrect: {
      type: Number,
      default: 0
    },
    score: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const examAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeneratedExam",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    lastSavedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: {
      type: Date,
      default: null
    },
    elapsedSec: {
      type: Number,
      min: 0,
      default: 0
    },
    responses: {
      type: [responseSchema],
      default: []
    },
    result: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 0 },
      correctCount: { type: Number, default: 0 },
      incorrectCount: { type: Number, default: 0 },
      unattemptedCount: { type: Number, default: 0 },
      negativeMarksApplied: { type: Number, default: 0 },
      topicBreakdown: {
        type: [topicBreakdownSchema],
        default: []
      },
      weakTopicIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
      }
    }
  },
  {
    timestamps: true
  }
);

examAttemptSchema.index({ userId: 1, examId: 1, status: 1 });
examAttemptSchema.index({ userId: 1, submittedAt: -1, status: 1 });

module.exports = mongoose.model("ExamAttempt", examAttemptSchema);
