import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { TransactionsPage } from "../../../src/features/transactions/TransactionsPage.js";
import { server } from "../../msw/server.js";
import { createTestQueryClient, withProviders } from "../../test-utils.js";

const API_URL = "http://localhost:3001";

const checkingAccount = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  type: "BANK",
  currency: "USD",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const groceriesCategory = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Groceries",
  type: "EXPENSE",
  isSystem: false,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const salaryCategory = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Salary",
  type: "INCOME",
  isSystem: false,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TransactionsPage", () => {
  it("filters the category options by the selected type, then creates a transaction", async () => {
    const user = userEvent.setup();
    let transactions: Array<Record<string, unknown>> = [];

    server.use(
      http.get(`${API_URL}/accounts`, () =>
        HttpResponse.json({
          data: [checkingAccount],
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        }),
      ),
      http.get(`${API_URL}/categories`, ({ request }) => {
        const type = new URL(request.url).searchParams.get("type");
        const data = [groceriesCategory, salaryCategory].filter(
          (category) => !type || category.type === type,
        );
        return HttpResponse.json({
          data,
          meta: { page: 1, pageSize: 100, totalItems: data.length, totalPages: 1 },
        });
      }),
      http.get(`${API_URL}/transactions`, () =>
        HttpResponse.json({
          data: transactions,
          meta: { page: 1, pageSize: 20, totalItems: transactions.length, totalPages: 1 },
        }),
      ),
      http.post(`${API_URL}/transactions`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const created = {
          id: "33333333-3333-4333-8333-333333333333",
          recurringTransactionId: null,
          currency: "USD",
          createdAt: "2026-01-15T00:00:00.000Z",
          updatedAt: "2026-01-15T00:00:00.000Z",
          ...body,
          // A real backend always returns `note` as string | null (Prisma
          // column default); JSON.stringify drops an `undefined` note
          // entirely, so the request body may not even have the key.
          note: (body.note as string | undefined) ?? null,
        };
        transactions = [created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const client = createTestQueryClient();
    render(<TransactionsPage />, { wrapper: withProviders(client) });

    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();

    const [newTransactionButton] = screen.getAllByRole("button", { name: "New transaction" });
    await user.click(newTransactionButton as HTMLElement);
    const dialog = await screen.findByRole("dialog");

    // Default type is Expense: the category select must only offer
    // "Groceries", never "Salary" (transactions.service.ts's
    // assertTypeMatchesCategory rule, enforced client-side too).
    await user.click(within(dialog).getByRole("combobox", { name: "Category" }));
    expect(screen.getByRole("option", { name: "Groceries" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Salary" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Groceries" }));

    await user.click(within(dialog).getByRole("combobox", { name: "Account" }));
    await user.click(screen.getByRole("option", { name: "Checking" }));

    await user.type(within(dialog).getByLabelText("Amount"), "42.50");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
    // Currency formatting is locale-dependent (Intl.NumberFormat uses the
    // runtime's default locale), so match loosely instead of an exact string.
    expect(screen.getByText(/^-.*42[.,]50/)).toBeInTheDocument();
  });
});
