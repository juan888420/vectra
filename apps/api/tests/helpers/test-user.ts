import type { FastifyInstance } from "fastify";

export interface TestUser {
  userId: string;
  accessToken: string;
  accountId: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
}

let counter = 0;

// Goes through the real /auth/register and list endpoints instead of
// touching Prisma directly, so tests exercise the same setup a real client
// would (and pick up the default account/categories from RFC-0010).
export async function registerTestUser(app: FastifyInstance): Promise<TestUser> {
  counter += 1;
  const email = `transactions-test-${Date.now()}-${counter}@example.com`;

  const registerRes = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "password123" },
  });
  const { user, accessToken } = registerRes.json();

  const authHeader = { authorization: `Bearer ${accessToken}` };

  const accountsRes = await app.inject({ method: "GET", url: "/accounts", headers: authHeader });
  const { data: accounts } = accountsRes.json();

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
    accountId: accounts[0].id,
    expenseCategoryId: expenseCategory.id,
    incomeCategoryId: incomeCategory.id,
  };
}

export async function cleanupTestUser(app: FastifyInstance, userId: string): Promise<void> {
  // Transactions and recurring templates reference Account/Category with
  // onDelete: Restrict, so the User's cascade delete
  // (RefreshToken/Account/Category/...) fails unless they're removed first.
  await app.prisma.transaction.deleteMany({ where: { account: { userId } } });
  await app.prisma.recurringTransaction.deleteMany({ where: { userId } });
  await app.prisma.user.delete({ where: { id: userId } });
}
