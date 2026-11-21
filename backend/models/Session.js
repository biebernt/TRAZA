const mongoose = require("mongoose");

// Una sesión pertenece a un administrador o a un usuario, nunca a ambos.
// Las sesiones antiguas solo tienen adminId, así que siguen siendo válidas.
const sessionSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: undefined
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: undefined,
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
  }
}, { timestamps: true });

sessionSchema.pre("validate", function validateSessionOwner() {
  if (Boolean(this.adminId) === Boolean(this.userId)) {
    this.invalidate(
      "tokenHash",
      "La sesión debe pertenecer a un administrador o a un usuario"
    );
  }
});

module.exports = mongoose.model("Session", sessionSchema);
