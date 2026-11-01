require("dotenv").config();

const mongoose = require("mongoose");
const readline = require("node:readline");
const { randomBytes } = require("node:crypto");

const Admin = require("../models/Admin");
const { hashPassword } = require("../utils/security");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve =>
    rl.question(question, resolve)
  );
}

async function main() {
  try {
    const email = (
      await ask("Correo del administrador: ")
    ).trim().toLowerCase();

    const password = await ask(
      "Contraseña de al menos 12 caracteres: "
    );

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12
    ) {
      throw new Error("Correo o contraseña inválidos");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const exists = await Admin.findOne({ email });

    if (exists) {
      throw new Error("Este administrador ya existe");
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, salt);

    await Admin.create({
      email,
      passwordSalt: salt,
      passwordHash
    });

    console.log("Administrador creado correctamente");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

main();