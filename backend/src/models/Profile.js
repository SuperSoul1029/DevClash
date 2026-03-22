const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    classLevel: {
      type: String,
      enum: ["11", "12"],
      required: true,
      default: "11"
    },
    targetExam: {
      type: String,
      trim: true,
      default: "General"
    },
    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata"
    }
  },
  {
    timestamps: true
  }
);

profileSchema.index({ classLevel: 1, updatedAt: -1 });

module.exports = mongoose.model("Profile", profileSchema);
