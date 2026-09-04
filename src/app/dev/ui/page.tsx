import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  AnchorIcon,
  CircleCheckIcon,
  CloudOffIcon,
  InfoIcon,
  NotebookPenIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { XamanMark } from "@/components/brand/XamanMark";
import { CategoryBadge, CategoryIcon } from "@/components/common/CategoryBadge";
import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { DueLabel } from "@/components/common/DueLabel";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppShell } from "@/components/layout/AppShell";
import { PrimaryActionSheet } from "@/components/layout/PrimaryActionSheet";
import {
  ACCOUNT_NAV_KEYS,
  PRIMARY_NAV_KEYS,
  SECONDARY_NAV_KEYS,
  type NavItem,
  type NavKey,
} from "@/components/layout/nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";

import { DevFields, DevOverlays } from "./DevInteractive";
import { NEUTRALS, SAMPLE_CATEGORIES } from "./sample-data";
import { devUiEnabled } from "@/lib/dev-ui";

const DEV_BOAT_ID = "00000000-0000-4000-8000-000000000000";

const SAMPLE_RATIOS: (number | null)[] = [0.4, null, 0.85, 1];

const SEMANTIC = [
  ["Planifié", "--status-planned", "--status-planned-fg", "--status-planned-tint"],
  ["En cours", "--status-in-progress", "--status-in-progress-fg", "--status-in-progress-tint"],
  ["Terminé", "--status-done", "--status-done-fg", "--status-done-tint"],
  ["Urgent", "--status-urgent", "--status-urgent-fg", "--status-urgent-tint"],
  ["À faire", "--state-never", "--state-never-fg", "--state-never-tint"],
  ["Bientôt", "--state-soon", "--state-soon-fg", "--state-soon-tint"],
  ["En retard", "--state-overdue", "--state-overdue-fg", "--state-overdue-tint"],
] as const;

/** The whole gallery, in reading order. Kept in step with tests/e2e/touch-audit.spec.ts. */
const PREVIEWS: { href: string; label: string }[] = [
  { href: "/dev/ui/dashboard", label: "Tableau de bord" },
  { href: "/dev/ui/checklist", label: "Checklist" },
  { href: "/dev/ui/checklist-setup", label: "Checklist · mise en route" },
  { href: "/dev/ui/checklist-form", label: "Checklist · nouveau point" },
  { href: "/dev/ui/logs", label: "Interventions" },
  { href: "/dev/ui/attachments", label: "Documents et pièces jointes" },
  { href: "/dev/ui/boat", label: "Bateau" },
  { href: "/dev/ui/boat/engine", label: "Bateau · fiche moteur" },
  { href: "/dev/ui/boat/engine-form", label: "Bateau · formulaire moteur" },
  { href: "/dev/ui/boat/equipment-form", label: "Bateau · formulaire équipement" },
  { href: "/dev/ui/boat/settings", label: "Bateau · paramètres" },
  { href: "/dev/ui/supplies", label: "Achats et stock" },
  { href: "/dev/ui/haul-outs", label: "Sorties de l'eau" },
  { href: "/dev/ui/contacts", label: "Prestataires" },
  { href: "/dev/ui/members", label: "Équipage" },
  { href: "/dev/ui/report", label: "Rapport d'état" },
  { href: "/dev/ui/trash", label: "Corbeille" },
  { href: "/dev/ui/import", label: "Import" },
  { href: "/dev/ui/review", label: "Relecture" },
  { href: "/dev/ui/boats", label: "Choix du bateau" },
  { href: "/dev/ui/boats/new", label: "Ajouter mon bateau" },
  { href: "/dev/ui/checklist-plan", label: "Checklist · choisir un plan" },
  { href: "/dev/ui/profile", label: "Mon compte" },
  { href: "/dev/ui/reset-password", label: "Nouveau mot de passe" },
  { href: "/dev/ui/install", label: "Installer l'application" },
  { href: "/dev/ui/dialogs?d=complete", label: "Dialogue · marquer comme fait" },
  { href: "/dev/ui/dialogs?d=hours", label: "Dialogue · relevé de compteur" },
  { href: "/dev/ui/dialogs?d=contact", label: "Dialogue · nouveau prestataire" },
  { href: "/dev/ui/supplies?dialog=1", label: "Dialogue · bouteille de gaz" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2">{title}</h2>
        {description ? <p className="mt-1 text-caption text-ink-2">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function DevUiPage() {
  if (!devUiEnabled()) notFound();

  const t = await getTranslations("dev");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");
  const ta = await getTranslations("app");
  const tch = await getTranslations("checklist");

  const keys: NavKey[] = [...PRIMARY_NAV_KEYS, ...SECONDARY_NAV_KEYS, ...ACCOUNT_NAV_KEYS];
  const badges: Partial<Record<NavKey, number>> = { checklist: 3, logs: 2, trash: 4 };
  const hints: Partial<Record<NavKey, string>> = { contacts: "6 fiches", supplies: "4 321 €" };
  const nav: NavItem[] = keys.map((key) => ({
    key,
    href: `/boats/${DEV_BOAT_ID}/${key}`,
    label: tn(key),
    shortLabel: tn(`short.${key}`),
    badge: badges[key],
    hint: hints[key],
  }));

  return (
    <AppShell
      boatName={t("sample.boatName")}
      boatSubtitle="Marsaudon Composites ORC 50"
      nav={nav}
      primaryAction={<PrimaryActionSheet boatId={DEV_BOAT_ID} role="owner" />}
      accountMenu={
        <AccountMenu
          boatId={DEV_BOAT_ID}
          role="owner"
          user={{ name: "Xavier Marin", email: "xavier@exemple.fr" }}
        />
      }
    >
      <div className="flex flex-col gap-10">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <Button asChild variant="outline">
              <a href="/dev/ui/dashboard">{t("dashboard.title")}</a>
            </Button>
          }
        />

        {/* Every preview page, in one place. There is no other way to find them: the audit
            reads its own list, and a screen with no preview is a screen nobody looks at —
            which is how six of them went months without being opened on a phone. */}
        <Section title="Écrans">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PREVIEWS.map((preview) => (
              <li key={preview.href}>
                <a
                  href={preview.href}
                  className="flex min-h-11 items-center rounded-lg border border-border tap-feedback bg-surface px-3 py-2 text-body hover:bg-accent"
                >
                  {preview.label}
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("sections.brand")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-start gap-4 rounded-xl bg-header-gradient p-6 text-on-navy">
              <p className="text-overline text-brass-light uppercase">{ta("eyebrow")}</p>
              <XamanLogotype className="h-10" />
              <div className="flex items-center gap-4">
                <XamanMark className="size-10" decorative />
                <XamanMark className="size-8 text-brass-light" decorative />
                <XamanMark className="size-6" decorative />
              </div>
            </div>
            <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6 text-navy">
              <p className="text-overline text-brass uppercase">{ta("eyebrow")}</p>
              <XamanLogotype className="h-10" />
              <p className="text-caption text-ink-2">
                Le laiton est un accent de marque : jamais sur une donnée.
              </p>
            </div>
          </div>
        </Section>

        <Section title={t("sections.neutrals")} description="Rampe unique, teinte 215°.">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
            {NEUTRALS.map(([token, hex, role]) => (
              <div key={token} className="overflow-hidden rounded-lg border border-border">
                <div className="h-12" style={{ backgroundColor: hex }} />
                <div className="bg-surface px-2 py-1.5">
                  <p className="truncate num text-[11px] font-semibold">{hex}</p>
                  <p className="truncate text-[11px] text-ink-3">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title={t("sections.semantic")}
          description="Trois variantes : pastille, texte (-fg), fond (-tint)."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SEMANTIC.map(([label, dot, fg, tint]) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border p-3"
                style={{ backgroundColor: `var(${tint})`, borderColor: `var(${fg})` }}
              >
                <span
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(${dot})` }}
                />
                <span className="text-label font-semibold" style={{ color: `var(${fg})` }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title={t("sections.categories")}
          description="Palette harmonisée : 5 couleurs corrigées, 0 sous 3:1. Toujours icône + libellé."
        >
          <div className="flex flex-wrap gap-2">
            {SAMPLE_CATEGORIES.map((c) => (
              <CategoryBadge key={c.id} name={c.name} color={c.color} icon={c.icon} withIcon />
            ))}
            <CategoryBadge name={tc("archivedCategory")} color="#63748A" archived />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {SAMPLE_CATEGORIES.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <CategoryIcon color={c.color} icon={c.icon} />
                <span className="num text-caption text-ink-2">{c.color}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("sections.typography")}>
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
            <p className="text-overline text-ink-2 uppercase">Surtitre · text-overline 11/600</p>
            <p className="text-display">Xaman · text-display 28</p>
            <p className="text-h1">Titre d&apos;écran · text-h1 24</p>
            <p className="text-h2">Titre de section · text-h2 19</p>
            <p className="text-h3">Titre de carte · text-h3 17</p>
            <p className="text-body">Corps · text-body 16 — la taille de tous les champs.</p>
            <p className="text-label text-ink-2">Libellé · text-label 14/500</p>
            <p className="text-caption text-ink-3">Métadonnée · text-caption 13</p>
            <p className="num text-num-lg font-semibold">1 234,5 h · 4 321,50 €</p>
          </div>
        </Section>

        <Section
          title={t("sections.buttons")}
          description="Toutes les cibles ≥ 44 px ; primaire 48 px."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xl">{tc("save")}</Button>
            <Button>{tc("add")}</Button>
            <Button variant="secondary">{tc("edit")}</Button>
            <Button variant="outline">{tc("cancel")}</Button>
            <Button variant="ghost">{tc("back")}</Button>
            <Button variant="destructive">{tc("delete")}</Button>
            <Button variant="link">{tc("more")}</Button>
            <Button variant="offline" aria-disabled>
              <CloudOffIcon />
              {tc("save")}
            </Button>
            <Button disabled>{tc("loading")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-header-gradient p-4">
            <Button variant="inverse">{tc("add")}</Button>
            <Button variant="inverse" size="icon" aria-label={tc("add")}>
              <NotebookPenIcon />
            </Button>
          </div>
        </Section>

        <Section
          title={t("sections.fields")}
          description="Pas de type=number, suffixe hors du champ, dates natives, chips de catégorie."
        >
          <DevFields categories={[...SAMPLE_CATEGORIES]} />
          <div className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dev-select">{t("sample.category")}</Label>
              <NativeSelect id="dev-select" defaultValue="engines">
                {SAMPLE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
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
          </div>
        </Section>

        <Section
          title={t("sections.badges")}
          description="Plein = action requise. Teinté = état stable. Toujours icône + libellé."
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="planned" />
            <StatusBadge status="in_progress" />
            <StatusBadge status="done" />
            <StatusBadge status="urgent" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChecklistStateBadge state="never" />
            <ChecklistStateBadge state="ok" />
            <ChecklistStateBadge state="soon" />
            <ChecklistStateBadge state="overdue" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="sm" variant="secondary">
              À vérifier
            </Badge>
            <Badge size="md" variant="secondary">
              Personnalisé
            </Badge>
            <Badge size="sm">4</Badge>
            <DueLabel status="overdue" daysRemaining={-126} />
            <DueLabel status="soon" daysRemaining={9} />
            <DueLabel status="soon" daysRemaining={null} hoursRemaining={40} />
            <DueLabel status="never" hasCounter={false} />
          </div>
        </Section>

        <Section title={t("sections.rows")} description="64 px (paysage) · 76 px (portrait).">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <ListRow
              lead={<ChecklistStateBadge state="overdue" size="sm" />}
              title="Vidange huile + filtre — Moteur SB"
              meta={
                <>
                  <CategoryBadge
                    name="Moteurs"
                    color="#D97706"
                    icon="cog"
                    withIcon
                    size="sm"
                    variant="inline"
                  />
                  <span>· relevé le 28/08/2026</span>
                </>
              }
              trailing={<DueLabel status="overdue" daysRemaining={-126} />}
              action={
                <Button size="sm" variant="outline" className="min-w-22">
                  {tch("markDone")}
                </Button>
              }
              categoryColor="#D97706"
            />
            <ListRow
              lead={<StatusBadge status="urgent" size="sm" />}
              title="Fuite inverseur BB"
              meta={<span>Moteurs · Nous-mêmes</span>}
              trailing={<span className="num text-caption text-ink-2">depuis 4 j</span>}
              href="/dev/ui"
              categoryColor="#D97706"
            />
            <ListRow
              size="lg"
              lead={<ChecklistStateBadge state="soon" size="sm" />}
              title="Capteur loch (roue à aubes)"
              meta={<span>Électronique / Nav</span>}
              trailing={<DueLabel status="soon" daysRemaining={9} />}
              action={
                <Button size="sm" variant="outline" className="min-w-22">
                  {tch("markDone")}
                </Button>
              }
              categoryColor="#1D4ED8"
            />
          </div>
        </Section>

        <Section title={t("sections.cards")}>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-header-gradient p-4 lg:grid-cols-4">
            <StatCard variant="dark" label="En retard" value="3" hint="points" href="/dev/ui" />
            <StatCard
              variant="dark"
              label="Bientôt"
              value="5"
              hint="sous 30 j ou 25 h"
              href="/dev/ui"
            />
            <StatCard
              variant="dark"
              label="Interventions"
              value="2"
              hint="dont 1 urgente"
              tone="danger"
              href="/dev/ui"
            />
            <StatCard
              variant="dark"
              label="Dépenses 2026"
              value={formatCurrency(4321.5)}
              hint="12 lignes"
              href="/dev/ui"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Points en retard"
              value="3"
              hint="dont 1 sur les moteurs"
              tone="danger"
            />
            <StatCard label="Moteur BB" value={formatHours(987)} hint={formatDate("2026-08-28")} />
            <StatCard label="Annexe" value="—" hint={tc("unknownCounter")} />
          </div>
          <SectionCard title="État des systèmes" actionHref="/dev/ui" actionLabel={tc("seeAll")}>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {SAMPLE_CATEGORIES.slice(0, 4).map((c, index) => (
                <div key={c.id} className="flex flex-col gap-2 bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <CategoryIcon color={c.color} icon={c.icon} />
                    <span className="truncate text-h3">{c.name}</span>
                  </div>
                  <ProgressBar
                    ratio={SAMPLE_RATIOS[index] ?? null}
                    color={c.color}
                    label={c.name}
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </Section>

        <Section title={t("sections.states")}>
          <div className="flex flex-col gap-3">
            <div className="flex min-h-10 items-center gap-2 rounded-lg border border-warning-border bg-warning-tint px-4 py-2 text-caption">
              <CloudOffIcon className="size-4 text-warning-fg" aria-hidden />
              <span className="font-medium">Hors ligne — consultation seule.</span>
              <span className="num text-ink-2">Données du 02/09 à 14:12.</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Alert variant="info">
                <InfoIcon />
                <AlertTitle>7 lignes à vérifier</AlertTitle>
                <AlertDescription>Importées du carnet papier.</AlertDescription>
              </Alert>
              <Alert variant="warning">
                <TriangleAlertIcon />
                <AlertTitle>Compteur inconnu</AlertTitle>
                <AlertDescription>Aucun relevé d&apos;heures sur Moteur SB.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>L&apos;enregistrement a échoué</AlertTitle>
                <AlertDescription>Vos données sont conservées ici.</AlertDescription>
              </Alert>
              <Alert variant="success">
                <CircleCheckIcon />
                <AlertTitle>Relevé enregistré</AlertTitle>
                <AlertDescription>Moteur SB 1 256,0 h.</AlertDescription>
              </Alert>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <EmptyState
              icon={<NotebookPenIcon />}
              title={t("sample.emptyTitle")}
              description={t("sample.emptyDescription")}
              action={<Button size="xl">{tc("add")}</Button>}
            />
            <EmptyState
              variant="filtered"
              icon={<SearchIcon />}
              title={t("sample.filteredTitle")}
              description={t("sample.filteredDescription")}
              action={<Button variant="outline">{t("sample.clearFilters")}</Button>}
            />
            <EmptyState
              variant="positive"
              icon={<AnchorIcon />}
              title={t("sample.positiveTitle")}
              description={t("sample.positiveDescription")}
            />
          </div>
        </Section>

        <Section title={t("sections.overlays")}>
          <DevOverlays />
        </Section>
      </div>
    </AppShell>
  );
}
