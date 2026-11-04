import { expect, test } from "@playwright/test"
import { expectInsideViewport, mockLcaApi, openAnalysisView, openChat, openPrimaryView, pageMetrics } from "./helpers"

test("graph and Sankey phone toolbars stay compact below the navbar", async ({ page }, testInfo) => {
  await mockLcaApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  for (const view of ["Graph", "Sankey Graph"]) {
    if (view === "Sankey Graph") await openAnalysisView(page, view)
    const toolbar = page.locator(".graph-toolbar:visible")
    await expectInsideViewport(toolbar, page)
    if (page.viewportSize()!.width <= 620) {
      const header = (await page.locator(".topbar").boundingBox())!
      const box = (await toolbar.boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(header.y + header.height)
      expect(box.y).toBeLessThanOrEqual(header.y + header.height + 9)
      expect(box.height).toBeLessThanOrEqual(42)
      expect(box.width).toBeLessThanOrEqual(240)
      await expect(toolbar.locator(".toolbar-grip")).toBeVisible()
      if (view === "Graph") await page.locator(".react-flow__node").last().click()
      const grip = (await toolbar.locator(".toolbar-grip").boundingBox())!
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
      await page.mouse.down()
      await page.mouse.move(grip.x + grip.width / 2, header.y, { steps: 8 })
      await page.mouse.up()
      await expect(async () => {
        expect((await toolbar.boundingBox())!.y).toBeCloseTo(header.y + header.height, 0)
      }).toPass()
      for (const button of await toolbar.locator(".toolbar-group").getByRole("button").all()) {
        const bounds = (await button.boundingBox())!
        expect(bounds.width).toBeGreaterThanOrEqual(28)
        expect(bounds.height).toBeGreaterThanOrEqual(28)
      }
    }
    await toolbar.getByRole("button", { name: "Fit graph", exact: true }).click()
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`${view}-toolbar.png`) })
    expect((await pageMetrics(page)).documentWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
})

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
  await page.getByRole("button", { name: "Fit graph", exact: true }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("navigation.png") })
})

test("chat overlays narrow workspaces and activity details leave tools reachable", async ({ page }, testInfo) => {
  await mockLcaApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  const width = page.viewportSize()!.width
  const before = await page.locator(".workspace").boundingBox()
  await openChat(page)
  await expectInsideViewport(page.locator(".ai-chat-sidebar"), page)
  if (width <= 900) expect((await page.locator(".workspace").boundingBox())!.width).toBe(before!.width)
  await page.getByRole("button", { name: "Close AI assistant" }).click()
  await page.locator(".react-flow__node").last().click()
  await expectInsideViewport(page.locator(".inspector"), page)
  await expectInsideViewport(page.locator(".graph-toolbar"), page)
  await page.waitForTimeout(400)
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("inspector.png") })
  if (width <= 620) {
    const handle = page.getByRole("button", { name: "Resize property editor" })
    const initial = (await page.locator(".inspector").boundingBox())!.height
    await handle.focus()
    await handle.press("ArrowUp")
    expect((await page.locator(".inspector").boundingBox())!.height).toBeGreaterThan(initial)
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y - 100, { steps: 5 })
    await page.mouse.up()
    expect((await page.locator(".inspector").boundingBox())!.height).toBeGreaterThan(initial + 100)
    await handle.press("ArrowDown")
    await handle.press("ArrowDown")
  }
  await page.getByRole("button", { name: "Graph settings", exact: true }).click()
  await expectInsideViewport(page.locator(".graph-settings-picker"), page)
  if (width <= 900) await expect(page.locator(".inspector")).toBeHidden()
  await page.getByRole("button", { name: "Close graph settings" }).click()
})

test("Sankey summary stays clear of nodes and workspace panels are exclusive", async ({ page }, testInfo) => {
  await mockLcaApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  await openAnalysisView(page, "Sankey Graph")
  const width = page.viewportSize()!.width
  if (width <= 900) {
    const chip = page.getByRole("button", { name: "Toggle Sankey summary" })
    await expectInsideViewport(chip, page)
    const chipBox = (await chip.boundingBox())!
    const canvas = (await page.locator(".sankey-canvas").boundingBox())!
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(chipBox.y)
    // React Grab's development toolbar floats at bottom-centre.
    await chip.click({ position: { x: 20, y: 20 } })
    await expect(page.getByLabel("Active Sankey settings")).toBeVisible()
  }
  await page.getByRole("button", { name: "Chart settings" }).click()
  await expectInsideViewport(page.getByRole("dialog", { name: "Sankey settings" }), page)
  if (width <= 900) await expect(page.getByLabel("Active Sankey settings")).toBeHidden()
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("sankey-settings.png") })
  if (width <= 900) {
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "Sankey settings" })).toBeHidden()
    await expect(page.getByRole("button", { name: "Chart settings" })).toBeFocused()
    await page.getByRole("button", { name: "Chart settings" }).click()
    await page.getByRole("button", { name: "Close Sankey settings" }).click()
    await expect(page.getByRole("button", { name: "Chart settings" })).toBeFocused()
    await page.getByRole("button", { name: "Chart settings" }).click()
  }
  await page.getByRole("button", { name: "File", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Sankey settings" })).toBeHidden()
  await expectInsideViewport(page.getByRole("menu", { name: "File", exact: true }), page)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "File", exact: true })).toBeFocused()
  await openAnalysisView(page, "Impact Analysis")
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("impact.png") })
  if (width <= 620) {
    await expectInsideViewport(page.locator(".impact-threshold"), page)
    await expect(page.locator(".impact-table-wrap tr > :first-child").first()).toHaveCSS("position", "sticky")
  }
})

test("phone navigation preserves unsaved edits and orientation stays local", async ({ page }) => {
  await mockLcaApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Explore PRISM" }).click()
  await openPrimaryView(page, "Edit")
  const editor = page.getByRole("textbox", { name: "Product graph YAML" })
  await editor.fill(`${await editor.inputValue()}\n# unsaved edit`)
  await openPrimaryView(page, "Graph")
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page.getByRole("button", { name: "Keep editing" }).click()
  await expect(editor).toHaveValue(/# unsaved edit$/)
  await openPrimaryView(page, "Graph")
  await page.getByRole("button", { name: "Discard changes" }).click()
  await page.getByRole("button", { name: "Graph settings", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Graph orientation" })).toHaveText(page.viewportSize()!.width <= 620 ? "Vertical" : "Horizontal")
  await page.getByRole("button", { name: "Close graph settings" }).click()
  if (page.viewportSize()!.width <= 620) {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.getByRole("button", { name: "Graph settings", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Graph orientation" })).toHaveText("Horizontal")
  }
})
