import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ContactsList } from "@/components/contacts/ContactsList";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { importPath } from "@/lib/queries/boat-routes";
import Link from "next/link";
import type { Route } from "next";
import { UploadIcon } from "lucide-react";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

// Intervenants (E6-2), reached from the « Plus » sheet.
export default async function ContactsPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: contacts }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, phone, email")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (!role) notFound();
  const t = await getTranslations("contacts");
  const ti = await getTranslations("import");
  const list = contacts ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("count", { count: list.length })}
        actions={
          can(role as BoatRole, "write") ? (
            <Button asChild variant="outline">
              <Link href={importPath(boatId, "contacts") as Route}>
                <UploadIcon />
                {ti("action")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ContactsList boatId={boatId} contacts={list} canWrite={can(role as BoatRole, "write")} />
    </div>
  );
}
