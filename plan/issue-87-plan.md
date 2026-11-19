# Plan for issue #87: Make results readable: a Geography map and a grouped Inventory under Results
Branch: issue-87-branch · Owner: faith (Database & Engine team) · Reviewers: Elena, Calvin

This plan covers **Part 1: the Geography view**. Part 2 (the grouped Inventory)
gets its own plan section and pull request after this one is merged.

## Goal
People who aren't LCA experts can't tell where a product's impacts happen:
results show location codes like `RER` or `CN` in tables, if at all. We want
a **Geography** view under Results with a world map that shades the places
where a product's processes happen, so "most of my jacket's impact happens in
China" is visible at a glance. It uses data the editor already receives from
each calculation, so it needs no engine changes.

## Acceptance criteria
- [ ] 1. Given a calculated product graph, when I open the Results menu, then "Geography" is listed, and it is disabled before a calculation, like the other result views.
- [ ] 2. Given I open Geography, when the map loads, then each location in the supply chain is classed as a country (shaded solid), a region we know the countries of (e.g. Europe, outlined), or "Worldwide" (shown separately, not as a shape); locations we can't place on the map are still listed by code.
- [ ] 3. Given an impact category is selected, when I look at the map, then places with a bigger share of that impact are shaded more strongly.
- [ ] 4. Given I click a place on the map or in the list, when the list below the map updates, then it shows the processes in that place and their share of the impact.
- [ ] 5. Given I select a place, when the side panel shows it, then it shows a plain name next to the code (e.g. "Switzerland · CH", "Europe · RER"), or just the code if we don't know the name.
- [ ] 6. Given I change the graph and recalculate, when I return to Geography, then the map shows the new result.
- [ ] 7. Given a 375 px wide phone screen, when I open Geography, then the map and panel stack and nothing scrolls sideways.

## What will change
- **A new "Geography" entry in the Results menu**, after Sankey, greyed out until a calculation has run (same rule as the other result views). It also appears in the phone navigation menu.
- **A new Geography screen** (`src/components/views/GeographyView.tsx`) that follows the editor's design guide (`.stitch/DESIGN.md`): dark-first, violet for foreground, cyan for background, an inspector-style side panel, semantic tables.
  - An impact-category picker, like the Contributions view.
  - A world map (Natural Earth outlines, public domain) that shades each place by its share of the chosen impact.
  - A list of places with their share, and, for the selected place, its processes and their share.
- **The calculation logic lives in plain functions** (`src/lib/geography.ts`) so it can be tested without a browser:
  - which result views exist and when they're enabled;
  - what a location code means (country, region, worldwide, unknown) and its plain name;
  - adding up impact per place, and the processes in one place;
  - how strongly to shade a place.
- **The map shapes ship with the app** as a small data file (`src/assets/world-map.json`), made once by a script (`scripts/build-world-map.mjs`) from the free Natural Earth data. No new libraries are added to the app.
- **Regions:** Europe (`RER`) and "Europe without Switzerland" get country lists now. Other region codes (`RoW`, `RAS`, `UCTE`, …) are listed by code without a shape until the engine provides their country lists (engine issue, Part A). `GLO` is shown as "Worldwide".
- **Where the numbers come from:** the existing contribution data for the chosen impact category (the same data the Contributions view loads), using each process's own direct score so nothing is counted twice.

## Tests
Unit tests go in `tests/unit/geography.test.ts` (Vitest, run with `npm run test:unit`). The phone-width check goes in `tests/responsive/geography.responsive.spec.ts` (Playwright).

1. **Results menu lists Geography, disabled until there are results.** Checks the list of result views includes "Geography", and that it's disabled with no results and enabled with them.
2. **Location codes are classed as country, region, worldwide or unknown.** `CH` → country Switzerland; `RER` → region Europe containing Germany and France; `GLO` → worldwide; `XYZ` → unknown, kept as `XYZ`.
3. **Places with a bigger share are shaded more strongly.** From a sample result, impact is added up per place, shares add to 100%, and a 60% place gets a stronger shade than a 10% place.
4. **Selecting a place lists its processes and their shares.** From a sample result, picking `CH` returns only the Swiss processes, largest first, with the right shares.
5. **Places show a plain name next to the code.** `CH` → "Switzerland", `RER` → "Europe", `GLO` → "Worldwide", an unknown code → the code itself.
6. **A new result gives a new map.** Two different sample results give different per-place totals, and the view keeps no stored copy of an old result.
7. **Geography fits a 375 px phone screen.** Opens Geography at phone, tablet and desktop sizes and checks the page never scrolls sideways.

Each test is shown failing before its code is written. Before the pull request, the
editor's full checks also run: `npm run build`, `npm run lint`, `npm run test:unit`,
`npm run test:responsive` and `npm run test:visual`.

## Testing steps
1. Open the editor, choose a model with background (`bafu`) processes, and calculate. Open **Results**: "Geography" is listed. Before calculating, it is greyed out.
2. Open **Results › Geography**. Countries with impact are shaded; Europe (if used) is outlined; worldwide data appears as "Worldwide" beside the map; any other codes are listed.
3. Switch the impact category. The shading changes, and the place with the biggest share is the darkest.
4. Click a shaded country. The list below shows only processes in that country, with their shares adding up to that country's share.
5. Check the panel shows names like "Switzerland · CH" and "Europe · RER".
6. Go to **Graph**, change an amount on a background input, recalculate, and return to Geography. The shading reflects the change.
7. Narrow the browser to phone width (375 px). The map and panel stack, and there's no sideways scrolling.
