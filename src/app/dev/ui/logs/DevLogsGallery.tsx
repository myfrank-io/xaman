"use client";

import { useState } from "react";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import { ChecklistMatches } from "@/components/logs/ChecklistMatches";
import { TitleSuggestions } from "@/components/logs/TitleSuggestions";
import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/input";
import { DEV_ENGINES, DEV_ITEM_SUGGESTIONS, DEV_TITLE_SUGGESTIONS } from "@/app/dev/ui/logs/sample";

/**
 * The two live pieces of the intervention form, frozen open for the visual check: the title
 * suggestions (56 px rows, category dot, engine, « N fois ») and the checklist points, one of
 * them greyed because its engine hours are missing.
 */
export function DevLogsGallery({ categories }: { categories: CategoryChoice[] }) {
  const [checked, setChecked] = useState<string[]>(["item-oil-sb"]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-2">
        <Field id="dev-title" label="Titre" required>
          <Input id="dev-title" defaultValue="Vidange mot" autoComplete="off" />
        </Field>
        <TitleSuggestions
          items={DEV_TITLE_SUGGESTIONS}
          categories={categories}
          engines={DEV_ENGINES}
          onPick={() => undefined}
        />
      </div>
      <div className="max-w-2xl">
        <ChecklistMatches
          items={DEV_ITEM_SUGGESTIONS}
          checked={checked}
          hoursByEngine={{ "engine-sb": "1256", "engine-bb": "" }}
          onToggle={(itemId, next) =>
            setChecked((current) =>
              next ? [...new Set([...current, itemId])] : current.filter((id) => id !== itemId),
            )
          }
        />
      </div>
    </div>
  );
}
