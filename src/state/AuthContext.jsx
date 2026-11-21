import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext } from "./authContext";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser
} from "../services/api";

const TOKEN_KEY = "urbi:user-token:v1";

function readStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function storeToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // La sesión funciona durante la visita aunque no se pueda persistir.
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(null);
  const [checkedToken, setCheckedToken] = useState(null);

  // La sesión está lista cuando no hay token o cuando ya se comprobó.
  const ready = !token || checkedToken === token;

  // Restaura la sesión guardada al cargar la plataforma.
  useEffect(() => {
    let active = true;

    if (!token) return undefined;

    getCurrentUser(token)
      .then(result => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        storeToken("");
        setToken("");
      })
      .finally(() => {
        if (active) setCheckedToken(token);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const result = await loginUser(email, password);

    storeToken(result.token);
    setToken(result.token);
    setCheckedToken(result.token);
    setUser(result.user);

    return result.user;
  }, []);

  const register = useCallback(async payload => {
    const result = await registerUser(payload);

    storeToken(result.token);
    setToken(result.token);
    setCheckedToken(result.token);
    setUser(result.user);

    return result.user;
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await logoutUser(token);
      } catch {
        // Aunque el servidor no responda, la sesión local se cierra.
      }
    }

    storeToken("");
    setToken("");
    setCheckedToken(null);
    setUser(null);
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return null;

    const result = await getCurrentUser(token);
    setUser(result.user);

    return result.user;
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refresh
    }),
    [user, token, ready, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
