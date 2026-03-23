const mongoose = require("mongoose");

const knowledgeChunkSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["pdf", "markdown", "text", "curriculum_topic", "unknown"],
      default: "unknown",
      index: true
    },
    sourceId: {
      type: String,
      default: "",
      index: true
    },
    sourceLabel: {
      type: String,
      required: true,
      trim: true
    },
    sourceUrl: {
      type: String,
      default: ""
    },
    classLevel: {
      type: String,
      enum: ["11", "12", ""],
      default: "",
      index: true
    },
    subject: {
      type: String,
      default: "",
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    text: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      default: []
    },
    tokenCount: {
      type: Number,
      default: 0
    },
    chunkIndex: {
      type: Number,
      default: 0
    },
    ingestBatch: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

knowledgeChunkSchema.index({ sourceType: 1, sourceId: 1, chunkIndex: 1 }, { unique: true });
knowledgeChunkSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
