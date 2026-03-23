const mongoose = require("mongoose");

const plannerTaskSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240
    },
    taskType: {
      type: String,
      enum: ["review", "practice", "learn"],
      default: "review"
    },
    dueDate: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["todo", "completed", "skipped"],
      default: "todo",
      index: true
    },
    priorityScore: {
      type: Number,
      default: 0
    },
    estimatedMinutes: {
      type: Number,
      min: 5,
      max: 180,
      default: 20
    },
    reason: {
      type: String,
      trim: true,
      default: ""
    },
    source: {
      type: String,
      enum: ["auto", "manual", "rebalance"],
      default: "auto"
    },
    completedAt: {
      type: Date,
      default: null
    },
    skippedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

plannerTaskSchema.index({ userId: 1, dueDate: 1, status: 1 });
plannerTaskSchema.index({ userId: 1, topicId: 1, dueDate: 1, status: 1 });

module.exports = mongoose.model("PlannerTask", plannerTaskSchema);
