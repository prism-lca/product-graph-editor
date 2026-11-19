import { describe, expect, test } from "vitest"
import { RESULT_VIEWS, classifyLocation, isResultViewEnabled } from "@/lib/geography"

describe("Geography view (issue #87)", () => {
  test("Rule 1: Results menu lists Geography, disabled until there are results", () => {
    expect(RESULT_VIEWS).toContainEqual(["geography", "Geography"])
    expect(isResultViewEnabled("geography", false)).toBe(false)
    expect(isResultViewEnabled("geography", true)).toBe(true)
    // The overview page stays reachable before a calculation, as today.
    expect(isResultViewEnabled("results", false)).toBe(true)
  })

  // Map shapes are keyed by ISO 3166 numeric codes: CH 756, DE 276, FR 250.
  test("Rule 2: location codes are classed as country, region, worldwide or unknown", () => {
    expect(classifyLocation("CH")).toEqual({ kind: "country", code: "CH", countries: ["756"] })

    const europe = classifyLocation("RER")
    expect(europe.kind).toBe("region")
    expect(europe.countries).toEqual(expect.arrayContaining(["276", "250", "756"]))

    const europeWithoutSwitzerland = classifyLocation("Europe without Switzerland")
    expect(europeWithoutSwitzerland.kind).toBe("region")
    expect(europeWithoutSwitzerland.countries).toContain("276")
    expect(europeWithoutSwitzerland.countries).not.toContain("756")

    expect(classifyLocation("GLO")).toEqual({ kind: "worldwide", code: "GLO", countries: [] })
    expect(classifyLocation("XYZ")).toEqual({ kind: "unknown", code: "XYZ", countries: [] })
    expect(classifyLocation(null)).toEqual({ kind: "unknown", code: "Not specified", countries: [] })
  })
})
