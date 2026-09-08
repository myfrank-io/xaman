import Link from "next/link";
import type { Route } from "next";
import { ArrowRightIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import type { ExpenseDetail } from "@/lib/expenses";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { editPurchasePath, haulOutPath, logPath } from "@/lib/queries/boat-routes";

/** One labelled fact of the recap — same shape as the intervention sheet it summarises. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-overline text-ink-2 uppercase">{label}</span>
      <span className="text-body break-words text-foreground">{children}</span>
    </div>
  );
}

/**
 * The recap unrolled under a line of Dépenses (D86). Continues D77: the answer to « c'est quoi,
 * cette ligne ? » is read where the question is asked, not two screens away. It says what the
 * line paid for — statut, intervenant, notes, ce qui y est rattaché — and offers **one** way
 * out: the entity itself, one tap further, when the recap is not enough.
 *
 * `detail` is null when the row carries nothing more (the /dev/ui gallery, a line whose entity
 * has since gone to the corbeille): the panel then holds its exit link and nothing else.
 */
export function ExpenseRecap({
  boatId,
  source,
  entityId,
  detail,
  canWrite,
}: {
  boatId: string;
  source: string;
  entityId: string;
  detail: ExpenseDetail | null;
  canWrite: boolean;
}) {
  const t = useTranslations("supplies.expenses.recap");
  const tl = useTranslations("logs");
  const tld = useTranslations("logs.detail");
  const tp = useTranslations("supplies.purchases");
  const th = useTranslations("haulOuts");

  const facts: React.ReactNode[] = [];
  let body: React.ReactNode = null;
  let counts: string | null = null;
  const actions: React.ReactNode[] = [];

  if (detail?.source === "log") {
    facts.push(
      <Fact key="status" label={tld("fields.status")}>
        <StatusBadge status={detail.status} size="sm" />
      </Fact>,
      <Fact key="by" label={tld("fields.by")}>
        {detail.contactName ?? tl("byCrew")}
      </Fact>,
    );
    if (detail.equipmentName) {
      facts.push(
        <Fact key="equipment" label={tld("fields.equipment")}>
          {detail.equipmentName}
        </Fact>,
      );
    }
    if (detail.engineHours.length > 0) {
      facts.push(
        <Fact key="hours" label={tld("sections.hours")}>
          <span className="num">
            {detail.engineHours
              .map((entry) => `${entry.label} ${formatHours(entry.hours)}`)
              .join(" · ")}
          </span>
        </Fact>,
      );
    }
    body = detail.notes;
    counts =
      [
        detail.completionsCount > 0
          ? t("counts.completions", { count: detail.completionsCount })
          : null,
        detail.purchasesCount > 0 ? t("counts.purchases", { count: detail.purchasesCount }) : null,
        detail.attachmentsCount > 0
          ? t("counts.attachments", { count: detail.attachmentsCount })
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;
  }

  if (detail?.source === "purchase") {
    facts.push(
      <Fact key="supplier" label={tp("fields.supplier")}>
        {detail.supplier ?? tp("noSupplier")}
      </Fact>,
    );
    if (detail.bottleType) {
      facts.push(
        <Fact key="bottle" label={tp("fields.bottleType")}>
          {detail.bottleType}
        </Fact>,
      );
    }
    facts.push(
      <Fact key="log" label={tp("fields.log")}>
        {detail.logTitle ?? tp("noLog")}
      </Fact>,
    );
    body = detail.notes;
    counts = detail.needsReview ? tp("review.help") : null;
    // The intervention comes first: an achat rattaché is read for the work it paid for.
    if (detail.logId) {
      actions.push(
        <Button key="log" asChild variant="outline">
          <Link href={logPath(boatId, detail.logId) as Route}>
            <ArrowRightIcon />
            {t("openLinkedLog")}
          </Link>
        </Button>,
      );
    }
  }

  if (detail?.source === "haul_out") {
    facts.push(
      <Fact key="yard" label={th("fields.yard")}>
        {detail.yard ?? th("noYard")}
      </Fact>,
      <Fact key="started" label={th("fields.startedAt")}>
        {formatDate(detail.startedAt)}
      </Fact>,
      <Fact key="ended" label={th("fields.endedAt")}>
        {detail.endedAt ? formatDate(detail.endedAt) : th("stillAshore")}
      </Fact>,
    );
    body = detail.works;
    // The figure wanted at resale: the yard's own bill is the line above, the interventions
    // of the period are what it does not say.
    counts = [
      th("duration", { days: detail.daysAshore }),
      detail.logsCount > 0
        ? `${th("logs.count", { count: detail.logsCount })} · ${formatCurrency(detail.logsTotal)}`
        : th("logs.count", { count: 0 }),
    ].join(" · ");
  }

  // « Ouvrir » leads to the entity itself. A purchase has no read-only screen of its own: its
  // form is where it is corrected, so only someone who may write is sent there.
  const open =
    source === "log"
      ? { href: logPath(boatId, entityId), label: t("open.log"), edit: false }
      : source === "haul_out"
        ? { href: haulOutPath(boatId, entityId), label: t("open.haul_out"), edit: false }
        : canWrite
          ? { href: editPurchasePath(boatId, entityId), label: t("open.purchase"), edit: true }
          : null;

  return (
    <div className="flex animate-in flex-col gap-4 border-t border-border bg-surface-sunken px-4 py-4 duration-200 fade-in motion-reduce:animate-none sm:px-5">
      {facts.length > 0 ? (
        // Two columns of « statut · intervenant · équipement » on a 390 px phone leave about
        // 160 px a fact: one column below `sm`, where the recap is read one line at a time.
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{facts}</div>
      ) : null}

      {/* Four lines of notes, no more: the whole point of the panel is that the list stays
          readable behind it. The rest is one tap away, on the intervention itself. */}
      {body ? (
        <p className="line-clamp-4 text-body whitespace-pre-wrap text-ink-2">{body}</p>
      ) : null}

      {counts ? <p className="text-caption text-ink-2">{counts}</p> : null}

      {facts.length === 0 && !body ? <p className="text-body text-ink-2">{t("empty")}</p> : null}

      {open || actions.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {actions}
          {open ? (
            <Button asChild variant={actions.length > 0 ? "outline" : "default"}>
              <Link href={open.href as Route}>
                {open.edit ? <PencilIcon /> : <ArrowRightIcon />}
                {open.label}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
