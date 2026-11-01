import { StagePlaceholder } from "@/components/StagePlaceholder";

export default function SettingsPage() {
  return (
    <StagePlaceholder
      title="Settings"
      description="Dictionaries the bundle form and filters are built from."
      stage="stage 6"
      items={[
        "Offers CRUD (name, URL, payout, network, active flag)",
        "GEO CRUD (code, name)",
        "Tags CRUD (name, colour)",
        "Buyers management for admins, plus the ROI alert threshold stored in settings",
      ]}
    />
  );
}
