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
import { ChevronDown, LogOut, User } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import vectraLogo from "../assets/vectra-logo.png";
import { useAuth } from "../features/auth/useAuth.js";

// Primary nav answers a financial question each (ADR-0006); the ledger
// (registro histórico, ADR-0005) is secondary and grouped under "Historial"
// instead of competing for the same visual weight.
const PRIMARY_NAV_LINKS = [
  { to: "/scenarios", label: "Escenarios" },
  { to: "/categories", label: "Categorías" },
  { to: "/expense-items", label: "Productos" },
  { to: "/incomes", label: "Ingresos" },
];

const HISTORIAL_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/accounts", label: "Cuentas" },
  { to: "/transactions", label: "Transacciones" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isHistorialActive = HISTORIAL_LINKS.some((link) => location.pathname.startsWith(link.to));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <img src={vectraLogo} alt="Vectra" className="size-7 rounded-md" />
            <span className="text-sm font-semibold tracking-tight">Vectra</span>
          </div>
          <nav className="flex items-center gap-4">
            {PRIMARY_NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "text-sm text-muted-foreground transition-colors hover:text-foreground",
                    isActive && "font-medium text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    isHistorialActive && "font-medium text-foreground",
                  )}
                >
                  Historial
                  <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {HISTORIAL_LINKS.map((link) => (
                  <DropdownMenuItem key={link.to} asChild>
                    <Link to={link.to}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="Menú de usuario"
              >
                <User className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void logout()}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
