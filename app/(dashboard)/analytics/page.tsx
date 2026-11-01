import { StagePlaceholder } from "@/components/StagePlaceholder";

export default function AnalyticsPage() {
  return (
    <StagePlaceholder
      title="Analytics"
      description="Team effectiveness over a selectable period."
      stage="stage 6"
      items={[
        "Profit by buyer and revenue by offer",
        "Top bundles for a chosen date range",
        "Funnel by status: how many tests reach profit",
        "Average team ROI with period comparison",
      ]}
    />
  );
}
