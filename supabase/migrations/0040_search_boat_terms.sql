-- 0040_search_boat_terms.sql — E18-14 / D138: la recherche répond à ce qu'on tape.
--
-- Ce qui n'allait pas
-- -------------------
-- `0039` cherchait la question **entière** comme une sous-chaîne : `search_text like '%' || q ||
-- '%'`. Une frappe en un mot marchait ; tout le reste tombait à côté, et sur des cas qui sont la
-- façon normale de taper.
--
--   « vidange babord »   → 0 résultat, alors que « Vidange moteur bâbord » est dans le carnet.
--   « moteur vidange »   → 0 résultat, la même ligne, dans l'autre sens.
--   « 100% »             → n'importe quelle ligne : le `%` tapé était un joker `LIKE`.
--   « % »                → le carnet entier, pour la même raison.
--   « videnge »          → 0 résultat ; une lettre pour rien.
--
-- Le classement était du même ordre : `score = similarity(titre_entier, question)`. Plus un titre
-- est précis, plus il est long, plus il perd — « Vidange moteur bâbord » (0.364) passait **après**
-- « Vidange (owner) » (0.571) sur la frappe « vidange ». Et une ligne trouvée par ses notes ou par
-- sa marque sortait à 0.000, sans ordre entre elles et sans rien à l'écran qui dise pourquoi elle
-- était là : on lisait un titre qui ne contenait pas le mot cherché.
--
-- Ce que fait ce fichier
-- ----------------------
--   1. `search_terms()`   — la question devient des mots, sans joker possible
--   2. `search_rank()`    — un score qui veut dire quelque chose, et comparable d'une ligne à l'autre
--   3. `search_excerpt()` — le fragment qui a répondu, quand ce n'est pas le titre
--   4. `search_boat()`    — les mots dans le désordre, la faute de frappe pardonnée, le tout classé
--
-- Aucune table, aucune politique : les sept familles portent les leurs (`0002` → `0034`), et la
-- fonction reste `security invoker` — ce qui revient est exactement ce que l'appelant atteindrait
-- écran par écran. La colonne `search_text` de `0039` ne bouge pas : c'est toujours elle qu'on lit,
-- et toujours ses index GIN trigram qui portent le `like`.

-- ---------------------------------------------------------------------------------------------
-- 0. Charger pg_trgm avant de nommer son réglage
-- ---------------------------------------------------------------------------------------------
-- `search_boat` porte un `set pg_trgm.word_similarity_threshold`, et Postgres ne connaît ce
-- paramètre qu'une fois la bibliothèque de `pg_trgm` chargée dans la session. Tant qu'elle ne
-- l'est pas, `pg_trgm.*` n'est qu'un *placeholder* — une variable inventée — et en poser une
-- demande le superutilisateur.
--
-- Sur une base locale on est superutilisateur, donc la migration passe sans rien dire ; sur
-- Supabase le rôle `postgres` ne l'est pas, et le `create function` est refusé :
--
--     ERROR: 42501: permission denied to set parameter "pg_trgm.word_similarity_threshold"
--
-- Un appel — n'importe lequel — charge la bibliothèque et le paramètre devient un vrai GUC,
-- `USERSET`, que le rôle pose sans privilège particulier. C'est donc la première ligne du
-- fichier, et c'est exactement le genre d'écart local/production qui a fait que `0039` vivait
-- dans le dépôt sans jamais avoir été appliquée (D138).
do $$ begin perform extensions.similarity('a', 'a'); end $$;

-- ---------------------------------------------------------------------------------------------
-- 1. search_terms : la question devient des mots
-- ---------------------------------------------------------------------------------------------
-- Replier (`text_fold`), puis couper sur tout ce qui n'est ni lettre ni chiffre. Deux effets, et
-- le second est une correction de sécurité autant que d'ergonomie :
--
--   * « vidange babord » devient {vidange, babord}, deux conditions au lieu d'une phrase ;
--   * `%`, `_` et `\` — les métacaractères de `LIKE` — ne peuvent plus survivre à la découpe.
--     `0039` les concaténait tels quels dans son motif : « 100% » cherchait `%100%%`, et une
--     frappe « % » à elle seule sortait le carnet entier. Il n'y a rien à échapper ici parce
--     qu'il n'en reste rien.
--
-- Les mots sont rendus **du plus long au plus court** : le premier est celui que `search_boat`
-- donne à l'index, et un mot long est plus sélectif qu'un mot court. Six au maximum — au-delà,
-- la question n'en est plus une.
--
-- Son jumeau TypeScript est `searchTerms()` (`src/lib/search-terms.ts`), qui sert à surligner ce
-- qui a répondu ; `tests/unit/search-sql.test.ts` fait répondre les deux aux mêmes frappes.
create function public.search_terms(p_query text)
returns text[]
language sql immutable
set search_path = ''
as $$
  select coalesce(array_agg(s.term order by length(s.term) desc, s.term), '{}'::text[])
  from (
    select w as term
    from unnest(regexp_split_to_array(public.text_fold(p_query), '[^[:alnum:]]+')) as w
    where w <> ''
    group by w
    order by length(w) desc, w
    limit 6
  ) s;
$$;

comment on function public.search_terms(text) is
  'La question découpée en mots repliés, du plus long au plus court, six au plus (E18-14). La '
  'découpe sur [^[:alnum:]] est aussi ce qui rend impossible un joker LIKE tapé par un humain. '
  'Jumeau de searchTerms() dans src/lib/search-terms.ts.';

-- ---------------------------------------------------------------------------------------------
-- 2. search_rank : un score qui veut dire quelque chose
-- ---------------------------------------------------------------------------------------------
-- Des paliers, pas une distance. `similarity()` compare deux chaînes entières, donc il punit la
-- longueur : c'est ce qui faisait passer « Vidange (owner) » devant « Vidange moteur bâbord ».
-- Ce qu'une personne veut dire en tapant « vidange », c'est « la ligne dont c'est le sujet »,
-- et le sujet d'une ligne est au début de son nom.
--
--   1.00  le nom est la question
--   0.90  le nom commence par la question          « vidange » → « Vidange moteur bâbord »
--   0.80  la question ouvre un mot du nom          « moteur »  → « Vidange moteur bâbord »
--   0.70  la question est quelque part dans le nom « oteur »   → « Vidange moteur bâbord »
--   0.60  tous les mots sont dans le nom, désordre compris     « babord vidange »
--   0.50  la question est dans le second champ     « yanmar »  → marque de « Moteur bâbord »
--   0.45  tous les mots y sont
--   ≤0.40 le reste : trouvé dans le texte profond (notes, référence) ou à une faute près
--
-- Trois étages, donc, et jamais l'un devant l'autre : une ligne trouvée par son **nom** passe
-- devant une ligne trouvée par sa **marque**, qui passe devant une ligne trouvée par ses
-- **notes**. C'est la seule hiérarchie que l'écran n'a pas à expliquer.
--
-- Le dernier étage lit `word_similarity` et non `similarity` : la première compare la question au
-- meilleur mot du nom, la seconde aux deux chaînes entières — donc `similarity` punit la longueur
-- et c'est très exactement le défaut qu'on répare ici. Sur la frappe « videnge », « Vidange
-- moteur bâbord » vaut 0.10 en `similarity` et 0.45 en `word_similarity`.
--
-- Pourquoi les arguments arrivent **déjà repliés**
-- ------------------------------------------------
-- Parce que c'est la différence entre une recherche et une attente. Écrite avec un `from (select
-- text_fold(…))` et deux sous-requêtes `(select bool_and(…) from unnest(terms))`, cette fonction
-- ne peut pas être *inlinée* par Postgres : `inline_function()` refuse tout corps qui porte un
-- FROM ou un sublink, et chaque appel devient alors une invocation complète de l'exécuteur.
-- Mesuré sur un carnet de dix ans, frappe « vidange », 625 lignes à classer : **140 ms** pour le
-- seul classement, soit 0.22 ms par ligne. La même chose en un seul `select` sans FROM ni
-- sous-requête — le repliage fait par l'appelant, les mots reçus comme motifs `LIKE` et testés
-- par `like all`, qui est un opérateur et non un sublink — s'inline et retombe dans le bruit de
-- fond. C'est pour cela que les paramètres s'appellent `p_folded_*` : leur repliage est le
-- travail de l'appelant, une fois par ligne, et non trois fois par palier.
--
-- Pure, immuable, sans lecture de table : `tests/unit/search-sql.test.ts` l'interroge palier par
-- palier.
create function public.search_rank(
  p_folded_name text,
  p_folded_subtitle text,
  p_folded_query text,
  p_patterns text[]
)
returns real
language sql immutable
set search_path = ''
as $$
  select greatest(
    case
      when p_folded_name = '' or p_folded_query = '' then 0::real
      when p_folded_name = p_folded_query then 1.0::real
      when starts_with(p_folded_name, p_folded_query) then 0.9::real
      -- ' ' devant les deux : « moteur » ouvre un mot de « vidange moteur », pas de « démoteur ».
      when strpos(' ' || p_folded_name, ' ' || p_folded_query) > 0 then 0.8::real
      when strpos(p_folded_name, p_folded_query) > 0 then 0.7::real
      else 0::real
    end,
    -- `like all` sur un tableau vide vaut `true` : sans la garde, une question sans mot donnerait
    -- 0.6 à tout le carnet.
    case
      when p_folded_name <> '' and cardinality(p_patterns) > 0 and p_folded_name like all (p_patterns)
      then 0.6::real
      else 0::real
    end,
    case
      when p_folded_subtitle = '' or p_folded_query = '' then 0::real
      when strpos(p_folded_subtitle, p_folded_query) > 0 then 0.5::real
      when cardinality(p_patterns) > 0 and p_folded_subtitle like all (p_patterns) then 0.45::real
      else 0::real
    end,
    (0.4 * greatest(
      extensions.similarity(p_folded_name, p_folded_query),
      extensions.word_similarity(p_folded_query, p_folded_name)
    ))::real
  );
$$;

comment on function public.search_rank(text, text, text, text[]) is
  'Ce que vaut une ligne pour une question (E18-14) : paliers du nom (exact, préfixe, mot, '
  'sous-chaîne, mots dans le désordre), puis du second champ (marque, fournisseur, entreprise), '
  'et au plus 0.4 quand seul le texte profond ou une approximation a répondu — une ligne trouvée '
  'par son nom passe donc toujours devant. Les textes arrivent repliés par normalise_for_match : '
  'un corps sans FROM ni sous-requête est la condition pour que Postgres l''inline.';

-- ---------------------------------------------------------------------------------------------
-- 3. search_excerpt : le fragment qui a répondu
-- ---------------------------------------------------------------------------------------------
-- « courroie » trouvait « Vidange moteur bâbord » — c'est juste, la courroie est dans les notes —
-- et l'écran affichait un titre où le mot cherché n'était pas. On ne pouvait pas distinguer une
-- bonne réponse d'un bug. Le fragment est la différence.
--
-- La position est cherchée dans le texte replié et découpée dans le texte d'origine, pour rendre
-- les accents et les majuscules. `text_fold` conserve les longueurs sauf sur les ligatures
-- (« œ » → « oe ») : un « œ » avant le mot trouvé décale la fenêtre d'un caractère, ce qui la
-- déplace sans jamais la faire mentir — les bornes sont bridées sur le texte.
--
-- Celle-ci garde son FROM et ses sous-requêtes, donc elle ne s'inline pas — et n'a pas à le
-- faire : `search_boat` ne l'appelle qu'**après** le `limit` de chaque famille, sur les huit
-- lignes qui restent et non sur les six cents qui ont répondu.
create function public.search_excerpt(p_text text, p_terms text[], p_width int default 96)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when w.at is null then null
    else
      case when w.start > 1 then '…' else '' end
      || btrim(substr(s.raw, w.start, p_width))
      || case when w.start + p_width <= length(s.raw) then '…' else '' end
  end
  from (select btrim(coalesce(p_text, '')) as raw) s,
  lateral (
    select min(p.pos) as at
    from unnest(p_terms) as t,
    lateral (select strpos(public.text_fold(s.raw), t) as pos) p
    where p.pos > 0
  ) m,
  -- 24 caractères avant le mot trouvé : assez pour la fin de la phrase qui l'amène, pas assez
  -- pour qu'on doive la lire pour trouver le mot.
  lateral (select greatest(1, least(m.at - 24, greatest(1, length(s.raw) - p_width + 1))) as start,
                  m.at as at) w
  where s.raw <> '';
$$;

comment on function public.search_excerpt(text, text[], int) is
  'Le fragment de texte profond qui a répondu à la question (E18-14), borné et élidé — ce qui '
  'permet à l''écran de dire pourquoi une ligne est là quand son titre ne le dit pas.';

-- ---------------------------------------------------------------------------------------------
-- 4. search_boat
-- ---------------------------------------------------------------------------------------------
-- Le contrat change (`context` s'ajoute), donc `drop` puis `create` : `create or replace` ne sait
-- pas changer la liste des colonnes rendues.
drop function public.search_boat(uuid, text, int);

-- Une ligne répond quand **tous** les mots de la question y sont, dans n'importe quel ordre — et
-- le plus long d'entre eux a droit à une faute de frappe :
--
--     (search_text like '%<le plus long>%'  ou  search_text %> '<le plus long>')
--     et search_text like all ('%<les autres>%')
--
-- Le mot le plus long ouvre la marche parce que c'est le plus sélectif, et c'est lui qui attaque
-- l'index GIN trigram de `0039` ; les autres filtrent derrière (`like all` sur un tableau vide
-- vaut `true`, donc une question d'un seul mot ne paie rien).
--
-- L'approximation est `word_similarity`, seuil abaissé à 0.45 par le `set` de la fonction :
-- « videnge » vaut 0.455 contre « vidange moteur bâbord », et le défaut de 0.6 le refusait.
--
-- Elle ne porte que sur ce mot-là, et **le reste de la question continue d'être exigé** — c'est
-- ce qui la sépare d'un `or` posé sur toute la condition. Écrite comme un `or` global, la frappe
-- « secret@chantier » (deux mots : « chantier », « secret ») rendait les lignes proches de
-- « chantier » **sans** « secret », donc une question à deux mots répondait à un seul. Ici la
-- faute est pardonnée sur un mot, jamais sur l'intention.
--
-- Le second est écrit `search_text %> mot` et non `mot <% search_text`, qui dit pourtant la même
-- chose : seul `%>` porte la colonne indexée **à gauche**, et c'est la seule des deux formes que
-- l'`opfamily` `gin_trgm_ops` expose (`%`, `~~`, `~`, `%>`, `%>>`, `=`, lues dans `pg_amop`).
-- Mesuré sur un carnet de dix ans (5 000 interventions), même prédicat, même résultat : **60 ms**
-- en `<%`, où chaque ligne est repliée et comparée, contre **0.2 ms** en `%>`, où l'index répond.
-- C'est un détail d'écriture qui vaut un facteur 300.
--
-- Rien d'autre ne bouge de `0039` : la corbeille reste invisible (règle 9), les points inactifs
-- aussi, chaque famille est filtrée par `boat_id` (règle 4), et le téléphone, l'adresse et
-- l'e-mail d'un intervenant ne sont toujours pas cherchés.
create function public.search_boat(
  p_boat_id uuid,
  p_query text,
  p_limit int default 8
)
returns table (
  kind text,
  id uuid,
  title text,
  subtitle text,
  context text,
  happened_at date,
  amount numeric,
  parent_id uuid,
  score real
)
returns null on null input
language sql stable
set search_path = ''
set pg_trgm.word_similarity_threshold = '0.45'
as $$
  with n as (
    select
      t.terms,
      -- La question repliée **dans l'ordre où elle est tapée** : c'est elle que les paliers
      -- « commence par » et « ouvre un mot » comparent, et `normalise_for_match` la rend telle
      -- quelle, ponctuation et espaces doubles en moins.
      public.normalise_for_match(p_query) as query,
      -- Deux caractères au moins sur le mot le plus long — donc une question qui ne fait que de
      -- la ponctuation (« %% ») n'a aucun mot et ne cherche rien, là où `0039` y voyait deux
      -- caractères et sortait le carnet.
      coalesce(length(t.terms[1]), 0) >= 2 as usable,
      t.terms[1] as lead_term,
      '%' || coalesce(t.terms[1], '') || '%' as lead,
      coalesce(
        (select array_agg('%' || x || '%') from unnest(t.terms[2:]) as x),
        '{}'::text[]
      ) as rest,
      coalesce(
        (select array_agg('%' || x || '%') from unnest(t.terms) as x),
        '{}'::text[]
      ) as patterns,
      greatest(1, least(p_limit, 20)) as per_family
    from (select public.search_terms(p_query) as terms) t
  ),
  hits as (
    -- Interventions : la réponse à « c'était quand ? » est aussi souvent dans les notes que dans
    -- le titre — d'où le texte profond emporté jusqu'au fragment.
    (
      select
        'log'::text as kind,
        l.id,
        l.title,
        null::text as subtitle,
        l.notes as deep_text,
        l.performed_at as happened_at,
        l.cost as amount,
        l.category_id as parent_id,
        public.search_rank(
          public.normalise_for_match(l.title), '', n.query, n.patterns
        ) as score
      from public.maintenance_logs l, n
      where n.usable
        and l.boat_id = p_boat_id
        and l.deleted_at is null
        and (
          l.search_text like n.lead
          or l.search_text operator(extensions.%>) n.lead_term
        )
        and l.search_text like all (n.rest)
      order by score desc, l.performed_at desc nulls last
      limit (select per_family from n)
    )
    union all
    -- Points de checklist : seulement le plan vivant. Un point inactif n'est pas quelque chose
    -- à aller faire.
    (
      select
        'item'::text,
        i.id,
        i.label,
        null::text,
        i.description,
        null::date,
        null::numeric,
        i.category_id,
        public.search_rank(
          public.normalise_for_match(i.label), '', n.query, n.patterns
        )
      from public.checklist_items i, n
      where n.usable
        and i.boat_id = p_boat_id
        and i.is_active
        and (
          i.search_text like n.lead
          or i.search_text operator(extensions.%>) n.lead_term
        )
        and i.search_text like all (n.rest)
      order by 9 desc, i.sort_order
      limit (select per_family from n)
    )
    union all
    -- Achats : « combien ? » est la moitié de la question, donc le fournisseur se cherche aussi.
    (
      select
        'purchase'::text,
        p.id,
        p.designation,
        p.supplier_name,
        p.notes,
        p.purchased_at,
        p.amount,
        p.category_id,
        public.search_rank(
          public.normalise_for_match(p.designation),
          public.normalise_for_match(p.supplier_name),
          n.query,
          n.patterns
        )
      from public.purchases p, n
      where n.usable
        and p.boat_id = p_boat_id
        and p.deleted_at is null
        and (
          p.search_text like n.lead
          or p.search_text operator(extensions.%>) n.lead_term
        )
        and p.search_text like all (n.rest)
      order by 9 desc, p.purchased_at desc nulls last
      limit (select per_family from n)
    )
    union all
    -- Équipements : « quelle référence ? » est un numéro de série ou un modèle aussi souvent
    -- qu'un nom.
    (
      select
        'equipment'::text,
        e.id,
        e.name,
        nullif(trim(coalesce(e.brand, '') || ' ' || coalesce(e.model, '')), ''),
        e.serial,
        null::date,
        null::numeric,
        e.category_id,
        public.search_rank(
          public.normalise_for_match(e.name),
          public.normalise_for_match(coalesce(e.brand, '') || ' ' || coalesce(e.model, '')),
          n.query,
          n.patterns
        )
      from public.equipment e, n
      where n.usable
        and e.boat_id = p_boat_id
        and e.deleted_at is null
        and (
          e.search_text like n.lead
          or e.search_text operator(extensions.%>) n.lead_term
        )
        and e.search_text like all (n.rest)
      order by 9 desc, e.sort_order
      limit (select per_family from n)
    )
    union all
    -- Pièces : la référence est ce qu'on lit sur une boîte au fond d'un coffre.
    (
      select
        'part'::text,
        pa.id,
        pa.name,
        pa.reference,
        nullif(concat_ws(' · ', pa.location, pa.notes), ''),
        null::date,
        null::numeric,
        pa.category_id,
        public.search_rank(
          public.normalise_for_match(pa.name),
          public.normalise_for_match(pa.reference),
          n.query,
          n.patterns
        )
      from public.parts pa, n
      where n.usable
        and pa.boat_id = p_boat_id
        and pa.deleted_at is null
        and (
          pa.search_text like n.lead
          or pa.search_text operator(extensions.%>) n.lead_term
        )
        and pa.search_text like all (n.rest)
      order by 9 desc, pa.name
      limit (select per_family from n)
    )
    union all
    -- Les personnes : le nom, l'entreprise, le métier — jamais le téléphone, l'e-mail ou
    -- l'adresse. Rien à extraire non plus : ce qui a répondu est déjà sur la ligne.
    (
      select
        'contact'::text,
        c.id,
        c.name,
        nullif(trim(coalesce(c.company, '') || ' ' || coalesce(c.specialty, '')), ''),
        null::text,
        null::date,
        null::numeric,
        null::uuid,
        public.search_rank(
          public.normalise_for_match(c.name),
          public.normalise_for_match(coalesce(c.company, '') || ' ' || coalesce(c.specialty, '')),
          n.query,
          n.patterns
        )
      from public.contacts c, n
      where n.usable
        and c.boat_id = p_boat_id
        and c.deleted_at is null
        and (
          c.search_text like n.lead
          or c.search_text operator(extensions.%>) n.lead_term
        )
        and c.search_text like all (n.rest)
      order by 9 desc, c.name
      limit (select per_family from n)
    )
    union all
    -- Les documents encore sur « À valider ». Un document validé est devenu une intervention ou
    -- un achat et se trouve déjà comme tel : le montrer deux fois serait le montrer en deux choses.
    (
      select
        'document'::text,
        d.id,
        coalesce(nullif(d.subject, ''), d.file_name),
        d.sender_name,
        nullif(d.file_name, d.subject),
        d.received_at::date,
        null::numeric,
        null::uuid,
        public.search_rank(
          public.normalise_for_match(coalesce(nullif(d.subject, ''), d.file_name)),
          public.normalise_for_match(d.sender_name),
          n.query,
          n.patterns
        )
      from public.inbox_items d, n
      where n.usable
        and d.boat_id = p_boat_id
        and d.status in ('received', 'analysing', 'ready')
        and (
          d.search_text like n.lead
          or d.search_text operator(extensions.%>) n.lead_term
        )
        and d.search_text like all (n.rest)
      order by 9 desc, d.received_at desc
      limit (select per_family from n)
    )
  )
  select
    h.kind,
    h.id,
    h.title,
    h.subtitle,
    -- Après le `limit` de chaque famille, donc sur cinquante-six lignes au plus.
    public.search_excerpt(h.deep_text, n.terms) as context,
    h.happened_at,
    h.amount,
    h.parent_id,
    h.score
  from hits h, n
  order by h.score desc, h.happened_at desc nulls last, h.title;
$$;

comment on function public.search_boat(uuid, text, int) is
  'E18-4, E18-14 : une question, sept familles (log, item, purchase, equipment, part, contact, '
  'document). Les mots dans n''importe quel ordre, une faute de frappe pardonnée sur le plus '
  'long, un score par paliers du nom, et le fragment qui a répondu quand ce n''est pas le titre. '
  '`security invoker`, donc la RLS de l''appelant décide de chaque ligne ; la corbeille et les '
  'points inactifs sont exclus, et le téléphone, l''e-mail et l''adresse d''un intervenant ne '
  'sont jamais cherchés.';

-- `0009` reprend à `anon` l'EXECUTE que Supabase donne à la création. Ces trois-là sont neuves,
-- et la recherche ne l'est plus : il n'y a rien à chercher pour un visiteur déconnecté.
revoke execute on function public.search_terms(text) from public, anon;
revoke execute on function public.search_rank(text, text, text, text[]) from public, anon;
revoke execute on function public.search_excerpt(text, text[], int) from public, anon;
revoke execute on function public.search_boat(uuid, text, int) from public, anon;
grant execute on function public.search_boat(uuid, text, int) to authenticated, service_role;
