import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  useCreateTransaction,
  useTransactions,
} from "../../../src/features/transactions/use-transactions.js";
import { server } from "../../msw/server.js";
import { createTestQueryClient, withQueryClient } from "../../test-utils.js";

const API_URL = "http://localhost:3001";

function makeTransaction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    accountId: "11111111-1111-4111-8111-111111111111",
    categoryId: "22222222-2222-4222-8222-222222222222",
    recurringTransactionId: null,
    amount: 42.5,
    currency: "USD",
    type: "EXPENSE",
    date: "2026-01-15",
    note: "Groceries",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("useTransactions", () => {
  it("forwards filters as query params and parses the paginated response", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(`${API_URL}/transactions`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          data: [makeTransaction()],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        });
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useTransactions({
          page: 1,
          pageSize: 20,
          sortBy: "date",
          sortOrder: "desc",
          type: "EXPENSE",
          accountId: "11111111-1111-4111-8111-111111111111",
          search: "groc",
        }),
      { wrapper: withQueryClient(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(capturedUrl?.searchParams.get("sortBy")).toBe("date");
    expect(capturedUrl?.searchParams.get("sortOrder")).toBe("desc");
    expect(capturedUrl?.searchParams.get("type")).toBe("EXPENSE");
    expect(capturedUrl?.searchParams.get("accountId")).toBe("11111111-1111-4111-8111-111111111111");
    expect(capturedUrl?.searchParams.get("search")).toBe("groc");
  });
});

describe("useCreateTransaction", () => {
  it("invalidates the transactions list cache on success, triggering a refetch", async () => {
    let listCallCount = 0;
    server.use(
      http.get(`${API_URL}/transactions`, () => {
        listCallCount += 1;
        return HttpResponse.json({
          data: listCallCount === 1 ? [] : [makeTransaction()],
          meta: { page: 1, pageSize: 20, totalItems: listCallCount === 1 ? 0 : 1, totalPages: 1 },
        });
      }),
      http.post(`${API_URL}/transactions`, () =>
        HttpResponse.json(makeTransaction(), { status: 201 }),
      ),
    );

    const client = createTestQueryClient();
    const wrapper = withQueryClient(client);

    const list = renderHook(() => useTransactions({ page: 1, pageSize: 20 }), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(list.result.current.data?.data).toHaveLength(0);

    const mutation = renderHook(() => useCreateTransaction(), { wrapper });
    await mutation.result.current.mutateAsync({
      accountId: "11111111-1111-4111-8111-111111111111",
      categoryId: "22222222-2222-4222-8222-222222222222",
      type: "EXPENSE",
      amount: 42.5,
      date: "2026-01-15",
    });

    await waitFor(() => expect(list.result.current.data?.data).toHaveLength(1));
    expect(listCallCount).toBe(2);
  });
});
