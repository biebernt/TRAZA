const {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash
} = require("node:crypto");

const { promisify } = require("node:util");

const scryptAsync = promisify(scrypt);

async function hashPassword(password, salt) {
  const derivedKey = await scryptAsync(
    password,
    salt,
    64
  );

  return derivedKey.toString("hex");
}

async function verifyPassword(password, salt, storedHash) {
  const candidate = await hashPassword(password, salt);

  const candidateBuffer = Buffer.from(candidate, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (candidateBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, storedBuffer);
}

function generateToken() {
  return randomBytes(32).toString("hex");
}

function hashToken(token) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken
};