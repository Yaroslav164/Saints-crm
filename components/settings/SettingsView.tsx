"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertsTab } from "@/components/settings/AlertsTab";
import { BuyersTab } from "@/components/settings/BuyersTab";
import { GeosTab } from "@/components/settings/GeosTab";
import { OffersTab } from "@/components/settings/OffersTab";
import { TagsTab } from "@/components/settings/TagsTab";

const TABS = [
  { value: "offers", label: "Offers" },
  { value: "geos", label: "GEOs" },
  { value: "tags", label: "Tags" },
  { value: "buyers", label: "Buyers", adminOnly: true },
  { value: "alerts", label: "Alerts" },
];

/**
 * Dictionaries screen. The tab lives in the URL, so a link to `/settings?tab=buyers`
 * opens where a teammate meant you to land, and a reload does not jump back to Offers.
 *
 * A buyer sees the same lists as an admin but without the write buttons: the rows are
 * shared context for every bundle in the team, and refusing the write is the API's job
 * (`requireApiAdmin`), not a matter of hiding a control.
 */
export function SettingsView({ isAdmin }: { isAdmin: boolean }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);
  const initial = tabs.some((tab) => tab.value === requested) ? requested! : tabs[0].value;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "The dictionaries the bundle form and the filters are built from. A rename shows up in both immediately."
            : "The dictionaries behind the bundle form. Only an admin changes them; you can read what a bundle refers to."}
        </p>
      </div>

      <Tabs
        defaultValue={initial}
        onValueChange={(value) => {
          const next = value === tabs[0].value ? "" : `?tab=${value}`;
          window.history.replaceState(null, "", `/settings${next}`);
        }}
      >
        <TabsList className="flex-wrap">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="offers" className="pt-3">
          <OffersTab canManage={isAdmin} />
        </TabsContent>
        <TabsContent value="geos" className="pt-3">
          <GeosTab canManage={isAdmin} />
        </TabsContent>
        <TabsContent value="tags" className="pt-3">
          <TagsTab canManage={isAdmin} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="buyers" className="pt-3">
            <BuyersTab canManage={isAdmin} />
          </TabsContent>
        )}
        <TabsContent value="alerts" className="pt-3">
          <AlertsTab canManage={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
