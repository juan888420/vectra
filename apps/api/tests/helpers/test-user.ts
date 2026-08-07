import type { FastifyInstance } from "fastify";

export interface TestUser {
  userId: string;
  accessToken: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
}

let counter = 0;

// Goes through the real /auth/register and list endpoints instead of
// touching Prisma directly, so tests exercise the same setup a real client
// would (and pick up the default categories from RFC-0010).
export async function registerTestUser(app: FastifyInstance): Promise<TestUser> {
  counter += 1;
  const email = `test-${Date.now()}-${counter}@example.com`;

  const registerRes = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "password123" },
  });
  const { user, accessToken } = registerRes.json();

  const authHeader = { authorization: `Bearer ${accessToken}` };

  const categoriesRes = await app.inject({
    method: "GET",
    url: "/categories?pageSize=100",
    headers: authHeader,
  });
  const { data: categories } = categoriesRes.json();

  const expenseCategory = categories.find(
    (category: { type: string; isSystem: boolean }) =>
      category.type === "EXPENSE" && !category.isSystem,
  );
  const incomeCategory = categories.find(
    (category: { type: string; isSystem: boolean }) =>
      category.type === "INCOME" && !category.isSystem,
  );

  return {
    userId: user.id,
    accessToken,
    expenseCategoryId: expenseCategory.id,
    incomeCategoryId: incomeCategory.id,
  };
}

export async function cleanupTestUser(app: FastifyInstance, userId: string): Promise<void> {
  // expenseItem references Category with onDelete: Restrict, so the User's
  // cascade delete (RefreshToken/Account/Category/...) fails unless it's
  // removed first. Scenarios must go before expenseItem/income:
  // ScenarioItem/ScenarioIncome reference them with onDelete: Restrict too.
  await app.prisma.scenario.deleteMany({ where: { userId } });
  await app.prisma.expenseItem.deleteMany({ where: { userId } });
  await app.prisma.user.delete({ where: { id: userId } });
}
