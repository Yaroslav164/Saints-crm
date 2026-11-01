import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { requirePageUser } from "@/lib/dal";

/** Top bar: drawer trigger + brand below the sidebar breakpoint, theme and account on the right. */
export async function Header() {
  const user = await requirePageUser();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:px-5">
      <MobileMenu />
      <div className="md:hidden">
        <BrandMark compact />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
