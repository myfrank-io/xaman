import { z } from "zod";

import { expectedUpdatedAt, nullableText, requiredText, uuid } from "@/lib/schemas/common";

// The eight harmonised category colours (AUDIT.md §4): every one reaches 3:1 on white.
export const CATEGORY_COLORS = [
  "#D97706",
  "#0284C7",
  "#A21CAF",
  "#52606F",
  "#1D4ED8",
  "#A16207",
  "#0F766E",
  "#C81E2B",
] as const;

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const createCategorySchema = z.object({
  id: uuid,
  boatId: uuid,
  name: requiredText(60),
  color: hexColorSchema,
  icon: nullableText(40),
});

export const updateCategorySchema = z.object({
  boatId: uuid,
  categoryId: uuid,
  expectedUpdatedAt,
  name: requiredText(60),
  color: hexColorSchema,
  icon: nullableText(40),
});

export const reorderCategoriesSchema = z.object({
  boatId: uuid,
  orderedIds: z.array(uuid).min(1).max(50),
});

// Archiving asks what happens to the category's active items (BACKLOG E2-4).
export const archiveCategorySchema = z
  .object({
    boatId: uuid,
    categoryId: uuid,
    mode: z.enum(["archive_items", "move_items"]),
    targetCategoryId: uuid.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "move_items" && !value.targetCategoryId) {
      ctx.addIssue({ code: "custom", path: ["targetCategoryId"], message: "required" });
    }
    if (value.targetCategoryId === value.categoryId) {
      ctx.addIssue({ code: "custom", path: ["targetCategoryId"], message: "same_category" });
    }
  });

export const restoreCategorySchema = z.object({
  boatId: uuid,
  categoryId: uuid,
});
