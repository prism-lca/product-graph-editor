import { useEffect, useMemo, useRef, useState } from "react"
import { Globe2, MapPin } from "lucide-react"
import { AppSelect } from "@/components/common/AppControls"
import { useDisplaySettings } from "@/lib/displaySettings"
import worldMap from "@/assets/world-map.json"
import {
  buildGeography, describeLocation, processesInLocation, shadeForShare,
  type PlaceImpact,
} from "@/lib/geography"
import {
  impactCategoryAbbreviation, impactCategoryDisplayName,
  type ContributionGraph, type LcaResult,
} from "@/lib/lcaApi"

type MapCountry = { id: string; name: string; d: string }
const MAP = worldMap as { width: number; height: number; countries: MapCountry[] }

const KIND_LABEL: Record<PlaceImpact["kind"], string> = {
  country: "Country",
  region: "Region",
  worldwide: "Worldwide",
  unknown: "Not on the map yet",
}

/**
 * Results › Geography (issue #87): a world map of where the selected impact
 * happens, from each process's own direct score and dataset location.
 */
export function GeographyView({ result, isCurrent, error, loadContributionGraphs }: {
  result: LcaResult | null
  isCurrent: boolean
  error: string
  loadContributionGraphs: (categories: string[]) => Promise<ContributionGraph[]>
}) {
  const { formatNumber, formatPercent } = useDisplaySettings()
  const [impact, setImpact] = useState("")
  const [selectedCode, setSelectedCode] = useState("")

  const impactNames = result ? Object.keys(result.lcia) : []
  const defaultImpact = impactNames.find((name) => impactCategoryAbbreviation(name).replaceAll(/\s+/g, "").toUpperCase() === "GWP100")
    ?? impactNames.find((name) => /global warming|climate change/i.test(name))
    ?? impactNames[0]
    ?? ""
  const selectedImpact = impactNames.includes(impact) ? impact : defaultImpact
  const model = useMemo(() => result ? buildGeography(result, selectedImpact) : null, [result, selectedImpact])

  // Ask for each category's contribution data once per result, so a failed
  // request shows its error instead of being retried on every render.
  const requested = useRef(new Set<string>())
  useEffect(() => {
    if (!result || !isCurrent || !selectedImpact || model?.status !== "loading") return
    const key = `${result.result_id}\u0000${selectedImpact}`
    if (requested.current.has(key)) return
    requested.current.add(key)
    void loadContributionGraphs([selectedImpact]).catch(() => undefined)
  }, [result, isCurrent, selectedImpact, model?.status, loadContributionGraphs])

  if (!result || !isCurrent || !model) return <div className="results-panel geography-panel">
    <div className="results-panel-head"><div><strong>Geography</strong><span>Where a product's impacts happen.</span></div></div>
    <div className="results-placeholder"><div className="results-empty-icon"><Globe2 size={22} /></div><strong>No current results</strong><p>Calculate the LCA to see where its impacts happen.</p>{error ? <div className="results-error"><strong>Calculation failed</strong><p>{error}</p></div> : null}</div>
  </div>

  const selected = model.places.find((place) => place.code === selectedCode) ?? model.places[0]
  const processes = selected ? processesInLocation(model.contributions, selected.code) : []
  const fills = new Map<string, { opacity: number; code: string }>()
  const outlines = new Map<string, string>()
  for (const place of model.places) {
    const opacity = shadeForShare(place.share, model.largestShare)
    for (const id of place.countries) {
      if (place.kind === "country" && opacity > (fills.get(id)?.opacity ?? 0)) fills.set(id, { opacity, code: place.code })
      if (place.kind === "region") {
        outlines.set(id, place.code)
        if (!fills.has(id)) fills.set(id, { opacity: opacity * 0.45, code: place.code })
      }
    }
  }
  const offMap = model.places.filter((place) => place.kind === "worldwide" || place.kind === "unknown")
  const percent = (share: number) => formatPercent(share * 100)
  const zeroTotal = model.status === "ready" && model.total === 0

  return <div className="geography-view">
    <div className="geography-title">
      <div><strong>Geography</strong><span>Where the {impactCategoryDisplayName(selectedImpact)} impact of {result.name} happens</span></div>
      <div className="contribution-select is-impact geography-select"><AppSelect value={selectedImpact} onValueChange={(value) => { setImpact(value); setSelectedCode("") }} label="Impact category" options={impactNames.map((value) => ({ value, label: impactCategoryDisplayName(value) }))} /></div>
    </div>
    <div className="geography-body">
      <section className="geography-map-area" aria-label="Map">
        <div className="geography-map">
          <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} role="img" aria-label={`World map shading ${model.places.filter((place) => place.countries.length).map((place) => describeLocation(place.code).name).join(", ") || "no places yet"}`}>
            <g className="geography-land">
              {MAP.countries.map((country) => {
                const fill = fills.get(country.id)
                return <path key={country.id} d={country.d} className={fill ? "is-shaded" : undefined} style={fill ? { fillOpacity: fill.opacity } : undefined} onClick={fill ? () => setSelectedCode(fill.code) : undefined}><title>{fill ? describeLocation(fill.code).label : country.name}</title></path>
              })}
            </g>
            <g className="geography-outlines" aria-hidden="true">
              {MAP.countries.filter((country) => outlines.has(country.id)).map((country) => <path key={country.id} d={country.d} />)}
            </g>
            {selected?.countries.length ? <g className="geography-selected" aria-hidden="true">
              {MAP.countries.filter((country) => selected.countries.includes(country.id)).map((country) => <path key={country.id} d={country.d} />)}
            </g> : null}
          </svg>
          {offMap.length ? <div className="geography-offmap">
            {offMap.map((place) => <button type="button" key={place.code} className={place.code === selected?.code ? "is-selected" : undefined} onClick={() => setSelectedCode(place.code)}>
              {place.kind === "worldwide" ? <Globe2 size={13} /> : <MapPin size={13} />}{describeLocation(place.code).name}<b>{percent(place.share)}</b>
            </button>)}
          </div> : null}
          {model.status === "loading" ? <div className="geography-note" role="status">{error ? `Could not load where this impact happens: ${error}` : "Loading where this impact happens…"}</div> : null}
          {zeroTotal ? <div className="geography-note">This impact category scores zero for this model, so there is nothing to shade.</div> : null}
        </div>
        <div className="geography-legend">
          <span><i className="is-country" />Country, darker = bigger share</span>
          <span><i className="is-region" />Region (e.g. Europe)</span>
          <span className="geography-credit">Map: Natural Earth</span>
        </div>
      </section>

      <aside className="geography-panel-side" aria-label="Places">
        <section>
          <h3>Places</h3>
          {model.places.length ? <ul className="geography-places">
            {model.places.map((place) => <li key={place.code}>
              <button type="button" aria-pressed={place.code === selected?.code} onClick={() => setSelectedCode(place.code)}>
                <span className="geography-place-name">{describeLocation(place.code).label}<small>{KIND_LABEL[place.kind]}</small></span>
                <span className="result-bar"><i className={place.share < 0 ? "negative" : ""} style={{ width: `${Math.min(100, Math.abs(place.share) * 100)}%` }} /></span>
                <b>{percent(place.share)}</b>
              </button>
            </li>)}
          </ul> : <p className="geography-empty">{model.status === "loading" ? "Loading…" : "No processes with a score for this category."}</p>}
        </section>
        {selected ? <section>
          <h3>{describeLocation(selected.code).label}</h3>
          <p className="geography-summary">{KIND_LABEL[selected.kind]} · {percent(selected.share)} of the total · {formatNumber(selected.score)} {model.unit}</p>
          <div className="geography-table-wrap">
            <table className="geography-table">
              <thead><tr><th>Process</th><th>Share</th></tr></thead>
              <tbody>{processes.map((process) => <tr key={process.name}>
                <td>{process.name}<span className={`contribution-scope is-${process.scope}`}>{process.scope}</span></td>
                <td>{percent(process.share)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section> : null}
      </aside>
    </div>
  </div>
}
