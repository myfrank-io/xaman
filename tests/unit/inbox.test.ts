import { describe, expect, it } from "vitest";

import {
  confidentItems,
  documentWarnings,
  draftFrom,
  isConfidentItem,
  toValidateInput,
} from "@/components/inbox/inbox-draft";
import { contextText, normaliseSuggestion, type InboxContext } from "@/lib/inbox/prompt";
import type { InboxItem } from "@/lib/queries/inbox";
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
  inboxEntityId,
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

  it("hangs a document on an existing intervention with nothing but its id (D109)", () => {
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

  it("reads a single photo on the spot, and a pile after the response (D109)", () => {
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

  it("names the one door and the third filing (D109)", () => {
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

/**
 * The id of the line a document becomes. It used to be drawn at random when the row did not yet
 * remember one — but the row only remembers *after* everything succeeded, so a « Valider » that
 * wrote the intervention and then failed left the card up, and the next tap wrote a second
 * intervention for the same invoice. Derived from the document, the second tap writes the first
 * line again (`saveLog` upserts on the id) and there is nothing to clean up.
 */
describe("the id a document becomes", () => {
  it("is the same one every time, for the same document and the same list", () => {
    expect(inboxEntityId(ITEM, "log")).toBe(inboxEntityId(ITEM, "log"));
    expect(inboxEntityId(ITEM, "purchase")).toBe(inboxEntityId(ITEM, "purchase"));
  });

  it("is a uuid, and not the document's own id", () => {
    const id = inboxEntityId(ITEM, "log");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).not.toBe(ITEM);
  });

  it("never files the same document twice in the same place", () => {
    // An intervention and a purchase are two tables, but a card that changed its mind between
    // two taps must not hand the second list the id of the line it left in the first.
    expect(inboxEntityId(ITEM, "log")).not.toBe(inboxEntityId(ITEM, "purchase"));
    expect(inboxEntityId(ITEM, "log")).not.toBe(inboxEntityId(BOAT, "log"));
  });

  it("refuses anything that is not a document id", () => {
    expect(() => inboxEntityId("not-a-uuid", "log")).toThrow();
  });
});

/**
 * What decides whether a card costs one tap or a scroll through eight fields. « Un agent IA a lu
 * le document » is posted on every card (D94) and says nothing about *this* document; a guessed
 * total or an unlabelled date does, and that is what earns the second look (D92).
 */
describe("a card that opens on one line", () => {
  const suggestion = {
    documentType: "receipt" as const,
    kind: "purchase" as const,
    purchaseKind: "part" as const,
    title: "Manilles inox 8 mm",
    date: "2026-09-04",
    amount: 24.9,
    currency: "EUR",
    supplierName: "Accastillage Diffusion",
    contactId: null,
    categoryId: null,
    engineHours: [],
    lineItems: [],
    notes: null,
    confidence: "high" as const,
    warnings: ["local"],
  };

  const item = (over: Partial<InboxItem> = {}): InboxItem => ({
    id: ITEM,
    source: "upload",
    status: "ready",
    receivedAt: "2026-09-04T11:40:00.000Z",
    senderEmail: null,
    senderName: null,
    subject: null,
    fileName: "ticket.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1000,
    storagePath: `boats/${BOAT}/inbox/${ITEM}.jpeg`,
    url: null,
    suggestion,
    error: null,
    logId: null,
    purchaseId: null,
    validatedAt: null,
    updatedAt: "2026-09-04T11:40:00.000Z",
    ...over,
  });
  const options = { boatId: BOAT, engineIds: [ENGINE] };

  it("does not count the sentence every card carries as something to check", () => {
    expect(documentWarnings(item())).toEqual([]);
    expect(
      documentWarnings(item({ suggestion: { ...suggestion, warnings: ["local", "noDate"] } })),
    ).toEqual(["noDate"]);
  });

  it("opens on one line when the reading flagged nothing", () => {
    expect(isConfidentItem(item(), options)).toBe(true);
    expect(confidentItems([item(), item({ id: BOAT })], options)).toHaveLength(2);
  });

  it("opens on the form as soon as anything asks for a second look", () => {
    const warned = item({ suggestion: { ...suggestion, warnings: ["local", "amountGuessed"] } });
    expect(isConfidentItem(warned, options)).toBe(false);
    expect(isConfidentItem(item({ error: "noText" }), options)).toBe(false);
    expect(isConfidentItem(item({ suggestion: null }), options)).toBe(false);
    expect(
      isConfidentItem(item({ suggestion: { ...suggestion, confidence: "low" } }), options),
    ).toBe(false);
    expect(isConfidentItem(item({ status: "analysing" }), options)).toBe(false);
    expect(isConfidentItem(item({ status: "validated" }), options)).toBe(false);
  });

  /** An intervention with no system would be refused by the schema: never a one-tap card. */
  it("opens on the form when what it proposes is not yet a line", () => {
    const asLog = item({ suggestion: { ...suggestion, kind: "log", categoryId: null } });
    expect(isConfidentItem(asLog, options)).toBe(false);
    const filed = item({ suggestion: { ...suggestion, kind: "log", categoryId: CATEGORY } });
    expect(isConfidentItem(filed, options)).toBe(true);
  });

  it("hands « Valider » exactly what the card holds", () => {
    const input = toValidateInput(draftFrom(item(), suggestion), {
      boatId: BOAT,
      itemId: ITEM,
      engineIds: [ENGINE],
    });
    const parsed = validateInboxItemSchema.parse(input);
    expect(parsed.title).toBe("Manilles inox 8 mm");
    expect(parsed.amount).toBe(24.9);
    expect(parsed.kind).toBe("purchase");
    expect(parsed.engineHours).toEqual([{ engineId: ENGINE, hours: null }]);
  });
});

/** The words of the one-line card and of « Tout valider » (rule 7). */
describe("the words of a document filed in one tap", () => {
  // fr.inbox mixes flat strings and nested groups, so the two groups are read one by one rather
  // than through a cast that would claim every key holds an object.
  const summary: Record<string, string> = fr.inbox.summary;
  const validateAll: Record<string, string> = fr.inbox.validateAll;
  it("names the line, the way back to the form, and the batch", () => {
    for (const key of ["hint", "edit"] as const)
      expect(summary[key]?.trim(), `summary.${key}`).toBeTruthy();
    for (const key of ["help", "action", "progress", "done", "result", "failed"] as const)
      expect(validateAll[key]?.trim(), `validateAll.${key}`).toBeTruthy();
    // Still « un agent IA », never the reader behind it (D94), and still « vérifiez ».
    expect(summary.hint).toContain("agent IA");
    expect(summary.hint).toContain("vérifiez");
  });
});
