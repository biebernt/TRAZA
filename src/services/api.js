const API_URL = import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

export async function getServerStatus() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error("No se pudo conectar con TRAZA");
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

export async function getProjects() {
  const response = await fetch(`${API_URL}/api/projects`);

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
export async function getWalkingPlaces(signal) {
  const response = await fetch(`${API_URL}/api/walkability/places`, { signal });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "No se pudieron consultar los servicios del área piloto.");
  }
  return data;
}
