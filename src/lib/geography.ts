import type { ProductGraphView } from "@/state/productGraphStore"

/**
 * The views listed under the navbar's Results menu, in menu order.
 * Geography (issue #87) shows where a product's impacts happen on a map.
 */
export const RESULT_VIEWS = [
  ["results", "LCA results"],
  ["inventory", "Inventory"],
  ["impact", "Impact analysis"],
  ["process", "Process results"],
  ["contribution", "Contributions"],
  ["sankey", "Sankey"],
  ["geography", "Geography"],
] as const satisfies ReadonlyArray<readonly [ProductGraphView, string]>

/** Every result view needs a current calculation, except the LCA results overview. */
export const isResultViewEnabled = (view: ProductGraphView, hasCurrentResults: boolean) =>
  view === "results" || hasCurrentResults
