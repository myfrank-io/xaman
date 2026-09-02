"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { PhoneIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { groupBySpecialty, normalise, type ContactOption } from "@/components/contacts/specialties";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contactPath, newContactPath } from "@/lib/queries/boat-routes";

export type ContactListItem = ContactOption & { email: string | null };

// Contacts grouped by specialty (E6-2), searched by name, company or specialty.
export function ContactsList({
  boatId,
  contacts,
  canWrite,
}: {
  boatId: string;
  contacts: ContactListItem[];
  canWrite: boolean;
}) {
  const t = useTranslations("contacts");
  const [query, setQuery] = useState("");
  const needle = normalise(query.trim());
  const visible = needle
    ? contacts.filter((contact) =>
        normalise([contact.name, contact.company ?? "", contact.specialty].join(" ")).includes(
          needle,
        ),
      )
    : contacts;
  const groups = groupBySpecialty(visible, t("specialties.other"));

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon aria-hidden />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          canWrite ? (
            <Button asChild>
              <Link href={newContactPath(boatId) as Route}>{t("new")}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          autoComplete="off"
          className="pl-10"
        />
      </div>
      {visible.length === 0 ? (
        <EmptyState variant="filtered" title={t("noResult", { query: query.trim() })} />
      ) : (
        groups.map(([specialty, list]) => (
          <section key={specialty} className="flex flex-col gap-2">
            <h2 className="text-overline text-ink-2 uppercase">{specialty}</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {list.map((contact) => (
                <ListRow
                  key={contact.id}
                  title={contact.name}
                  meta={
                    <span className="truncate">
                      {[contact.company, contact.phone].filter(Boolean).join(" · ")}
                    </span>
                  }
                  href={contactPath(boatId, contact.id)}
                  action={
                    contact.phone ? (
                      <Button asChild variant="outline" size="icon" aria-label={t("call")}>
                        <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>
                          <PhoneIcon />
                        </a>
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
