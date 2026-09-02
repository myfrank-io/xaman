"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { suppliesPath } from "@/lib/queries/boat-routes";

export type SuppliesView = "expenses" | "purchases" | "stock";
export const SUPPLIES_VIEWS: SuppliesView[] = ["expenses", "purchases", "stock"];

/**
 * Three tabs, the fourth entry (gas) being a filter of « Achats » (E5-1). The tab lives in
 * the URL so a reload, a back or a shared link land on the same screen (ux-flows §1.2).
 */
export function SuppliesTabs({ boatId, active }: { boatId: string; active: SuppliesView }) {
  const t = useTranslations("supplies.tabs");
  const router = useRouter();
  return (
    <Tabs
      value={active}
      onValueChange={(value) =>
        router.replace(suppliesPath(boatId, value as SuppliesView) as Route)
      }
    >
      <TabsList className="w-full sm:w-auto">
        {SUPPLIES_VIEWS.map((view) => (
          <TabsTrigger key={view} value={view} className="min-w-28">
            {t(view)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
