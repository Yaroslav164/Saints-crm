import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";
import { UserMenu } from "./UserMenu";
import { requirePageUser } from "@/lib/dal";

/** Top bar: drawer trigger + brand below the sidebar breakpoint, account menu on the right. */
export async function Header() {
  const user = await requirePageUser();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:px-5">
      <MobileMenu />
      <div className="md:hidden">
        <BrandMark compact />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
