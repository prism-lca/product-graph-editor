import { expect, test } from "@playwright/test"
import { mockLcaApi, openAnalysisView, pageMetrics } from "./helpers"

test("resized impact names stay inside their cells", async ({ page }, testInfo) => {
  await mockLcaApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  await openAnalysisView(page, "Impact Analysis")
  await page.getByRole("button", { name: "Expand climate change", exact: true }).click()
  await expect(page.locator(".impact-process-row").first()).toBeVisible()
  const resize = page.getByRole("separator", { name: "Resize Name column", exact: true })
  await resize.focus()
  for (let i = 0; i < 5; i++) await resize.press("Shift+ArrowLeft")
  await expect(resize).toHaveAttribute("aria-valuenow", "100")
  for (const group of ["Processes", "Flows"]) {
    await page.getByRole("radio", { name: group, exact: true }).check()
    const cells = page.locator(".impact-table tbody tr:not(.impact-breakdown-status) > td:first-child")
    await expect(cells.first()).toBeVisible()
    for (const cell of await cells.all()) {
      await expect(cell).toHaveCSS("overflow-x", "hidden")
      const cellBox = (await cell.boundingBox())!
      const next = (await cell.locator("xpath=following-sibling::td[1]").boundingBox())!
      expect(cellBox.x + cellBox.width).toBeLessThanOrEqual(next.x + 1)
    }
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`impact-${group}-narrow.png`) })
  }
  await resize.focus()
  for (let i = 0; i < 5; i++) await resize.press("Shift+ArrowRight")
  await expect(resize).toHaveAttribute("aria-valuenow", "300")
  await expect(page.getByRole("button", { name: "Collapse climate change", exact: true })).toBeVisible()
  expect((await pageMetrics(page)).documentWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
})
