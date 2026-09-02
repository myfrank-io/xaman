/** One engine of an imported line, with everything needed to judge its value (ux-flows §3i). */
export type ReviewHourContext = {
  engineId: string;
  engineLabel: string;
  /** Value read in the paper logbook (`pending_engine_hours`). */
  bookHours: number | null;
  /** Last validated reading before this line. */
  previous: { hours: number; date: string } | null;
  /** Next value still waiting, further down the list. */
  next: { hours: number; date: string } | null;
};

export type ReviewLog = {
  id: string;
  title: string;
  performedAt: string;
  categoryName: string | null;
  categoryColor: string | null;
  contactName: string | null;
  notes: string | null;
  hours: ReviewHourContext[];
};

export type ReviewPurchase = {
  id: string;
  purchasedAt: string;
  designation: string;
  amount: number | null;
};
