// Shared currency formatting: used anywhere a feature displays a Money value
// (Transactions, Dashboard, ...), so formatting stays identical across views.
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}
