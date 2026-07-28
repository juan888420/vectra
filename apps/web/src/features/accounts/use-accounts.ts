import type { ListAccountsQuery, UpdateAccountBody } from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveAccountRequest,
  createAccountRequest,
  deleteAccountRequest,
  listAccountsRequest,
  unarchiveAccountRequest,
  updateAccountRequest,
} from "./accounts.api.js";
import { accountsKeys } from "./accounts.keys.js";

export function useAccounts(query: ListAccountsQuery) {
  return useQuery({
    queryKey: accountsKeys.list(query),
    queryFn: () => listAccountsRequest(query),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccountRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAccountBody }) =>
      updateAccountRequest(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}

export function useArchiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveAccountRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}

export function useUnarchiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveAccountRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccountRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}
