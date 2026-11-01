"use client";

import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/hooks/useSignOut";
import type { CurrentUser } from "@/lib/dal";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function UserMenu({ user }: { user: CurrentUser }) {
  const { run, pending } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-1.5">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/15 text-xs text-primary">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{user.name}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          <Badge variant="outline" className="mt-1 w-fit border-primary/30 bg-primary/10 text-primary">
            {user.role}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={run}>
          <LogOutIcon />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
