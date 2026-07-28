import type { ListTransactionsQuery, UpdateTransactionBody } from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTransactionRequest,
  deleteTransactionRequest,
  listTransactionsRequest,
  updateTransactionRequest,
} from "./transactions.api.js";
import { transactionsKeys } from "./transactions.keys.js";

export function useTransactions(query: ListTransactionsQuery) {
  return useQuery({
    queryKey: transactionsKeys.list(query),
    queryFn: () => listTransactionsRequest(query),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTransactionRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transactionsKeys.all }),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTransactionBody }) =>
      updateTransactionRequest(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transactionsKeys.all }),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTransactionRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transactionsKeys.all }),
  });
}
