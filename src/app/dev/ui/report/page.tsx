import { ReportDocument } from "@/components/report/ReportDocument";
import { ReportPrintButton } from "@/components/settings/ReportPrintButton";

import { DevShell } from "../DevShell";

/**
 * Visual acceptance of the printable state report — six tables, up to five columns each, and
 * the one screen in the app whose job is to be a document. It is six database queries deep, so
 * it had never once been opened by the audit; it is also the deliverable shown to an insurer
 * or a buyer, which makes it the last screen that should look broken.
 */
export default function DevReportPage() {
  return (
    <DevShell>
      <ReportDocument
        boat={{
          name: "Xaman",
          type: "catamaran",
          model: "ORC 50",
          builder: "Marsaudon Composites",
          hull_number: "MC-ORC50-014",
          year: 2019,
          home_port: "La Trinité-sur-Mer",
          flag: "France",
          sail_number: "FRA 50014",
          length_m: 15.24,
        }}
        today="2026-09-03"
        showCosts
        engines={[
          { id: "e1", label: "Bâbord", brand: "Volvo Penta", model: "D2-75", position: "port" },
          {
            id: "e2",
            label: "Tribord",
            brand: "Volvo Penta",
            model: "D2-75",
            position: "starboard",
          },
        ]}
        hours={[
          { engine_id: "e1", hours: 1482.5, read_at: "2026-08-28" },
          { engine_id: "e2", hours: 1461, read_at: "2026-08-28" },
        ]}
        progress={[
          {
            category_id: "c1",
            name: "Moteurs & Propulsion",
            total: 18,
            progress: 0.72,
            overdue_count: 2,
            never_recorded_count: 1,
          },
          {
            category_id: "c2",
            name: "Voiles & Gréement",
            total: 14,
            progress: 0.5,
            overdue_count: 1,
            never_recorded_count: 3,
          },
          {
            category_id: "c3",
            name: "Électricité & Électronique",
            total: 21,
            progress: 0.9,
            overdue_count: 0,
            never_recorded_count: 0,
          },
          {
            category_id: "c4",
            name: "Sécurité",
            total: 12,
            progress: null,
            overdue_count: 4,
            never_recorded_count: 12,
          },
          {
            category_id: "c5",
            name: "Coque, Pont & Appendices",
            total: 11,
            progress: 0.36,
            overdue_count: 1,
            never_recorded_count: 2,
          },
        ]}
        due={[
          {
            id: "d1",
            label: "Révision annuelle des moteurs (vidange, filtres, impellers)",
            category_id: "c1",
            status: "overdue",
            due_at: "2026-07-15",
            due_hours: 1500,
          },
          {
            id: "d2",
            label: "Contrôle du radeau de survie",
            category_id: "c4",
            status: "overdue",
            due_at: "2026-06-30",
            due_hours: null,
          },
          {
            id: "d3",
            label: "Remplacement du guindant du Code 0",
            category_id: "c2",
            status: "soon",
            due_at: "2026-10-01",
            due_hours: null,
          },
          {
            id: "d4",
            label: "Anodes de saildrive",
            category_id: "c1",
            status: "ok",
            due_at: "2027-03-12",
            due_hours: null,
          },
        ]}
        logs={[
          {
            id: "l1",
            performed_at: "2026-08-12",
            title: "Remplacement du guindant du Code 0 et révision de l'emmagasineur",
            category_name: "Voiles & Gréement",
            contact_name: "Voilerie All Purpose",
            cost: 1284,
          },
          {
            id: "l2",
            performed_at: "2026-06-04",
            title: "Carénage, anodes et changement des passe-coques",
            category_name: "Coque, Pont & Appendices",
            contact_name: "Chantier Naval du Guip",
            cost: 3420.5,
          },
          {
            id: "l3",
            performed_at: "2026-04-22",
            title: "Vidange des deux moteurs",
            category_name: "Moteurs & Propulsion",
            contact_name: null,
            cost: 268.9,
          },
        ]}
        haulOuts={[
          {
            id: "h1",
            started_at: "2026-05-28",
            ended_at: "2026-06-06",
            yard_name: "Chantier Naval du Guip — Brest",
            works: "Carénage complet, anodes, passe-coques, contrôle des saildrives",
            cost: 3420.5,
          },
          {
            id: "h2",
            started_at: "2025-04-14",
            ended_at: "2025-04-19",
            yard_name: "Marsaudon Composites",
            works: "Peinture antifouling",
            cost: 1980,
          },
        ]}
        logsCount={47}
        completionsCount={112}
        actions={<ReportPrintButton />}
      />
    </DevShell>
  );
}
