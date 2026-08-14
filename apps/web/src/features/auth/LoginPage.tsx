import { zodResolver } from "@hookform/resolvers/zod";
import { loginBodySchema, type LoginBody } from "@vectra/types";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@vectra/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { getErrorMessage } from "../../lib/error-messages.js";
import { AuthLayout } from "./AuthLayout.js";
import { useAuth } from "./useAuth.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginBody) {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await login(values);
      navigate("/", { replace: true });
    } catch (error) {
      // Kept in the form rather than a toast: bad credentials can be either
      // field, so there is no single input to hang it on, and the message has
      // to stay readable while the user retypes. Copy still comes from the one
      // place that produces error text (RFC-0029).
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Inicia sesión"
      description="Retoma tus escenarios donde los dejaste."
      error={formError}
      footer={
        <>
          ¿No tienes una cuenta?{" "}
          <Link
            to="/register"
            className="font-medium text-primary underline-offset-4 hover:underline focus-ring rounded-sm"
          >
            Regístrate
          </Link>
        </>
      }
    >
      <Form {...form}>
        {/* noValidate: Zod owns validation copy — see FormDialog. */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="tu@correo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
