import { StagePlaceholder } from "@/components/StagePlaceholder";

export default function BundlesPage() {
  return (
    <StagePlaceholder
      title="Bundles"
      description="The bundle list is the main working screen of the CRM."
      stage="stage 3"
      items={[
        "TanStack Table with every column from the spec (offer, angle, GEO, buyer, status, budget, spend, revenue, ROI, profit, dates)",
        "Filters by status, offer, buyer, GEO, ROI range and creation date, plus search",
        "Sorting on every column, 20-per-page pagination, bulk status change and delete",
        "Card layout instead of a table on phones, CSV export",
      ]}
    />
  );
}
