import type { ActivityContribution, ContributionGraph } from "@/lib/lcaApi"
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

/**
 * ISO 3166 alpha-2 -> ISO 3166 numeric (zero-padded, as the map shapes use).
 * Covers every two-letter location in the bafu and mock_background databases,
 * plus the European countries the RER region needs. "CS" is the former
 * Serbia and Montenegro, which ecoinvent-style data still uses.
 */
const COUNTRY_TABLE = `
AD:020 AE:784 AL:008 AO:024 AR:032 AT:040 AU:036 AZ:031 BA:070 BD:050 BE:056
BG:100 BO:068 BR:076 BY:112 CA:124 CH:756 CL:152 CM:120 CN:156 CO:170
CS:688,499 CY:196 CZ:203 DE:276 DK:208 DZ:012 EC:218 EE:233 EG:818 ES:724
ET:231 FI:246 FR:250 GB:826 GQ:226 GR:300 HR:191 HU:348 ID:360 IE:372 IL:376
IN:356 IQ:368 IR:364 IS:352 IT:380 JP:392 KE:404 KR:410 KW:414 KZ:398 LI:438
LT:440 LU:442 LV:428 LY:434 MA:504 MC:492 MD:498 ME:499 MK:807 MT:470 MW:454
MX:484 MY:458 NA:516 NE:562 NG:566 NL:528 NO:578 NZ:554 OM:512 PE:604 PG:598
PH:608 PK:586 PL:616 PT:620 QA:634 RO:642 RS:688 RU:643 SA:682 SE:752 SG:702
SI:705 SK:703 SM:674 TH:764 TM:795 TN:788 TR:792 TT:780 TW:158 TZ:834 UA:804
US:840 UZ:860 VE:862 VN:704 ZA:710`

const COUNTRIES: Record<string, string[]> = Object.fromEntries(
  COUNTRY_TABLE.trim().split(/\s+/).map((entry) => {
    const [alpha2, numeric] = entry.split(":")
    return [alpha2, numeric.split(",")]
  }),
)

const EUROPE = "AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA".split(" ")
const countriesOf = (alpha2: string[]) => alpha2.flatMap((code) => COUNTRIES[code] ?? [])

/**
 * Regions we can draw today. Other region codes (RoW, RAS, UCTE, ...) are
 * listed by code until the engine supplies their country lists.
 */
const REGIONS: Record<string, string[]> = {
  RER: countriesOf(EUROPE),
  "Europe without Switzerland": countriesOf(EUROPE.filter((code) => code !== "CH")),
}

const WORLDWIDE = new Set(["GLO"])

export type LocationKind = "country" | "region" | "worldwide" | "unknown"
export type LocationClass = { kind: LocationKind; code: string; countries: string[] }

/** Label used for processes whose dataset has no location. */
export const UNSPECIFIED_LOCATION = "Not specified"

/** What a dataset's location code means on the map. */
export function classifyLocation(location: string | null | undefined): LocationClass {
  const code = location?.trim() || UNSPECIFIED_LOCATION
  if (COUNTRIES[code]) return { kind: "country", code, countries: COUNTRIES[code] }
  if (REGIONS[code]) return { kind: "region", code, countries: REGIONS[code] }
  if (WORLDWIDE.has(code)) return { kind: "worldwide", code, countries: [] }
  return { kind: "unknown", code, countries: [] }
}

export type PlaceImpact = LocationClass & {
  /** Sum of the direct scores of every process in this place. */
  score: number
  /** score / total score of the result (0..1). */
  share: number
}

/**
 * Impact per place, largest first. Uses each activity's own direct score, so
 * every process is counted once however often it occurs in the supply chain.
 */
export function impactByLocation(contributions: ActivityContribution[]): PlaceImpact[] {
  const totals = new Map<string, number>()
  let total = 0
  for (const item of contributions) {
    const { code } = classifyLocation(item.location)
    totals.set(code, (totals.get(code) ?? 0) + item.direct_score)
    total += item.direct_score
  }
  return [...totals.entries()]
    .map(([code, score]) => ({ ...classifyLocation(code), score, share: total ? score / total : 0 }))
    .sort((left, right) => Math.abs(right.score) - Math.abs(left.score))
}

/**
 * Map fill strength (0..1) for a place's share, relative to the largest share
 * on the map so the biggest place is always clearly the darkest.
 */
export function shadeForShare(share: number, largestShare: number) {
  if (!largestShare || share <= 0) return 0
  return 0.2 + 0.8 * Math.min(1, share / largestShare)
}

export type ProcessInPlace = {
  name: string
  scope: ActivityContribution["scope"]
  score: number
  /** score / total score of the whole result (0..1). */
  share: number
}

/** The processes located in one place, largest first, with their share of the whole result. */
export function processesInLocation(contributions: ActivityContribution[], code: string): ProcessInPlace[] {
  const total = contributions.reduce((sum, item) => sum + item.direct_score, 0)
  return contributions
    .filter((item) => classifyLocation(item.location).code === code)
    .map((item) => ({ name: item.process_name, scope: item.scope, score: item.direct_score, share: total ? item.direct_score / total : 0 }))
    .sort((left, right) => Math.abs(right.score) - Math.abs(left.score))
}

/** Plain names for the region codes used in our databases. */
const REGION_NAMES: Record<string, string> = {
  GLO: "Worldwide",
  RoW: "Rest of the world",
  RER: "Europe",
  RoE: "Rest of Europe",
  "Europe without Switzerland": "Europe without Switzerland",
  WEU: "Western Europe",
  EEU: "Eastern Europe",
  UCTE: "European power grid (UCTE)",
  "ENTSO-E": "European power grid (ENTSO-E)",
  NORDEL: "Nordic power grid (NORDEL)",
  CENTREL: "Central European power grid (CENTREL)",
  RAS: "Asia",
  APAC: "Asia and the Pacific",
  CPA: "Centrally planned Asia",
  RME: "Middle East",
  RAF: "Africa",
  RLA: "Latin America",
  RNA: "North America",
  OCE: "Oceania",
  CS: "Serbia and Montenegro",
  ASCC: "US power grid (Alaska, ASCC)",
  ERCOT: "US power grid (Texas, ERCOT)",
  FRCC: "US power grid (Florida, FRCC)",
  MRO: "US power grid (Midwest, MRO)",
  NPCC: "US power grid (Northeast, NPCC)",
  RFC: "US power grid (RFC)",
  SERC: "US power grid (Southeast, SERC)",
  SPP: "US power grid (Southwest, SPP)",
  WECC: "US power grid (West, WECC)",
}

const countryNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null

const countryName = (code: string) => {
  if (!/^[A-Z]{2}$/.test(code)) return undefined
  try {
    const name = countryNames?.of(code)
    return name && name !== code ? name : undefined
  } catch {
    return undefined
  }
}

export type LocationDescription = { code: string; name: string; label: string }

/** A plain-language name for a location code, e.g. "Switzerland · CH". Unknown codes are shown as they are. */
export function describeLocation(location: string | null | undefined): LocationDescription {
  const { code } = classifyLocation(location)
  const name = REGION_NAMES[code] ?? countryName(code)
  if (!name || name === code) return { code, name: code, label: code }
  return { code, name, label: `${name} · ${code}` }
}

export type GeographyModel = {
  /** "loading" until the contribution data for this category has arrived. */
  status: "loading" | "ready"
  category: string
  unit: string
  total: number
  places: PlaceImpact[]
  largestShare: number
  contributions: ActivityContribution[]
}

/**
 * Everything the Geography view draws, worked out fresh from the result it is
 * given. The view keeps no copy, so a recalculation always shows the new result.
 */
export function buildGeography(result: { contribution_graphs: ContributionGraph[] }, category: string): GeographyModel {
  const graph = result.contribution_graphs.find((item) => item.label === category)
  if (!graph) return { status: "loading", category, unit: "", total: 0, places: [], largestShare: 0, contributions: [] }
  const contributions = graph.activity_contributions ?? []
  const places = impactByLocation(contributions)
  return {
    status: "ready",
    category,
    unit: graph.unit,
    total: contributions.reduce((sum, item) => sum + item.direct_score, 0),
    places,
    largestShare: places.reduce((largest, place) => Math.max(largest, place.share), 0),
    contributions,
  }
}
