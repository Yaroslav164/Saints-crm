"use client";

import { Loader2Icon, LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/useSignOut";

type SignOutButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick">;

export function SignOutButton({ variant = "ghost", size = "sm", ...props }: SignOutButtonProps) {
  const { run, pending } = useSignOut();

  return (
    <Button variant={variant} size={size} disabled={pending} onClick={run} {...props}>
      {pending ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />}
      Sign out
    </Button>
  );
}
