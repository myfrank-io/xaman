import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { searchTerms } from "@/lib/search-terms";

/**
 * Ce que la recherche répond, sur une vraie base (E18-14, D138).
 *
 * `tests/unit/search.test.ts` couvre la couche TypeScript et `rls.test.ts` dit qui a le droit de
 * lire quoi. Il restait le milieu — ce que `search_boat()` trouve et dans quel ordre — et c'est
 * précisément ce qu'aucune relecture ne garantit : les quatre frappes qui ouvrent ce fichier
 * rendaient toutes une mauvaise réponse avant `0040`, et trois d'entre elles rendaient zéro
 * ligne sur un carnet qui contenait ce qu'on cherchait.
 *
 * Comme `rls.test.ts` : DATABASE_URL, ou tout le fichier se saute. Chaque cas ouvre une
 * transaction, écrit ses lignes, interroge, et annule.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

const BOAT = "00000000-0000-0000-0000-00000000b001";
const CATEGORY = "00000000-0000-0000-0000-00000000ca01";
const OWNER = "00000000-0000-0000-0000-000000000011";

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
afterAll(async () => {
  if (DATABASE_URL) await pool.end();
});

async function rollbackAfter<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

/** Un carnet lisible : ce qu'on cherche est dans le titre, dans les notes, ou dans la marque. */
const CARNET = `
  delete from public.maintenance_logs where boat_id = '${BOAT}';
  delete from public.equipment where boat_id = '${BOAT}';
  insert into public.maintenance_logs
    (boat_id, category_id, title, notes, performed_at, cost, status, created_by)
  values
    ('${BOAT}', '${CATEGORY}', 'Vidange moteur bâbord',
     'Filtre à huile et courroie d''alternateur. Réf. YANMAR 119773-77500.',
     '2026-03-12', 180, 'done', '${OWNER}'),
    ('${BOAT}', '${CATEGORY}', 'Changement des anodes',
     'Anodes de safran et d''arbre changées au carénage.',
     '2026-02-02', 95, 'done', '${OWNER}'),
    ('${BOAT}', '${CATEGORY}', 'Révision du guindeau',
     'Démontage complet. Le disjoncteur 100 A a été remplacé.',
     '2026-01-20', 240, 'done', '${OWNER}');
  insert into public.equipment (boat_id, name, brand, model, serial, created_by)
  values ('${BOAT}', 'Moteur bâbord', 'Yanmar', '4JH45', 'E1234-ZZ', '${OWNER}');
`;

type Hit = { kind: string; title: string; context: string | null; score: number };

async function search(c: PoolClient, query: string): Promise<Hit[]> {
  const res = await c.query(
    "select kind, title, context, score from public.search_boat($1, $2, 8)",
    [BOAT, query],
  );
  return res.rows as Hit[];
}

const titles = (hits: Hit[]) => hits.map((h) => h.title);

describeWithDb("search_terms", () => {
  const terms = async (query: string) =>
    rollbackAfter(async (c) => {
      const res = await c.query("select public.search_terms($1) as t", [query]);
      return res.rows[0].t as string[];
    });

  it("coupe la question en mots, du plus long au plus court", async () => {
    expect(await terms("vidange babord")).toEqual(["vidange", "babord"]);
    expect(await terms("cale pompe de")).toEqual(["pompe", "cale", "de"]);
  });

  it("ne laisse survivre aucun joker LIKE", async () => {
    expect(await terms("100%")).toEqual(["100"]);
    expect(await terms("%")).toEqual([]);
    expect(await terms("_")).toEqual([]);
  });

  /**
   * La parité qui compte : `isSearchable()` décide **avant** l'appel si la question est posée.
   * Si les deux découpages divergeaient, l'écran dirait « continuez à taper » sur une frappe que
   * la base aurait su chercher — ou l'inverse, « aucun résultat » sur une question jamais posée.
   */
  it("répond comme son jumeau TypeScript", async () => {
    const frappes = [
      "vidange",
      "vidange babord",
      "  Carénage  BÂBORD ",
      "100%",
      "%",
      "_",
      "a.",
      "4L",
      "secret@chantier.test",
      "Réf. 119773-77500",
      "un deux trois quatre cinq six sept",
      "moteur moteur",
      "",
      "   ",
      "Cœur de câble",
    ];
    for (const frappe of frappes) {
      expect(await terms(frappe), frappe).toEqual(searchTerms(frappe));
    }
  });
});

describeWithDb("search_rank", () => {
  const rank = async (name: string, subtitle: string, query: string) =>
    rollbackAfter(async (c) => {
      const res = await c.query(
        `select public.search_rank(
           public.normalise_for_match($1),
           public.normalise_for_match($2),
           public.normalise_for_match($3),
           coalesce((select array_agg('%' || x || '%') from unnest(public.search_terms($3)) x), '{}')
         ) as r`,
        [name, subtitle, query],
      );
      return Number(res.rows[0].r);
    });

  it("descend les paliers du nom", async () => {
    expect(await rank("Vidange", "", "vidange")).toBeCloseTo(1, 5);
    expect(await rank("Vidange moteur bâbord", "", "vidange")).toBeCloseTo(0.9, 5);
    expect(await rank("Vidange moteur bâbord", "", "moteur")).toBeCloseTo(0.8, 5);
    expect(await rank("Vidange moteur bâbord", "", "oteur")).toBeCloseTo(0.7, 5);
    expect(await rank("Vidange moteur bâbord", "", "babord vidange")).toBeCloseTo(0.6, 5);
  });

  it("ne punit plus un titre d'être long et précis", async () => {
    // Le défaut de `0039` : « Vidange (owner) » (0.571) passait devant « Vidange moteur
    // bâbord » (0.364) sur la frappe « vidange », parce que le score comparait les chaînes
    // entières. Les deux commencent par la question : ils valent désormais autant.
    expect(await rank("Vidange moteur bâbord", "", "vidange")).toBe(
      await rank("Vidange (owner)", "", "vidange"),
    );
  });

  it("met le second champ sous le nom, et le texte profond sous les deux", async () => {
    const parNom = await rank("Yanmar", "", "yanmar");
    const parMarque = await rank("Moteur bâbord", "Yanmar 4JH45", "yanmar");
    const parRien = await rank("Vidange moteur bâbord", "", "yanmar");
    expect(parNom).toBeGreaterThan(parMarque);
    expect(parMarque).toBeGreaterThan(parRien);
    expect(parMarque).toBeLessThanOrEqual(0.5);
  });

  it("ne donne rien à une question sans mot", async () => {
    expect(await rank("Vidange moteur bâbord", "", "%")).toBe(0);
  });
});

describeWithDb("search_excerpt", () => {
  const excerpt = async (text: string | null, query: string) =>
    rollbackAfter(async (c) => {
      const res = await c.query("select public.search_excerpt($1, public.search_terms($2)) as e", [
        text,
        query,
      ]);
      return res.rows[0].e as string | null;
    });

  it("rend le fragment autour du mot trouvé, accents d'origine compris", async () => {
    const found = await excerpt(
      "Filtre à huile et courroie d'alternateur. Réf. YANMAR 119773-77500.",
      "courroie",
    );
    expect(found).toContain("courroie");
  });

  it("ne rend rien quand le mot n'y est pas — il n'y a alors rien à expliquer", async () => {
    expect(await excerpt("Filtre à huile", "guindeau")).toBe(null);
    expect(await excerpt(null, "courroie")).toBe(null);
    expect(await excerpt("   ", "courroie")).toBe(null);
  });

  it("élide ce qu'il a coupé, et seulement ce qu'il a coupé", async () => {
    const long = "a".repeat(300) + " courroie " + "b".repeat(300);
    const found = (await excerpt(long, "courroie")) ?? "";
    expect(found.startsWith("…")).toBe(true);
    expect(found.endsWith("…")).toBe(true);
    expect(found).toContain("courroie");
    const court = await excerpt("Courroie neuve", "courroie");
    expect(court).toBe("Courroie neuve");
  });
});

describeWithDb("search_boat", () => {
  const onCarnet = <T>(fn: (c: PoolClient) => Promise<T>) =>
    rollbackAfter(async (c) => {
      await c.query(CARNET);
      return fn(c);
    });

  it("trouve les mots dans le désordre, et séparés", async () => {
    // Les deux frappes qui rendaient zéro ligne, sur un carnet qui contient la réponse.
    await onCarnet(async (c) => {
      expect(titles(await search(c, "vidange babord"))[0]).toBe("Vidange moteur bâbord");
      expect(titles(await search(c, "moteur vidange"))[0]).toBe("Vidange moteur bâbord");
    });
  });

  it("exige tous les mots, et ne répond pas à un seul d'entre eux", async () => {
    await onCarnet(async (c) => {
      expect(titles(await search(c, "vidange guindeau"))).toEqual([]);
    });
  });

  it("pardonne une faute de frappe sur le mot le plus long", async () => {
    await onCarnet(async (c) => {
      expect(titles(await search(c, "videnge"))).toContain("Vidange moteur bâbord");
      expect(titles(await search(c, "guindau"))).toContain("Révision du guindeau");
    });
  });

  it("pardonne la faute sans lâcher le reste de la question", async () => {
    await onCarnet(async (c) => {
      // « videnge » est approché, « babord » est exigé : le guindeau ne répond pas.
      const found = titles(await search(c, "videnge babord"));
      expect(found).toContain("Vidange moteur bâbord");
      expect(found).not.toContain("Révision du guindeau");
    });
  });

  it("traite un joker tapé comme du texte, jamais comme un joker", async () => {
    await onCarnet(async (c) => {
      // « 100% » ne doit rendre que la ligne qui parle de 100 A…
      expect(titles(await search(c, "100%"))).toEqual(["Révision du guindeau"]);
      // …et « % » seul ne doit pas rendre le carnet entier.
      expect(await search(c, "%")).toEqual([]);
      expect(await search(c, "%_%")).toEqual([]);
    });
  });

  it("dit pourquoi une ligne est là quand son titre ne le dit pas", async () => {
    await onCarnet(async (c) => {
      const [hit] = await search(c, "courroie");
      expect(hit?.title).toBe("Vidange moteur bâbord");
      expect(hit?.context).toContain("courroie");
    });
  });

  it("ne porte pas de fragment quand c'est le titre qui a répondu", async () => {
    await onCarnet(async (c) => {
      const hit = (await search(c, "guindeau")).find((h) => h.kind === "log");
      expect(hit?.title).toBe("Révision du guindeau");
      expect(hit?.context).toBe(null);
    });
  });

  it("classe la ligne trouvée par son nom devant celle trouvée par ses notes", async () => {
    await onCarnet(async (c) => {
      const found = await search(c, "yanmar");
      // La marque de l'équipement, puis l'intervention qui ne fait que la citer.
      expect(found[0]?.kind).toBe("equipment");
      expect(found[0]!.score).toBeGreaterThan(found[1]!.score);
    });
  });

  it("reste muet sous deux caractères de mot", async () => {
    await onCarnet(async (c) => {
      expect(await search(c, "v")).toEqual([]);
      expect(await search(c, "a.")).toEqual([]);
    });
  });
});
