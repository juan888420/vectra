import { notFound } from "./http-errors.js";

interface OwnedDelegate<T> {
  findFirst(args: { where: { id: string; userId: string } }): Promise<T | null>;
}

// Every user-owned resource lookup goes through this: a resource that exists
// but belongs to another user is indistinguishable from a missing one (404),
// so the API never confirms other users' resource ids.
export async function findOwnedOrFail<T>(
  delegate: OwnedDelegate<T>,
  id: string,
  userId: string,
  resourceName: string,
): Promise<T> {
  const entity = await delegate.findFirst({ where: { id, userId } });
  if (!entity) {
    throw notFound(`${resourceName} not found`);
  }
  return entity;
}
