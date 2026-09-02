import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ClipboardListIcon, CogIcon, NotebookPenIcon, PlusIcon } from "lucide-react";

import { CategoryBadge } from "@/components/common/CategoryBadge";
import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ProgressBar } from "@/components/common/ProgressBar";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/format";

import { DevInteractive } from "./DevInteractive";

const SAMPLE_CATEGORIES = [
  { name: "Moteurs", color: "#D97706" },
  { name: "Dérives & Safrans", color: "#0EA5E9" },
  { name: "Voiles & Gréement", color: "#7C3AED" },
  { name: "Coque & Pont", color: "#64748B" },
  { name: "Électronique / Nav", color: "#2563EB" },
  { name: "Énergie", color: "#EAB308" },
  { name: "Hydraulique & Circuits", color: "#0D9488" },
  { name: "Sécurité", color: "#DC2626" },
] as const;

const SAMPLE_CARDS = [
  { name: "Moteurs", color: "#D97706", total: 13, ratio: 0.4, overdue: 3 },
  { name: "Dérives & Safrans", color: "#0EA5E9", total: 6, ratio: null, overdue: 0 },
  { name: "Voiles & Gréement", color: "#7C3AED", total: 23, ratio: 0.85, overdue: 1 },
  { name: "Coque & Pont", color: "#64748B", total: 12, ratio: 1, overdue: 0 },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const t = await getTranslations("dev");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");

  const nav: NavItem[] = [
    { key: "dashboard", href: "/dev/ui", label: tn("dashboard") },
    { key: "logs", href: "/dev/ui/logs", label: tn("logs") },
    { key: "checklist", href: "/dev/ui/checklist", label: tn("checklist") },
    { key: "supplies", href: "/dev/ui/supplies", label: tn("supplies") },
    { key: "haulOuts", href: "/dev/ui/haul-outs", label: tn("haulOuts") },
    { key: "contacts", href: "/dev/ui/contacts", label: tn("contacts") },
    { key: "boat", href: "/dev/ui/boat", label: tn("boat") },
    { key: "members", href: "/dev/ui/members", label: tn("members") },
    { key: "settings", href: "/dev/ui/settings", label: tn("settings") },
  ];

  return (
    <AppShell
      boatName={t("sample.boatName")}
      boatSubtitle="Marsaudon Composites ORC 50"
      nav={nav}
      primaryAction={
        <Button size="icon" variant="secondary" aria-label={tc("add")}>
          <PlusIcon className="size-5" />
        </Button>
      }
      sidebarFooter={
        <Button className="w-full">
          <PlusIcon />
          {tc("add")}
        </Button>
      }
    >
      <div className="flex flex-col gap-10">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <Button>
              <PlusIcon />
              {tc("add")}
            </Button>
          }
        />

        <Section title={t("sections.colors")}>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-header-gradient p-4 sm:grid-cols-4">
            <StatCard variant="dark" label={tn("checklist")} value="3" hint="en retard" />
            <StatCard variant="dark" label={tn("logs")} value="2" hint="planifiées / urgentes" />
            <StatCard variant="dark" label="Moteur SB" value={formatHours(1234.5)} />
            <StatCard variant="dark" label="2026" value={formatCurrency(4321.5)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_CATEGORIES.map((c) => (
              <CategoryBadge key={c.name} name={c.name} color={c.color} />
            ))}
            <CategoryBadge name="Catégorie archivée" color="#64748B" archived />
          </div>
        </Section>

        <Section title={t("sections.buttons")}>
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <PlusIcon />
              {tc("add")}
            </Button>
            <Button variant="secondary">{tc("edit")}</Button>
            <Button variant="outline">{tc("cancel")}</Button>
            <Button variant="ghost">{tc("back")}</Button>
            <Button variant="destructive">{tc("delete")}</Button>
            <Button variant="link">{tc("more")}</Button>
            <Button size="lg">{tc("save")}</Button>
            <Button size="icon" variant="outline" aria-label={tc("add")}>
              <PlusIcon />
            </Button>
            <Button disabled>{tc("loading")}</Button>
          </div>
        </Section>

        <Section title={t("sections.forms")}>
          <Card>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="dev-title">{t("sample.title")}</Label>
                <Input id="dev-title" placeholder={t("sample.title")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dev-category">{t("sample.category")}</Label>
                <NativeSelect id="dev-category" defaultValue="engines">
                  {SAMPLE_CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dev-date">{formatDate("2026-09-02")}</Label>
                <Input id="dev-date" type="date" defaultValue="2026-09-02" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dev-cost">{formatCurrency(150)}</Label>
                <Input id="dev-cost" inputMode="decimal" placeholder="0,00" aria-invalid />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="dev-notes">Notes</Label>
                <Textarea id="dev-notes" placeholder="…" />
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="dev-check" defaultChecked />
                <Label htmlFor="dev-check">{tc("yes")}</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="dev-switch" defaultChecked />
                <Label htmlFor="dev-switch">{tc("yes")}</Label>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title={t("sections.badges")}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="planned" />
            <StatusBadge status="in_progress" />
            <StatusBadge status="done" />
            <StatusBadge status="urgent" />
            <Badge>{tc("none")}</Badge>
            <Badge variant="secondary" size="sm">
              À vérifier
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChecklistStateBadge state="never" />
            <ChecklistStateBadge state="ok" />
            <ChecklistStateBadge state="soon" />
            <ChecklistStateBadge state="overdue" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Alert variant="warning">
              <ClipboardListIcon />
              <AlertTitle>Hors ligne — consultation seule</AlertTitle>
              <AlertDescription>
                Les formulaires seront réactivés au retour du réseau.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <CogIcon />
              <AlertTitle>Compteur inconnu</AlertTitle>
              <AlertDescription>Aucun relevé d&apos;heures pour ce moteur.</AlertDescription>
            </Alert>
          </div>
        </Section>

        <Section title={t("sections.cards")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SAMPLE_CARDS.map((c) => (
              <Card key={c.name} className="gap-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </CardTitle>
                  <CardDescription>{c.total} points</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <ProgressBar ratio={c.ratio} color={c.color} />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{formatPercent(c.ratio)}</span>
                    {c.overdue > 0 ? (
                      <ChecklistStateBadge state="overdue" size="sm" />
                    ) : (
                      <ChecklistStateBadge state="ok" size="sm" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={tn("checklist")} value="3" hint="points en retard" tone="danger" />
            <StatCard label={tn("logs")} value="2" hint="planifiées" tone="warning" />
            <StatCard label="Moteur BB" value={formatHours(987)} hint={formatDate("2026-08-28")} />
          </div>
          <EmptyState
            icon={<NotebookPenIcon />}
            title={t("sample.emptyTitle")}
            description={t("sample.emptyDescription")}
            action={
              <Button>
                <PlusIcon />
                {tc("add")}
              </Button>
            }
          />
        </Section>

        <Section title={t("sections.overlays")}>
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">{tn("logs")}</TabsTrigger>
              <TabsTrigger value="b">{tn("checklist")}</TabsTrigger>
              <TabsTrigger value="c">{tn("supplies")}</TabsTrigger>
            </TabsList>
            <TabsContent value="a">
              <DevInteractive />
            </TabsContent>
            <TabsContent value="b">
              <p className="text-sm text-muted-foreground">{tc("empty")}</p>
            </TabsContent>
            <TabsContent value="c">
              <p className="text-sm text-muted-foreground">{tc("empty")}</p>
            </TabsContent>
          </Tabs>
        </Section>
      </div>
    </AppShell>
  );
}
