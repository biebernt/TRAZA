
const API_URL = import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

export async function getServerStatus() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error("No se pudo conectar con TRAZA");
  }

  return response.json();
}
