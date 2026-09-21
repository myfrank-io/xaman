import { getTranslations } from "next-intl/server";

import {
  Bar,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSection,
  SkeletonTabs,
} from "../_loading/Skeletons";

/** Match the checklist layout while its data loads. */
export default async function ChecklistLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <SkeletonPageHeader actions={2} />
      <SkeletonTabs />
      <SkeletonSection action bare>
        <Bar className="h-16 w-full rounded-xl" />
      </SkeletonSection>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Bar className="h-16 w-full" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-t border-border p-4">
            <Bar className="size-7 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Bar className="h-5 w-3/4" />
              <Bar className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
