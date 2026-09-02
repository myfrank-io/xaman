# Xaman — Modèle de données

> Postgres (Supabase). Schéma `public`. Toutes les tables métier sont multi-tenant par `boat_id` et protégées par RLS.
> Conventions : noms de tables au pluriel, `snake_case`, clés primaires `uuid` (générées côté client ou `gen_random_uuid()`), `timestamptz` pour la technique, `date` pour le métier.
> Conventions transversales (valables même si non répétées dans chaque table) :
> - toutes les tables ont `created_at` et `updated_at` (`timestamptz`, trigger `set_updated_at`) ; les tables métier ont en plus `created_by` et `updated_by` ;
> - toute FK vers `profiles` (`created_by`, `updated_by`, `completed_by`, `invited_by`, `accepted_by`) est **nullable et `on delete set null`** : la suppression d'un compte ne fait jamais disparaître les données du bateau ;
> - toute vue est créée **`with (security_invoker = true)`** afin que la RLS des tables sous-jacentes s'applique ;
> - les colonnes sensibles sont retirées du rôle `authenticated` par privilèges de colonne (§5), en plus de la RLS.
> Ce document est la référence ; les migrations SQL dans `supabase/migrations/` doivent le refléter. En cas d'écart découvert en implémentation, mettre à jour ce fichier dans le même commit.

---

## 1. Vue d'ensemble

```
auth.users ─1:1─ profiles
                    │
   organizations ◄──┼── organization_members (V2, table créée, sans UI)
        │           │
        └─0..1─► boats ◄──── boat_members (role) ──── profiles
                   │  ◄──── boat_invitations
                   ├── engines ──── engine_hour_readings
                   ├── boat_categories ──┬── checklist_items ──── checklist_completions
                   │                     ├── maintenance_logs ──── (engine_hour_readings, checklist_completions, attachments, purchases)
                   │                     ├── equipment
                   │                     └── purchases
                   ├── contacts (référencés par maintenance_logs, purchases, haul_outs, parts)
                   ├── parts
                   ├── haul_outs
                   └── attachments (polymorphe : entity_type + entity_id)

checklist_templates ── checklist_template_categories ── checklist_template_items
        (instanciés dans boat_categories / checklist_items à la création du bateau)
```

## 2. Énumérations

```sql
create type organization_type as enum ('private', 'charter', 'club', 'builder', 'yard', 'pro');
-- V1 : 'private' uniquement en pratique.

create type boat_role as enum ('owner', 'editor', 'pro', 'viewer', 'renter');
-- V1 actifs : owner, editor, pro, viewer. 'renter' réservé (V2), jamais attribué en V1.

create type boat_type as enum ('catamaran', 'trimaran', 'monohull_sail', 'motor', 'rib', 'other');

create type engine_position as enum ('port', 'starboard', 'center', 'outboard');
-- 'port' = bâbord (BB), 'starboard' = tribord (SB). Le libellé FR est calculé côté UI.

create type log_status as enum ('planned', 'in_progress', 'done', 'urgent');
create type log_priority as enum ('low', 'normal', 'high');

create type purchase_kind as enum ('gas', 'part', 'consumable', 'service', 'other');

create type hour_reading_source as enum ('manual', 'maintenance_log', 'checklist', 'import');

create type attachment_entity as enum ('maintenance_log', 'equipment', 'haul_out', 'purchase', 'boat', 'checklist_completion');

create type checklist_item_source as enum ('template', 'custom');
```

## 3. Tables

### 3.1 `profiles`
Miroir public de `auth.users`, créé par trigger `on_auth_user_created`.

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK, FK auth.users(id) on delete cascade | |
| email | text | not null, unique | copie de auth.users.email |
| full_name | text | | |
| avatar_url | text | | |
| locale | text | not null default 'fr' | |
| is_platform_admin | boolean | not null default false | Joseph = true. `revoke update (is_platform_admin) on profiles from authenticated` : modifiable uniquement en SQL / clé service |
| created_at | timestamptz | not null default now() | |
| updated_at | timestamptz | not null default now() | |

### 3.2 `organizations` (V2 — créée en V1, sans UI)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| name | text | not null |
| type | organization_type | not null default 'private' |
| created_by | uuid | FK profiles |
| created_at / updated_at | timestamptz | |

### 3.3 `organization_members` (V2)

| Colonne | Type | Contraintes |
|---|---|---|
| organization_id | uuid | FK organizations on delete cascade |
| user_id | uuid | FK profiles on delete cascade |
| role | text | not null default 'member' (`admin` / `member`) |
| PK | (organization_id, user_id) | |

### 3.4 `boats`

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| organization_id | uuid | FK organizations, null | V2 |
| name | text | not null | « Xaman » |
| builder | text | | « Marsaudon Composites » |
| model | text | | « ORC 50 » |
| hull_number | text | | « 25 » |
| year | int | | |
| type | boat_type | not null default 'monohull_sail' | |
| flag | text | | pavillon |
| home_port | text | | |
| sail_number | text | | |
| length_m / beam_m / draft_m | numeric(5,2) | | |
| photo_path | text | | chemin Storage |
| notes | text | | données fixes libres (ex. antifouling) |
| checklist_template_id | uuid | FK checklist_templates, null | modèle utilisé à l'instanciation |
| external_ref | text | unique, null | clé d'idempotence du seed (`xaman`) |
| created_by / updated_by | uuid | FK profiles | |
| created_at / updated_at | timestamptz | | |

### 3.5 `boat_members`

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| boat_id | uuid | FK boats on delete cascade | |
| user_id | uuid | FK profiles on delete cascade | |
| role | boat_role | not null | |
| valid_from / valid_until | date | null | V2 (renter) ; null = illimité. Les fonctions RLS vérifient `valid_until is null or valid_until >= current_date` |
| invited_by | uuid | FK profiles | |
| created_at | timestamptz | | |
| PK | (boat_id, user_id) | | |

Contrainte métier : un bateau a **au moins un `owner`** (trigger empêchant la suppression / rétrogradation du dernier owner).

### 3.6 `boat_invitations`

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| email | text | not null | normalisé en minuscules |
| role | boat_role | not null | jamais 'owner' via l'UI V1 (un owner promeut ensuite) |
| token | text | not null, unique | 32 octets aléatoires, base64url ; `revoke select (token) on boat_invitations from authenticated` — la colonne n'est lisible que par la clé service (Server Action d'envoi d'e-mail) ; l'acceptation passe par `accept_invitation(token)` et l'aperçu par `get_invitation_preview(token)` (security definer) |
| invited_by | uuid | FK profiles | |
| expires_at | timestamptz | not null default now() + interval '14 days' | |
| accepted_at | timestamptz | null | |
| accepted_by | uuid | FK profiles, null | |
| revoked_at | timestamptz | null | |
| created_at | timestamptz | | |

### 3.7 `engines`

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| label | text | not null | « Moteur SB », « Moteur BB », « Annexe » |
| position | engine_position | not null | |
| brand / model / serial | text | | |
| installed_at | date | | |
| is_active | boolean | not null default true | |
| sort_order | int | not null default 0 | |
| notes | text | | |
| external_ref | text | | seed (`xaman-engine-sb`) |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

### 3.8 `engine_hour_readings`
Historique des relevés. **Les heures courantes d'un moteur = dernier relevé par `read_at desc, created_at desc`** (vue `engine_current_hours`).

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | dénormalisé pour RLS |
| engine_id | uuid | FK engines on delete cascade | |
| hours | numeric(8,1) | not null, check hours >= 0 | |
| read_at | date | not null default current_date | |
| source | hour_reading_source | not null default 'manual' | |
| maintenance_log_id | uuid | FK maintenance_logs on delete set null, null | le relevé survit à la purge de l'intervention |
| checklist_completion_id | uuid | FK checklist_completions on delete set null, null | |
| note | text | | |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (maintenance_log_id, engine_id) | | un relevé par moteur et par intervention (permet l'upsert) |
| unique | (checklist_completion_id) | | un relevé par cochage |

Pas de contrainte de monotonie (un compteur peut être remplacé) ; l'UI avertit si la valeur saisie est inférieure au dernier relevé. Quand `maintenance_logs.performed_at` change, le trigger `sync_log_readings_date` aligne `read_at` des relevés liés.

### 3.9 `boat_categories`
Les « systèmes » du bateau. Instanciés depuis le modèle, modifiables (renommage, couleur, ordre) par owner/editor. Utilisés par la checklist, le journal, les achats, les équipements.

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| name | text | not null | |
| color | text | not null | hex `#RRGGBB` |
| icon | text | | nom d'icône lucide |
| sort_order | int | not null default 0 | |
| template_category_id | uuid | FK checklist_template_categories, null | |
| is_active | boolean | not null default true | |
| external_ref | text | | copié depuis `checklist_template_categories.external_ref` à l'instanciation (`engines`, `sails_rigging`…) ; les seeds y font référence via `category_ref` |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

### 3.10 `equipment`

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| category_id | uuid | FK boat_categories, null | |
| name | text | not null | « Mât carbone Lorima » |
| brand / model / serial | text | | |
| quantity | int | default 1 | |
| installed_at | date | | |
| specs | jsonb | not null default '{}' | paires clé/valeur libres affichées telles quelles (`{"surface_m2": 88, "tissu": "Hydranet"}`) |
| notes | text | | |
| sort_order | int | default 0 | |
| external_ref | text | | seed |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

### 3.11 `contacts` (annuaire des intervenants)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | V1 : par bateau. V2 : `organization_id` pour un annuaire partagé |
| name | text | not null | personne ou société |
| company | text | | |
| specialty | text | not null | libre, avec suggestions : Chantier carénage, Voilier, Électronicien, Motoriste, Gréeur, Mécanicien hors-bord, Shipchandler, Autre |
| phone / email | text | | |
| address | text | | |
| notes | text | | |
| external_ref | text | | seed |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

Suppression : toutes les FK vers `contacts` sont `on delete set null` ; l'UI affiche le nombre de références avant de confirmer.

### 3.12 `maintenance_logs` (journal des interventions)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| title | text | not null, check length ≤ 160 | |
| category_id | uuid | FK boat_categories, null | |
| status | log_status | not null default 'done' | |
| priority | log_priority | not null default 'normal' | |
| performed_at | date | not null | date de l'intervention (ou date prévue si planned) |
| next_due_at | date | null | prochaine échéance |
| cost | numeric(10,2) | null, check >= 0 | |
| currency | char(3) | not null default 'EUR' | |
| contact_id | uuid | FK contacts on delete set null, null | prestataire ; null = fait par l'équipage |
| haul_out_id | uuid | FK haul_outs on delete set null, null | intervention réalisée pendant une sortie de l'eau |
| notes | text | | |
| needs_review | boolean | not null default false | import carnet papier |
| pending_engine_hours | jsonb | null | `{ "<engine_id>": <hours> }` — heures importées non validées ; consommé par `mark_log_reviewed` qui crée les relevés (source `import`) puis vide la colonne |
| external_ref | text | | seed / import |
| deleted_at | timestamptz | null | soft delete |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

Index : `(boat_id, performed_at desc)`, `(boat_id, status)`, `(boat_id, category_id)`, index GIN trigram sur `title || ' ' || coalesce(notes,'')` pour la recherche (`pg_trgm`).

Heures moteur d'une intervention = lignes `engine_hour_readings` avec `maintenance_log_id = id` (une par moteur renseigné).

### 3.13 `checklist_templates`, `checklist_template_categories`, `checklist_template_items`
Modèles globaux, lisibles par tout utilisateur connecté, modifiables par l'admin plateforme (V2 : par l'organisation propriétaire).

`checklist_templates`

| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | « ORC 50 — Marsaudon Composites » |
| builder / model | text | |
| boat_type | boat_type | |
| version | int | default 1 |
| is_public | boolean | default true |
| owner_organization_id | uuid | FK organizations, null (V2 : constructeur) |
| external_ref | text | unique (`orc50-v1`) |
| created_by / created_at / updated_at | | |

`checklist_template_categories` : `id`, `template_id` FK, `name`, `color`, `icon`, `sort_order`, `external_ref` (unique par template).

`checklist_template_items`

| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| template_category_id | uuid | FK on delete cascade |
| label | text | not null |
| description | text | |
| interval_months | int | null |
| interval_hours | int | null (heures moteur) |
| engine_scope | text | `'none'` (défaut) / `'inboard'` / `'outboard'` / `'all'` — `apply_checklist_template` duplique le point pour chaque moteur actif du bateau correspondant au scope (inboard = positions port/starboard/center ; outboard = position outboard) en suffixant le libellé « — {engine.label} » et en renseignant `engine_id` |
| actions | jsonb | tableau de chaînes : étapes pas à pas, `[]` par défaut |
| source | text | 'briefing' / 'proposal' / 'builder' — informatif |
| sort_order | int | |
| external_ref | text | unique `(template_category_id, external_ref)` |
| check | `interval_hours is null or engine_scope <> 'none'` | un intervalle en heures exige un moteur |

Les points sans aucun intervalle sont **autorisés** (contrôle ponctuel) : l'état est « À faire » tant que jamais fait, puis « OK » définitivement.

### 3.14 `checklist_items` (points de la checklist du bateau)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| category_id | uuid | FK boat_categories on delete restrict | |
| label | text | not null | « Vidange huile — Moteur SB » |
| description | text | | |
| interval_months | int | null, check > 0 | |
| interval_hours | int | null, check > 0 | |
| engine_id | uuid | FK engines on delete set null, null | requis si `interval_hours` non null |
| actions | jsonb | not null default '[]' | étapes détaillées |
| source | checklist_item_source | not null default 'custom' | |
| template_item_id | uuid | FK checklist_template_items, null | |
| is_active | boolean | not null default true | désactivation au lieu de suppression |
| sort_order | int | not null default 0 | |
| external_ref | text | | seed ; pour un point dupliqué par moteur : `{item_ref}:{engine_external_ref}` (ex. `eng-oil:xaman-engine-sb`) |
| created_by / updated_by / created_at / updated_at | | | |
| check | `interval_hours is null or engine_id is not null` | | |
| unique | (boat_id, external_ref) | | |

### 3.15 `checklist_completions` (réalisations)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| checklist_item_id | uuid | FK checklist_items on delete cascade | |
| completed_at | date | not null default current_date | |
| completed_by | uuid | FK profiles | qui l'a fait (par défaut l'utilisateur courant ; peut être un autre membre) |
| completed_by_name | text | null | si fait par quelqu'un qui n'est pas membre (« Chantier X ») |
| engine_hours | numeric(8,1) | null | heures du moteur lié au moment du cochage. **Obligatoire si le point a un `interval_hours`** (validation zod + trigger `check_completion_hours`). Crée un `engine_hour_readings` (source 'checklist') sauf si `maintenance_log_id` est renseigné (l'intervention porte déjà ses relevés) |
| note | text | | |
| maintenance_log_id | uuid | FK maintenance_logs on delete set null, null | |
| created_by / updated_by / created_at / updated_at | | | |

Index : `(checklist_item_id, completed_at desc)`.

### 3.16 `purchases` (achats, gaz, consommables)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| purchased_at | date | not null | |
| kind | purchase_kind | not null default 'other' | |
| designation | text | not null | |
| amount | numeric(10,2) | null, check >= 0 | |
| currency | char(3) | default 'EUR' | |
| quantity | numeric(8,2) | default 1 | |
| supplier_contact_id | uuid | FK contacts on delete set null, null | |
| supplier_name | text | | texte libre si pas dans l'annuaire |
| category_id | uuid | FK boat_categories, null | |
| bottle_type | text | null | gaz uniquement (« Butane 13 kg », « Campingaz 907 ») |
| maintenance_log_id | uuid | FK maintenance_logs on delete set null, null | |
| part_id | uuid | FK parts on delete set null, null | si l'achat réapprovisionne une pièce en stock (Should : incrémente la quantité) |
| notes | text | | |
| needs_review | boolean | not null default false | import carnet papier |
| external_ref | text | | |
| deleted_at | timestamptz | null | |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

### 3.17 `parts` (stock de pièces)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| name | text | not null | |
| reference | text | | référence fabricant |
| category_id | uuid | FK boat_categories, null | |
| quantity | numeric(8,2) | not null default 0, check >= 0 | |
| min_quantity | numeric(8,2) | not null default 0 | seuil d'alerte ; alerte si quantity ≤ min_quantity et min_quantity > 0 |
| unit | text | default 'pc' | |
| location | text | | emplacement à bord |
| supplier_contact_id | uuid | FK contacts on delete set null | |
| notes | text | | |
| external_ref | text | | |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

### 3.18 `haul_outs` (sorties de l'eau)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| started_at | date | not null | sortie de l'eau |
| ended_at | date | null, check ended_at >= started_at | remise à l'eau |
| yard_contact_id | uuid | FK contacts on delete set null | |
| yard_name | text | | texte libre |
| works | text | | travaux effectués |
| cost | numeric(10,2) | | |
| currency | char(3) | default 'EUR' | |
| notes | text | | |
| external_ref | text | | |
| deleted_at | timestamptz | null | |
| created_by / updated_by / created_at / updated_at | | | |
| unique | (boat_id, external_ref) | | |

Durée = `ended_at - started_at` (calculée). Interventions liées : `maintenance_logs.haul_out_id` (FK nullable ajoutée sur `maintenance_logs`, on delete set null).

### 3.19 `attachments` (Should)

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| id | uuid | PK | |
| boat_id | uuid | FK boats on delete cascade | |
| entity_type | attachment_entity | not null | |
| entity_id | uuid | not null | pas de FK (polymorphe) ; nettoyage par trigger sur suppression de l'entité |
| storage_path | text | not null | `boats/{boat_id}/{entity_type}/{entity_id}/{uuid}.{ext}` dans le bucket `boat-files` |
| file_name | text | not null | |
| mime_type | text | not null | |
| size_bytes | int | not null, check ≤ 10 Mo | |
| created_by / updated_by / created_at / updated_at | | | |

## 4. Fonctions et triggers

```sql
-- Admin plateforme ?
create function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false);
$$;

-- Membre actif du bateau ? (l'admin plateforme est membre virtuel de tous les bateaux)
create function is_boat_member(p_boat_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from boat_members m
    where m.boat_id = p_boat_id and m.user_id = auth.uid()
      and (m.valid_until is null or m.valid_until >= current_date)
      and (m.valid_from is null or m.valid_from <= current_date)
  ) or is_platform_admin();
$$;

-- Rôle sur le bateau : 'owner' pour l'admin plateforme (owner virtuel), sinon le rôle de boat_members, sinon null.
create function boat_role(p_boat_id uuid) returns boat_role ...;

-- Droits dérivés (tous tiennent compte de l'owner virtuel)
create function is_boat_owner(p_boat_id uuid) returns boolean      -- boat_role = 'owner'
create function can_write_boat(p_boat_id uuid) returns boolean     -- owner | editor
create function can_contribute_boat(p_boat_id uuid) returns boolean -- owner | editor | pro

-- Aperçu d'une invitation pour la page /invite/[token], appelable par un utilisateur anonyme
-- (security definer) : renvoie boat_name, inviter_name, email, role, status ('pending'|'expired'|'accepted'|'revoked').
create function get_invitation_preview(p_token text) returns table (...) ...;

-- Acceptation d'invitation (security definer) : vérifie token, non expiré, non révoqué, non accepté,
-- email = auth.email() (insensible à la casse), upsert boat_members, marque accepted_at / accepted_by. Retourne boat_id.
create function accept_invitation(p_token text) returns uuid ...;

-- Instanciation d'un modèle de checklist (security definer, réservé owner/editor/admin). Idempotente :
--  * upsert des catégories dans boat_categories (clé (boat_id, external_ref) = external_ref de la catégorie du modèle) ;
--  * upsert des points dans checklist_items : engine_scope = 'none' → un point (external_ref = item.external_ref) ;
--    'inboard' / 'outboard' / 'all' → un point par moteur actif du scope (external_ref = item_ref || ':' || engine.external_ref,
--    libellé suffixé « — {engine.label} », engine_id renseigné) ;
--  * renseigne boats.checklist_template_id ;
--  * p_engine_id non null → ne (re)génère que les points de ce moteur (action « Générer les points de ce moteur »).
create function apply_checklist_template(p_boat_id uuid, p_template_id uuid, p_engine_id uuid default null) returns void ...;

-- Validation d'une ligne importée (owner/editor) : needs_review = false et, si pending_engine_hours non null,
-- crée un engine_hour_readings (source 'import') par moteur avec p_hours_override (jsonb, optionnel) pour corriger,
-- puis vide pending_engine_hours.
create function mark_log_reviewed(p_log_id uuid, p_hours_override jsonb default null) returns void ...;

-- Purge de la corbeille : supprime physiquement maintenance_logs / purchases / haul_outs dont deleted_at < now() - 30 jours
-- (pg_cron quotidien si disponible, sinon appelée par une Server Action admin).
create function purge_trash() returns int ...;

-- Triggers
--  set_updated_at()                : before update sur toutes les tables avec updated_at.
--  handle_new_user()               : after insert sur auth.users → profiles.
--  ensure_last_owner()             : before delete / update sur boat_members — refuse de retirer ou rétrograder le
--                                    dernier owner, SAUF si l'opération vient d'une cascade (pg_trigger_depth() > 0)
--                                    ou si le bateau n'existe plus. La suppression de compte du dernier owner d'un
--                                    bateau est refusée en amont par la Server Action (« transférez d'abord la propriété »).
--  check_completion_hours()        : before insert/update sur checklist_completions — engine_hours obligatoire si
--                                    l'item a un interval_hours.
--  sync_engine_hours_from_completion() : after insert/update sur checklist_completions — upsert engine_hour_readings
--                                    (source 'checklist') si engine_hours non null ET maintenance_log_id null.
--  sync_log_readings_date()        : after update of performed_at sur maintenance_logs — aligne read_at des relevés liés.
--  cleanup_attachments()           : after delete sur les entités porteuses — supprime attachments + objets Storage.
```

## 5. Politiques RLS (résumé)

RLS **activée sur toutes les tables**. Modèle général pour une table métier `T` portant `boat_id` :

| Opération | Politique |
|---|---|
| select | `is_boat_member(boat_id)` |
| insert | `can_write_boat(boat_id)` — ou, pour `maintenance_logs`, `checklist_completions`, `engine_hour_readings`, `attachments` : `can_contribute_boat(boat_id) and created_by = auth.uid()` |
| update | `can_write_boat(boat_id)` — ou, pour les mêmes quatre tables : `using (boat_role(boat_id) = 'pro' and created_by = auth.uid())` **`with check (deleted_at is null)`** sur `maintenance_logs` (un pro ne peut pas mettre à la corbeille) |
| delete | `can_write_boat(boat_id)` (les pro ne suppriment pas, même leurs lignes) |

Les tables sans contribution `pro` (`purchases`, `parts`, `haul_outs`, `contacts`, `equipment`, `engines`, `boat_categories`, `checklist_items`) suivent strictement `can_write_boat` pour insert/update/delete.

Cas particuliers :
- `profiles` : select pour soi-même et pour les profils partageant au moins un bateau avec soi (nécessaire pour afficher « qui a fait » ; un `pro` voit donc les noms des co-membres mais pas la page Membres — accepté, documenté) ; update soi-même uniquement ; `revoke update (is_platform_admin) on profiles from authenticated`.
- `boats` : select `is_boat_member(id)` ; insert `is_platform_admin()` (V1) ; update `can_write_boat(id)` ; delete `is_boat_owner(id)`.
- `boat_members` : select `can_write_boat(boat_id)` (owner + editor voient la liste) **ou** `user_id = auth.uid()` (sa propre ligne) ; insert/update/delete `is_boat_owner(boat_id)` (+ trigger dernier owner).
- `boat_invitations` : select/insert/update `is_boat_owner(boat_id)` ; `revoke select (token) on boat_invitations from authenticated` — le client sélectionne des colonnes explicites ou la vue `boat_invitations_safe` ; la Server Action d'invitation insère avec le client utilisateur (RLS owner) puis lit le token avec la clé service pour envoyer l'e-mail.
- `checklist_templates*` : select tout utilisateur authentifié où `is_public` ; write `is_platform_admin()`.
- `organizations*` : V1, select/write `is_platform_admin()` uniquement.
- Storage bucket `boat-files` (privé) : policies sur le préfixe `boats/{boat_id}/` avec les mêmes fonctions (select membre ; insert contribute ; delete write).
- Vues : toutes en `security_invoker = true` ; elles n'ont pas de politique propre, la RLS des tables s'applique.

Tests obligatoires (Vitest + client Supabase avec **5 utilisateurs de test** : owner, editor, pro, viewer, non-membre, créés par `supabase/seed.sql`) : pour chaque table **et chaque vue**, vérifier select/insert/update/delete selon la matrice `SPEC.md §4.3`, y compris : un pro ne peut pas `update ... set deleted_at`, un non-membre ne lit rien via les vues, `token` illisible même pour l'owner. Voir BACKLOG E1-6.

## 6. Vues

Toutes créées `with (security_invoker = true)`.

### 6.1 `engine_current_hours`
```sql
select distinct on (r.engine_id) r.engine_id, r.boat_id, r.hours, r.read_at
from engine_hour_readings r
left join maintenance_logs l on l.id = r.maintenance_log_id
where l.id is null or l.deleted_at is null          -- un relevé porté par une intervention à la corbeille est ignoré
order by r.engine_id, r.read_at desc, r.created_at desc;
```

### 6.2 `checklist_item_status` (logique centrale)
Pour chaque `checklist_items` actif dont la catégorie est active :
- `last_completed_at`, `last_completed_by`, `last_completed_by_name`, `last_engine_hours` : dernière `checklist_completions` (par `completed_at desc, created_at desc`).
- `due_at` = `last_completed_at + make_interval(months => interval_months)` (mois calendaires ; null si pas d'intervalle mois ou jamais fait).
- `due_hours` = `last_engine_hours + interval_hours` (null si pas d'intervalle heures ou jamais fait ; `last_engine_hours` ne peut pas être null quand `interval_hours` est défini, grâce au trigger `check_completion_hours`).
- `current_hours` = `engine_current_hours.hours` du moteur lié (null si aucun relevé : `hours_remaining` null, l'échéance par heures est alors ignorée et l'UI affiche « compteur inconnu »).
- `days_remaining` = `due_at - current_date` ; `hours_remaining` = `due_hours - current_hours`.
- `status` :
  - `'never'` si aucune réalisation ;
  - `'overdue'` si `days_remaining < 0` **ou** `hours_remaining < 0` ;
  - `'soon'` si `days_remaining <= 30` **ou** `hours_remaining <= 25` ;
  - `'ok'` sinon (y compris points sans intervalle déjà faits).
- `checklist_category_progress` : par catégorie active, `total`, `ok_count`, `soon_count`, `overdue_count`, `never_count`, `progress = (ok_count + soon_count)::numeric / nullif(total, 0)` (null → « — »).

La même logique est implémentée en TypeScript dans `src/lib/checklist-status.ts` **uniquement** pour l'optimistic UI, avec un test de parité sur un jeu de cas partagé (`tests/fixtures/checklist-status-cases.json`) : jamais fait, mois seul, heures seul, les deux (première atteinte), compteur inconnu, sans intervalle, **fins de mois** (31/01 + 1 mois, 31/08 + 6 mois, année bissextile) — côté TS avec `date-fns/addMonths`.

### 6.3 `maintenance_logs_view`
`maintenance_logs` non supprimés, joints à `boat_categories` (nom, couleur), `contacts` (nom), `profiles` (nom du créateur), avec `engine_hours` agrégé en JSON `[{engine_id, label, hours}]` depuis `engine_hour_readings`, `completions_count`, `attachments_count`. Utilisée par la liste, le détail et l'export. Une variante `maintenance_logs_trash_view` expose les lignes supprimées (< 30 jours).

### 6.4 `boat_invitations_safe`
`boat_invitations` sans la colonne `token`, avec `status` calculé (`pending` / `expired` / `accepted` / `revoked`) et le nom de l'inviteur.

### 6.5 `expenses_by_category`
Union de `maintenance_logs` (`cost`, `date = performed_at`, `source = 'log'`, `purchase_kind = null`), `purchases` (`amount`, `date = purchased_at`, `source = 'purchase'`, `purchase_kind = kind`), `haul_outs` (`cost`, `date = started_at`, `source = 'haul_out'`, `purchase_kind = null`), non supprimés, montant non null. Colonnes : `boat_id`, `category_id` (null → « Non catégorisé »), `category_name`, `source`, `purchase_kind`, `date`, `amount`, `currency`, `entity_id`. Agrégation par période côté requête ; le tableau E5-5 croise `category_name` × (`source`, `purchase_kind`).

### 6.6 `boat_dashboard_stats`
Par bateau : `overdue_items`, `soon_items`, `planned_logs`, `in_progress_logs`, `urgent_logs`, `ytd_expenses`, `last_haul_out_at`, `months_since_haul_out`, `low_stock_parts`.

## 7. Realtime
Publication `supabase_realtime` sur : `maintenance_logs`, `checklist_items`, `checklist_completions`, `engine_hour_readings`, `purchases`, `parts`, `haul_outs`, `contacts`. Le client ouvre un canal par bateau avec filtre `boat_id=eq.{id}` sur ces 8 tables et invalide les queries TanStack correspondantes. La RLS s'applique aux événements Realtime (Supabase le garantit pour les tables avec RLS).

## 8. Seed et idempotence
- Deux mécanismes distincts : `supabase/seed.sql` (dev et CI : 5 utilisateurs de test, un bateau de test minimal, pour les tests RLS et E2E) et `pnpm seed:xaman` (`scripts/seed.ts`, données réelles de `seed/*.json`, exécutable en local, preview et prod).
- Chaque enregistrement seedé porte un `external_ref` stable ; le script fait des `upsert` sur `(boat_id, external_ref)` (ou `external_ref` seul pour le modèle, `(template_category_id, external_ref)` pour ses points).
- Ordre : template (catégories, points) → boat (`checklist_template_id`) → engines → `apply_checklist_template` (catégories + points, idempotente) → equipment → contacts → membres → history (`maintenance_logs` avec `pending_engine_hours` si `needs_review`, relevés créés uniquement si `needs_review = false`) → purchases.
- Membres : pour chaque e-mail, `auth.admin.getUserByEmail` sinon `auth.admin.inviteUserByEmail` (l'utilisateur reçoit un e-mail Supabase et pourra se connecter par code OTP), puis upsert direct dans `boat_members` avec le rôle ; `is_platform_admin` positionné pour Joseph. Aucune `boat_invitations` n'est créée par le seed.
- Le script utilise la clé service **uniquement en local / CI / exécution manuelle par l'admin**, jamais embarquée dans l'app.

## 9. Compatibilité offline V2 (anticipée, non implémentée)
- UUID générés côté client ✔ ; `updated_at` sur toutes les tables ✔ ; pas de séquences ✔.
- V2 ajoutera une colonne `client_updated_at` et une stratégie « dernier écrit gagne » par ligne, avec journal de conflits pour `maintenance_logs`. Rien à faire en V1 sinon ne pas introduire de compteurs auto-incrémentés ni de logique dépendante de l'ordre d'arrivée.

## 10. Notes d'implémentation (migration `0001_init.sql`)
Écarts et précisions par rapport aux sections précédentes, décidés à l'implémentation :
- **RLS activée dès `0001`** sur toutes les tables, sans politique (refus total pour `anon` / `authenticated`) ; les politiques arrivent dans `0002_rls.sql`. Aucune fenêtre d'exposition entre les deux migrations.
- `boat_members`, `boat_invitations` et `organization_members` portent aussi `updated_at` (convention transversale, trigger `set_updated_at`).
- `equipment.quantity`, `equipment.sort_order`, `purchases.quantity`, `parts.unit` sont `not null` avec leur valeur par défaut ; `parts.min_quantity >= 0`.
- Contraintes de forme : `color ~ '^#[0-9A-Fa-f]{6}$'` (catégories et modèles), `jsonb_typeof(actions) = 'array'`, `jsonb_typeof(specs) = 'object'`, `pending_engine_hours` objet ou null, `boat_invitations.email = lower(email)`, `maintenance_logs.title` entre 1 et 160 caractères, `attachments.size_bytes` entre 1 et 10 Mio, `checklist_template_items.source in ('briefing','proposal','builder')`, `organization_members.role in ('admin','member')`, `boat_members.valid_until >= valid_from`.
- Index supplémentaires sur `boat_id` (+ FK fréquentes) de toutes les tables métier, pour les politiques RLS et les listes ; index partiels sur `maintenance_logs.haul_out_id`, `checklist_items.engine_id`, `checklist_completions.maintenance_log_id`, `purchases.maintenance_log_id`.
- Trigger `on_auth_user_email_updated` : synchronise `profiles.email` quand l'e-mail change dans `auth.users` ; `handle_new_user` lit `full_name` / `avatar_url` dans `raw_user_meta_data` (renseignés par le seed via `inviteUserByEmail`).
- Supabase fournit Postgres 17 ; la validation locale sans Docker se fait sur Postgres 16 avec `tests/support/supabase-shim.sql` (aucune fonctionnalité spécifique à la 17 n'est utilisée).

## 11. Notes d'implémentation (migration `0003_logic.sql`)
- La logique d'état est isolée dans la fonction pure `checklist_compute_status(last_completed_at, interval_months, last_engine_hours, interval_hours, current_hours, today)` (type `checklist_state`), utilisée par la vue `checklist_item_status` avec `current_date` et testée en parité avec `src/lib/checklist-status.ts` sur `tests/fixtures/checklist-status-cases.json` (18 cas dont fins de mois et années bissextiles).
- `checklist_item_status` expose en plus `last_completion_id`, `last_note`, `current_hours` ; `last_completed_by_name` = texte libre si renseigné, sinon nom (ou e-mail) du profil.
- `checklist_category_progress` expose aussi `name`, `color`, `icon`, `sort_order` de la catégorie (une seule requête pour la grille).
- `maintenance_logs_view` ajoute `category_is_active`, `created_by_name`, `purchases_count` ; `maintenance_logs_trash_view` expose `deleted_by` (= `updated_by`) et son nom.
- `expenses_by_category` ajoute `category_color` et `label` (titre / désignation / chantier).
- `apply_checklist_template` : `security definer`, réservé à `can_write_boat` ; les catégories existantes ne sont pas écrasées (seul `template_category_id` est relié) ; les points existants sont conservés (`on conflict do nothing`) ; `external_ref` d'un point par moteur = `item_ref:engine_ref` (id du moteur si `external_ref` absent).
- `mark_log_reviewed` : `security definer`, réservé à `can_write_boat` ; clés de `pending_engine_hours` = uuid de moteurs du bateau (sinon erreur) ; relevés `source = 'import'` datés de `performed_at`.
- `sync_engine_hours_from_completion` est `security definer` : il est aussi déclenché par la cascade `on delete set null` quand une intervention est supprimée par un autre membre que l'auteur du cochage.
- `purge_trash()` n'est exécutable que par `service_role` ; planifiée par `pg_cron` (`xaman-purge-trash`, 03:15 UTC) uniquement si l'extension est disponible.
- `anon` n'a plus aucun privilège sur le schéma `public` (y compris par défaut sur les objets futurs) : seules les fonctions explicitement accordées (`get_invitation_preview`) lui sont accessibles.

## 12. Notes d'implémentation (migration `0004_tracking.sql`)
Cette migration applique les décisions de l'audit (`docs/AUDIT.md §3.1`). **Elle prime sur les sections 3, 4, 6 et 11 ci-dessus** pour les points qu'elle modifie.

### 12.1 Colonnes ajoutées
| Table | Colonne | Type | Rôle |
|---|---|---|---|
| `checklist_items` | `anchor_date` | date not null default `current_date` | **Ancrage (D1)** : date de référence tant que le point n'a aucune réalisation. Renseignée à `current_date` par `apply_checklist_template`, modifiable (assistant de mise en route, édition d'un point). |
| `checklist_items` | `anchor_hours` | numeric(8,1) null | Heures du moteur lié au moment de l'ancrage (`engine_current_hours`, null s'il n'y a pas encore de relevé). |
| `checklist_completions` | `next_due_at` | date null | **Échéance à date fixe (D11)**, « valide jusqu'au… ». `check (next_due_at is null or next_due_at > completed_at)`. |
| `engines` | `counter_reset_at` | date null | **Compteur remplacé (D12)** : les échéances en heures dont la référence est antérieure sont ignorées. |
| `engines` | `counter_reset_note` | text null | Contexte de ce remplacement (texte libre). |
| `maintenance_logs` | `equipment_id` | uuid null, FK `equipment` on delete set null | Historique par équipement ; index partiel `maintenance_logs_equipment_idx`. |
| `equipment` | `removed_at` | date null | Un équipement n'est jamais supprimé depuis l'UI (E2-3) : il est « déposé le … » et conserve son historique. |
| `boat_invitations` | `valid_until` | date null | Fin d'accès portée par l'invitation, recopiée dans `boat_members.valid_until` à l'acceptation. Obligatoire pour une invitation émise par un `editor`. |

### 12.2 Colonnes et type supprimés
- `maintenance_logs.priority` et le type `log_priority` (**D6** : jamais lus, jamais triés ; clé `logPriority` retirée de `src/messages/fr.json`, champ `priority` ignoré par `scripts/seed.mts` et retiré de `seed/xaman-history.json`).
- `maintenance_logs.next_due_at` (**D4**) : la « prochaine échéance » vit désormais sur la réalisation (`checklist_completions.next_due_at`) ; une intervention planifiée porte sa date dans `performed_at`.

### 12.3 Statut d'un point : fonction pure et vue
- Nouvelle signature : `checklist_compute_status(reference_at date, interval_months int, reference_hours numeric, interval_hours int, current_hours numeric, has_completion boolean, fixed_due_at date, today date)`. Les deux `coalesce` d'ancrage et la neutralisation du compteur sont **résolus par l'appelant** (la vue), pas par la fonction : elle reste pure et immuable.
- `due_at = coalesce(fixed_due_at, reference_at + interval_months)` — **la date fixe gagne toujours**.
- `due_hours = reference_hours + interval_hours`, null si `interval_hours` est null, si `reference_hours` est null, ou si le compteur a été remplacé après la référence (`reference_at < engines.counter_reset_at`).
- `status` : `overdue` si une échéance est dépassée, sinon `soon` à 30 jours **ou** 25 heures (première échéance atteinte), sinon `never` **uniquement** pour un point sans aucun intervalle et jamais réalisé, sinon `ok`. Un point jamais coché mais ancré n'est donc plus `never` : au jour 1 tout est `ok`, et les points basculent seuls à l'échéance.
- `checklist_item_status` expose en plus `anchor_date`, `anchor_hours`, `counter_reset_at`, `fixed_due_at`, `has_completion`, `is_estimated` (= `not has_completion`), `reference_at`, `reference_hours` ; elle exclut les points dont le moteur est inactif (`i.engine_id is null or e.is_active`).
- Parité TS ↔ SQL : `src/lib/checklist-status.ts` reflète la fonction **et** les deux `coalesce` de la vue (helpers exportés `checklistReferenceAt` / `checklistReferenceHours`) ; 30 cas dans `tests/fixtures/checklist-status-cases.json`, dont l'ancrage, la date fixe et le compteur remplacé. Les cas « moteur désactivé », « catégorie désactivée » et « deux réalisations le même jour » relèvent de la vue et sont testés dans `tests/unit/rls.test.ts`.

### 12.4 Progression et agrégats
- `checklist_category_progress` : le dénominateur (`total`, `progress`, `ok_count`, `soon_count`) ne compte que les **points à intervalle** ; nouvelles colonnes `never_recorded_count` (points à intervalle sans réalisation) et `punctual_count` (points sans intervalle). `overdue_count` n'est volontairement **pas** filtré : un contrôle ponctuel porteur d'une date fixe est une vraie échéance.
- `boat_dashboard_stats` ajoute `expenses_12m` (12 mois glissants — l'année civile n'a pas de sens pour une saison méditerranéenne), `never_recorded_items` (même définition que `never_recorded_count`), `review_pending_logs`, `review_pending_purchases`, `engines_without_reading` ; les colonnes existantes sont conservées.
- `maintenance_logs_view` ajoute `equipment_id` et `equipment_name` ; `maintenance_logs_trash_view` ajoute `pending_engine_hours` (les heures parquées, cf. 12.6) ; `boat_invitations_safe` ajoute `valid_until`.

### 12.5 `boat_todo_queue(p_boat_id uuid, p_limit int default 10)`
Fonction `stable`, **security invoker** (la RLS de l'appelant s'applique : un étranger obtient une file vide). Union ordonnée par `rank`, puis `sort_key` croissant, puis `title` (tri stable obligatoire) :

| rang | contenu | `sort_key` |
|---|---|---|
| 0 | interventions `urgent` | `performed_at` (la plus ancienne d'abord) |
| 1 | points `overdue` | `-severity` — **retard relatif** `greatest((today − due_at)/max(interval_months×30, 30), (current_hours − due_hours)/max(interval_hours, 25))` |
| 2 | interventions `in_progress` puis `planned` dont `performed_at ≤ today + 30 j` | `+1 000 000` pour `planned`, puis `performed_at` |
| 3 | points `soon` | `least(days_remaining, hours_remaining × 1,2)` — 1 h moteur ≈ 1,2 jour (seuils 30 j / 25 h) |

Colonnes : `rank, kind ('log'|'item'), id, title, category_id, category_name, category_color, engine_id, engine_label, status, due_at, due_hours, days_remaining, hours_remaining, severity, sort_key`. Pour une intervention, `due_at = performed_at` et `days_remaining = performed_at − current_date`. **Les points `never` sont exclus** : au lancement les ~90 points de la checklist ORC 50 sont tous « jamais faits » et noieraient la file.

### 12.6 Triggers et politiques
- **Corbeille et relevés (D5)** — `sync_log_readings_trash` (`after update of deleted_at on maintenance_logs`, `security definer`) : à la mise à la corbeille, les `engine_hour_readings` de l'intervention sont fusionnés dans `pending_engine_hours` (`{engine_id: hours}`) puis supprimés ; à la restauration, si `needs_review = false`, ils sont recréés (source `maintenance_log`) et la colonne est vidée. Une intervention encore `needs_review` garde ses heures pour `mark_log_reviewed`. Le compteur ne change donc plus une seconde fois lors du `purge_trash()` 30 jours plus tard, et plus aucun relevé n'est orphelin.
- **Suppression d'un moteur (D14)** — `prevent_engine_delete_in_use` (`before delete on engines`) refuse (`engine_in_use`, `P0001`) s'il existe des relevés ou des points ; les cascades bateau / compte passent (`pg_trigger_depth() > 1`). Un moteur créé par erreur, sans donnée, reste supprimable.
- **Dates futures (D17)** — un `check (completed_at <= current_date)` est impossible (`current_date` n'est pas immuable) : la règle est portée par `reject_future_date()`, trigger `before insert or update` sur `checklist_completions.completed_at` et `engine_hour_readings.read_at` (erreur `date_in_future`, `SQLSTATE 23514`). Le seuil est `current_date + 1` : la base tourne en UTC alors que l'iPad est dans son fuseau, donc un relevé saisi à 00 h 30 à Paris (22 h 30 UTC la veille) et daté « aujourd'hui » doit passer ; une date à deux jours est refusée. Même tolérance côté zod (`pastOrTodayDate`, `src/lib/schemas/common.ts`). `maintenance_logs.performed_at` reste libre (une intervention planifiée est dans le futur) : la règle « futur seulement si `planned`/`urgent` » est côté zod.
- **Annulation d'une réalisation (D15)** — politique `delete` sur `checklist_completions` : `can_write_boat(boat_id) or (created_by = auth.uid() and created_at > now() - interval '24 hours')`. La FK `engine_hour_readings.checklist_completion_id` passe en `on delete cascade` : le relevé dérivé disparaît avec la réalisation, sinon le compteur reste faux.
- **Invitations (D28)** — politique `insert` sur `boat_invitations` : `invited_by = auth.uid()` **et** (owner, **ou** `editor` avec `role in ('pro','viewer')`, `valid_until` non null et `≤ current_date + 90`). `accept_invitation` recopie `valid_until` dans `boat_members` sans jamais écraser une valeur existante par null. Le changement de rôle et le retrait d'un membre restent réservés à l'owner. *Limite connue* : la politique `select` reste owner-only, donc un editor ne relit ni ne révoque l'invitation qu'il a créée — à traiter avec l'écran Membres si le besoin se confirme.
- `apply_checklist_template` renseigne `anchor_date = current_date` et, pour un point rattaché à un moteur, `anchor_hours = engine_current_hours.hours` de ce moteur (null s'il n'a pas encore de relevé).

### 12.7 Couleurs de catégories
Palette harmonisée (deutéranopie, lisibilité en plein soleil) : `daggerboards_rudders #0284C7`, `sails_rigging #A21CAF`, `hull_deck #52606F`, `electronics_nav #1D4ED8`, `energy #A16207`, `plumbing_systems #0F766E`, `safety #C81E2B` ; `engines #D97706` inchangé. La migration ne met à jour, par `external_ref`, que les `checklist_template_categories` / `boat_categories` **portant encore l'ancienne couleur exacte** : un choix fait par l'utilisateur n'est jamais écrasé. `seed/orc50-checklist.json` porte les nouvelles valeurs et gagne le point `haul-out` « Carénage / sortie de l'eau » (18 mois, catégorie Coque & Pont) qui fait entrer les sorties de l'eau dans le modèle unique (D9).

## 13. Notes d'implémentation — `0007_invitation_privacy.sql` et `0008_weekly_digest.sql`

- **0007** : `get_invitation_preview(p_token)` renvoie désormais l'adresse invitée **masquée** (`x•••@domaine`) ; la page publique `/invite/[token]` ne pré-remplit plus le formulaire de connexion et `accept_invitation` reste la seule vérification exacte de l'adresse (D29).
- **0008** : `weekly_digest_payload()` (security definer, `service_role` seulement) agrège par bateau les destinataires owner/editor actifs, les points en retard et bientôt (`checklist_item_status`) et les interventions planifiées / en cours / urgentes à 30 jours ; `enqueue_weekly_digest()` appelle l'Edge Function `weekly-digest` via `net.http_post` avec l'URL et la clé lues dans Vault (`xaman_digest_url`, `xaman_digest_key`) ; planification `pg_cron` « vendredi 06:30 UTC » quand l'extension existe (rien en local). L'envoi passe par Resend (secrets de la fonction : `RESEND_API_KEY`, `DIGEST_FROM`, `APP_URL`).
