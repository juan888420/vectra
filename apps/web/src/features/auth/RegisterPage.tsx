import { zodResolver } from "@hookform/resolvers/zod";
import { registerBodySchema, type RegisterBody } from "@vectra/types";
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
import type { z } from "zod";

import { ApiError } from "../../lib/api-client.js";
import { getErrorMessage } from "../../lib/error-messages.js";
import { AuthLayout } from "./AuthLayout.js";
import { useAuth } from "./useAuth.js";

// `defaultCurrency`/`timezone` carry schema defaults, so the form's *input*
// type (before the resolver fills them in) leaves them optional — only the
// resolver's *output* (RegisterBody) has them always present. RHF needs both
// generics to type `onSubmit`'s `values` as the fully-resolved output.
type RegisterFormValues = z.input<typeof registerBodySchema>;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterFormValues, unknown, RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: RegisterBody) {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await register(values);
      navigate("/", { replace: true });
    } catch (error) {
      // A taken email belongs under the field the user can fix; anything else
      // is form-level. Both paths take their copy from getErrorMessage.
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        form.setError("email", { message: getErrorMessage(error) });
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      description="Empieza a simular tus decisiones de dinero en unos minutos."
      error={formError}
      footer={
        <>
          ¿Ya tienes una cuenta?{" "}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline focus-ring rounded-sm"
          >
            Inicia sesión
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
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
