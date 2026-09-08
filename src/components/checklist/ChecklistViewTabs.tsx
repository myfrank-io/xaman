"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { AttentionDot } from "@/components/common/AttentionDot";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checklistPath } from "@/lib/queries/boat-routes";

/**
 * `attentionCount` : ce qui est en retard ou dû dans la journée. Le compte gris dit la
 * longueur de la liste (trente jours), le point rouge dit ce qui ne peut pas attendre — le
 * même que celui de l'onglet de navigation, une marche plus bas (D81).
 */
export function ChecklistViewTabs({
  boatId,
  view,
  todoCount,
  attentionCount = 0,
}: {
  boatId: string;
  view: "grid" | "todo";
  todoCount: number;
  attentionCount?: number;
}) {
  const t = useTranslations("checklist.views");
  const router = useRouter();
  return (
    <Tabs
      value={view}
      onValueChange={(next) =>
        router.replace(
          checklistPath(boatId, next === "todo" ? { view: "todo" } : undefined) as Route,
        )
      }
    >
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="grid" className="min-w-32">
          {t("grid")}
        </TabsTrigger>
        <TabsTrigger value="todo" className="min-w-32 gap-2">
          {t("todo")}
          <AttentionDot count={attentionCount} size="sm" />
          <span className="num text-caption text-ink-3">{todoCount}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
