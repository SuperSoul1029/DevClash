const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true
    },
    classLevel: {
      type: String,
      enum: ["11", "12"],
      required: true,
      index: true
    },
    chapter: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    prerequisiteTopicIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Topic"
      }
    ]
  },
  {
    timestamps: true
  }
);

topicSchema.index({ subjectId: 1, slug: 1 }, { unique: true });
topicSchema.index({ classLevel: 1, subjectId: 1, updatedAt: -1 });

module.exports = mongoose.model("Topic", topicSchema);
