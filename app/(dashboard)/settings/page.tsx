import { isAdmin, requirePageUser } from "@/lib/dal";
import { SettingsView } from "@/components/settings/SettingsView";

/**
 * Only the role travels to the client: which buttons to draw is a rendering question,
 * and every dictionary write re-checks `requireApiAdmin()` on its own.
 */
export default async function SettingsPage() {
  const user = await requirePageUser();

  return <SettingsView isAdmin={isAdmin(user)} />;
}
