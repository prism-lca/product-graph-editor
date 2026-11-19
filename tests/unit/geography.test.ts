import { describe, expect, test } from "vitest"
import { RESULT_VIEWS, classifyLocation, impactByLocation, isResultViewEnabled, processesInLocation, shadeForShare } from "@/lib/geography"
import type { ActivityContribution } from "@/lib/lcaApi"

const contribution = (process_name: string, location: string | null, direct_score: number): ActivityContribution => ({
  activity_id: process_name, process_name, database: "bafu", code: process_name, location,
  scope: "background", direct_score, percentage: null, occurrence_count: 1,
})

// A small cotton-like result: 10 kg CO2-eq in total.
const sample: ActivityContribution[] = [
  contribution("Electricity, low voltage, at grid", "CN", 4),
  contribution("Heat, natural gas, at industrial furnace", "CH", 1.5),
  contribution("Treatment, sewage", "CH", 0.5),
  contribution("Heat, light fuel oil, at industrial furnace", "RER", 3),
  contribution("Chemicals organic, at plant", "GLO", 1),
]

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

  test("Rule 3: places with a bigger share are shaded more strongly", () => {
    const places = impactByLocation(sample)
    // Largest first, each process counted once, shares adding up to 100%.
    expect(places.map((place) => place.code)).toEqual(["CN", "RER", "CH", "GLO"])
    expect(places.find((place) => place.code === "CH")?.score).toBeCloseTo(2)
    expect(places.find((place) => place.code === "CN")?.share).toBeCloseTo(0.4)
    expect(places.reduce((sum, place) => sum + place.share, 0)).toBeCloseTo(1)
    expect(places.find((place) => place.code === "RER")?.kind).toBe("region")

    expect(shadeForShare(0.6, 0.6)).toBeGreaterThan(shadeForShare(0.1, 0.6))
    expect(shadeForShare(0, 0.6)).toBe(0)
    expect(shadeForShare(0.6, 0.6)).toBeLessThanOrEqual(1)
  })

  test("Rule 4: selecting a place lists its processes and their shares", () => {
    const swiss = processesInLocation(sample, "CH")
    expect(swiss.map((process) => process.name)).toEqual([
      "Heat, natural gas, at industrial furnace",
      "Treatment, sewage",
    ])
    // Shares are of the whole result (10), so they add up to Switzerland's 20%.
    expect(swiss[0].share).toBeCloseTo(0.15)
    expect(swiss[1].share).toBeCloseTo(0.05)
    expect(processesInLocation(sample, "XYZ")).toEqual([])
    expect(processesInLocation([contribution("Assembly", null, 2)], "Not specified")).toHaveLength(1)
  })
})
