const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/projects", require("./routes/projects"));
app.use("/api/contacts", require("./routes/contacts"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/walkability", require("./routes/walkability"));

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Bienvenido a la API de TRAZA"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected"
  });
});

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("Falta MONGODB_URI en .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB conectado correctamente");

    app.listen(PORT, () => {
      console.log(`TRAZA activo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error al iniciar TRAZA:", error.message);
    process.exit(1);
  }
}

startServer();