// Identificador público del navegador para proyectos guardados sin cuenta.
// No es una credencial: solo separa los proyectos anónimos de cada navegador.
const STORAGE_KEY = "urbi:owner-key:v1";
const PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function generateKey() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes, byte => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

export function getOwnerKey() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored && PATTERN.test(stored)) return stored;

    const key = generateKey();

    window.localStorage.setItem(STORAGE_KEY, key);

    return key;
  } catch {
    // Sin almacenamiento disponible se usa una clave efímera válida.
    return "navegador-temporal-01";
  }
}
