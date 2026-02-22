"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);
    if (!result || result.error) {
      setError("Credenciales inválidas");
      return;
    }
    router.push(result.url || callbackUrl);
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-md pt-12">
      <div className="mb-4 text-center">
        <h1 className="mb-1 text-3xl font-bold">MotoIsla Ledger</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <label>
              Usuario
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <LoadingButton type="submit" loading={loading} loadingText="Entrando..." className="w-full">
              Entrar
            </LoadingButton>
          </form>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Si perdiste tus credenciales o tienes un problema, contacta a Moto Isla directamente.
      </p>
    </section>
  );
}
