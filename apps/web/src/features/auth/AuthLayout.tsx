import { cn } from "@vectra/ui";
import type { ReactNode } from "react";

import vectraLogo from "../../assets/vectra-mark.png";

interface AuthLayoutProps {
  title: string;
  description: string;
  /** Form-level failure, already resolved to Spanish copy by
   * `getErrorMessage`. Rendered next to the fields rather than as a toast: a
   * sign-in failure is about the values still on screen, and a toast that
   * auto-dismisses leaves the user staring at a form with no visible reason
   * for why nothing happened. */
  error?: string | null;
  children: ReactNode;
  footer: ReactNode;
}

/** The two auth screens share everything except their fields, so the shell
 * lives here — otherwise the identity panel, the background and the surface
 * treatment would have to be kept in sync by hand across two files.
 *
 * From `lg` it is a split: identity on the left, form on the right. Below that
 * the identity panel is dropped (not stacked — it would push the form under
 * the fold on a phone) and replaced by a compact logo above the heading. `lg`
 * is already the breakpoint the rest of the app widens at, so this introduces
 * none of its own. */
export function AuthLayout({ title, description, error, children, footer }: AuthLayoutProps) {
  return (
    <div
      className="grid min-h-dvh bg-background lg:grid-cols-2"
      // The one place the app paints a gradient. It exists to give the glass
      // form panel something to refract — over a flat ground, a translucent
      // surface renders identical to an opaque one. Built from `--primary`
      // alone, at low alpha, so it follows the theme and stays within the
      // single-accent rule.
      style={{
        backgroundImage:
          "radial-gradient(50rem 36rem at 8% 10%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 60%)," +
          "radial-gradient(42rem 30rem at 92% 96%, color-mix(in oklab, var(--primary) 13%, transparent), transparent 58%)",
      }}
    >
      <aside className="relative hidden flex-col overflow-hidden p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-2.5">
          <img src={vectraLogo} alt="" className="size-8 rounded-lg" />
          <span className="text-base font-semibold tracking-tight">Vectra</span>
        </div>

        {/* Tagline and visual are centred together as one block, with only the
            logo pinned to the top. Spreading all three with `justify-between`
            left a large void under the logo on a tall viewport and pushed the
            stack into the corner, so the panel read as empty rather than calm. */}
        <div className="flex flex-1 flex-col justify-center gap-12">
          {/* A tagline, not a section heading: it is styled large but stays a
              <p> so the form's "Inicia sesión" is the page's only h1. Marking
              it up as an h2 put an h2 ahead of the h1 in document order. */}
          <div className="max-w-md">
            <p className="text-3xl font-semibold leading-[1.15] tracking-tight text-balance xl:text-4xl">
              Prueba una decisión antes de tomarla.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
              Arma escenarios con tus gastos e ingresos reales y compara cuánto cuesta cada versión
              de tu vida, sin tocar lo que ya tienes registrado.
            </p>
          </div>

          <ScenarioStack />
        </div>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src={vectraLogo} alt="" className="size-8 rounded-lg" />
            <span className="text-base font-semibold tracking-tight">Vectra</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">{description}</p>

          <div className="glass mt-6 rounded-xl border p-5 shadow-lift sm:p-6">
            {error ? (
              // role="alert" so the failure is announced; the icon-free layout
              // keeps it from competing with the field-level messages below it.
              <p
                role="alert"
                className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
            {children}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </main>
    </div>
  );
}

/** Three offset panels: the product's central idea (a scenario is a stack of
 * snapshots you can layer) shown rather than described. Decorative only, so it
 * is hidden from assistive tech — the headline beside it carries the meaning.
 * The figures are illustrative, not a real account. */
function ScenarioStack() {
  return (
    <div className="relative h-56 w-full max-w-sm select-none" aria-hidden="true">
      <StackPanel className="inset-x-8 top-0 bg-card/60" />
      <StackPanel className="inset-x-4 top-5 bg-card/80" />
      <div className="glass absolute inset-x-0 top-10 rounded-xl border p-4 shadow-lift">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Escenario
        </p>
        <p className="mt-1 truncate text-sm font-medium">Mudanza a Medellín</p>
        <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">$4.328.900</p>
        <p className="mt-0.5 text-xs text-muted-foreground">al mes · 14 productos</p>
      </div>
    </div>
  );
}

function StackPanel({ className }: { className: string }) {
  return <div className={cn("absolute h-24 rounded-xl border shadow-surface", className)} />;
}
