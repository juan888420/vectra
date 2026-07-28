// Placeholder landing screen — confirms auth + routing + layout work end to
// end. Real business features (Dashboard, Transactions, Budgets, Reports)
// are out of scope for RFC-0017 and arrive in their own RFCs.
export function Home() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Ya estás dentro.</h1>
      <p className="mt-2 text-muted-foreground">
        La base del frontend está lista: auth, routing, tema y cliente de API funcionan. Las
        funcionalidades de negocio llegan en sus propios RFCs.
      </p>
    </div>
  );
}
