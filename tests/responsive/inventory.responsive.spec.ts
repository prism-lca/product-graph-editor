import { expect, test } from "@playwright/test"
import { calculate, mockLcaApi, openAnalysisView, pageMetrics } from "./helpers"

test("inventory keeps names beside horizontally scrolling amounts", async ({ page }, testInfo) => {
  await mockLcaApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  await calculate(page)
  await openAnalysisView(page, "Inventory")
  for (const section of await page.locator(".inventory-view details").all()) {
    const wrapper = section.locator(".inventory-table-wrap")
    const row = wrapper.locator("tbody tr:not(.empty-row)").first()
    if (!await row.count()) continue
    await wrapper.scrollIntoViewIfNeeded()
    const name = row.locator("td").first()
    const amount = row.locator("td").nth(2)
    const before = (await name.boundingBox())!
    if (page.viewportSize()!.width <= 620) expect(before.width).toBeLessThanOrEqual(160)
    await wrapper.evaluate((element) => { element.scrollLeft = element.scrollWidth })
    if (page.viewportSize()!.width <= 620) {
      expect(await wrapper.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      const after = (await name.boundingBox())!
      const value = (await amount.boundingBox())!
      const frame = (await wrapper.boundingBox())!
      expect(after.x).toBeCloseTo(before.x, 0)
      expect(value.x).toBeGreaterThanOrEqual(after.x + after.width - 1)
      expect(value.x + value.width).toBeLessThanOrEqual(frame.x + frame.width + 1)
      await expect(name).toBeVisible()
      await expect(amount).toBeVisible()
    }
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`inventory-${(await section.locator("summary").innerText()).replace(/\s+/g, "-")}-scrolled.png`) })
    await wrapper.evaluate((element) => { element.scrollLeft = 0 })
    expect((await name.boundingBox())!.x).toBeCloseTo(before.x, 0)
  }
  expect((await pageMetrics(page)).documentWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
})
