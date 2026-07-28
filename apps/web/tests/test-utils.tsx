import type { UserPublic } from "@vectra/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AuthContext, type AuthContextValue } from "../src/features/auth/auth-context.js";

// A fresh, retry-disabled QueryClient per test: retries would make failing
// assertions slow instead of failing fast, and state must not leak between
// tests the way the app's shared singleton (lib/query-client.ts) does.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function withQueryClient(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const testUser: UserPublic = {
  id: "00000000-0000-4000-8000-000000000000",
  email: "test@vectra.dev",
  defaultCurrency: "USD",
  timezone: "UTC",
  weekStartsOn: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

// For component tests that render a feature page directly (bypassing
// AuthProvider's real /auth/refresh boot flow, which is out of scope here).
export function withProviders(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const authValue: AuthContextValue = {
      user: testUser,
      isLoading: false,
      login: () => Promise.resolve(),
      register: () => Promise.resolve(),
      logout: () => Promise.resolve(),
    };
    return (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}
