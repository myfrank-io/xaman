"use client";

import { useState } from "react";

import { ContactPicker } from "@/components/contacts/ContactPicker";
import type { ContactOption } from "@/components/contacts/specialties";

export function ContactPickerDemo({
  boatId,
  contacts,
}: {
  boatId: string;
  contacts: ContactOption[];
}) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <ContactPicker
      id="demo-contact"
      boatId={boatId}
      contacts={contacts}
      value={value}
      onValueChange={setValue}
      canCreate
    />
  );
}
