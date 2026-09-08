import { describe, expect, it } from "vitest";

import { contextText, normaliseSuggestion, type InboxContext } from "@/lib/inbox/prompt";
import {
  inboundExternalRef,
  inboundFromEvent,
  receivedAttachmentUrl,
  splitAddress,
} from "@/lib/inbox/resend-inbound";
import fr from "@/messages/fr.json";
import {
  INBOX_CONFIDENCES,
  INBOX_ERROR_KEYS,
  INBOX_FILINGS,
  INBOX_KINDS,
  INBOX_SOURCES,
  INBOX_STATUSES,
  createInboxUploadSchema,
  inboxAddress,
  inboxStoragePath,
  inboxTokenFromAddress,
  parseSuggestion,
  validateInboxItemSchema,
} from "@/lib/schemas/inbox";

const BOAT = "00000000-0000-4000-8000-0000000000b1";
const ITEM = "00000000-0000-4000-8000-0000000000c1";
const CATEGORY = "00000000-0000-4000-8000-0000000000a1";
const CONTACT = "00000000-0000-4000-8000-0000000000d1";
const ENGINE = "00000000-0000-4000-8000-0000000000e1";

/**
 * D91 — « chaque bateau a une adresse e-mail dédiée » and « je prends en photo mon ticket, ça
 * l'analyse ». What follows is the pure half of that: the address, the event the mailer posts,
 * and the reading made safe before it reaches a card.
 */
describe("the boat's address", () => {
  it("is the slug of the name, the token, and the receiving domain", () => {
    expect(inboxAddress("Xaman", "3f9a1c2b7d4e", "carnet.xaman.boats")).toBe(
      "xaman-3f9a1c2b7d4e@carnet.xaman.boats",
    );
    expect(inboxAddress("L'Étoile du Nord II", "abc123def456", "carnet.xaman.boats")).toBe(
      "l-etoile-du-nord-ii-abc123def456@carnet.xaman.boats",
    );
  });

  it("never lets the name break the address", () => {
    expect(inboxAddress("   ", "abc123def456", "d.io")).toBe("carnet-abc123def456@d.io");
    expect(inboxAddress("x".repeat(80), "abc123def456", "d.io").length).toBeLessThan(60);
  });

  it("is matched on the token alone, whatever the name became", () => {
    const domain = "carnet.xaman.boats";
    expect(inboxTokenFromAddress("xaman-3f9a1c2b7d4e@carnet.xaman.boats", domain)).toBe(
      "3f9a1c2b7d4e",
    );
    expect(inboxTokenFromAddress("Renamed-3f9a1c2b7d4e@Carnet.Xaman.Boats", domain)).toBe(
      "3f9a1c2b7d4e",
    );
    expect(
      inboxTokenFromAddress('"Le carnet" <xaman-3f9a1c2b7d4e@carnet.xaman.boats>', domain),
    ).toBe("3f9a1c2b7d4e");
  });

  it("refuses an address on another domain, or one with no token", () => {
    expect(inboxTokenFromAddress("xaman-3f9a1c2b7d4e@gmail.com", "carnet.xaman.boats")).toBeNull();
    expect(inboxTokenFromAddress("hello@carnet.xaman.boats", "carnet.xaman.boats")).toBeNull();
    expect(inboxTokenFromAddress("not an address", "carnet.xaman.boats")).toBeNull();
  });

  it("stores the document under the boat, so the storage policies read the right segment", () => {
    expect(
      inboxStoragePath({
        boatId: BOAT,
        itemId: ITEM,
        fileName: "Facture (2).PDF",
        mimeType: "application/pdf",
      }),
    ).toBe(`boats/${BOAT}/inbox/${ITEM}.pdf`);
    expect(
      inboxStoragePath({ boatId: BOAT, itemId: ITEM, fileName: "ticket", mimeType: "image/jpeg" }),
    ).toBe(`boats/${BOAT}/inbox/${ITEM}.jpeg`);
  });
});

describe("the mailer's event", () => {
  const event = {
    type: "email.received",
    created_at: "2026-09-08T10:00:00.000Z",
    data: {
      email_id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
      from: '"Chantier Naval" <compta@chantier.fr>',
      to: ["xaman-3f9a1c2b7d4e@carnet.xaman.boats"],
      cc: "xav@example.com",
      subject: "Facture 2026-118",
      attachments: [
        {
          id: "att_1",
          filename: "facture-118.pdf",
          content_type: "application/pdf",
          size: 120_000,
        },
        { filename: "photo.jpg", content_type: "image/jpeg" },
      ],
    },
  };

  it("reads who wrote, to whom, and what was attached", () => {
    const mail = inboundFromEvent(event);
    expect(mail).not.toBeNull();
    expect(mail!.senderEmail).toBe("compta@chantier.fr");
    expect(mail!.senderName).toBe("Chantier Naval");
    expect(mail!.recipients).toEqual(["xaman-3f9a1c2b7d4e@carnet.xaman.boats", "xav@example.com"]);
    expect(mail!.subject).toBe("Facture 2026-118");
    expect(mail!.attachments.map((a) => [a.id, a.fileName, a.mimeType])).toEqual([
      ["att_1", "facture-118.pdf", "application/pdf"],
      ["1", "photo.jpg", "image/jpeg"],
    ]);
  });

  it("is not a delivery event, and a delivery event is not it", () => {
    expect(inboundFromEvent({ type: "email.delivered", data: { email_id: "x" } })).toBeNull();
    expect(inboundFromEvent(null)).toBeNull();
    expect(inboundFromEvent({ type: "email.received", data: {} })).toBeNull();
  });

  it("keys every attachment of every message once", () => {
    expect(inboundExternalRef("m1", "a1")).toBe("resend:m1:a1");
    expect(inboundExternalRef("m1", "a1")).not.toBe(inboundExternalRef("m1", "a2"));
  });

  it("splits a display name from its address", () => {
    expect(splitAddress("Compta <Compta@Chantier.fr>")).toEqual({
      email: "compta@chantier.fr",
      name: "Compta",
    });
    expect(splitAddress("xav@example.com")).toEqual({ email: "xav@example.com", name: null });
  });

  it("asks the receiving API for an attachment at one address", () => {
    expect(receivedAttachmentUrl("m 1", "a/1")).toBe(
      "https://api.resend.com/emails/receiving/m%201/attachments/a%2F1",
    );
  });
});

const context: InboxContext = {
  boatName: "Xaman",
  boatType: "catamaran",
  today: "2026-09-08",
  categories: [{ id: CATEGORY, name: "Moteurs" }],
  engines: [{ id: ENGINE, label: "Moteur bâbord", propulsion: "saildrive" }],
  contacts: [{ id: CONTACT, name: "Chantier Naval", company: null, specialty: "Chantier" }],
};

const output = {
  documentType: "invoice" as const,
  kind: "log" as const,
  purchaseKind: "service" as const,
  title: "  Vidange moteur bâbord  ",
  date: "2026-09-01",
  amount: 312.456,
  currency: "eur",
  supplierName: "Chantier Naval",
  contactId: CONTACT,
  categoryId: CATEGORY,
  engineHours: [{ engineId: ENGINE, hours: 1250.44 }],
  lineItems: [{ designation: "Huile 15W40", amount: 48 }],
  notes: "Vidange et filtre.",
  confidence: "high" as const,
  warnings: [],
};

describe("the reading, made safe", () => {
  it("keeps what the boat knows and rounds what the columns hold", () => {
    const suggestion = normaliseSuggestion(output, context);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.title).toBe("Vidange moteur bâbord");
    expect(suggestion!.amount).toBe(312.46);
    expect(suggestion!.currency).toBe("EUR");
    expect(suggestion!.contactId).toBe(CONTACT);
    expect(suggestion!.engineHours).toEqual([{ engineId: ENGINE, hours: 1250.4 }]);
  });

  /** An id the boat does not have would put a card in front of a chip that does not exist. */
  it("drops ids that are not the boat's, and a date that is not one", () => {
    const suggestion = normaliseSuggestion(
      {
        ...output,
        contactId: "someone-else",
        categoryId: "not-a-system",
        engineHours: [{ engineId: "other-engine", hours: 10 }],
        date: "1er septembre",
        amount: -5,
      },
      context,
    );
    expect(suggestion!.contactId).toBeNull();
    expect(suggestion!.categoryId).toBeNull();
    expect(suggestion!.engineHours).toEqual([]);
    expect(suggestion!.date).toBeNull();
    expect(suggestion!.amount).toBeNull();
  });

  it("never lets an empty title through, and clips a long one", () => {
    expect(normaliseSuggestion({ ...output, title: "   " }, context)!.title).toBe("Document");
    expect(normaliseSuggestion({ ...output, title: "x".repeat(500) }, context)!.title).toHaveLength(
      160,
    );
  });

  it("reads a stored suggestion back tolerantly", () => {
    expect(parseSuggestion(normaliseSuggestion(output, context))).not.toBeNull();
    expect(parseSuggestion({ title: "only a title" })).toBeNull();
    expect(parseSuggestion(null)).toBeNull();
  });

  it("hands the model the boat's vocabulary, never the app's text", () => {
    const text = contextText(context, "facture.pdf");
    expect(text).toContain(CATEGORY);
    expect(text).toContain("Moteur bâbord");
    expect(text).toContain("facture.pdf");
  });
});

describe("validating a card", () => {
  const base = {
    boatId: BOAT,
    itemId: ITEM,
    kind: "log",
    title: "Vidange",
    date: "2026-09-01",
    categoryId: CATEGORY,
    amount: "312,46",
    contactId: "",
    supplierName: null,
    notes: null,
    engineHours: [{ engineId: ENGINE, hours: "1250" }],
  };

  it("needs a system for an intervention, not for a purchase", () => {
    expect(validateInboxItemSchema.safeParse({ ...base, categoryId: "" }).success).toBe(false);
    expect(
      validateInboxItemSchema.safeParse({ ...base, kind: "purchase", categoryId: "" }).success,
    ).toBe(true);
  });

  it("reads the French decimal and an emptied contact", () => {
    const parsed = validateInboxItemSchema.parse(base);
    expect(parsed.amount).toBe(312.46);
    expect(parsed.contactId).toBeNull();
    expect(parsed.purchaseKind).toBe("service");
    expect(parsed.engineHours[0]?.hours).toBe(1250);
    // A card that is not an attachment carries no intervention to join.
    expect(parsed.logId).toBeNull();
  });

  it("hangs a document on an existing intervention with nothing but its id (D95)", () => {
    const LOG = "00000000-0000-4000-8000-0000000000f1";
    // The title, the system, the amount are the intervention's already: none is asked for.
    const attach = { ...base, kind: "attach", title: "", categoryId: "", logId: LOG };
    const parsed = validateInboxItemSchema.parse(attach);
    expect(parsed.kind).toBe("attach");
    expect(parsed.logId).toBe(LOG);
    // Without the intervention there is nothing to attach to.
    expect(validateInboxItemSchema.safeParse({ ...attach, logId: "" }).success).toBe(false);
    expect(validateInboxItemSchema.safeParse({ ...attach, logId: undefined }).success).toBe(false);
    // The other two filings still need their title.
    expect(validateInboxItemSchema.safeParse({ ...base, title: "  " }).success).toBe(false);
  });
});

describe("dropping a pile", () => {
  const upload = {
    id: ITEM,
    boatId: BOAT,
    storagePath: `boats/${BOAT}/inbox/${ITEM}.jpg`,
    fileName: "facture.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 120_000,
  };

  it("reads a single photo on the spot, and a pile after the response (D95)", () => {
    expect(createInboxUploadSchema.parse(upload).deferReading).toBe(false);
    expect(createInboxUploadSchema.parse({ ...upload, deferReading: true }).deferReading).toBe(
      true,
    );
  });
});

/** Every enum the screen labels has its French word (rule 7). */
describe("the inbox's words", () => {
  const inbox = fr.inbox as Record<string, Record<string, string> | string>;
  it.each([
    ["source", INBOX_SOURCES],
    ["status", INBOX_STATUSES],
    ["badge", INBOX_STATUSES],
    ["kind", INBOX_KINDS],
    ["kind", INBOX_FILINGS],
    ["confidence", INBOX_CONFIDENCES],
    ["errors", INBOX_ERROR_KEYS],
  ] as const)("names every %s", (section, keys) => {
    const words = inbox[section] as Record<string, string>;
    for (const key of keys) expect(words[key]?.trim(), `${section}.${key}`).toBeTruthy();
  });

  it("names the one door and the third filing (D95)", () => {
    for (const key of [
      "entry",
      "drop",
      "attach",
      "attached",
      "attachHelp",
      "uploadedMany",
    ] as const)
      expect((inbox[key] as string)?.trim(), key).toBeTruthy();
    const fields = inbox.fields as Record<string, string>;
    for (const key of ["existingLog", "existingLogPlaceholder"] as const)
      expect(fields[key]?.trim(), `fields.${key}`).toBeTruthy();
    // The pile's toast counts; the old screen's words are gone with it.
    expect(inbox.uploadedMany).toContain("{count");
    expect((fr.attachments as Record<string, unknown>).import).toBeUndefined();
  });

  it("gives an ignored document a way back and a way out (D93)", () => {
    for (const key of ["reopen", "reopened", "delete", "deleted"] as const)
      expect((inbox[key] as string)?.trim(), key).toBeTruthy();
    const confirm = inbox.deleteConfirm as Record<string, string>;
    for (const key of ["title", "description", "action"] as const)
      expect(confirm[key]?.trim(), `deleteConfirm.${key}`).toBeTruthy();
    // The dialog names the file it is about to destroy (ux-flows §5.6).
    expect(confirm.description).toContain("{fileName}");
  });
});
