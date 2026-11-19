import { describe, expect, test } from "vitest"
import { RESULT_VIEWS, isResultViewEnabled } from "@/lib/geography"

describe("Geography view (issue #87)", () => {
  test("Rule 1: Results menu lists Geography, disabled until there are results", () => {
    expect(RESULT_VIEWS).toContainEqual(["geography", "Geography"])
    expect(isResultViewEnabled("geography", false)).toBe(false)
    expect(isResultViewEnabled("geography", true)).toBe(true)
    // The overview page stays reachable before a calculation, as today.
    expect(isResultViewEnabled("results", false)).toBe(true)
  })
})
