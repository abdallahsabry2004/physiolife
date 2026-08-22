import { createFileRoute } from "@tanstack/react-router";
import { PageGuard } from "@/components/PageGuard";
import { FinancialReportsView } from "@/components/FinancialReportsView";

export const Route = createFileRoute("/_authenticated/financial-reports")({
  component: FinancialReportsRoute,
});

function FinancialReportsRoute() {
  return (
    <PageGuard page="financial_reports">
      <FinancialReportsView />
    </PageGuard>
  );
}
