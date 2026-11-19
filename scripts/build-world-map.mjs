#!/usr/bin/env node
/**
 * Builds src/assets/world-map.json, the country outlines the Geography view
 * draws (issue #87). Run once, or when the outlines need refreshing:
 *
 *   node scripts/build-world-map.mjs
 *
 * Source: Natural Earth 1:110m admin-0 countries (public domain), via the
 * world-atlas package's TopoJSON. Countries are projected with the Equal Earth
 * projection, simplified, and stored as SVG path strings keyed by their
 * ISO 3166 numeric code, so the app needs no map library at runtime.
 */
import { writeFile } from "node:fs/promises"
import path from "node:path"

const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json"
const OUTPUT = path.resolve(import.meta.dirname, "../src/assets/world-map.json")
const WIDTH = 960
const TOLERANCE = 0.35 // px; Douglas-Peucker simplification

const topology = await (await fetch(SOURCE)).json()
const [scaleX, scaleY] = topology.transform.scale
const [translateX, translateY] = topology.transform.translate
const arcs = topology.arcs.map((arc) => {
  let x = 0, y = 0
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scaleX + translateX, y * scaleY + translateY] })
})

// Equal Earth projection (Šavrič, Patterson & Jenny, 2018).
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2
const equalEarth = ([lon, lat]) => {
  const lambda = lon * Math.PI / 180
  const theta = Math.asin(M * Math.sin(lat * Math.PI / 180))
  const t2 = theta * theta, t6 = t2 * t2 * t2
  const x = 2 * Math.sqrt(3) * lambda * Math.cos(theta) / (3 * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
  return [x, -y]
}
const [maxX] = equalEarth([180, 0])
const [, maxY] = equalEarth([0, -90])
const scale = WIDTH / (2 * maxX)
const HEIGHT = Math.round(2 * maxY * scale)
const project = (point) => {
  const [x, y] = equalEarth(point)
  return [(x + maxX) * scale, (y + maxY) * scale]
}

const simplify = (points) => {
  if (points.length < 3) return points
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1]
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy)
  let index = 0, furthest = -1
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]
    const distance = length ? Math.abs(dy * (px - ax) - dx * (py - ay)) / length : Math.hypot(px - ax, py - ay)
    if (distance > furthest) { index = i; furthest = distance }
  }
  if (furthest <= TOLERANCE) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))]
}

const ring = (indexes) => indexes.flatMap((index, position) => {
  const arc = index >= 0 ? arcs[index] : [...arcs[~index]].reverse()
  return position ? arc.slice(1) : arc
})

const pathOf = (geometry) => {
  const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.type === "MultiPolygon" ? geometry.arcs : []
  return polygons.flatMap((polygon) => polygon.map((indexes) => {
    const points = simplify(ring(indexes).map(project))
    if (points.length < 3) return ""
    // Rings crossing the date line (Russia, Fiji) jump from one edge of the map
    // to the other; start a new sub-path there instead of drawing the jump.
    const crossesDateLine = points.some(([x], i) => i && Math.abs(x - points[i - 1][0]) > WIDTH / 2)
    const commands = points.map(([x, y], i) => {
      const jump = i && Math.abs(x - points[i - 1][0]) > WIDTH / 2
      return `${i === 0 || jump ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join("")
    return crossesDateLine ? commands : `${commands}Z`
  })).join("")
}

const countries = topology.objects.countries.geometries
  .map((geometry) => ({ id: geometry.id ?? geometry.properties.name, name: geometry.properties.name, d: pathOf(geometry) }))
  .filter((country) => country.d && country.id !== "010") // Antarctica only adds empty space below the map
const cropBottom = Math.round(HEIGHT * 0.86)

await writeFile(OUTPUT, `${JSON.stringify({ source: "Natural Earth 1:110m (public domain) via world-atlas@2.0.2", width: WIDTH, height: cropBottom, countries })}\n`)
console.log(`Wrote ${countries.length} countries to ${path.relative(process.cwd(), OUTPUT)}`)
