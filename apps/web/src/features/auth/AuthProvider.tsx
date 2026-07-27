import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LoginBody, RegisterBody, UserPublic } from "@vectra/types";
import { useNavigate } from "react-router";

import { onSessionExpired, setAccessToken } from "../../lib/api-client.js";
import { queryClient } from "../../lib/query-client.js";
import { AuthContext } from "./auth-context.js";
import { loginRequest, logoutRequest, refreshRequest, registerRequest } from "./auth.api.js";

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Guards against React StrictMode's dev-only double effect invocation:
  // without it, two concurrent /auth/refresh calls race for the same
  // (single-use) refresh cookie — one rotates it, the other 401s on the now-
  // stale value, and the discarded winner's state update never applies.
  const hasStartedRestore = useRef(false);

  // Silent session restore on boot: the httpOnly refresh cookie is the only
  // thing that can prove a session exists this early — a 401 here just means
  // "not logged in yet", not an error.
  useEffect(() => {
    if (hasStartedRestore.current) return;
    hasStartedRestore.current = true;

    refreshRequest()
      .then((response) => {
        setAccessToken(response.accessToken);
        setUser(response.user);
      })
      .catch(() => {
        // No valid session — expected on a first visit or after expiry.
      })
      .finally(() => setIsLoading(false));
  }, []);

  // api-client is a plain module (not a hook), so it reports a dead session
  // (refresh failed mid-flight) through this subscription instead.
  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      navigate("/login", { replace: true });
    });
  }, [navigate]);

  const login = useCallback(async (body: LoginBody) => {
    const response = await loginRequest(body);
    setAccessToken(response.accessToken);
    setUser(response.user);
  }, []);

  const register = useCallback(async (body: RegisterBody) => {
    const response = await registerRequest(body);
    setAccessToken(response.accessToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAccessToken(null);
      setUser(null);
      // No stale authenticated data lingering for the next session.
      queryClient.clear();
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
