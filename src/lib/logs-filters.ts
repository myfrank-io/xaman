/**
 * Values the interventions filter can take that are not a boat category.
 *
 * Kept outside the page so the toolbar (a client component) and the page (a server one) read
 * the same constant: a value defined in one and retyped in the other is a filter that silently
 * stops matching the day someone renames it.
 */

/** « Stock » in the category list: the interventions that consumed a spare part. */
export const STOCK_FILTER = "stock";

/** A UUID no row carries, so « nothing matched » never degrades into « no filter ». */
export const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";
