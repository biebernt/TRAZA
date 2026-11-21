const Session = require("../models/Session");
const Admin = require("../models/Admin");
const User = require("../models/User");
const { hashToken } = require("../utils/security");

const INVALID_SESSION = "Sesión inválida o expirada";

function readToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7);

  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

// Devuelve { auth, sessionId } o { error, status }.
async function resolveAuth(req) {
  const token = readToken(req);

  if (!token) {
    return { error: "Debes iniciar sesión", status: 401 };
  }

  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() }
  });

  if (!session) {
    return { error: INVALID_SESSION, status: 401 };
  }

  if (session.adminId) {
    const admin = await Admin.findById(session.adminId).select("email").lean();

    if (!admin) {
      return { error: INVALID_SESSION, status: 401 };
    }

    return {
      auth: { role: "admin", id: String(admin._id), email: admin.email },
      sessionId: session._id
    };
  }

  const user = await User.findById(session.userId)
    .select("name email status role")
    .lean();

  if (!user) {
    return { error: INVALID_SESSION, status: 401 };
  }

  // Una cuenta suspendida no puede seguir usando sesiones abiertas.
  if (user.status !== "active") {
    await Session.deleteOne({ _id: session._id });

    return {
      error: "Tu cuenta está suspendida. Escribe a URBI para solicitar ayuda.",
      status: 403
    };
  }

  return {
    auth: {
      role: user.role === "admin" ? "admin" : "user",
      id: String(user._id),
      email: user.email,
      name: user.name
    },
    sessionId: session._id
  };
}

async function requireAdmin(req, res, next) {
  try {
    const result = await resolveAuth(req);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.auth.role !== "admin") {
      return res.status(403).json({
        error: "No tienes permisos de administración"
      });
    }

    req.auth = result.auth;
    req.adminId = result.auth.id;
    req.sessionId = result.sessionId;

    next();
  } catch (error) {
    next(error);
  }
}

async function requireUser(req, res, next) {
  try {
    const result = await resolveAuth(req);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.auth.role !== "user") {
      return res.status(403).json({
        error: "Esta sección es para cuentas de usuario"
      });
    }

    req.auth = result.auth;
    req.sessionId = result.sessionId;

    next();
  } catch (error) {
    next(error);
  }
}

// Deja req.auth con la cuenta autenticada, o null si no hay credenciales.
// Un token presente pero inválido se rechaza para no degradar a anónimo.
async function optionalAuth(req, res, next) {
  try {
    if (!readToken(req)) {
      req.auth = null;

      return next();
    }

    const result = await resolveAuth(req);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    req.auth = result.auth;
    req.sessionId = result.sessionId;

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireUser = requireUser;
module.exports.optionalAuth = optionalAuth;
module.exports.resolveAuth = resolveAuth;
