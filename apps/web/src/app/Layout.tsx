import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ThemeToggle,
} from "@vectra/ui";
import { LogOut, User } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import vectraLogo from "../assets/vectra-mark.png";
import { useAuth } from "../features/auth/useAuth.js";
import { CategoryColorProvider } from "../features/categories/CategoryColorProvider.js";

// Vectra's product surface (RFC-0027): the ledger (Cuentas/Transacciones/
// Dashboard) was retired from the UI, so the primary nav is the whole nav.
const PRIMARY_NAV_LINKS = [
  { to: "/scenarios", label: "Escenarios" },
  { to: "/categories", label: "Categorías" },
  { to: "/expense-items", label: "Productos" },
  { to: "/incomes", label: "Ingresos" },
];

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return cn(
    // shrink-0 + the row's overflow-x-auto: the four labels fit a 320px row
    // as they stand, and anything longer scrolls rather than compressing into
    // unreadable stubs.
    "shrink-0 rounded-md px-1.5 py-1 text-sm whitespace-nowrap transition-colors focus-ring sm:px-2",
    isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

// App shell: a fixed-height column whose main area scrolls, rather than a
// document that scrolls as a whole. Escenarios needs this — it is a
// master/detail screen whose two panels scroll independently, and it used to
// approximate the available height with a hardcoded `calc(100dvh-7rem)` that
// silently broke the moment the header changed height (which it now does, at
// the mobile breakpoint).
export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden"
      // The luminous ground, painted here rather than on <body>: this shell is
      // h-dvh with `overflow-hidden` and the scrolling happens inside <main>,
      // so the body element is never visible and a gradient on it would render
      // to nothing. Anchoring it here also keeps it still while content
      // scrolls, instead of dragging the light along with the list.
      //
      // Far fainter than the auth screens'. This is the surface someone works
      // on for long stretches; there it is a first impression, here it only
      // has to keep cards from sitting on dead flat white.
      style={{
        backgroundImage:
          "radial-gradient(60rem 40rem at 15% -5%, color-mix(in oklab, var(--primary) 7%, transparent), transparent 55%)",
      }}
    >
      <header className="shrink-0 border-b">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <img src={vectraLogo} alt="" className="size-7 rounded-md" />
            <span className="text-sm font-semibold tracking-tight">Vectra</span>
          </div>

          {/* Inline from sm up; below that the same links get their own row
              underneath, where they have the full width to themselves. Only
              one of the two is ever rendered, so the accessibility tree never
              sees the nav twice. */}
          <nav className="hidden items-center gap-1 sm:flex">
            {PRIMARY_NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClassName}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-ring"
                  aria-label="Menú de usuario"
                >
                  <User className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-56 truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav className="flex items-center gap-0.5 overflow-x-auto border-t px-2 py-1.5 sm:hidden">
          {PRIMARY_NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClassName}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Wraps every authenticated screen so a category is tinted the same on
          the categories list, on a product card and inside a scenario. */}
      <CategoryColorProvider>
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </CategoryColorProvider>
    </div>
  );
}
