import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create an account"
      subtitle="New accounts join as buyers (USER). An admin can promote you later."
    >
      <RegisterForm />
    </AuthShell>
  );
}
