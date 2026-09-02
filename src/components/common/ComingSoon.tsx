import { ConstructionIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";

export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("common");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <EmptyState icon={<ConstructionIcon />} title={t("comingSoon")} />
    </div>
  );
}
