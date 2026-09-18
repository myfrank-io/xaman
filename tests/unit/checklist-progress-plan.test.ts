import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * La forme de `checklist_category_progress` (D147, migration 0046).
 *
 * La vue joignait les catégories aux points sans agréger d'abord :
 *
 *     from public.boat_categories c
 *     left join public.checklist_item_status s on s.category_id = c.id
 *     group by c.id, ...
 *
 * `checklist_item_status` étant une vue, le planificateur l'intègre à la requête, et le filtre
 * `where boat_id = …` porté par la requête appelante **ne descend pas** dedans : il ne s'applique
 * qu'aux catégories. Le statut est donc calculé pour tous les points de la base, puis jeté. Selon
 * les statistiques, cela prenait deux formes — sur la production d'un seul bateau, un `Nested
 * Loop` qui rejouait les 161 points pour chacune des 7 catégories (1127 calculs, 274 ms par
 * lecture) ; sur une flotte, le calcul du statut de **tous** les bateaux à chaque lecture.
 *
 * Agréger d'abord, joindre ensuite, fait descendre le prédicat : mesuré sur 40 bateaux de
 * 200 points, 8051 lignes traitées en 58 ms deviennent 200 en 3,5 ms.
 *
 * C'est un invariant qu'aucune relecture de diff ne donne : les deux versions rendent exactement
 * les mêmes lignes, et seul le plan les sépare. Ce cas lit le plan. Il ne mesure pas un temps —
 * une machine de CI chargée rendrait le test capricieux — mais **combien de points sont touchés**
 * pour répondre sur un seul bateau. La réponse doit être : ceux de ce bateau.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

const ORG = "00000000-0000-0000-0000-0000000f0000";
/** Le bateau observé. Les autres n'existent que pour être ignorés. */
const BOAT = "00000000-0000-0000-0000-0000000f0001";
const OTHER_BOATS = 20;
const CATEGORIES = 8;
const ITEMS_PER_CATEGORY = 25;
const ITEMS_PER_BOAT = CATEGORIES * ITEMS_PER_CATEGORY;

const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

/**
 * Le plus large balayage d'une table dans le plan : `rows=R … loops=L`, pris au maximum et non
 * en somme. Le plan lit `checklist_items` depuis plusieurs nœuds — la vue le joint puis le
 * recoupe — et chacun en lit autant ; ce qui sépare les deux versions n'est pas leur nombre
 * mais leur **largeur** : les points de ce bateau, ou ceux de toute la base.
 */
function widestScan(plan: string, table: RegExp): number {
  return plan
    .split("\n")
    .filter((line) => /Scan/.test(line) && table.test(line))
    .reduce((widest, line) => {
      const rows = Number(/rows=(\d+)/.exec(line)?.[1] ?? 0);
      const loops = Number(/loops=(\d+)/.exec(line)?.[1] ?? 1);
      return Math.max(widest, rows * loops);
    }, 0);
}

describeWithDb("le plan de checklist_category_progress", () => {
  let plan = "";

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      // Tout dans une transaction annulée : la base de test ressort intacte.
      await client.query("begin");
      await client.query("insert into public.organizations (id, name) values ($1, 'Plan')", [ORG]);
      await client.query(
        `insert into public.boats (id, organization_id, name, type)
         select ('00000000-0000-0000-0000-0000000f' || lpad(g::text, 4, '0'))::uuid, $1,
                'Bateau ' || g, 'catamaran'
         from generate_series(1, $2) g`,
        [ORG, OTHER_BOATS + 1],
      );
      await client.query(
        `insert into public.boat_categories (id, boat_id, name, color, sort_order)
         select gen_random_uuid(), b.id, 'Catégorie ' || g, '#336699', g
         from public.boats b, generate_series(0, $1) g
         where b.organization_id = $2`,
        [CATEGORIES - 1, ORG],
      );
      await client.query(
        `insert into public.checklist_items
           (id, boat_id, category_id, label, interval_months, sort_order)
         select gen_random_uuid(), c.boat_id, c.id, 'Point ' || g, 12, g
         from public.boat_categories c
         join public.boats b on b.id = c.boat_id
         cross join generate_series(0, $1) g
         where b.organization_id = $2`,
        [ITEMS_PER_CATEGORY - 1, ORG],
      );
      // Sans statistiques le planificateur travaille à l'aveugle, et le test mesurerait son
      // hasard plutôt que la forme de la vue.
      await client.query("analyze public.checklist_items");
      await client.query("analyze public.boat_categories");
      await client.query("analyze public.boats");
      const explained = await client.query(
        `explain (analyze, costs off)
         select * from public.checklist_category_progress where boat_id = $1`,
        [BOAT],
      );
      plan = explained.rows.map((r: Record<string, string>) => r["QUERY PLAN"]).join("\n");
      await client.query("rollback");
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("obtient bien un plan à lire", () => {
    expect(plan).toMatch(/checklist_items/);
  });

  it("ne touche que les points du bateau demandé", () => {
    // La version fautive lisait les points de toute la base — ici 21 bateaux, 4201 points —
    // pour répondre sur un seul : le filtre `boat_id` ne descendait pas dans la vue.
    //
    // Le seuil se dit par rapport à la **flotte**, pas au bateau : un plan correct relit
    // légitimement les points de ce bateau plusieurs fois (la vue les joint, puis les
    // recoupe pour la dernière réalisation et l'intervention ouverte), et compter ces
    // relectures reviendrait à figer une forme de plan que Postgres est libre de changer.
    // Ce qu'il n'a pas le droit de faire, c'est lire les autres bateaux.
    const fleet = ITEMS_PER_BOAT * (OTHER_BOATS + 1);
    const widest = widestScan(plan, /checklist_items/);
    expect(widest).toBeLessThan(fleet / 2);
    expect(widest).toBeLessThanOrEqual(ITEMS_PER_BOAT * 6);
  });

  it("ne recalcule pas les points une fois par catégorie", () => {
    // L'autre forme de la même faute : 8 catégories × 200 points sur le bateau observé.
    const executions = plan
      .split("\n")
      .filter((line) => /checklist_compute_status/.test(line))
      .reduce((total, line) => total + Number(/loops=(\d+)/.exec(line)?.[1] ?? 0), 0);
    expect(executions).toBeLessThanOrEqual(ITEMS_PER_BOAT * 2);
    expect(executions).toBeLessThan(ITEMS_PER_BOAT * CATEGORIES);
  });
});
