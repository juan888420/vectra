import { env } from "./env.js";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorName: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// In-memory only — never localStorage (XSS risk). A plain module variable
// (not React state) so it can be read synchronously by requests fired
// outside the component tree (TanStack Query's queryFn/mutationFn).
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

// AuthProvider subscribes here so api-client (a plain module, not a hook)
// can still trigger the logout-and-redirect flow when a refresh fails.
type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

export function onSessionExpired(listener: SessionExpiredListener): void {
  sessionExpiredListener = listener;
}

// Concurrency guard: several requests can 401 at nearly the same moment
// (e.g. a screen firing multiple queries right as the access token expires).
// Only the first one actually calls /auth/refresh; the rest await its result.
let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const res = await fetch(`${env.VITE_API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new ApiError(res.status, "Unauthorized", "Session expired");
  }

  const body = (await res.json()) as { accessToken: string };
  currentAccessToken = body.accessToken;
  return body.accessToken;
}

function refreshAccessToken(): Promise<string> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function readErrorBody(res: Response): Promise<{ error: string; message: string }> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return { error: data.error ?? res.statusText, message: data.message ?? res.statusText };
  } catch {
    return { error: res.statusText, message: res.statusText };
  }
}

async function performRequest<T>(
  path: string,
  options: RequestOptions,
  isRetry: boolean,
): Promise<T> {
  const isAuthEndpoint = path.startsWith("/auth/");
  const headers: Record<string, string> = {};
  // Only set Content-Type when there's actually a body: Fastify's JSON body
  // parser tries to parse an empty body as JSON when the header is present
  // (e.g. on /auth/refresh, which takes no body), failing with 400.
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (currentAccessToken) {
    headers.Authorization = `Bearer ${currentAccessToken}`;
  }

  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    method: options.method ?? "GET",
    // Needed for the httpOnly `vectra_refresh` cookie on /auth/* calls;
    // harmless elsewhere since the cookie is scoped path=/auth server-side.
    credentials: "include",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  // 401s from /auth/login or /auth/register are real credential failures,
  // not expiry — retrying those would loop forever.
  if (res.status === 401 && !isAuthEndpoint && !isRetry) {
    try {
      await refreshAccessToken();
    } catch {
      currentAccessToken = null;
      sessionExpiredListener?.();
      throw new ApiError(401, "Unauthorized", "Session expired");
    }
    return performRequest<T>(path, options, true);
  }

  if (!res.ok) {
    const { error, message } = await readErrorBody(res);
    if (res.status === 401 && !isAuthEndpoint) {
      // The retry above also failed with 401: refresh succeeded once but the
      // session is still invalid (or died again immediately).
      sessionExpiredListener?.();
    }
    throw new ApiError(res.status, error, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return performRequest<T>(path, options, false);
}
