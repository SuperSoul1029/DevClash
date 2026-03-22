const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["student", "mentor", "admin"],
      default: "student",
      index: true
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ role: 1, createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
