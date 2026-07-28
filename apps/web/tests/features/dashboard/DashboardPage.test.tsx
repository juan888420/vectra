import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { DashboardPage } from "../../../src/features/dashboard/DashboardPage.js";
import { server } from "../../msw/server.js";
import { createTestQueryClient, withProviders } from "../../test-utils.js";

const API_URL = "http://localhost:3001";

function emptyList() {
  return { data: [], meta: { page: 1, pageSize: 100, totalItems: 0, totalPages: 1 } };
}

function makeSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    totalBalance: { income: 0, expenses: 0, balance: 0 },
    accountBalances: [],
    currentMonthSummary: { income: 0, expenses: 0, balance: 0 },
    spendingByCategory: [],
    topExpenses: [],
    budgets: [],
    monthComparison: {
      current: { income: 0, expenses: 0, balance: 0 },
      previous: { income: 0, expenses: 0, balance: 0 },
      changePercent: { income: null, expenses: null, balance: null },
    },
    financialHealth: { score: 50, status: "WARNING" },
    ...overrides,
  };
}

function mockAccountsAndCategories() {
  server.use(
    http.get(`${API_URL}/accounts`, () => HttpResponse.json(emptyList())),
    http.get(`${API_URL}/categories`, () => HttpResponse.json(emptyList())),
  );
}

describe("DashboardPage", () => {
  it("shows loading skeletons while the summary request is pending", async () => {
    mockAccountsAndCategories();
    server.use(
      http.get(`${API_URL}/dashboard/summary`, async () => {
        await delay(50);
        return HttpResponse.json(makeSummary());
      }),
    );

    const client = createTestQueryClient();
    render(<DashboardPage />, { wrapper: withProviders(client) });

    expect(screen.getByText("Total balance")).toBeInTheDocument();
    expect(screen.queryByText("50")).not.toBeInTheDocument();

    expect(await screen.findByText("50")).toBeInTheDocument();
  });

  it("renders totals and financial health once the summary loads", async () => {
    mockAccountsAndCategories();
    server.use(
      http.get(`${API_URL}/dashboard/summary`, () =>
        HttpResponse.json(
          makeSummary({
            totalBalance: { income: 900, expenses: 300, balance: 600 },
            currentMonthSummary: { income: 500, expenses: 200, balance: 300 },
            financialHealth: { score: 82, status: "GOOD" },
          }),
        ),
      ),
    );

    const client = createTestQueryClient();
    render(<DashboardPage />, { wrapper: withProviders(client) });

    expect(await screen.findByText("82")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
    // Locale-independent: match the digits regardless of decimal separator.
    expect(screen.getByText(/600[.,]00/)).toBeInTheDocument();
    expect(screen.getByText(/300[.,]00/)).toBeInTheDocument();
  });

  it("shows empty states for a brand-new user with no data", async () => {
    mockAccountsAndCategories();
    server.use(http.get(`${API_URL}/dashboard/summary`, () => HttpResponse.json(makeSummary())));

    const client = createTestQueryClient();
    render(<DashboardPage />, { wrapper: withProviders(client) });

    expect(await screen.findByText("No accounts yet")).toBeInTheDocument();
    expect(screen.getByText("No budgets set up yet")).toBeInTheDocument();
    // Both the category chart and the top-expenses list share this copy; the
    // chart is behind a lazy-loaded Suspense boundary, so wait for both.
    await waitFor(() => expect(screen.getAllByText("No expenses yet this month")).toHaveLength(2), {
      timeout: 5000,
    });
  });

  it("shows an error state with a retry action when the summary request fails", async () => {
    mockAccountsAndCategories();
    let requestCount = 0;
    server.use(
      http.get(`${API_URL}/dashboard/summary`, () => {
        requestCount += 1;
        if (requestCount === 1) {
          return HttpResponse.json({ error: "Internal", message: "Boom" }, { status: 500 });
        }
        return HttpResponse.json(makeSummary());
      }),
    );

    const user = userEvent.setup();
    const client = createTestQueryClient();
    render(<DashboardPage />, { wrapper: withProviders(client) });

    expect(
      await screen.findByText("Something went wrong loading your dashboard"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(requestCount).toBe(2));
    expect(await screen.findByText("Total balance")).toBeInTheDocument();
  });
});
