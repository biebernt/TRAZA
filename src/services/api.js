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

