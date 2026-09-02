"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checklistPath } from "@/lib/queries/boat-routes";

export function ChecklistViewTabs({
  boatId,
  view,
  todoCount,
}: {
  boatId: string;
  view: "grid" | "todo";
  todoCount: number;
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
          <span className="num text-caption text-ink-3">{todoCount}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
