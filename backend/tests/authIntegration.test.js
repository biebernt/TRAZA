// Pruebas de integración con MongoDB real: autenticación de usuarios, propiedad
// de proyectos, permisos administrativos y recuperación de contraseña.
// Se ejecutan solo cuando TEST_MONGODB_URI apunta a una base de pruebas.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const mongoose = require("mongoose");

const MONGO_URI = process.env.TEST_MONGODB_URI;
const enabled = Boolean(MONGO_URI);

const app = require("../server");
const Admin = require("../models/Admin");
const User = require("../models/User");
const Project = require("../models/Project");
const Session = require("../models/Session");
const Contact = require("../models/Contact");
const PasswordReset = require("../models/PasswordReset");
const { hashPassword } = require("../utils/security");

let server;
let baseUrl;

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  return { status: response.status, data };
}

async function registerUser(name, email, password = "secreto123") {
  const result = await api("/api/auth/users/register", {
    method: "POST",
    body: { name, email, password, confirmPassword: password }
  });

  assert.equal(result.status, 201, JSON.stringify(result.data));

  return result.data;
}

async function createProject(token, name = "Barrio de prueba") {
  const result = await api("/api/projects", {
    method: "POST",
    token,
    body: {
      name,
      description: "Proyecto de integración",
      mode: "grid",
      map: Array(100).fill("empty"),
      features: [],
      area: {
        kind: "viewport",
        name: "Ciudad del Saber",
        bbox: [8.995, -79.589, 9.0045, -79.578]
      }
    }
  });

  assert.equal(result.status, 201, JSON.stringify(result.data));

  return result.data;
}

if (!enabled) {
  test("pruebas de integración (omitidas: falta TEST_MONGODB_URI)", { skip: true }, () => {});
} else {
  before(async () => {
    await mongoose.connect(MONGO_URI);

    await Promise.all([
      Admin.deleteMany({}),
      User.deleteMany({}),
      Project.deleteMany({}),
      Session.deleteMany({}),
      Contact.deleteMany({}),
      PasswordReset.deleteMany({})
    ]);

    const salt = randomBytes(16).toString("hex");

    await Admin.create({
      email: "admin@urbi.test",
      passwordSalt: salt,
      passwordHash: await hashPassword("admin-secreto-123", salt)
    });

    server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  });

  test("un usuario puede registrarse e iniciar sesión con sesión persistente", async () => {
    const registro = await registerUser("Ana Torres", "ana@urbi.test");

    assert.ok(registro.token);
    assert.equal(registro.user.email, "ana@urbi.test");
    assert.equal(registro.user.role, "user");

    const duplicado = await api("/api/auth/users/register", {
      method: "POST",
      body: {
        name: "Ana Otra",
        email: "ANA@urbi.test",
        password: "secreto123",
        confirmPassword: "secreto123"
      }
    });
    assert.equal(duplicado.status, 409);

    const malo = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "ana@urbi.test", password: "incorrecta" }
    });
    assert.equal(malo.status, 401);

    const login = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "ana@urbi.test", password: "secreto123" }
    });
    assert.equal(login.status, 200);

    const perfil = await api("/api/auth/users/me", { token: login.data.token });
    assert.equal(perfil.status, 200);
    assert.equal(perfil.data.user.name, "Ana Torres");
  });

  test("el proyecto se guarda en la cuenta y sobrevive a cerrar sesión", async () => {
    const { token } = await registerUser("Beto Ruiz", "beto@urbi.test");
    const creado = await createProject(token, "Parque central");

    assert.ok(creado.user, "el proyecto debe quedar asociado al usuario");

    await api("/api/auth/users/logout", { method: "POST", token });

    const relogin = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "beto@urbi.test", password: "secreto123" }
    });

    const lista = await api("/api/projects", { token: relogin.data.token });
    assert.equal(lista.status, 200);
    assert.equal(lista.data.length, 1);
    assert.equal(lista.data[0].name, "Parque central");

    const detalle = await api(`/api/projects/${creado._id}`, {
      token: relogin.data.token
    });
    assert.equal(detalle.status, 200);
    assert.deepEqual(detalle.data.area.bbox, [8.995, -79.589, 9.0045, -79.578]);
  });

  test("dos usuarios no pueden verse ni modificar proyectos ajenos", async () => {
    const ana = await registerUser("Ana Dos", "ana2@urbi.test");
    const carla = await registerUser("Carla Gil", "carla@urbi.test");
    const proyecto = await createProject(ana.token, "Proyecto privado de Ana");

    const listaCarla = await api("/api/projects", { token: carla.token });
    assert.equal(listaCarla.data.length, 0);

    const lectura = await api(`/api/projects/${proyecto._id}`, {
      token: carla.token
    });
    assert.equal(lectura.status, 403);

    const edicion = await api(`/api/projects/${proyecto._id}`, {
      method: "PUT",
      token: carla.token,
      body: { name: "Secuestrado" }
    });
    assert.equal(edicion.status, 403);

    const borrado = await api(`/api/projects/${proyecto._id}`, {
      method: "DELETE",
      token: carla.token
    });
    assert.equal(borrado.status, 403);

    const duplicado = await api(`/api/projects/${proyecto._id}/duplicate`, {
      method: "POST",
      token: carla.token
    });
    assert.equal(duplicado.status, 403);

    // Un usuario no puede falsificar el dueño enviando user en el cuerpo.
    const falso = await api("/api/projects", {
      method: "POST",
      token: carla.token,
      body: {
        name: "Intento de suplantación",
        mode: "grid",
        map: Array(100).fill("empty"),
        user: proyecto.user
      }
    });
    assert.equal(falso.status, 201);
    assert.notEqual(String(falso.data.user), String(proyecto.user));
  });

  test("el listado anónimo no expone proyectos de cuentas", async () => {
    const anonimo = await api("/api/projects");
    assert.equal(anonimo.status, 401);

    // Los proyectos anteriores sin cuenta siguen siendo accesibles.
    await Project.create({
      name: "Proyecto legado",
      mode: "grid",
      map: Array(100).fill("empty")
    });

    const conClaveFalsa = await api("/api/projects?ownerKey=claveinventada1");
    assert.equal(conClaveFalsa.status, 200);
    assert.deepEqual(
      conClaveFalsa.data.map(project => project.name),
      ["Proyecto legado"]
    );
  });

  test("el administrador consulta usuarios, proyectos y estadísticas reales", async () => {
    const admin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "admin@urbi.test", password: "admin-secreto-123" }
    });
    assert.equal(admin.status, 200);

    const adminToken = admin.data.token;

    const stats = await api("/api/admin/stats", { token: adminToken });
    assert.equal(stats.status, 200);
    assert.ok(stats.data.users.total >= 4);
    assert.ok(stats.data.projects.total >= 3);

    const usuarios = await api("/api/admin/users", { token: adminToken });
    assert.equal(usuarios.status, 200);

    const ana = usuarios.data.find(user => user.email === "ana2@urbi.test");
    assert.equal(ana.projectCount, 1);

    const detalle = await api(`/api/admin/users/${ana.id}`, { token: adminToken });
    assert.equal(detalle.status, 200);
    assert.equal(detalle.data.projects.length, 1);
    assert.equal(detalle.data.projects[0].name, "Proyecto privado de Ana");

    const proyectos = await api(`/api/admin/projects?userId=${ana.id}`, {
      token: adminToken
    });
    assert.equal(proyectos.status, 200);
    assert.equal(proyectos.data.length, 1);
    assert.equal(proyectos.data[0].owner.email, "ana2@urbi.test");

    const proyectoDetalle = await api(
      `/api/admin/projects/${detalle.data.projects[0].id}`,
      { token: adminToken }
    );
    assert.equal(proyectoDetalle.status, 200);
    assert.ok(proyectoDetalle.data.project.map.length === 100);
  });

  test("un usuario normal nunca accede al panel administrativo", async () => {
    const { token } = await registerUser("Dani Paz", "dani@urbi.test");

    const stats = await api("/api/admin/stats", { token });
    assert.equal(stats.status, 403);

    const usuarios = await api("/api/admin/users", { token });
    assert.equal(usuarios.status, 403);
  });

  test("suspender una cuenta bloquea el acceso y se puede reactivar", async () => {
    const admin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "admin@urbi.test", password: "admin-secreto-123" }
    });
    const adminToken = admin.data.token;

    const { user, token } = await registerUser("Eva Luna", "eva@urbi.test");

    const suspender = await api(`/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "suspended" }
    });
    assert.equal(suspender.status, 200);

    // La sesión abierta deja de servir y el login responde 403.
    const sesionVieja = await api("/api/auth/users/me", { token });
    assert.equal(sesionVieja.status, 401);

    const login = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "eva@urbi.test", password: "secreto123" }
    });
    assert.equal(login.status, 403);

    const reactivar = await api(`/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "active" }
    });
    assert.equal(reactivar.status, 200);

    const loginNuevo = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "eva@urbi.test", password: "secreto123" }
    });
    assert.equal(loginNuevo.status, 200);
  });

  test("recuperación de contraseña invalida la anterior y sus sesiones", async () => {
    const { token } = await registerUser("Flor Mena", "flor@urbi.test");

    const solicitud = await api("/api/auth/users/forgot-password", {
      method: "POST",
      body: { email: "flor@urbi.test" }
    });
    assert.equal(solicitud.status, 200);
    assert.ok(solicitud.data.resetToken, "fuera de producción se devuelve el token");

    const cambio = await api("/api/auth/users/reset-password", {
      method: "POST",
      body: { token: solicitud.data.resetToken, password: "nuevaClave123" }
    });
    assert.equal(cambio.status, 200);

    const sesionCerrada = await api("/api/auth/users/me", { token });
    assert.equal(sesionCerrada.status, 401);

    const loginViejo = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "flor@urbi.test", password: "secreto123" }
    });
    assert.equal(loginViejo.status, 401);

    const loginNuevo = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "flor@urbi.test", password: "nuevaClave123" }
    });
    assert.equal(loginNuevo.status, 200);

    const reuso = await api("/api/auth/users/reset-password", {
      method: "POST",
      body: { token: solicitud.data.resetToken, password: "otraClave123" }
    });
    assert.equal(reuso.status, 400);
  });

  test("eliminar una cuenta borra sus proyectos y conserva las solicitudes de contacto", async () => {
    const admin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "admin@urbi.test", password: "admin-secreto-123" }
    });
    const adminToken = admin.data.token;

    const { user, token } = await registerUser("Gabo Solís", "gabo@urbi.test");
    const proyecto = await createProject(token, "Proyecto de Gabo");

    const contacto = await api("/api/contacts", {
      method: "POST",
      body: {
        name: "Gabo Solís",
        email: "gabo@urbi.test",
        message: "Quiero colaborar con URBI"
      }
    });
    assert.equal(contacto.status, 201);

    const borrado = await api(`/api/admin/users/${user.id}`, {
      method: "DELETE",
      token: adminToken
    });
    assert.equal(borrado.status, 200);
    assert.equal(borrado.data.projects.deleted, 1);

    const proyectoBorrado = await Project.findById(proyecto._id).lean();
    assert.equal(proyectoBorrado, null);

    const solicitudes = await api("/api/contacts", { token: adminToken });
    assert.equal(solicitudes.status, 200);
    assert.ok(
      solicitudes.data.some(contact => contact.email === "gabo@urbi.test"),
      "las solicitudes de contacto deben seguir disponibles"
    );

    const login = await api("/api/auth/users/login", {
      method: "POST",
      body: { email: "gabo@urbi.test", password: "secreto123" }
    });
    assert.equal(login.status, 401);
  });
}
