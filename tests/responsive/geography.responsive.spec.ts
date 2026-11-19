import { expect, test } from "@playwright/test"
import { lcaResultFixture } from "../fixtures/lca-result"
import { calculate, mockLcaApi, openAnalysisView, pageMetrics } from "./helpers"

// Give the fixture's processes real places so the map has something to shade.
const LOCATIONS = ["CN", "CH", "RER", "GLO", "CH"]

test("Rule 7: Geography fits the screen at every size and stacks on a phone", async ({ page }, testInfo) => {
  await mockLcaApi(page)
  await page.route("**/lca-api/api/lca/contribution", async (route) => {
    const body = route.request().postDataJSON() as { categories?: string[] }
    const categories = body.categories ?? []
    await route.fulfill({
      json: {
        result_id: lcaResultFixture.result_id,
        method: lcaResultFixture.method,
        contribution_graphs: lcaResultFixture.contribution_graphs
          .filter((graph) => categories.some((category) => graph.label.includes(category)))
          .map((graph) => ({
            ...graph,
            activity_contributions: graph.activity_contributions.map((item, index) => ({ ...item, location: LOCATIONS[index % LOCATIONS.length] })),
          })),
      },
    })
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  await calculate(page)
  await openAnalysisView(page, "Geography")

  const view = page.locator(".geography-view")
  await expect(view).toBeVisible()
  await expect(view.locator(".geography-map > svg")).toBeVisible()
  await expect(view.locator(".geography-land path.is-shaded").first()).toBeAttached()
  await expect(view.getByRole("button", { name: /China · CN/ })).toBeVisible()

  await view.getByRole("button", { name: /Switzerland · CH/ }).click()
  await expect(view.getByRole("heading", { name: "Switzerland · CH" })).toBeVisible()
  await expect(view.locator(".geography-table tbody tr").first()).toBeVisible()

  const mapArea = (await view.locator(".geography-map-area").boundingBox())!
  const side = (await view.locator(".geography-panel-side").boundingBox())!
  if (page.viewportSize()!.width <= 620) {
    // On a phone the places panel sits below the map, not squeezed beside it.
    expect(side.y).toBeGreaterThanOrEqual(mapArea.y + mapArea.height - 1)
  }
  expect(mapArea.width).toBeGreaterThan(0)
  expect((await pageMetrics(page)).documentWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("geography.png") })
})
