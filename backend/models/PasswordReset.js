const mongoose = require("mongoose");

// Token de un solo uso para restablecer contraseñas. Solo se guarda su hash.
const passwordResetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0
    },
    usedAt: {
      type: Date,
      default: undefined
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PasswordReset", passwordResetSchema);
