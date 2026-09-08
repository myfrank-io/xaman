-- 0025_generic_templates_v2.sql — the model registry, second edition (D90).
--
-- Generated from seed/generic-checklists.json by scripts/gen-template-migration.mjs.
-- Do not edit by hand: edit the JSON and re-run the script (tests/unit/template-migration.test.ts
-- fails if the two drift). 0016 carried the first edition and stays as it ran.
--
-- What changed since 0016, all of it asked for by the first motor-boat owner to try the app:
--
--   * a fourth model, « Semi-rigide — modèle générique »: six systems, sixty-odd points, and
--     nothing a boat you tow on a trailer does not have — no shaft line, no generator, no
--     toilets; a « Remorque » system instead;
--   * the drive-specific points say which drive (engine_scope shaft / saildrive / sterndrive /
--     jet, matched on engines.propulsion by 0024), so a Z-drive's bellows never land on a shaft
--     line and a saildrive boot never on an outboard;
--   * detailed outboard points (gear oil, plugs, impeller, anodes…) on the motor and semi-rigide
--     models, where a single « révision du hors-bord » was hiding a real list;
--   * zone_scope = offshore on liferaft, EPIRB, AIS, radar, watermaker and the MMSI licence: a
--     coastal boat (boats.navigation_zone) is not asked about them.
--
-- Idempotent, on the same external_ref keys 0016 and scripts/seed.mts upsert on: rows already
-- there are updated in place, new ones added, none duplicated. A boat already instantiated from
-- one of these keeps its own rows — `apply_checklist_template` copies, it does not track.

do $migration$
declare
  v_payload jsonb := $json$
{
  "$schema_note": "Modèles de checklist génériques proposés à la création d'un bateau : catamaran à voile, voilier monocoque, bateau à moteur, semi-rigide. Les catégories reprennent les external_ref, couleurs et icônes du modèle ORC 50. `engine_scope` : none | inboard | outboard | all | shaft | saildrive | sterndrive | jet — `inboard` vaut pour tout moteur qui n'est pas un hors-bord, les quatre derniers pour cette propulsion exactement (`engines.propulsion`, D90) ; `interval_hours` n'est renseigné que si `engine_scope` n'est pas `none`. `zone_scope` : `offshore` sur un point qu'un bateau côtier ne porte pas (radeau, balise, AIS…), absent sinon (= `all`). Intervalles indicatifs, à ajuster au carnet du constructeur. `source: proposal` = proposition standard, que le propriétaire adapte à son bateau.",
  "templates": [
    {
      "template": {
        "external_ref": "generic-catamaran-v1",
        "name": "Catamaran à voile — modèle générique",
        "builder": null,
        "model": null,
        "boat_type": "catamaran",
        "version": 1,
        "is_public": true
      },
      "categories": [
        {
          "external_ref": "engines",
          "name": "Moteurs",
          "color": "#D97706",
          "icon": "cog",
          "sort_order": 1,
          "items": [
            {
              "external_ref": "eng-oil",
              "label": "Vidange huile moteur + filtre à huile",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Faire tourner le moteur dix minutes pour fluidifier l'huile",
                "Arrêter le moteur et pomper l'huile usagée par le tube de jauge",
                "Remplacer le filtre à huile, joint neuf huilé, serrage à la main puis trois quarts de tour",
                "Remplir avec l'huile préconisée par le constructeur et contrôler le niveau à la jauge",
                "Démarrer, contrôler l'absence de fuite au filtre et au bouchon de vidange",
                "Relever les heures moteur et déposer l'huile usagée au point de collecte du port"
              ]
            },
            {
              "external_ref": "eng-fuel-filters",
              "label": "Filtres à gasoil (préfiltre décanteur + filtre moteur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne de gasoil",
                "Vidanger le bol du décanteur et noter la présence d'eau ou de dépôt",
                "Remplacer la cartouche du préfiltre, puis le filtre monté sur le moteur",
                "Purger le circuit à la pompe d'amorçage jusqu'à disparition des bulles",
                "Démarrer et contrôler l'absence de fuite et de fumée noire"
              ]
            },
            {
              "external_ref": "eng-impeller",
              "label": "Turbine de pompe à eau de mer (impeller)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne d'eau de mer",
                "Déposer le couvercle de pompe et extraire la turbine",
                "Contrôler les ailettes ; si une ailette manque, la rechercher dans l'échangeur",
                "Monter une turbine neuve légèrement graissée avec un joint neuf",
                "Rouvrir la vanne, démarrer et vérifier le débit d'eau à l'échappement"
              ]
            },
            {
              "external_ref": "eng-belt",
              "label": "Courroie d'alternateur (tension, usure, alignement)",
              "description": null,
              "interval_months": 6,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-anodes",
              "label": "Anodes moteur (échangeur, collecteur)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne d'eau de mer et laisser refroidir le moteur",
                "Déposer les bouchons porte-anodes de l'échangeur et du collecteur",
                "Remplacer toute anode usée à plus de la moitié",
                "Rincer les logements pour évacuer les résidus de zinc",
                "Remonter avec des joints neufs, rouvrir la vanne et contrôler l'étanchéité"
              ]
            },
            {
              "external_ref": "eng-coolant",
              "label": "Liquide de refroidissement (niveau, remplacement)",
              "description": null,
              "interval_months": 24,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-gearbox-oil",
              "label": "Huile d'inverseur ou d'embase saildrive",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-saildrive-boot",
              "label": "Soufflet et anode d'embase saildrive",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "saildrive",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-stern-gland",
              "label": "Presse-étoupe et bague hydrolube (égouttement, graissage, jeu)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "shaft",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-exhaust",
              "label": "Circuit d'échappement (coude, waterlock, durites, colliers)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-outboard-service",
              "label": "Entretien du hors-bord d'annexe (embase, bougies, anode, rinçage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "daggerboards_rudders",
          "name": "Dérives & Safrans",
          "color": "#0284C7",
          "icon": "anchor",
          "sort_order": 2,
          "items": [
            {
              "external_ref": "db-inspection",
              "label": "Dérives : inspection (chocs, fissures, délaminage, bord d'attaque)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "db-wells",
              "label": "Puits de dérive : nettoyage, patins et guides (usure, jeu)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "db-lifting",
              "label": "Relevage des dérives (bosses, poulies, bloqueurs, winches dédiés)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-bearings",
              "label": "Safrans : jeu des paliers, mèches, fixations",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-steering",
              "label": "Transmission de barre (biellettes, drosses, fixation du vérin de pilote)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-emergency",
              "label": "Barre de secours : présence à bord et essai de montage",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "sails_rigging",
          "name": "Voiles & Gréement",
          "color": "#A21CAF",
          "icon": "sailboat",
          "sort_order": 3,
          "items": [
            {
              "external_ref": "sail-main-check",
              "label": "Grand-voile (coutures, lattes, œillets, points de ragage)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "sail-jib-check",
              "label": "Foc ou génois (coutures, chute, bande anti-UV)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "furler-bearings",
              "label": "Enrouleur de génois (roulements, drosse, rinçage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "stays-shrouds",
              "label": "Gréement dormant : étai, haubans, ridoirs, cadènes",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Contrôler chaque terminaison à la loupe : fissure, toron cassé, amorce de corrosion",
                "Vérifier les axes, les goupilles et leur frettage",
                "Contrôler les ridoirs : filetage propre, contre-écrou bloqué, absence de jeu",
                "Inspecter les cadènes et leur ancrage dans le bateau (fissure, infiltration)",
                "Rincer le gréement à l'eau douce et noter les tensions relevées"
              ]
            },
            {
              "external_ref": "halyards-sheets",
              "label": "Drisses et écoutes (usure, gaines, épissures, points de ragage)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "winch-service",
              "label": "Winches : démontage, nettoyage, graissage",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Déposer la poupée au-dessus d'un seau pour ne rien perdre par-dessus bord",
                "Extraire les tambours et les roulements en repérant l'ordre de montage",
                "Nettoyer les pièces au dégraissant, puis sécher",
                "Contrôler les cliquets et leurs ressorts, remplacer les pièces usées",
                "Graisser légèrement roulements et engrenages, huiler les cliquets sans les graisser",
                "Remonter, puis tester les deux vitesses et le retour des cliquets"
              ]
            },
            {
              "external_ref": "boom-vang",
              "label": "Bôme, vit-de-mulet et hale-bas (fixations, jeu, fissures)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "masthead",
              "label": "Visite en tête de mât (réas, capelage, feux, girouette, antennes)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "hull_deck",
          "name": "Coque & Pont",
          "color": "#52606F",
          "icon": "ship",
          "sort_order": 4,
          "items": [
            {
              "external_ref": "haul-out",
              "label": "Carénage / sortie de l'eau",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Réserver la grue et prévenir l'assureur de la période de chantier",
                "Laver la carène au jet dès la sortie de l'eau, avant que les salissures ne sèchent",
                "Inspecter carènes, passe-coques, hélices et safrans, prendre des photos",
                "Remplacer les anodes et poncer les zones à reprendre",
                "Appliquer l'antifouling selon le nombre de couches préconisé, en insistant sur les bords d'attaque",
                "Ne peindre ni les anodes ni les capteurs de sondeur et de loch"
              ]
            },
            {
              "external_ref": "hull-inspection",
              "label": "Carènes : inspection à la sortie de l'eau (chocs, cloques, délaminage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "seacocks",
              "label": "Passe-coques et vannes (manœuvre, corrosion, colliers doubles)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Manœuvrer chaque vanne en butée dans les deux sens",
                "Contrôler la corrosion du passe-coque, du raccord et de la durite",
                "Vérifier le double collier inox sur toute durite sous la flottaison",
                "Démonter et regarnir les vannes dures plutôt que de forcer",
                "Vérifier qu'un bouchon conique est amarré à proximité de chaque passe-coque"
              ]
            },
            {
              "external_ref": "hull-anodes",
              "label": "Anodes de coque et d'embase",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Contrôler les anodes à chaque plongée d'inspection",
                "Remplacer toute anode usée à plus de la moitié",
                "Décaper le plan de contact jusqu'au métal nu avant de poser l'anode neuve",
                "Ne jamais peindre une anode",
                "Vérifier la continuité électrique entre l'anode et la pièce protégée"
              ]
            },
            {
              "external_ref": "trampoline",
              "label": "Trampoline et filets (coutures, ralingues, ridoirs, tension)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "crossbeam-check",
              "label": "Poutre avant et bras de liaison (fissures, laquage, serrage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "deck-hardware",
              "label": "Accastillage de pont (rails, chariots, bloqueurs, poulies, rinçage à l'eau douce)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hatches",
              "label": "Hublots et capots (joints, étanchéité, charnières)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "windlass-service",
              "label": "Guindeau (graissage, barbotin, commande, disjoncteur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "anchor-chain-check",
              "label": "Mouillage : ancre, chaîne, manilles, émerillon (marquage, usure)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "electronics_nav",
          "name": "Électronique / Nav",
          "color": "#1D4ED8",
          "icon": "radar",
          "sort_order": 5,
          "items": [
            {
              "external_ref": "nav-instruments",
              "label": "Centrale de navigation et afficheurs (mises à jour, calibration compas et loch)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "speedo-sensor",
              "label": "Capteur de loch : nettoyage de la roue à aubes",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "autopilot",
              "label": "Pilote automatique (vérin, fixations, essai en mer)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "vhf-test",
              "label": "VHF fixe : essai d'émission, ASN, antenne et connexions",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "ais-test",
              "label": "AIS : essai d'émission et de réception, MMSI programmé",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "nav-lights",
              "label": "Feux de navigation et de mouillage : essai",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "connectors",
              "label": "Connectique et boîtiers (étanchéité, corrosion, presse-étoupes)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "handheld-vhf",
              "label": "VHF portable : batterie, essai",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "mmsi-registration",
              "label": "Licence de station radio et enregistrement MMSI",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "energy",
          "name": "Énergie",
          "color": "#A16207",
          "icon": "zap",
          "sort_order": 6,
          "items": [
            {
              "external_ref": "battery-check",
              "label": "Batteries de servitude et de démarrage (tension, capacité, état)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Couper les consommateurs et laisser le parc au repos deux heures",
                "Relever la tension de chaque batterie et comparer les valeurs entre elles",
                "Contrôler la propreté et le serrage des bornes",
                "Contrôler le niveau d'électrolyte sur les batteries ouvertes",
                "Faire un cycle de charge complet et vérifier l'absence d'échauffement",
                "Noter les tensions relevées pour suivre le vieillissement du parc"
              ]
            },
            {
              "external_ref": "battery-terminals",
              "label": "Bornes, fusibles et coupe-batteries (serrage, corrosion)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "solar-clean",
              "label": "Panneaux solaires (nettoyage, fixations, contrôle de production)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "charger-inverter",
              "label": "Chargeur et convertisseur (paramètres, ventilation, essai en charge)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "shore-power",
              "label": "Prise de quai et câble (état, différentiel, isolateur galvanique)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "alternator",
              "label": "Alternateur et régulateur de charge (débit, câblage, fixation)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "wiring-panel",
              "label": "Tableau électrique et câblage (échauffement, corrosion, étiquetage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "wiring-diagram",
              "label": "Schéma électrique du bord : établir et ranger avec les manuels",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "plumbing_systems",
          "name": "Hydraulique & Circuits",
          "color": "#0F766E",
          "icon": "droplets",
          "sort_order": 7,
          "items": [
            {
              "external_ref": "bilge-pumps",
              "label": "Pompes de cale (essai manuel et automatique, flotteurs, crépines)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Soulever le flotteur à la main pour déclencher la pompe automatique",
                "Vérifier le débit au refoulement et l'absence de retour d'eau",
                "Nettoyer la crépine et assécher le fond de cale",
                "Contrôler la durite, le col de cygne et le clapet anti-retour",
                "Tester la commande manuelle au tableau et la pompe de secours"
              ]
            },
            {
              "external_ref": "freshwater",
              "label": "Eau douce : réservoirs, pompe, filtres, groupe de pression",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "watermaker-service",
              "label": "Dessalinisateur (préfiltres, rinçage, conservation de la membrane)",
              "description": "Sans objet si le bateau n'est pas équipé.",
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "water-heater",
              "label": "Chauffe-eau (anode, soupape de sécurité, raccords)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hoses-clamps",
              "label": "Durites et colliers (état, doubles colliers sous flottaison)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "gas-system",
              "label": "Gaz : flexibles, détendeur, essai d'étanchéité, coffre ventilé",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Fermer la vanne de la bouteille et relever la date des flexibles",
                "Badigeonner les raccords d'eau savonneuse et rechercher les bulles",
                "Contrôler la tenue en pression : robinets fermés, l'aiguille du manomètre ne doit pas bouger",
                "Vérifier que le coffre à gaz est étanche vers l'intérieur et ventilé vers l'extérieur",
                "Remplacer le détendeur et les flexibles selon la préconisation du fabricant",
                "Tester le détecteur de gaz et sa sonde en fond de cale"
              ]
            },
            {
              "external_ref": "toilets",
              "label": "Toilettes et eaux noires (pompes, joints, vannes, détartrage)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "fridge-freezer",
              "label": "Réfrigérateur et congélateur (joints, condenseur, compresseur)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "seacock-plan",
              "label": "Plan des passe-coques et bouchons coniques à poste",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "safety",
          "name": "Sécurité",
          "color": "#C81E2B",
          "icon": "life-buoy",
          "sort_order": 8,
          "items": [
            {
              "external_ref": "liferaft",
              "label": "Radeau de survie : révision (date de validité)",
              "description": null,
              "interval_months": 36,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": [
                "Relever la date de validité inscrite sur le conteneur",
                "Confier le radeau à une station agréée pour la révision",
                "Contrôler la fixation du berceau et l'amarrage de la bosse sur un point de structure",
                "Vérifier la date du largueur hydrostatique s'il en est équipé",
                "Enregistrer la nouvelle date de validité au cochage"
              ]
            },
            {
              "external_ref": "epirb",
              "label": "Balise EPIRB : autotest, date de batterie, enregistrement",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "lifejackets",
              "label": "Gilets et harnais : cartouches, percuteurs, dates, longes",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "extinguishers",
              "label": "Extincteurs : dates, pression, couverture anti-feu",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "pyrotechnics",
              "label": "Pyrotechnie : dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "lifelines",
              "label": "Lignes de vie, filières, bouée fer à cheval, feux à retournement",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "first-aid",
              "label": "Trousse de secours : contenu et dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "gas-co-alarms",
              "label": "Détecteurs de gaz, de monoxyde et de fumée : essai, piles",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "insurance",
              "label": "Assurance du bateau : renouvellement (date de validité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "safety-file",
              "label": "Matériel d'armement et dossier de sécurité : contrôle",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        }
      ]
    },
    {
      "template": {
        "external_ref": "generic-monohull-sail-v1",
        "name": "Voilier monocoque — modèle générique",
        "builder": null,
        "model": null,
        "boat_type": "monohull_sail",
        "version": 1,
        "is_public": true
      },
      "categories": [
        {
          "external_ref": "engines",
          "name": "Moteurs",
          "color": "#D97706",
          "icon": "cog",
          "sort_order": 1,
          "items": [
            {
              "external_ref": "eng-oil",
              "label": "Vidange huile moteur + filtre à huile",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Faire tourner le moteur dix minutes pour fluidifier l'huile",
                "Arrêter le moteur et pomper l'huile usagée par le tube de jauge",
                "Remplacer le filtre à huile, joint neuf huilé, serrage à la main puis trois quarts de tour",
                "Remplir avec l'huile préconisée par le constructeur et contrôler le niveau à la jauge",
                "Démarrer, contrôler l'absence de fuite au filtre et au bouchon de vidange",
                "Relever les heures moteur et déposer l'huile usagée au point de collecte du port"
              ]
            },
            {
              "external_ref": "eng-fuel-filters",
              "label": "Filtres à gasoil (préfiltre décanteur + filtre moteur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne de gasoil",
                "Vidanger le bol du décanteur et noter la présence d'eau ou de dépôt",
                "Remplacer la cartouche du préfiltre, puis le filtre monté sur le moteur",
                "Purger le circuit à la pompe d'amorçage jusqu'à disparition des bulles",
                "Démarrer et contrôler l'absence de fuite et de fumée noire"
              ]
            },
            {
              "external_ref": "eng-impeller",
              "label": "Turbine de pompe à eau de mer (impeller)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne d'eau de mer",
                "Déposer le couvercle de pompe et extraire la turbine",
                "Contrôler les ailettes ; si une ailette manque, la rechercher dans l'échangeur",
                "Monter une turbine neuve légèrement graissée avec un joint neuf",
                "Rouvrir la vanne, démarrer et vérifier le débit d'eau à l'échappement"
              ]
            },
            {
              "external_ref": "eng-belt",
              "label": "Courroie d'alternateur (tension, usure, alignement)",
              "description": null,
              "interval_months": 6,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-anodes",
              "label": "Anodes moteur (échangeur, collecteur)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-coolant",
              "label": "Liquide de refroidissement (niveau, remplacement)",
              "description": null,
              "interval_months": 24,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-gearbox-oil",
              "label": "Huile d'inverseur ou d'embase saildrive",
              "description": "Sur saildrive, contrôler également le soufflet et l'anode d'embase.",
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-stern-gland",
              "label": "Presse-étoupe et bague hydrolube (égouttement, graissage, jeu)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "shaft",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-saildrive-boot",
              "label": "Soufflet et anode d'embase saildrive",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "saildrive",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-exhaust",
              "label": "Circuit d'échappement (coude, waterlock, durites, colliers)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-outboard-service",
              "label": "Entretien du hors-bord d'annexe (embase, bougies, anode, rinçage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "daggerboards_rudders",
          "name": "Quille & Safrans",
          "color": "#0284C7",
          "icon": "anchor",
          "sort_order": 2,
          "items": [
            {
              "external_ref": "keel-bolts",
              "label": "Boulons de quille (serrage, corrosion, fond de cale)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Assécher et nettoyer le fond de cale au droit des boulons",
                "Rechercher toute trace de rouille, de suintement ou de fissure autour des écrous",
                "Contrôler le serrage au couple préconisé par le constructeur, écrou par écrou",
                "Inspecter le joint quille-coque à la sortie de l'eau, à l'avant comme à l'arrière",
                "Faire expertiser la liaison après tout talonnage"
              ]
            },
            {
              "external_ref": "keel-joint",
              "label": "Joint quille-coque (fissure, mastic, reprise)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "keel-inspection",
              "label": "Lest et bord d'attaque de quille (chocs, corrosion, stratification)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-bearings",
              "label": "Safran : jeu des paliers, mèche, fixations",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-stock-seal",
              "label": "Presse-étoupe de mèche de safran (étanchéité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-steering",
              "label": "Transmission de barre (drosses, secteur, câbles, chaîne, embrayage du pilote)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-emergency",
              "label": "Barre de secours : présence à bord et essai de montage",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "sails_rigging",
          "name": "Voiles & Gréement",
          "color": "#A21CAF",
          "icon": "sailboat",
          "sort_order": 3,
          "items": [
            {
              "external_ref": "sail-main-check",
              "label": "Grand-voile (coutures, lattes, œillets, points de ragage)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "sail-jib-check",
              "label": "Foc ou génois (coutures, chute, bande anti-UV)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "furler-bearings",
              "label": "Enrouleur de génois (roulements, drosse, rinçage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "stays-shrouds",
              "label": "Gréement dormant : étai, haubans, ridoirs, cadènes",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Contrôler chaque terminaison à la loupe : fissure, toron cassé, amorce de corrosion",
                "Vérifier les axes, les goupilles et leur frettage",
                "Contrôler les ridoirs : filetage propre, contre-écrou bloqué, absence de jeu",
                "Inspecter les cadènes et leur ancrage dans le bateau (fissure, infiltration)",
                "Rincer le gréement à l'eau douce et noter les tensions relevées"
              ]
            },
            {
              "external_ref": "halyards-sheets",
              "label": "Drisses et écoutes (usure, gaines, épissures, points de ragage)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "winch-service",
              "label": "Winches : démontage, nettoyage, graissage",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Déposer la poupée au-dessus d'un seau pour ne rien perdre par-dessus bord",
                "Extraire les tambours et les roulements en repérant l'ordre de montage",
                "Nettoyer les pièces au dégraissant, puis sécher",
                "Contrôler les cliquets et leurs ressorts, remplacer les pièces usées",
                "Graisser légèrement roulements et engrenages, huiler les cliquets sans les graisser",
                "Remonter, puis tester les deux vitesses et le retour des cliquets"
              ]
            },
            {
              "external_ref": "boom-vang",
              "label": "Bôme, vit-de-mulet et hale-bas (fixations, jeu, fissures)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "mast-step",
              "label": "Pied de mât et étambrai (corrosion, cales, étanchéité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "masthead",
              "label": "Visite en tête de mât (réas, capelage, feux, girouette, antennes)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "hull_deck",
          "name": "Coque & Pont",
          "color": "#52606F",
          "icon": "ship",
          "sort_order": 4,
          "items": [
            {
              "external_ref": "haul-out",
              "label": "Carénage / sortie de l'eau",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Réserver la grue et prévenir l'assureur de la période de chantier",
                "Laver la carène au jet dès la sortie de l'eau, avant que les salissures ne sèchent",
                "Inspecter carène, passe-coques, hélice, safran et quille, prendre des photos",
                "Remplacer les anodes et poncer les zones à reprendre",
                "Appliquer l'antifouling selon le nombre de couches préconisé, en insistant sur les bords d'attaque",
                "Ne peindre ni les anodes ni les capteurs de sondeur et de loch"
              ]
            },
            {
              "external_ref": "hull-inspection",
              "label": "Carène : inspection à la sortie de l'eau (chocs, cloques, osmose)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "seacocks",
              "label": "Passe-coques et vannes (manœuvre, corrosion, colliers doubles)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Manœuvrer chaque vanne en butée dans les deux sens",
                "Contrôler la corrosion du passe-coque, du raccord et de la durite",
                "Vérifier le double collier inox sur toute durite sous la flottaison",
                "Démonter et regarnir les vannes dures plutôt que de forcer",
                "Vérifier qu'un bouchon conique est amarré à proximité de chaque passe-coque"
              ]
            },
            {
              "external_ref": "hull-anodes",
              "label": "Anodes de coque, d'arbre et d'hélice",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Contrôler les anodes à chaque plongée d'inspection",
                "Remplacer toute anode usée à plus de la moitié",
                "Décaper le plan de contact jusqu'au métal nu avant de poser l'anode neuve",
                "Ne jamais peindre une anode",
                "Vérifier la continuité électrique entre l'anode et la pièce protégée"
              ]
            },
            {
              "external_ref": "deck-hardware",
              "label": "Accastillage de pont (rails, chariots, bloqueurs, poulies, rinçage à l'eau douce)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hatches",
              "label": "Hublots et capots (joints, étanchéité, charnières)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "stanchions",
              "label": "Chandeliers, balcons et embases (fixations, étanchéité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "windlass-service",
              "label": "Guindeau (graissage, barbotin, commande, disjoncteur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "anchor-chain-check",
              "label": "Mouillage : ancre, chaîne, manilles, émerillon (marquage, usure)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "electronics_nav",
          "name": "Électronique / Nav",
          "color": "#1D4ED8",
          "icon": "radar",
          "sort_order": 5,
          "items": [
            {
              "external_ref": "nav-instruments",
              "label": "Centrale de navigation et afficheurs (mises à jour, calibration compas et loch)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "speedo-sensor",
              "label": "Capteur de loch : nettoyage de la roue à aubes",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "autopilot",
              "label": "Pilote automatique (vérin, fixations, essai en mer)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "vhf-test",
              "label": "VHF fixe : essai d'émission, ASN, antenne et connexions",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "ais-test",
              "label": "AIS : essai d'émission et de réception, MMSI programmé",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "nav-lights",
              "label": "Feux de navigation et de mouillage : essai",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "connectors",
              "label": "Connectique et boîtiers (étanchéité, corrosion, presse-étoupes)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "handheld-vhf",
              "label": "VHF portable : batterie, essai",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "mmsi-registration",
              "label": "Licence de station radio et enregistrement MMSI",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "energy",
          "name": "Énergie",
          "color": "#A16207",
          "icon": "zap",
          "sort_order": 6,
          "items": [
            {
              "external_ref": "battery-check",
              "label": "Batteries de servitude et de démarrage (tension, capacité, état)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Couper les consommateurs et laisser le parc au repos deux heures",
                "Relever la tension de chaque batterie et comparer les valeurs entre elles",
                "Contrôler la propreté et le serrage des bornes",
                "Contrôler le niveau d'électrolyte sur les batteries ouvertes",
                "Faire un cycle de charge complet et vérifier l'absence d'échauffement",
                "Noter les tensions relevées pour suivre le vieillissement du parc"
              ]
            },
            {
              "external_ref": "battery-terminals",
              "label": "Bornes, fusibles et coupe-batteries (serrage, corrosion)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "solar-clean",
              "label": "Panneaux solaires (nettoyage, fixations, contrôle de production)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "charger-inverter",
              "label": "Chargeur et convertisseur (paramètres, ventilation, essai en charge)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "shore-power",
              "label": "Prise de quai et câble (état, différentiel, isolateur galvanique)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "alternator",
              "label": "Alternateur et régulateur de charge (débit, câblage, fixation)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "wiring-panel",
              "label": "Tableau électrique et câblage (échauffement, corrosion, étiquetage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "wiring-diagram",
              "label": "Schéma électrique du bord : établir et ranger avec les manuels",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "plumbing_systems",
          "name": "Hydraulique & Circuits",
          "color": "#0F766E",
          "icon": "droplets",
          "sort_order": 7,
          "items": [
            {
              "external_ref": "bilge-pumps",
              "label": "Pompes de cale (essai manuel et automatique, flotteurs, crépines)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Soulever le flotteur à la main pour déclencher la pompe automatique",
                "Vérifier le débit au refoulement et l'absence de retour d'eau",
                "Nettoyer la crépine et assécher le fond de cale",
                "Contrôler la durite, le col de cygne et le clapet anti-retour",
                "Tester la commande manuelle au tableau et la pompe de secours"
              ]
            },
            {
              "external_ref": "freshwater",
              "label": "Eau douce : réservoirs, pompe, filtres, groupe de pression",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "water-heater",
              "label": "Chauffe-eau (anode, soupape de sécurité, raccords)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hoses-clamps",
              "label": "Durites et colliers (état, doubles colliers sous flottaison)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "gas-system",
              "label": "Gaz : flexibles, détendeur, essai d'étanchéité, coffre ventilé",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Fermer la vanne de la bouteille et relever la date des flexibles",
                "Badigeonner les raccords d'eau savonneuse et rechercher les bulles",
                "Contrôler la tenue en pression : robinets fermés, l'aiguille du manomètre ne doit pas bouger",
                "Vérifier que le coffre à gaz est étanche vers l'intérieur et ventilé vers l'extérieur",
                "Remplacer le détendeur et les flexibles selon la préconisation du fabricant",
                "Tester le détecteur de gaz et sa sonde en fond de cale"
              ]
            },
            {
              "external_ref": "toilets",
              "label": "Toilettes et eaux noires (pompes, joints, vannes, détartrage)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "fridge-freezer",
              "label": "Réfrigérateur et congélateur (joints, condenseur, compresseur)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "seacock-plan",
              "label": "Plan des passe-coques et bouchons coniques à poste",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "safety",
          "name": "Sécurité",
          "color": "#C81E2B",
          "icon": "life-buoy",
          "sort_order": 8,
          "items": [
            {
              "external_ref": "liferaft",
              "label": "Radeau de survie : révision (date de validité)",
              "description": null,
              "interval_months": 36,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": [
                "Relever la date de validité inscrite sur le conteneur",
                "Confier le radeau à une station agréée pour la révision",
                "Contrôler la fixation du berceau et l'amarrage de la bosse sur un point de structure",
                "Vérifier la date du largueur hydrostatique s'il en est équipé",
                "Enregistrer la nouvelle date de validité au cochage"
              ]
            },
            {
              "external_ref": "epirb",
              "label": "Balise EPIRB : autotest, date de batterie, enregistrement",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "lifejackets",
              "label": "Gilets et harnais : cartouches, percuteurs, dates, longes",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "extinguishers",
              "label": "Extincteurs : dates, pression, couverture anti-feu",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "pyrotechnics",
              "label": "Pyrotechnie : dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "lifelines",
              "label": "Lignes de vie, filières, bouée fer à cheval, feux à retournement",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "first-aid",
              "label": "Trousse de secours : contenu et dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "gas-co-alarms",
              "label": "Détecteurs de gaz, de monoxyde et de fumée : essai, piles",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "insurance",
              "label": "Assurance du bateau : renouvellement (date de validité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "safety-file",
              "label": "Matériel d'armement et dossier de sécurité : contrôle",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        }
      ]
    },
    {
      "template": {
        "external_ref": "generic-motor-v1",
        "name": "Bateau à moteur — modèle générique",
        "builder": null,
        "model": null,
        "boat_type": "motor",
        "version": 1,
        "is_public": true
      },
      "categories": [
        {
          "external_ref": "engines",
          "name": "Moteurs",
          "color": "#D97706",
          "icon": "cog",
          "sort_order": 1,
          "items": [
            {
              "external_ref": "eng-oil",
              "label": "Vidange huile moteur + filtre à huile",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Faire tourner le moteur dix minutes pour fluidifier l'huile",
                "Arrêter le moteur et pomper l'huile usagée par le tube de jauge",
                "Remplacer le filtre à huile, joint neuf huilé, serrage à la main puis trois quarts de tour",
                "Remplir avec l'huile préconisée par le constructeur et contrôler le niveau à la jauge",
                "Démarrer, contrôler l'absence de fuite au filtre et au bouchon de vidange",
                "Relever les heures moteur et déposer l'huile usagée au point de collecte du port"
              ]
            },
            {
              "external_ref": "eng-fuel-filters",
              "label": "Filtres à gasoil (préfiltre décanteur + filtre moteur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne de gasoil",
                "Vidanger le bol du décanteur et noter la présence d'eau ou de dépôt",
                "Remplacer la cartouche du préfiltre, puis le filtre monté sur le moteur",
                "Purger le circuit à la pompe d'amorçage jusqu'à disparition des bulles",
                "Démarrer et contrôler l'absence de fuite et de fumée noire"
              ]
            },
            {
              "external_ref": "eng-impeller",
              "label": "Turbine de pompe à eau de mer (impeller)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 300,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne d'eau de mer",
                "Déposer le couvercle de pompe et extraire la turbine",
                "Contrôler les ailettes ; si une ailette manque, la rechercher dans l'échangeur",
                "Monter une turbine neuve légèrement graissée avec un joint neuf",
                "Rouvrir la vanne, démarrer et vérifier le débit d'eau à l'échappement"
              ]
            },
            {
              "external_ref": "eng-belt",
              "label": "Courroie d'alternateur (tension, usure, alignement)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-anodes",
              "label": "Anodes moteur (échangeur, collecteur)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-coolant",
              "label": "Liquide de refroidissement (niveau, remplacement)",
              "description": null,
              "interval_months": 24,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-gearbox-oil",
              "label": "Huile d'inverseur ou d'embase (niveau, remplacement)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-exhaust",
              "label": "Circuit d'échappement (coude, waterlock, durites, colliers)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-fuel-tank",
              "label": "Réservoir et circuit gasoil (décantation, eau, évents, jaugeur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-outboard-service",
              "label": "Révision du hors-bord (contrôle général, graissage, rinçage, hivernage)",
              "description": "Pour une motorisation hors-bord ou le moteur de l'annexe.",
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": [
                "Rincer le circuit de refroidissement à l'eau douce après chaque sortie en mer",
                "Vidanger l'huile d'embase : une huile laiteuse signale une entrée d'eau par les joints",
                "Remplacer les bougies et contrôler l'état des électrodes",
                "Remplacer l'anode d'embase et le filtre à essence",
                "Démarrer et vérifier le témoin de refroidissement"
              ]
            },
            {
              "external_ref": "out-gear-oil",
              "label": "Huile d'embase du hors-bord (vidange, eau dans l'huile)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": [
                "Moteur vertical, dévisser la vis du bas puis celle du haut et laisser couler",
                "Une huile laiteuse signale une entrée d'eau : contrôler les joints d'arbre d'hélice",
                "Remplir par le bas jusqu'à ce que l'huile ressorte par le haut, joints neufs sur les deux vis"
              ]
            },
            {
              "external_ref": "out-engine-oil",
              "label": "Vidange huile moteur + filtre du hors-bord (4 temps)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-spark-plugs",
              "label": "Bougies du hors-bord (état, écartement, remplacement)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-fuel-filter",
              "label": "Filtre à essence et préfiltre décanteur du hors-bord",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-impeller",
              "label": "Turbine de pompe à eau du hors-bord (impeller, témoin de refroidissement)",
              "description": null,
              "interval_months": 24,
              "interval_hours": 200,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-anodes",
              "label": "Anodes du hors-bord (embase, plaque anticavitation, bloc)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-propeller",
              "label": "Hélice du hors-bord (pales, moyeu, écrou, goupille, fil de pêche)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-tilt",
              "label": "Relevage et trim du hors-bord (vérin, niveau, fuites, essai)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-controls",
              "label": "Câbles de commande et de direction du hors-bord (jeu, corrosion, graissage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-timing-belt",
              "label": "Courroie de distribution du hors-bord (selon préconisation constructeur)",
              "description": null,
              "interval_months": 60,
              "interval_hours": 1000,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "daggerboards_rudders",
          "name": "Transmission & Safrans",
          "color": "#0284C7",
          "icon": "anchor",
          "sort_order": 2,
          "items": [
            {
              "external_ref": "shaft-alignment",
              "label": "Alignement moteur et ligne d'arbre (silent-blocs, accouplement)",
              "description": null,
              "interval_months": 24,
              "interval_hours": null,
              "engine_scope": "shaft",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "stern-gland",
              "label": "Presse-étoupe ou joint tournant (égouttement, graissage, jeu)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "shaft",
              "source": "proposal",
              "actions": [
                "Contrôler l'égouttement à l'arrêt puis moteur en marche",
                "Graisser le presse-étoupe ou contrôler le niveau du graisseur",
                "Reprendre le serrage du fouloir d'un quart de tour si l'égouttement est excessif",
                "Contrôler l'état du soufflet, des colliers et de la tresse",
                "Remplacer la tresse dès qu'un serrage supplémentaire ne suffit plus"
              ]
            },
            {
              "external_ref": "shaft-bearing",
              "label": "Bague hydrolube et chaise d'arbre (jeu, usure)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "shaft",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "propeller",
              "label": "Hélice (état des pales, clavette, écrou et goupille)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "shaft",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "sterndrive",
              "label": "Embase Z-drive : soufflets (cardan, échappement, câble) et anodes",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "sterndrive",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "sterndrive-oil",
              "label": "Huile d'embase Z-drive (vidange, eau dans l'huile)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "sterndrive",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "sterndrive-gimbal",
              "label": "Cardan, roulement de cloche et joint tournant du Z-drive (jeu, bruit, graissage)",
              "description": null,
              "interval_months": 24,
              "interval_hours": 200,
              "engine_scope": "sterndrive",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "jet-wear-ring",
              "label": "Turbine de jet et bague d'usure (jeu, chocs, cavitation)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "jet",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "jet-bearings",
              "label": "Roulements et joint d'arbre de turbine (jeu, bruit, graisse)",
              "description": null,
              "interval_months": 24,
              "interval_hours": 200,
              "engine_scope": "jet",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "jet-intake",
              "label": "Grille d'aspiration et godet d'inversion du jet (débris, fixations, câble)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "jet",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-bearings",
              "label": "Safrans : jeu des paliers, mèches, fixations",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "rud-steering",
              "label": "Direction hydraulique (niveau, flexibles, purge, vérin)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "trim-tabs",
              "label": "Flaps (vérins, joints, anodes, commande)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "bow-thruster",
              "label": "Propulseur d'étrave (hélice, soufflet, anode, fusible, batterie)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "hull_deck",
          "name": "Coque & Pont",
          "color": "#52606F",
          "icon": "ship",
          "sort_order": 4,
          "items": [
            {
              "external_ref": "haul-out",
              "label": "Carénage / sortie de l'eau",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Réserver la grue et prévenir l'assureur de la période de chantier",
                "Laver la carène au jet dès la sortie de l'eau, avant que les salissures ne sèchent",
                "Inspecter carène, passe-coques, hélice, arbre et safrans, prendre des photos",
                "Remplacer les anodes et poncer les zones à reprendre",
                "Appliquer l'antifouling selon le nombre de couches préconisé, en insistant sur les bords d'attaque",
                "Ne peindre ni les anodes ni les capteurs de sondeur et de loch"
              ]
            },
            {
              "external_ref": "hull-inspection",
              "label": "Carène : inspection à la sortie de l'eau (chocs, cloques, osmose)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "seacocks",
              "label": "Passe-coques et vannes (manœuvre, corrosion, colliers doubles)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Manœuvrer chaque vanne en butée dans les deux sens",
                "Contrôler la corrosion du passe-coque, du raccord et de la durite",
                "Vérifier le double collier inox sur toute durite sous la flottaison",
                "Démonter et regarnir les vannes dures plutôt que de forcer",
                "Vérifier qu'un bouchon conique est amarré à proximité de chaque passe-coque"
              ]
            },
            {
              "external_ref": "hull-anodes",
              "label": "Anodes de coque, d'arbre et d'hélice",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Contrôler les anodes à chaque plongée d'inspection",
                "Remplacer toute anode usée à plus de la moitié",
                "Décaper le plan de contact jusqu'au métal nu avant de poser l'anode neuve",
                "Ne jamais peindre une anode",
                "Vérifier la continuité électrique entre l'anode et la pièce protégée"
              ]
            },
            {
              "external_ref": "deck-hardware",
              "label": "Accastillage de pont (taquets, chaumards, mains courantes, rinçage à l'eau douce)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hatches",
              "label": "Hublots, capots et pare-brise (joints, étanchéité, charnières)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "canvas-cover",
              "label": "Taud, bimini et sellerie extérieure (coutures, fermetures, fixations)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "windlass-service",
              "label": "Guindeau (graissage, barbotin, commande, disjoncteur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "anchor-chain-check",
              "label": "Mouillage : ancre, chaîne, manilles, émerillon (marquage, usure)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "electronics_nav",
          "name": "Électronique / Nav",
          "color": "#1D4ED8",
          "icon": "radar",
          "sort_order": 5,
          "items": [
            {
              "external_ref": "nav-instruments",
              "label": "Centrale de navigation et afficheurs (mises à jour, calibration compas et sondes)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "speedo-sensor",
              "label": "Sonde et capteur de vitesse (nettoyage, essai)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "autopilot",
              "label": "Pilote automatique (vérin, fixations, essai en mer)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "radar-check",
              "label": "Radar (essai, fixation, connectique)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "vhf-test",
              "label": "VHF fixe : essai d'émission, ASN, antenne et connexions",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "ais-test",
              "label": "AIS : essai d'émission et de réception, MMSI programmé",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "nav-lights",
              "label": "Feux de navigation et de mouillage : essai",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "connectors",
              "label": "Connectique et boîtiers (étanchéité, corrosion, presse-étoupes)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "mmsi-registration",
              "label": "Licence de station radio et enregistrement MMSI",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "energy",
          "name": "Énergie",
          "color": "#A16207",
          "icon": "zap",
          "sort_order": 6,
          "items": [
            {
              "external_ref": "battery-check",
              "label": "Batteries de servitude et de démarrage (tension, capacité, état)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Couper les consommateurs et laisser le parc au repos deux heures",
                "Relever la tension de chaque batterie et comparer les valeurs entre elles",
                "Contrôler la propreté et le serrage des bornes",
                "Contrôler le niveau d'électrolyte sur les batteries ouvertes",
                "Faire un cycle de charge complet et vérifier l'absence d'échauffement",
                "Noter les tensions relevées pour suivre le vieillissement du parc"
              ]
            },
            {
              "external_ref": "battery-terminals",
              "label": "Bornes, fusibles et coupe-batteries (serrage, corrosion)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "charger-inverter",
              "label": "Chargeur et convertisseur (paramètres, ventilation, essai en charge)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "shore-power",
              "label": "Prise de quai et câble (état, différentiel, isolateur galvanique)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "alternator",
              "label": "Alternateur et régulateur de charge (débit, câblage, fixation)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "generator-service",
              "label": "Groupe électrogène (vidange, filtres, anode, essai en charge)",
              "description": "Sans objet si le bateau n'est pas équipé.",
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "wiring-panel",
              "label": "Tableau électrique et câblage (échauffement, corrosion, étiquetage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "wiring-diagram",
              "label": "Schéma électrique du bord : établir et ranger avec les manuels",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "plumbing_systems",
          "name": "Hydraulique & Circuits",
          "color": "#0F766E",
          "icon": "droplets",
          "sort_order": 7,
          "items": [
            {
              "external_ref": "bilge-pumps",
              "label": "Pompes de cale (essai manuel et automatique, flotteurs, crépines)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Soulever le flotteur à la main pour déclencher la pompe automatique",
                "Vérifier le débit au refoulement et l'absence de retour d'eau",
                "Nettoyer la crépine et assécher le fond de cale",
                "Contrôler la durite, le col de cygne et le clapet anti-retour",
                "Tester la commande manuelle au tableau et la pompe de secours"
              ]
            },
            {
              "external_ref": "freshwater",
              "label": "Eau douce : réservoirs, pompe, filtres, groupe de pression",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "water-heater",
              "label": "Chauffe-eau (anode, soupape de sécurité, raccords)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hoses-clamps",
              "label": "Durites et colliers (état, doubles colliers sous flottaison)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "gas-system",
              "label": "Gaz : flexibles, détendeur, essai d'étanchéité, coffre ventilé",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Fermer la vanne de la bouteille et relever la date des flexibles",
                "Badigeonner les raccords d'eau savonneuse et rechercher les bulles",
                "Contrôler la tenue en pression : robinets fermés, l'aiguille du manomètre ne doit pas bouger",
                "Vérifier que le coffre à gaz est étanche vers l'intérieur et ventilé vers l'extérieur",
                "Remplacer le détendeur et les flexibles selon la préconisation du fabricant",
                "Tester le détecteur de gaz et sa sonde en fond de cale"
              ]
            },
            {
              "external_ref": "toilets",
              "label": "Toilettes et eaux noires (pompes, joints, vannes, détartrage)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "fridge-freezer",
              "label": "Réfrigérateur et congélateur (joints, condenseur, compresseur)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "air-conditioning",
              "label": "Climatisation (filtres, crépine, pompe de circulation)",
              "description": "Sans objet si le bateau n'est pas climatisé.",
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "seacock-plan",
              "label": "Plan des passe-coques et bouchons coniques à poste",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "safety",
          "name": "Sécurité",
          "color": "#C81E2B",
          "icon": "life-buoy",
          "sort_order": 8,
          "items": [
            {
              "external_ref": "liferaft",
              "label": "Radeau de survie : révision (date de validité)",
              "description": null,
              "interval_months": 36,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": [
                "Relever la date de validité inscrite sur le conteneur",
                "Confier le radeau à une station agréée pour la révision",
                "Contrôler la fixation du berceau et l'amarrage de la bosse sur un point de structure",
                "Vérifier la date du largueur hydrostatique s'il en est équipé",
                "Enregistrer la nouvelle date de validité au cochage"
              ]
            },
            {
              "external_ref": "epirb",
              "label": "Balise EPIRB : autotest, date de batterie, enregistrement",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "lifejackets",
              "label": "Gilets et harnais : cartouches, percuteurs, dates, longes",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "extinguishers",
              "label": "Extincteurs : dates, pression, couverture anti-feu",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "pyrotechnics",
              "label": "Pyrotechnie : dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "lifelines",
              "label": "Filières, mains courantes, bouée fer à cheval, feux à retournement",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "first-aid",
              "label": "Trousse de secours : contenu et dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "gas-co-alarms",
              "label": "Détecteurs de gaz, de monoxyde et de fumée : essai, piles",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "insurance",
              "label": "Assurance du bateau : renouvellement (date de validité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "safety-file",
              "label": "Matériel d'armement et dossier de sécurité : contrôle",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        }
      ]
    },
    {
      "template": {
        "external_ref": "generic-rib-v1",
        "name": "Semi-rigide — modèle générique",
        "builder": null,
        "model": null,
        "boat_type": "rib",
        "version": 1,
        "is_public": true
      },
      "categories": [
        {
          "external_ref": "engines",
          "name": "Moteurs",
          "color": "#D97706",
          "icon": "cog",
          "sort_order": 1,
          "items": [
            {
              "external_ref": "out-gear-oil",
              "label": "Huile d'embase (vidange, eau dans l'huile)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": [
                "Moteur vertical, dévisser la vis du bas puis celle du haut et laisser couler",
                "Une huile laiteuse signale une entrée d'eau : contrôler les joints d'arbre d'hélice",
                "Remplir par le bas jusqu'à ce que l'huile ressorte par le haut, joints neufs sur les deux vis"
              ]
            },
            {
              "external_ref": "out-engine-oil",
              "label": "Vidange huile moteur + filtre (4 temps)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": [
                "Faire chauffer le moteur, puis le mettre à la verticale",
                "Vidanger par le bouchon ou par aspiration, remplacer le filtre, joint huilé",
                "Remplir à la jauge avec l'huile préconisée, démarrer, contrôler l'absence de fuite"
              ]
            },
            {
              "external_ref": "out-spark-plugs",
              "label": "Bougies (état, écartement, remplacement)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-fuel-filter",
              "label": "Filtre à essence et préfiltre décanteur",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-impeller",
              "label": "Turbine de pompe à eau (impeller, témoin de refroidissement)",
              "description": null,
              "interval_months": 24,
              "interval_hours": 200,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": [
                "Déposer l'embase, repérer le sens de rotation de la turbine",
                "Remplacer la turbine et le joint du corps de pompe, graisser légèrement",
                "Remonter, démarrer dans un bac et vérifier le jet du témoin"
              ]
            },
            {
              "external_ref": "out-anodes",
              "label": "Anodes (embase, plaque anticavitation, bloc)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-propeller",
              "label": "Hélice (pales, moyeu, écrou, goupille, fil de pêche)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-grease",
              "label": "Graissage (cannelures d'arbre d'hélice, axes de relevage, direction)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-tilt",
              "label": "Relevage et trim (vérin, niveau, fuites, essai)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-controls",
              "label": "Câbles de commande et de direction (jeu, corrosion, graissage)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-thermostat",
              "label": "Thermostat et circuit de refroidissement (essai, tartre, rinçage)",
              "description": null,
              "interval_months": 24,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-timing-belt",
              "label": "Courroie de distribution (selon préconisation constructeur)",
              "description": null,
              "interval_months": 60,
              "interval_hours": 1000,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "out-winterising",
              "label": "Hivernage (stabilisant carburant, brumisation, rinçage, stockage vertical)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "outboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "jet-wear-ring",
              "label": "Turbine de jet et bague d'usure (jeu, chocs, cavitation)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "jet",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "jet-bearings",
              "label": "Roulements et joint d'arbre de turbine (jeu, bruit, graisse)",
              "description": null,
              "interval_months": 24,
              "interval_hours": 200,
              "engine_scope": "jet",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "jet-intake",
              "label": "Grille d'aspiration et godet d'inversion (débris, fixations, câble)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "jet",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "sterndrive",
              "label": "Embase Z-drive : soufflets (cardan, échappement, câble) et anodes",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "sterndrive",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "sterndrive-oil",
              "label": "Huile d'embase Z-drive (vidange, eau dans l'huile)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 100,
              "engine_scope": "sterndrive",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-oil",
              "label": "Vidange huile moteur + filtre à huile",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Faire tourner le moteur dix minutes pour fluidifier l'huile",
                "Arrêter le moteur et pomper l'huile usagée par le tube de jauge",
                "Remplacer le filtre à huile, joint neuf huilé, serrage à la main puis trois quarts de tour",
                "Remplir avec l'huile préconisée par le constructeur et contrôler le niveau à la jauge",
                "Démarrer, contrôler l'absence de fuite au filtre et au bouchon de vidange",
                "Relever les heures moteur et déposer l'huile usagée au point de collecte du port"
              ]
            },
            {
              "external_ref": "eng-fuel-filters",
              "label": "Filtres à gasoil (préfiltre décanteur + filtre moteur)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne de gasoil",
                "Vidanger le bol du décanteur et noter la présence d'eau ou de dépôt",
                "Remplacer la cartouche du préfiltre, puis le filtre monté sur le moteur",
                "Purger le circuit à la pompe d'amorçage jusqu'à disparition des bulles",
                "Démarrer et contrôler l'absence de fuite et de fumée noire"
              ]
            },
            {
              "external_ref": "eng-impeller",
              "label": "Turbine de pompe à eau de mer (impeller)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 300,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": [
                "Fermer la vanne d'eau de mer",
                "Déposer le couvercle de pompe et extraire la turbine",
                "Contrôler les ailettes ; si une ailette manque, la rechercher dans l'échangeur",
                "Monter une turbine neuve légèrement graissée avec un joint neuf",
                "Rouvrir la vanne, démarrer et vérifier le débit d'eau à l'échappement"
              ]
            },
            {
              "external_ref": "eng-belt",
              "label": "Courroie d'alternateur (tension, usure, alignement)",
              "description": null,
              "interval_months": 12,
              "interval_hours": 250,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-anodes",
              "label": "Anodes moteur (échangeur, collecteur)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-coolant",
              "label": "Liquide de refroidissement (niveau, remplacement)",
              "description": null,
              "interval_months": 24,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "eng-exhaust",
              "label": "Circuit d'échappement (coude, waterlock, durites, colliers)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "inboard",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "fuel-system",
              "label": "Réservoir et circuit d'essence (durites, poire d'amorçage, évent, raccords)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "hull_deck",
          "name": "Coque & Flotteurs",
          "color": "#52606F",
          "icon": "ship",
          "sort_order": 2,
          "items": [
            {
              "external_ref": "tubes-pressure",
              "label": "Flotteurs : pression, collages, points de ragage",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": [
                "Gonfler à la pression indiquée par le constructeur, flotteurs froids",
                "Passer de l'eau savonneuse sur les collages, les valves et les cônes arrière",
                "Repérer les zones qui frottent (taquets, mains courantes, remorque) et les protéger"
              ]
            },
            {
              "external_ref": "tubes-valves",
              "label": "Valves de gonflage (joints, capuchons, étanchéité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "tubes-care",
              "label": "Nettoyage et protection UV des flotteurs",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hull-inspection",
              "label": "Carène : inspection (chocs, rayures, gelcoat, quille)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "antifouling",
              "label": "Antifouling ou carénage (si le bateau reste à l'eau)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "hull-anodes",
              "label": "Anodes de coque (si le bateau reste à l'eau)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "drain-plug",
              "label": "Nable et vide-vite (bouchon, joint, clapet)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "deck-hardware",
              "label": "Accastillage et console (taquets, mains courantes, fixations, corrosion)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "seats-canvas",
              "label": "Sellerie, taud et housse (coutures, fermetures, moisissures)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "anchor-check",
              "label": "Mouillage : ancre, chaîne, cordage, manilles",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "energy",
          "name": "Électricité",
          "color": "#A16207",
          "icon": "zap",
          "sort_order": 3,
          "items": [
            {
              "external_ref": "battery-check",
              "label": "Batterie (tension, charge, cosses, fixation)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "battery-switch",
              "label": "Coupe-batterie, fusibles et câblage (serrage, corrosion)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "bilge-pump",
              "label": "Pompe de cale (essai manuel et automatique, flotteur, crépine)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "nav-lights",
              "label": "Feux de navigation : essai",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "charger",
              "label": "Chargeur et prise de quai (si équipé)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "electronics_nav",
          "name": "Électronique / Nav",
          "color": "#1D4ED8",
          "icon": "radar",
          "sort_order": 4,
          "items": [
            {
              "external_ref": "gps-plotter",
              "label": "GPS, traceur et sonde (mises à jour, fixation, essai)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "vhf-test",
              "label": "VHF fixe ou portable : essai, batterie, antenne",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "compass",
              "label": "Compas (lisibilité, éclairage, fixation)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "ais-test",
              "label": "AIS : essai d'émission et de réception, MMSI programmé",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "mmsi-registration",
              "label": "Licence de station radio et enregistrement MMSI",
              "description": null,
              "interval_months": null,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "safety",
          "name": "Sécurité",
          "color": "#C81E2B",
          "icon": "life-buoy",
          "sort_order": 5,
          "items": [
            {
              "external_ref": "kill-switch",
              "label": "Coupe-circuit : cordon et essai",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "lifejackets",
              "label": "Gilets de sauvetage (dates, percuteurs, sangles)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "extinguishers",
              "label": "Extincteur : date, pression",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "pyrotechnics",
              "label": "Feux à main : dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "bailer-paddle",
              "label": "Écope, pagaie, bouée, ligne de remorquage",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "first-aid",
              "label": "Trousse de secours : contenu et dates de péremption",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "liferaft",
              "label": "Radeau de survie : révision (date de validité)",
              "description": null,
              "interval_months": 36,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "epirb",
              "label": "Balise EPIRB ou PLB : autotest, date de batterie, enregistrement",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "zone_scope": "offshore",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "insurance",
              "label": "Assurance du bateau : renouvellement (date de validité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "safety-file",
              "label": "Matériel d'armement selon la zone de navigation : contrôle",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        },
        {
          "external_ref": "trailer",
          "name": "Remorque",
          "color": "#0F766E",
          "icon": "container",
          "sort_order": 6,
          "items": [
            {
              "external_ref": "trailer-bearings",
              "label": "Roulements et moyeux (graissage, jeu, chauffe)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "trailer-tyres",
              "label": "Pneus et roue de secours (pression, usure, craquelures)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "trailer-brakes",
              "label": "Freins et attelage (essai, réglage, verrouillage, câble de sécurité)",
              "description": null,
              "interval_months": 12,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "trailer-rollers",
              "label": "Rouleaux, patins et treuil (usure, rotation, câble ou sangle, cliquet)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "trailer-lights",
              "label": "Éclairage et prise (essai, corrosion)",
              "description": null,
              "interval_months": 6,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            },
            {
              "external_ref": "trailer-rinse",
              "label": "Rinçage à l'eau douce et anticorrosion (châssis, essieu)",
              "description": null,
              "interval_months": 3,
              "interval_hours": null,
              "engine_scope": "none",
              "source": "proposal",
              "actions": []
            }
          ]
        }
      ]
    }
  ]
}
$json$;
  v_template jsonb;
  v_category jsonb;
  v_item jsonb;
  v_template_id uuid;
  v_category_id uuid;
  v_category_order int;
  v_item_order int;
begin
  for v_template in select * from jsonb_array_elements(v_payload -> 'templates')
  loop
    insert into public.checklist_templates (name, builder, model, boat_type, version, is_public, external_ref)
    values (
      v_template -> 'template' ->> 'name',
      v_template -> 'template' ->> 'builder',
      v_template -> 'template' ->> 'model',
      (v_template -> 'template' ->> 'boat_type')::public.boat_type,
      (v_template -> 'template' ->> 'version')::int,
      (v_template -> 'template' ->> 'is_public')::boolean,
      v_template -> 'template' ->> 'external_ref'
    )
    on conflict (external_ref) do update
      set name = excluded.name,
          builder = excluded.builder,
          model = excluded.model,
          boat_type = excluded.boat_type,
          version = excluded.version,
          is_public = excluded.is_public
    returning id into v_template_id;

    v_category_order := 0;
    for v_category in select * from jsonb_array_elements(v_template -> 'categories')
    loop
      v_category_order := v_category_order + 1;
      insert into public.checklist_template_categories (template_id, name, color, icon, sort_order, external_ref)
      values (
        v_template_id,
        v_category ->> 'name',
        v_category ->> 'color',
        v_category ->> 'icon',
        coalesce((v_category ->> 'sort_order')::int, v_category_order),
        v_category ->> 'external_ref'
      )
      on conflict (template_id, external_ref) do update
        set name = excluded.name,
            color = excluded.color,
            icon = excluded.icon,
            sort_order = excluded.sort_order
      returning id into v_category_id;

      v_item_order := 0;
      for v_item in select * from jsonb_array_elements(v_category -> 'items')
      loop
        v_item_order := v_item_order + 1;
        insert into public.checklist_template_items (
          template_category_id, label, description, interval_months, interval_hours,
          engine_scope, zone_scope, actions, source, sort_order, external_ref
        )
        values (
          v_category_id,
          v_item ->> 'label',
          v_item ->> 'description',
          (v_item ->> 'interval_months')::int,
          (v_item ->> 'interval_hours')::int,
          coalesce(v_item ->> 'engine_scope', 'none'),
          coalesce(v_item ->> 'zone_scope', 'all'),
          coalesce(v_item -> 'actions', '[]'::jsonb),
          coalesce(v_item ->> 'source', 'proposal'),
          v_item_order,
          v_item ->> 'external_ref'
        )
        on conflict (template_category_id, external_ref) do update
          set label = excluded.label,
              description = excluded.description,
              interval_months = excluded.interval_months,
              interval_hours = excluded.interval_hours,
              engine_scope = excluded.engine_scope,
              zone_scope = excluded.zone_scope,
              actions = excluded.actions,
              source = excluded.source,
              sort_order = excluded.sort_order;
      end loop;
    end loop;
  end loop;
end;
$migration$;
