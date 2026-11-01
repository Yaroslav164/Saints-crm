import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { DemoAccounts } from "@/components/auth/DemoAccounts";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Track team bundles, budgets and ROI in one place."
      footer={<DemoAccounts />}
    >
      <LoginForm />
    </AuthShell>
  );
}
