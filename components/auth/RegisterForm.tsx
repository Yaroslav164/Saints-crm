"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApi } from "@/lib/api-client";
import { registerSchema, type RegisterForm } from "@/lib/validations";

export function RegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await fetchApi("/api/auth/register", { method: "POST", body: JSON.stringify(values) });
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Account created — sign in to continue");
        router.push("/auth/login");
        return;
      }
      toast.success("Account created");
      router.push("/");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not register";
      const fields = (error as { fields?: Record<string, string> }).fields;
      for (const [key, value] of Object.entries(fields ?? {})) {
        setError(key as keyof RegisterForm, { message: value });
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="name" placeholder="Ivan Ivanov" aria-invalid={Boolean(errors.name)} {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="ivanov@saints.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} {...register("password")} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
        Create account
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already registered?{" "}
        <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
