import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getSessionUser } from "@/lib/dal";
import { BrandMark } from "./BrandMark";
import { NavList } from "./NavList";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Desktop sidebar. Session read makes it dynamic, so the layout streams it. */
export async function Sidebar() {
  const user = await getSessionUser();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <BrandMark />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavList />
      </div>
      {user && (
        <footer className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 px-2.5 py-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/15 text-xs text-primary">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
              <p className="truncate text-xs leading-tight text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto border-indigo-500/40 bg-indigo-500/15 text-indigo-300">
              {user.role === "ADMIN" ? "Admin" : "Buyer"}
            </Badge>
          </div>
        </footer>
      )}
    </aside>
  );
}
