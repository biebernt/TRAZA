const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MAX = 120;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 1024;

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value) {
  const email = cleanText(value, EMAIL_MAX).toLowerCase();

  return EMAIL_PATTERN.test(email) ? email : "";
}

// Devuelve un mensaje de error o "" si los datos son válidos.
function validateRegistration({ name, email, password, confirmPassword }) {
  const cleanName = cleanText(name, NAME_MAX);

  if (cleanName.length < 2) {
    return "Escribe tu nombre completo";
  }

  if (!normalizeEmail(email)) {
    return "Introduce un correo válido";
  }

  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  }

  if (password.length > PASSWORD_MAX) {
    return "La contraseña es demasiado larga";
  }

  if (password !== confirmPassword) {
    return "Las contraseñas no coinciden";
  }

  return "";
}

function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  }

  if (password.length > PASSWORD_MAX) {
    return "La contraseña es demasiado larga";
  }

  return "";
}

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role || "user",
    status: user.status || "active",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

module.exports = {
  EMAIL_PATTERN,
  NAME_MAX,
  EMAIL_MAX,
  PASSWORD_MIN,
  PASSWORD_MAX,
  cleanText,
  normalizeEmail,
  validateRegistration,
  validateNewPassword,
  publicUser
};
