"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, MoreHorizontalIcon } from "lucide-react";

import { CategoryIcon } from "@/components/common/CategoryBadge";
import { CATEGORY_ICON_KEYS } from "@/components/common/category-icons";
import { Field } from "@/components/forms/Field";
import { useFieldError } from "@/components/forms/use-field-error";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  archiveCategory,
  createCategory,
  reorderCategories,
  restoreCategory,
  updateCategory,
} from "@/lib/actions/categories";
import { contrastRatio } from "@/lib/color";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import {
  CATEGORY_COLORS,
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/schemas/categories";
import { cn } from "@/lib/utils";

export type CategoryRow = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isActive: boolean;
  activeItems: number;
  updatedAt: string;
};

type ActionResultLike = { ok: boolean; error?: string };

// Categories settings (E2-4): rename, colour, fixed order, archive with its impact, restore.
export function CategoriesManager({
  boatId,
  categories,
  canWrite,
}: {
  boatId: string;
  categories: CategoryRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<CategoryRow | null>(null);
  const active = categories.filter((category) => category.isActive);
  const archived = categories.filter((category) => !category.isActive);

  function run(action: () => Promise<ActionResultLike>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(errorMessage(result.error ?? "errors.unknown"));
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...active];
    const target = index + direction;
    const current = next[index];
    const other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    run(
      () => reorderCategories({ boatId, orderedIds: next.map((category) => category.id) }),
      t("saved"),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="overflow-hidden rounded-xl border border-border bg-surface">
        {active.map((category, index) => (
          <li
            key={category.id}
            className="flex min-h-16 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0"
          >
            <CategoryIcon color={category.color} icon={category.icon} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-medium">{category.name}</div>
              <div className="text-caption text-ink-2">
                {t("itemsCount", { count: category.activeItems })}
              </div>
            </div>
            {canWrite ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("moveUp")}
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("moveDown")}
                  disabled={pending || index === active.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={tc("actions")}>
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(category)}>
                      {tc("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setArchiving(category)}>
                      {t("archive")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {canWrite ? (
        <div>
          <Button type="button" variant="outline" onClick={() => setCreating(true)}>
            {t("add")}
          </Button>
        </div>
      ) : null}
      {archived.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          className="rounded-xl border border-border bg-surface-2 px-4"
        >
          <AccordionItem value="archived">
            <AccordionTrigger className="text-body text-ink-2">
              {t("archivedSection", { count: archived.length })}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="flex flex-col">
                {archived.map((category) => (
                  <li key={category.id} className="flex min-h-14 items-center gap-3 py-1">
                    <CategoryIcon color={category.color} icon={category.icon} />
                    <span className="min-w-0 flex-1 truncate text-body">{category.name}</span>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => restoreCategory({ boatId, categoryId: category.id }),
                            t("restored"),
                          )
                        }
                      >
                        {t("restore")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      <CategoryDialog
        boatId={boatId}
        category={editing}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
      <ArchiveDialog
        boatId={boatId}
        category={archiving}
        others={active.filter((category) => category.id !== archiving?.id)}
        onOpenChange={(open) => (open ? undefined : setArchiving(null))}
      />
    </div>
  );
}

function CategoryDialog({
  boatId,
  category,
  open,
  onOpenChange,
}: {
  boatId: string;
  category: CategoryRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("categories");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? t("edit") : t("new")}</DialogTitle>
          <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <CategoryForm
            key={category?.id ?? "new"}
            boatId={boatId}
            category={category}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  boatId,
  category,
  onClose,
}: {
  boatId: string;
  category: CategoryRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [errors, setErrors] = useState<Partial<Record<"name" | "color", string>>>({});
  const ratio = contrastRatio(color);
  const lowContrast = ratio !== null && ratio < 3;
  const preset = (CATEGORY_COLORS as readonly string[]).includes(color.toUpperCase());

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = category
      ? updateCategorySchema.safeParse({
          boatId,
          categoryId: category.id,
          expectedUpdatedAt: category.updatedAt,
          name,
          color,
          icon: icon || null,
        })
      : createCategorySchema.safeParse({ id: newId, boatId, name, color, icon: icon || null });
    if (!payload.success) {
      const next: Partial<Record<"name" | "color", string>> = {};
      for (const issue of payload.error.issues) {
        const key = String(issue.path[0]) as "name" | "color";
        next[key] ??= fieldError({ type: issue.code, message: issue.message });
      }
      setErrors(next);
      return;
    }
    startTransition(async () => {
      const result = category
        ? await updateCategory(payload.data)
        : await createCategory(payload.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(category ? t("saved") : t("created"));
      onClose();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field id="category-name" label={t("fields.name")} required error={errors.name}>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>
      <div className="grid gap-2">
        <Label>{t("fields.color")}</Label>
        <div role="radiogroup" aria-label={t("fields.color")} className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((swatch) => {
            const selected = swatch.toUpperCase() === color.toUpperCase();
            return (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={swatch}
                onClick={() => setColor(swatch)}
                className={cn(
                  "flex size-11 items-center justify-center rounded-full border-2 tap-feedback focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: swatch }}
              >
                {selected ? <CheckIcon className="size-5 text-white" strokeWidth={3} /> : null}
              </button>
            );
          })}
          <label
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-full border-2 px-3 text-label",
              preset ? "border-border-strong" : "border-foreground",
            )}
          >
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label={t("customColor")}
            />
            {t("customColor")}
          </label>
        </div>
        {lowContrast && ratio !== null ? (
          <p className="text-caption font-medium text-state-soon-fg">
            {t("lowContrast", { ratio: ratio.toFixed(1) })}
          </p>
        ) : null}
        {errors.color ? <p className="text-caption text-state-overdue-fg">{errors.color}</p> : null}
      </div>
      <Field id="category-icon" label={t("fields.icon")}>
        <div className="flex items-center gap-3">
          <CategoryIcon color={color} icon={icon || null} />
          <NativeSelect
            id="category-icon"
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
          >
            <option value="">{tc("none")}</option>
            {CATEGORY_ICON_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </NativeSelect>
        </div>
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ArchiveDialog({
  boatId,
  category,
  others,
  onOpenChange,
}: {
  boatId: string;
  category: CategoryRow | null;
  others: CategoryRow[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"archive_items" | "move_items">("archive_items");
  const [target, setTarget] = useState("");

  function confirm() {
    if (!category) return;
    startTransition(async () => {
      const result = await archiveCategory({
        boatId,
        categoryId: category.id,
        mode: category.activeItems > 0 ? mode : "archive_items",
        targetCategoryId: mode === "move_items" && target ? target : undefined,
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("archived"));
      onOpenChange(false);
      router.refresh();
    });
  }

  const needsTarget = category !== null && category.activeItems > 0 && mode === "move_items";

  return (
    <Dialog open={category !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("archiveTitle", { name: category?.name ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("archiveDescription", { count: category?.activeItems ?? 0 })}
          </DialogDescription>
        </DialogHeader>
        {category && category.activeItems > 0 ? (
          <div className="flex flex-col gap-4">
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(next) => next && setMode(next as typeof mode)}
              className="w-full flex-col items-stretch sm:flex-row"
            >
              <ToggleGroupItem value="archive_items" className="min-h-11 whitespace-normal">
                {t("archiveItems")}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="move_items"
                className="min-h-11 whitespace-normal"
                disabled={others.length === 0}
              >
                {t("moveItems")}
              </ToggleGroupItem>
            </ToggleGroup>
            {mode === "move_items" ? (
              <Field id="archive-target" label={t("target")} required>
                <NativeSelect
                  id="archive-target"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">{tc("none")}</option>
                  {others.map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {tc("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || (needsTarget && !target)}
            onClick={confirm}
            aria-busy={pending}
          >
            {pending ? <Spinner /> : null}
            {t("archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
