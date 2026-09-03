import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { PartForm } from "@/components/supplies/PartForm";
import { ExpensesTab } from "@/components/supplies/ExpensesTab";
import { GasBottleEntry } from "@/components/supplies/GasBottleEntry";
import { GasFacts } from "@/components/supplies/GasFacts";
import { PurchaseFilters } from "@/components/supplies/PurchaseFilters";
import { PurchaseForm } from "@/components/supplies/PurchaseForm";
import { PurchaseList } from "@/components/supplies/PurchaseList";
import { StockList } from "@/components/supplies/StockList";
import { SuppliesTabs } from "@/components/supplies/SuppliesTabs";
import { EXPENSE_SOURCES, resolveRange } from "@/lib/expenses";
import { gasFacts } from "@/lib/gas";
import { countLowStock } from "@/lib/parts";

import { DEV_BOAT_ID, DevShell } from "../DevShell";
import {
  SAMPLE_CONTACTS,
  SAMPLE_DESIGNATIONS,
  SAMPLE_EXPENSES,
  SAMPLE_GAS_DATES,
  SAMPLE_GAS_DEFAULTS,
  SAMPLE_GAS_PURCHASES,
  SAMPLE_LOGS,
  SAMPLE_PARTS,
  SAMPLE_PURCHASES,
  SAMPLE_SUPPLY_CATEGORIES,
} from "./sample";

/**
 * Visual acceptance of the Dépenses module (E5-1, E5-2, E5-3) without a database:
 * the three tabs, the gas view and the purchase form stacked on one page.
 * `?dialog=1` opens the gas dialog so it can be screenshotted on its own.
 */
export default async function DevSuppliesPage({
  searchParams,
}: {
  searchParams: Promise<{ dialog?: string }>;
}) {
  const { dialog } = await searchParams;
  const t = await getTranslations("supplies");
  const range = resolveRange("rolling12", {});
  const facts = gasFacts(SAMPLE_GAS_DATES);
  const gasTotal = SAMPLE_GAS_PURCHASES.reduce((sum, purchase) => sum + (purchase.amount ?? 0), 0);

  return (
    <DevShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          <PageHeader title={t("title")} subtitle={t("subtitle")} />
          <SuppliesTabs boatId={DEV_BOAT_ID} active="expenses" />
          <ExpensesTab
            boatId={DEV_BOAT_ID}
            period="rolling12"
            range={range}
            sources={[...EXPENSE_SOURCES]}
            data={SAMPLE_EXPENSES}
            filtered={false}
          />
        </div>

        <div className="flex flex-col gap-6">
          <SuppliesTabs boatId={DEV_BOAT_ID} active="purchases" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <GasFacts facts={facts} total={gasTotal} />
            </div>
            <GasBottleEntry
              boatId={DEV_BOAT_ID}
              contacts={SAMPLE_CONTACTS}
              defaults={SAMPLE_GAS_DEFAULTS}
              facts={facts}
              defaultOpen={dialog === "1"}
            />
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <PurchaseFilters
              boatId={DEV_BOAT_ID}
              categories={SAMPLE_SUPPLY_CATEGORIES}
              kind="gas"
              categoryId={null}
              period="all"
              range={range}
            />
          </div>
          <PurchaseList
            boatId={DEV_BOAT_ID}
            purchases={SAMPLE_PURCHASES}
            canWrite
            filtered={false}
            moreHref={null}
          />
        </div>

        <div className="flex flex-col gap-6">
          <SuppliesTabs boatId={DEV_BOAT_ID} active="stock" />
          <StockList
            boatId={DEV_BOAT_ID}
            parts={SAMPLE_PARTS}
            canWrite
            filter="all"
            lowCount={countLowStock(SAMPLE_PARTS)}
            totalCount={SAMPLE_PARTS.length}
          />
        </div>

        <div className="border-t border-border pt-8">
          <PurchaseForm
            boatId={DEV_BOAT_ID}
            purchase={null}
            categories={SAMPLE_SUPPLY_CATEGORIES}
            contacts={SAMPLE_CONTACTS}
            logs={SAMPLE_LOGS}
            suggestions={SAMPLE_DESIGNATIONS}
          />
        </div>

        <div className="border-t border-border pt-8">
          <PartForm
            boatId={DEV_BOAT_ID}
            part={null}
            categories={SAMPLE_SUPPLY_CATEGORIES}
            contacts={SAMPLE_CONTACTS}
          />
        </div>
      </div>
    </DevShell>
  );
}
