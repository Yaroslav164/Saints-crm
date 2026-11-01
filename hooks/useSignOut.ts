"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";

/** Sign-out is triggered from two places (user menu, placeholder card), so the
 * pending state and the post-logout navigation live here once. */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = useCallback(async () => {
    setPending(true);
    try {
      await signOut({ redirect: false, callbackUrl: "/auth/login" });
      toast.success("Signed out");
      router.replace("/auth/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
      setPending(false);
    }
  }, [router]);

  return { run, pending };
}
