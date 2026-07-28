import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useAccounts, useCreateAccount } from "../../../src/features/accounts/use-accounts.js";
import { server } from "../../msw/server.js";
import { createTestQueryClient, withQueryClient } from "../../test-utils.js";

const API_URL = "http://localhost:3001";

function makeAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Checking",
    type: "BANK",
    currency: "USD",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useAccounts", () => {
  it("forwards filters as query params and parses the paginated response", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(`${API_URL}/accounts`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          data: [makeAccount()],
          meta: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
        });
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useAccounts({ page: 2, pageSize: 10, includeArchived: true }),
      { wrapper: withQueryClient(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.meta.totalPages).toBe(2);
    expect(capturedUrl?.searchParams.get("page")).toBe("2");
    expect(capturedUrl?.searchParams.get("pageSize")).toBe("10");
    expect(capturedUrl?.searchParams.get("includeArchived")).toBe("true");
  });
});

describe("useCreateAccount", () => {
  it("invalidates the accounts list cache on success, triggering a refetch", async () => {
    let listCallCount = 0;
    server.use(
      http.get(`${API_URL}/accounts`, () => {
        listCallCount += 1;
        return HttpResponse.json({
          data: listCallCount === 1 ? [] : [makeAccount()],
          meta: { page: 1, pageSize: 20, totalItems: listCallCount === 1 ? 0 : 1, totalPages: 1 },
        });
      }),
      http.post(`${API_URL}/accounts`, () => HttpResponse.json(makeAccount(), { status: 201 })),
    );

    const client = createTestQueryClient();
    const wrapper = withQueryClient(client);

    const list = renderHook(() => useAccounts({ page: 1, pageSize: 20 }), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(list.result.current.data?.data).toHaveLength(0);

    const mutation = renderHook(() => useCreateAccount(), { wrapper });
    await mutation.result.current.mutateAsync({ name: "Checking", type: "BANK" });

    await waitFor(() => expect(list.result.current.data?.data).toHaveLength(1));
    expect(listCallCount).toBe(2);
  });
});
