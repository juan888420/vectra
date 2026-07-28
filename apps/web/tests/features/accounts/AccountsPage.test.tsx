import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { AccountsPage } from "../../../src/features/accounts/AccountsPage.js";
import { server } from "../../msw/server.js";
import { createTestQueryClient, withProviders } from "../../test-utils.js";

const API_URL = "http://localhost:3001";

describe("AccountsPage", () => {
  it("shows an empty state, then lists a newly created account", async () => {
    const user = userEvent.setup();
    let accounts: Array<Record<string, unknown>> = [];

    server.use(
      http.get(`${API_URL}/accounts`, () =>
        HttpResponse.json({
          data: accounts,
          meta: { page: 1, pageSize: 20, totalItems: accounts.length, totalPages: 1 },
        }),
      ),
      http.post(`${API_URL}/accounts`, async ({ request }) => {
        const body = (await request.json()) as { name: string; type: string };
        const created = {
          id: "11111111-1111-4111-8111-111111111111",
          name: body.name,
          type: body.type,
          currency: "USD",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        accounts = [created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const client = createTestQueryClient();
    render(<AccountsPage />, { wrapper: withProviders(client) });

    expect(await screen.findByText("No accounts yet")).toBeInTheDocument();

    // Both the header and the empty state render a "New account" button.
    const newAccountButtons = screen.getAllByRole("button", { name: "New account" });
    expect(newAccountButtons.length).toBeGreaterThan(0);
    await user.click(newAccountButtons[0] as HTMLElement);

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Checking");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Checking")).toBeInTheDocument();
    expect(screen.queryByText("No accounts yet")).not.toBeInTheDocument();
  });
});
