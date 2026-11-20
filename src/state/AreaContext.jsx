import { useCallback, useEffect, useMemo, useState } from "react";

import { AreaContext } from "./areaContext";

import {
  MAX_AREA_KM2,
  PILOT_AREA,
  bboxAreaKm2,
  bboxCenter,
  formatKm2,
  normalizeBbox,
} from "../utils/geo";

const STORAGE_KEY = "urbi:area:v1";

function defaultArea() {
  return {
    name: PILOT_AREA.name,
    bbox: [...PILOT_AREA.bbox],
    revision: 1,
  };
}

function readStoredArea() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const stored = JSON.parse(raw);
    const bbox = normalizeBbox(stored?.bbox);

    if (!bbox) return null;

    const name =
      typeof stored.name === "string" && stored.name.trim()
        ? stored.name.trim().slice(0, 120)
        : "Área guardada";

    return { name, bbox, revision: 1 };
  } catch {
    // Sin acceso al almacenamiento: se usa el área piloto.
    return null;
  }
}

export function AreaProvider({ children }) {
  const [area, setAreaState] = useState(
    () => readStoredArea() ?? defaultArea()
  );
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name: area.name, bbox: area.bbox })
      );
    } catch {
      // El área sigue funcionando aunque el navegador no permita guardarla.
    }
  }, [area]);

  const setArea = useCallback((next) => {
    const bbox = normalizeBbox(next?.bbox);

    if (!bbox) {
      setError("El área indicada no es válida.");
      return false;
    }

    const km2 = bboxAreaKm2(bbox);

    if (km2 > MAX_AREA_KM2) {
      setError(
        `La vista ocupa ${formatKm2(
          km2
        )}; el máximo es ${MAX_AREA_KM2} km². Acerca el mapa y vuelve a intentarlo.`
      );
      return false;
    }

    const name =
      typeof next?.name === "string" && next.name.trim()
        ? next.name.trim().slice(0, 120)
        : "Área seleccionada";

    setError("");
    setAreaState((previous) => ({
      name,
      bbox,
      revision: previous.revision + 1,
    }));

    return true;
  }, []);

  const resetArea = useCallback(() => {
    setError("");
    setAreaState((previous) => ({
      ...defaultArea(),
      revision: previous.revision + 1,
    }));
  }, []);

  const value = useMemo(
    () => ({
      area,
      areaKm2: bboxAreaKm2(area.bbox),
      center: bboxCenter(area.bbox),
      error,
      setArea,
      resetArea,
    }),
    [area, error, setArea, resetArea]
  );

  return (
    <AreaContext.Provider value={value}>{children}</AreaContext.Provider>
  );
}
