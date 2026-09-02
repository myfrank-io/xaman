"use client";

import { useEffect, useState } from "react";

import { suggestLogTitles, type TitleSuggestion } from "@/lib/actions/logs";

const DEBOUNCE_MS = 150;
const MIN_CHARS = 2;

/**
 * Titles already used on this boat (ux-flows §4.6): from 2 characters, 150 ms after the last
 * key. The answer is kept with the query it answers, so a stale list is never displayed.
 * A failed lookup is silent: a suggestion is a convenience, never a step of the saisie.
 */
export function useTitleSuggestions(boatId: string, query: string): TitleSuggestion[] {
  const [answer, setAnswer] = useState<{ query: string; items: TitleSuggestion[] }>({
    query: "",
    items: [],
  });
  const trimmed = query.trim();

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < MIN_CHARS) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      suggestLogTitles({ boatId, query: needle })
        .then((result) => {
          if (cancelled) return;
          setAnswer({
            query: needle,
            items: result.ok ? result.data.filter((row) => row.title !== needle) : [],
          });
        })
        .catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [boatId, query]);

  return answer.query === trimmed && trimmed.length >= MIN_CHARS ? answer.items : [];
}
