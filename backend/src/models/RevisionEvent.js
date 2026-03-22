const mongoose = require("mongoose");

const revisionEventSchema = new mongoose.Schema(
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
    source: {
      type: String,
      enum: ["revision", "practice", "test", "planner_task", "manual"],
      default: "revision"
    },
    outcome: {
      type: String,
      enum: ["correct", "incorrect", "skipped", "completed"],
      required: true
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    timeSpentSec: {
      type: Number,
      min: 0,
      default: 0
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

revisionEventSchema.index({ userId: 1, topicId: 1, occurredAt: -1 });

module.exports = mongoose.model("RevisionEvent", revisionEventSchema);
