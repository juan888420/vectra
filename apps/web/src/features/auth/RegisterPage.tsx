import { zodResolver } from "@hookform/resolvers/zod";
import { registerBodySchema, type RegisterBody } from "@vectra/types";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { toast } from "sonner";
import type { z } from "zod";

import { ApiError } from "../../lib/api-client.js";
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

  const form = useForm<RegisterFormValues, unknown, RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: RegisterBody) {
    setIsSubmitting(true);
    try {
      await register(values);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        form.setError("email", { message: "Este correo ya está registrado" });
      } else {
        toast.error("Algo salió mal. Intenta de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Crea tu cuenta</CardTitle>
          <CardDescription>Empieza a controlar tus finanzas con Vectra.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
