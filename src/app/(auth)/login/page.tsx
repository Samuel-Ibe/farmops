import { Suspense } from "react";
import LoginForm from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <Suspense>
      <LoginForm
        callbackUrl={params.callbackUrl}
        authError={params.error}
      />
    </Suspense>
  );
}
