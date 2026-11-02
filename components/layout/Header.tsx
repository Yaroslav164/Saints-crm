import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";
import { NotificationsBell } from "./NotificationsBell";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { navHrefsForRole } from "./nav-items";
import { requirePageUser } from "@/lib/dal";

/** Top bar: drawer trigger + brand below the sidebar breakpoint, alerts, theme and account on the right. */
export async function Header() {
  const user = await requirePageUser();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:px-5">
      <MobileMenu hrefs={navHrefsForRole(user.role)} />
      <div className="md:hidden">
        <BrandMark compact />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* Owns its own fetch: the bell must not make the streamed shell wait on a query, and
            it polls on the client, so the header stays renderable without it. */}
        <NotificationsBell />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
