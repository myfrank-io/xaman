import { cn } from "@/lib/utils";

/**
 * Les squelettes des écrans du bateau.
 *
 * Un `loading.tsx` s'affiche **à l'instant du tap** : la vieille page ne reste plus figée
 * pendant que le serveur lit la base. Ce qui s'affiche doit donc être la forme exacte de ce
 * qui arrive — mêmes hauteurs de lignes, mêmes cadres, même grille — sinon le contenu, en
 * arrivant, fait sauter l'écran sous le pouce. Les dimensions ci-dessous sont copiées des
 * composants réels (`ListRow` 64 / 76 px, `StatCard` 80 / 104 px, `SectionCard`, la grille
 * des systèmes) : c'est la seule chose que ce fichier a le droit de savoir d'eux.
 *
 * Jamais un `spinner` plein écran : il dit « attends » et ne dit rien d'autre. La forme, elle,
 * dit déjà où on arrive — et c'est ce que quelqu'un qui connaît l'écran lit en premier.
 */

/** Un bloc gris qui respire. `w-*` et `h-*` viennent de l'appelant : ils décrivent le vrai texte. */
export function Bar({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded bg-n-100", className)} aria-hidden />;
}

/** Le même bloc sur le bandeau sombre du tableau de bord, où `--n-100` serait invisible. */
export function DarkBar({ className }: { className?: string }) {
  return (
    <span
      className={cn("block animate-pulse rounded bg-on-navy-surface-2", className)}
      aria-hidden
    />
  );
}

/**
 * L'enveloppe d'un écran en attente. `role="status"` + `aria-busy` : VoiceOver annonce
 * « Chargement… » une fois, et pas quarante blocs vides.
 */
export function SkeletonScreen({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("flex flex-col gap-6", className)}
    >
      {children}
    </div>
  );
}

/** `PageHeader` : le titre `text-h1`, la prose masquée sous `sm`, la place des boutons. */
export function SkeletonPageHeader({ actions = 1 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Bar className="h-7 w-48 sm:h-8" />
        <Bar className="mt-2 hidden h-4 w-72 max-w-full sm:block" />
      </div>
      {actions > 0 ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Bar key={i} className="h-11 w-32 rounded-lg" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Une ligne de liste : 64 px (`md`) ou 76 px (`lg`), colonne de gauche fixe à partir de `sm`. */
export function SkeletonListRow({
  size = "md",
  lead = false,
}: {
  size?: "md" | "lg";
  lead?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-4 last:border-b-0",
        size === "lg" ? "min-h-19 py-3" : "min-h-16 py-2",
      )}
    >
      {lead ? <Bar className="hidden h-4 w-20 shrink-0 sm:block" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bar className="h-4 w-1/2" />
        <Bar className="h-3 w-1/3" />
      </div>
      <Bar className="hidden h-4 w-16 shrink-0 sm:block" />
    </div>
  );
}

/** La liste encadrée que les écrans dessinent autour de leurs lignes. */
export function SkeletonList({
  rows = 5,
  size = "md",
  lead = false,
}: {
  rows?: number;
  size?: "md" | "lg";
  lead?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListRow key={i} size={size} lead={lead} />
      ))}
    </div>
  );
}

/** `SectionCard` : le titre en petites capitales, puis le contenu (encadré, ou nu). */
export function SkeletonSection({
  bare = false,
  action = false,
  children,
}: {
  bare?: boolean;
  action?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Bar className="h-3 w-32" />
        {action ? <Bar className="h-4 w-24" /> : null}
      </div>
      {bare ? (
        children
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {children}
        </div>
      )}
    </section>
  );
}

/** `StatCard` : 80 px, 104 px à partir de `sm`. `dark` pour les quatre vignettes du bandeau. */
export function SkeletonStatCard({ dark = false }: { dark?: boolean }) {
  const Fill = dark ? DarkBar : Bar;
  return (
    <div
      className={cn(
        "flex min-h-20 w-full flex-col justify-between rounded-xl border p-3.5 sm:min-h-26",
        dark ? "border-on-navy-border bg-on-navy-surface" : "border-border bg-surface shadow-sm",
      )}
    >
      <Fill className="h-3 w-20" />
      <Fill className="mt-1 h-7 w-16" />
      <Fill className="mt-1 hidden h-3 w-24 sm:block" />
    </div>
  );
}

/** La grille des systèmes : une liste encadrée sous `sm`, des tuiles de 144 px au-dessus. */
export function SkeletonCategoryGrid({ tiles = 8 }: { tiles?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent lg:grid-cols-3">
      {Array.from({ length: tiles }, (_, i) => (
        <div
          key={i}
          className="flex min-h-16 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0 sm:min-h-36 sm:flex-col sm:items-stretch sm:gap-3 sm:rounded-xl sm:border sm:bg-surface sm:p-4"
        >
          <Bar className="size-8 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 sm:flex sm:flex-col sm:gap-2">
            <Bar className="h-4 w-2/3" />
            <Bar className="mt-2 h-3 w-1/3 sm:mt-0" />
          </div>
          <Bar className="hidden h-2 w-full rounded-full sm:mt-auto sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Les onglets d'un écran (Checklist, Journal, Bateau) : une barre de puces de 44 px. */
export function SkeletonTabs({ tabs = 2 }: { tabs?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: tabs }, (_, i) => (
        <Bar key={i} className="h-11 w-32 rounded-lg" />
      ))}
    </div>
  );
}

/** Un formulaire : le fil d'Ariane du cadre, quelques champs de 44 px, la barre d'actions. */
export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonPageHeader actions={0} />
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bar className="h-3 w-24" />
            <Bar className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Bar className="h-11 w-32 rounded-lg" />
        <Bar className="h-11 w-24 rounded-lg" />
      </div>
    </div>
  );
}
