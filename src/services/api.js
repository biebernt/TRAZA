// Sin VITE_API_URL la API se pide al mismo origen (proxy de desarrollo).
// En producción se define VITE_API_URL con la URL del backend desplegado.
const API_URL = import.meta.env.VITE_API_URL ?? "";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

// Envuelve fetch para no filtrar errores de red sin contexto al usuario.
async function request(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("No se pudo conectar con el servidor", { cause: error });
  }
}

export async function getServerStatus() {
  const response = await request(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error("No se pudo conectar con URBI");
  }

  return response.json();
}

export async function sendContact(contact) {
  const response = await fetch(`${API_URL}/api/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(contact)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al enviar solicitud");
  }

  return data;
}

/* ---------- Sesión de administración (sin cambios) ---------- */

export async function loginAdmin(email, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al iniciar sesión");
  }

  return data;
}

export async function getContacts(token) {
  const response = await fetch(`${API_URL}/api/contacts`, {
    headers: authHeaders(token)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al cargar solicitudes");
  }

  return data;
}

export async function updateContactStatus(id, status, token) {
  const response = await fetch(
    `${API_URL}/api/contacts/${id}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token)
      },
      body: JSON.stringify({ status })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al actualizar solicitud");
  }

  return data;
}

export async function logoutAdmin(token) {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error("No se pudo cerrar sesión");
  }
}

/* ---------- Sesión de usuario ---------- */

export async function registerUser(payload) {
  const response = await request(`${API_URL}/api/auth/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo crear la cuenta");
  }

  return data;
}

export async function loginUser(email, password) {
  const response = await request(`${API_URL}/api/auth/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo iniciar sesión");
  }

  return data;
}

export async function logoutUser(token) {
  const response = await request(`${API_URL}/api/auth/users/logout`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error("No se pudo cerrar sesión");
  }
}

export async function getCurrentUser(token) {
  const response = await request(`${API_URL}/api/auth/users/me`, {
    headers: authHeaders(token)
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "La sesión no es válida");
  }

  return data;
}

export async function requestPasswordReset(email) {
  const response = await request(`${API_URL}/api/auth/users/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo procesar la solicitud");
  }

  return data;
}

export async function resetPassword(token, password) {
  const response = await request(`${API_URL}/api/auth/users/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo restablecer la contraseña");
  }

  return data;
}

/* ---------- Proyectos ---------- */

// Sin sesión, los proyectos se separan por la clave del navegador (ownerKey).
export async function getProjects({ token, ownerKey } = {}) {
  const query = !token && ownerKey ? `?ownerKey=${encodeURIComponent(ownerKey)}` : "";
  const response = await request(`${API_URL}/api/projects${query}`, {
    headers: authHeaders(token)
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudieron cargar los proyectos");
  }

  return data;
}

export async function saveProject(project, token) {
  const response = await request(`${API_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(project)
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo guardar el proyecto");
  }

  return data;
}

export async function updateProject(id, project, token) {
  const response = await request(`${API_URL}/api/projects/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(project)
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo actualizar el proyecto");
  }

  return data;
}

export async function duplicateProject(id, token) {
  const response = await request(`${API_URL}/api/projects/${id}/duplicate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo duplicar el proyecto");
  }

  return data;
}

export async function deleteProject(id, token) {
  const response = await request(`${API_URL}/api/projects/${id}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(data.error || "No se pudo eliminar el proyecto");
  }

  return response.json();
}

/* ---------- Administración ---------- */

export async function getAdminStats(token) {
  const response = await request(`${API_URL}/api/admin/stats`, {
    headers: authHeaders(token)
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudieron cargar las estadísticas");
  }

  return data;
}

export async function getAdminUsers(token, { search = "", status = "" } = {}) {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const query = params.toString() ? `?${params}` : "";
  const response = await request(`${API_URL}/api/admin/users${query}`, {
    headers: authHeaders(token)
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudieron cargar los usuarios");
  }

  return data;
}

export async function getAdminUser(token, id) {
  const response = await request(`${API_URL}/api/admin/users/${id}`, {
    headers: authHeaders(token)
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo cargar el usuario");
  }

  return data;
}

export async function setAdminUserStatus(token, id, status) {
  const response = await request(`${API_URL}/api/admin/users/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ status })
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo actualizar la cuenta");
  }

  return data;
}

export async function deleteAdminUser(token, id, keepProjects = false) {
  const query = keepProjects ? "?keepProjects=true" : "";
  const response = await request(`${API_URL}/api/admin/users/${id}${query}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo eliminar la cuenta");
  }

  return data;
}

export async function createAdminUserReset(token, id) {
  const response = await request(
    `${API_URL}/api/admin/users/${id}/reset-password`,
    { method: "POST", headers: authHeaders(token) }
  );
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo generar el enlace");
  }

  return data;
}

export async function getAdminProjects(token, { search = "", userId = "" } = {}) {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (userId) params.set("userId", userId);

  const query = params.toString() ? `?${params}` : "";
  const response = await request(`${API_URL}/api/admin/projects${query}`, {
    headers: authHeaders(token)
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudieron cargar los proyectos");
  }

  return data;
}

export async function getAdminProject(token, id) {
  const response = await request(`${API_URL}/api/admin/projects/${id}`, {
    headers: authHeaders(token)
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "No se pudo cargar el proyecto");
  }

  return data;
}

/* ---------- Datos geográficos ---------- */

export async function getWalkingPlaces(bbox, signal) {
  const query = Array.isArray(bbox) ? `?bbox=${bbox.join(",")}` : "";
  const response = await request(
    `${API_URL}/api/walkability/places${query}`,
    { signal }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "No se pudieron consultar los servicios del área.");
  }
  return data;
}

// Inventario geográfico del área: calles, edificios, verde y servicios.
export async function getAreaInventory(bbox, signal) {
  const response = await request(
    `${API_URL}/api/osm/area?bbox=${bbox.join(",")}`,
    { signal }
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "No se pudo consultar el inventario del área."
    );
  }

  return data;
}
