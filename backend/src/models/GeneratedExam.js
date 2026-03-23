const mongoose = require("mongoose");

const generatedQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true
    },
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
    type: {
      type: String,
      enum: ["mcq", "trueFalse", "caseStudy"],
      required: true
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true
    },
    prompt: {
      type: String,
      required: true,
      trim: true
    },
    options: {
      type: [String],
      default: []
    },
    correctOptionIndex: {
      type: Number,
      required: true,
      min: 0
    },
    explanation: {
      type: String,
      required: true,
      trim: true
    },
    marks: {
      type: Number,
      default: 1,
      min: 0
    },
    negativeMarks: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const generatedExamSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    settings: {
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard", "mixed"],
        required: true
      },
      questionCount: {
        type: Number,
        required: true,
        min: 1,
        max: 100
      },
      durationMin: {
        type: Number,
        required: true,
        min: 5,
        max: 300
      },
      typeMix: {
        mcq: { type: Number, default: 50 },
        trueFalse: { type: Number, default: 25 },
        caseStudy: { type: Number, default: 25 }
      },
      includeTopics: {
        type: [String],
        default: []
      },
      excludeTopics: {
        type: [String],
        default: []
      },
      negativeMarking: {
        enabled: { type: Boolean, default: false },
        value: { type: Number, default: 0.25, min: 0, max: 1 }
      }
    },
    blueprint: {
      resolvedTopicIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
      },
      resolvedTopicNames: {
        type: [String],
        default: []
      },
      typeCounts: {
        mcq: { type: Number, default: 0 },
        trueFalse: { type: Number, default: 0 },
        caseStudy: { type: Number, default: 0 }
      },
      generatedAt: {
        type: Date,
        default: Date.now
      }
    },
    questions: {
      type: [generatedQuestionSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["generated", "active", "submitted"],
      default: "generated"
    }
  },
  {
    timestamps: true
  }
);

generatedExamSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("GeneratedExam", generatedExamSchema);
