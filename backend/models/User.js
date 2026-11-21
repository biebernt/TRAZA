const mongoose = require("mongoose");

const USER_STATUSES = ["active", "suspended"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    passwordHash: {
      type: String,
      required: true
    },
    passwordSalt: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["user"],
      default: "user"
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "active"
    },
    lastLoginAt: {
      type: Date,
      default: undefined
    }
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
module.exports.USER_STATUSES = USER_STATUSES;
