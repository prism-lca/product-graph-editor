import { expect, test } from "@playwright/test"
import { expectInsideViewport, mockLcaApi, openAnalysisView, openPrimaryView, pageMetrics } from "./helpers"

test("compact navigation reaches every view without covering content", async ({ page }, testInfo) => {
  await mockLcaApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  for (const name of ["Edit", "Graph"]) await openPrimaryView(page, name)
  for (const name of ["Inventory", "Impact Analysis", "Process Results", "Contribution", "Sankey Graph", "LCA results"]) {
    await openAnalysisView(page, name)
    expect((await pageMetrics(page)).documentWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
  await openPrimaryView(page, "Graph")
  await expectInsideViewport(page.locator(".topbar"), page)
  const header = await page.locator(".topbar").boundingBox()
  const canvas = await page.locator(".graph-viewport").boundingBox()
  expect(canvas!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
  await page.screenshot({ path: testInfo.outputPath("navigation.png") })
})
