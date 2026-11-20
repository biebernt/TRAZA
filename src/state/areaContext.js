import { createContext, useContext } from "react";

export const AreaContext = createContext(null);

export function useArea() {
  const value = useContext(AreaContext);

  if (!value) {
    throw new Error("useArea debe usarse dentro de AreaProvider");
  }

  return value;
}
