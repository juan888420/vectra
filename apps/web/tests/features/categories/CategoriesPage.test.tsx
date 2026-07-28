import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { CategoriesPage } from "../../../src/features/categories/CategoriesPage.js";
import { server } from "../../msw/server.js";
import { createTestQueryClient, withProviders } from "../../test-utils.js";

const API_URL = "http://localhost:3001";

function makeCategory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Uncategorized",
    type: "EXPENSE",
    isSystem: true,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CategoriesPage", () => {
  it("disables edit/archive/delete for a system category", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/categories`, () =>
        HttpResponse.json({
          data: [makeCategory()],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        }),
      ),
    );

    const client = createTestQueryClient();
    render(<CategoriesPage />, { wrapper: withProviders(client) });

    expect(await screen.findByText("Uncategorized")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Acciones para Uncategorized" }));

    expect(screen.getByRole("menuitem", { name: /Editar/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /Archivar/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /Eliminar/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
