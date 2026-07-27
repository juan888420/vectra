import {
  authResponseSchema,
  type AuthResponse,
  type LoginBody,
  type RegisterBody,
} from "@vectra/types";

import { apiRequest } from "../../lib/api-client.js";

// Every response is re-validated with the shared Zod schema at the network
// boundary — the same "Zod validates end-to-end" principle the backend
// itself follows (docs/architecture/overview.md).

export async function registerRequest(body: RegisterBody): Promise<AuthResponse> {
  const data = await apiRequest<unknown>("/auth/register", { method: "POST", body });
  return authResponseSchema.parse(data);
}

export async function loginRequest(body: LoginBody): Promise<AuthResponse> {
  const data = await apiRequest<unknown>("/auth/login", { method: "POST", body });
  return authResponseSchema.parse(data);
}

export async function refreshRequest(): Promise<AuthResponse> {
  const data = await apiRequest<unknown>("/auth/refresh", { method: "POST" });
  return authResponseSchema.parse(data);
}

export async function logoutRequest(): Promise<void> {
  await apiRequest<void>("/auth/logout", { method: "POST" });
}
