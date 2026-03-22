const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    classLevel: {
      type: String,
      enum: ["11", "12"],
      required: true,
      index: true
    },
    description: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

subjectSchema.index({ code: 1, classLevel: 1 }, { unique: true });
subjectSchema.index({ classLevel: 1, name: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
