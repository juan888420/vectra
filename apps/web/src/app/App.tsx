import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, Toaster } from "@vectra/ui";
import { BrowserRouter } from "react-router";

import { AuthProvider } from "../features/auth/AuthProvider.js";
import { queryClient } from "../lib/query-client.js";
import { AppRoutes } from "./router.js";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
