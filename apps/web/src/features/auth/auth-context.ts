import { createContext } from "react";
import type { LoginBody, RegisterBody, UserPublic } from "@vectra/types";

export interface AuthContextValue {
  user: UserPublic | null;
  /** True only during the initial boot-time session restore. */
  isLoading: boolean;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
