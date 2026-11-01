
const Session = require("../models/Session");
const { hashToken } = require("../utils/security");

module.exports = async function requireAdmin(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Debes iniciar sesión"
      });
    }

    const token = authorization.slice(7);

    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(401).json({
        error: "Token inválido"
      });
    }

    const session = await Session.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(401).json({
        error: "Sesión inválida o expirada"
      });
    }

    req.adminId = session.adminId;
    req.sessionId = session._id;

    next();
  } catch (error) {
    next(error);
  }
};