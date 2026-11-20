const API_URL = import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

export async function getServerStatus() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error("No se pudo conectar con URBI");
  }

  return response.json();
}

export async function saveProject(project) {
  const response = await fetch(`${API_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(project)
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar el proyecto");
  }

  return response.json();
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

export async function getProjects() {
  const response = await request(`${API_URL}/api/projects`);

  if (!response.ok) {
    throw new Error("No se pudieron cargar los proyectos");
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
    headers: {
      Authorization: `Bearer ${token}`
    }
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
        Authorization: `Bearer ${token}`
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
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("No se pudo cerrar sesión");
  }
}
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

export async function updateProject(id, project) {
  const response = await request(`${API_URL}/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No se pudo actualizar el proyecto");
  }

  return data;
}

export async function duplicateProject(id) {
  const response = await request(`${API_URL}/api/projects/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No se pudo duplicar el proyecto");
  }

  return data;
}

export async function deleteProject(id) {
  const response = await request(`${API_URL}/api/projects/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo eliminar el proyecto");
  }

  return response.json();
}
