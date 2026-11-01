"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { Loader2Icon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { credentialsSchema, type CredentialsForm } from "@/lib/validations";

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsForm>({ resolver: zodResolver(credentialsSchema) });

  const disabled = useMemo(() => isSubmitting, [isSubmitting]);

  const onSubmit = handleSubmit(async (values) => {
    const result = await signIn("credentials", { ...values, redirect: false });
    if (result?.error) {
      toast.error("Invalid email or password");
      return;
    }
    toast.success("Signed in");
    router.push("/");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="ivanov@saints.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={disabled}>
        {isSubmitting ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
        Sign in
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        No account yet?{" "}
        <Link href="/auth/register" className="text-primary underline-offset-4 hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
