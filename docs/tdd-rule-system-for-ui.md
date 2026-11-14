# Applying the TDD "Rule System" to the Product Graph Editor UI

This note looks at whether the test-driven approach used in the practice project
[`prism-lca/tdd-sale-calculator`](https://github.com/prism-lca/tdd-sale-calculator)
can be reused for the Product Graph Editor's user interface. It explains the idea,
where it fits, what works well, and where it breaks down.

## The idea we are copying

The sale-calculator project keeps one small, pure calculation in `sale.js`. Both
the web page and the tests load that same file. A non-programmer states the rules
in plain English, and each rule becomes exactly one named test:

- **Red** — write one test for a rule, run it, and show that it fails.
- **Green** — write the smallest change that makes it pass, then run it again.
- **Tidy** — clean up while keeping every test passing.

Rules are numbered examples that can be answered yes or no (for example,
"20% off $50 is $40.00"). The tests are the written record of the agreement, and
they are never weakened to make the code pass.

## The core translation for UI code

UI code feels hard to test because decisions are tangled up inside components.
The technique's real value here is to **pull each UI decision out into a small,
pure function**, then test that function exactly like `salePrice`.

This repository already has this shape in places:

- `src/lib/resultFormatting.ts` — how numbers and labels are formatted
- `src/lib/units.ts` — unit conversion
- `src/lib/layout.ts` — graph layout decisions
- `src/hooks/usePhoneLayout.ts` — which layout mode to use at which width

Those files are the `sale.js` of this project. The suggestion is to make that the
deliberate home of the rule system, not an accident.

## Three kinds of UI rules

Not every UI rule can be tested the same way. There are three groups:

| Kind | Example | How it is checked |
| --- | --- | --- |
| Pure decision | "12.3456 kg CO2e formats to 12.3" | `vitest` (`npm run test:unit`) |
| Rendered behavior | "at 375×812 the page does not scroll sideways" | Playwright (`npm run test:responsive`) |
| Taste / appearance | "the spacing looks balanced" | human review only |

The first two follow the same red/green/tidy loop; only the test runner changes.
The third cannot be a pass/fail test at all — it is checked by looking at the page.

## How the pieces map

| Sale calculator | Product Graph Editor |
| --- | --- |
| `sale.js` | a small pure module under `src/lib/` |
| `sale.test.js` | `tests/unit/<rule>.test.ts` or `tests/responsive/<rule>.responsive.spec.ts` |
| `test("Rule 1: ...")` | `it("Rule 1: ...")` / `test("Rule 1: ...")` |
| `node --test` | `npm run test:unit` (or `test:responsive` for browser rules) |
| `python3 -m http.server 8000` | `./start_server.sh` |
| "don't add a package.json" | "use vitest and Playwright, which are already installed" |

## What a good rule looks like

A rule has to be a yes/no example with a real answer. Good examples:

1. At 375×812, the page must not scroll sideways. (answer: yes)
2. At 375×812, the graph canvas keeps a useful width. (answer: yes, at least 250px)
3. At 375×812, the inspector opens as a contained overlay, not by shrinking the graph.
4. Opening the inspector keeps the selected node at least 16px clear of the panel.

Rule 4 is the same rule that already existed as a fixed bug (#37), which shows the
approach fits this codebase.

## What works well

- **Pure UI decisions fit perfectly.** Formatting, unit conversion, layout-mode
  choices, label truncation, and "should we re-fit the viewport" are all plain
  functions. They get the fast, obvious red/green loop the calculator gives.
- **The discipline transfers to all UI work.** Numbered rules, one named test per
  rule, showing the failure before writing code, stopping to ask, and committing
  once at the end are good habits regardless of the test runner.
- **The repo is already split the right way.** Pure logic lives in `src/lib`, and
  browser behavior lives in `tests/visual` and `tests/responsive`. That split is
  exactly what this approach needs.
- **Existing prose checklists become rules.** The checklist in `AGENTS.md` and
  `plan/responsive-audit.md` is the raw material for numbered rules.

## Limitations

These are the main reasons this cannot be a perfect fit for UI code.

1. **The pure seam does not exist yet for most decisions.** `salePrice` was born
   testable. Here the decisions are tangled inside components such as
   `Inspector.tsx`, `GraphCanvas.tsx`, and `AppControls.tsx`. Extracting them is a
   real refactor, often bigger and riskier than the feature itself. The method
   says "smallest change"; making code testable is often a large one.

2. **UI state is combinatorial.** A price has one input and one output. A UI rule
   depends on viewport × theme × data × auth × in-flight calculation × MCP state ×
   realtime updates. One passing test proves one path and can give false confidence.

3. **The red step is not always clean.** Browser tests fail for environment reasons
   (missing Chromium, shared libraries — see `plan/responsive-baseline.md`), for
   timing, or for harmless pixel changes. If the failure is environmental, you
   cannot honestly show the person "the rule failed."

4. **Many UI rules are not binary.** Phrases like "useful space", "appropriate
   overlay", and "usable touch targets" are not yes/no. To make them checkable you
   have to invent a threshold (250px? 16px?), and then the number becomes the rule
   without the person ever agreeing to it.

5. **Visual snapshots go against the spirit.** The calculator has no golden files.
   Here, 56 pixel baselines can pass while being wrong, and fail on harmless
   rendering changes. "Never weaken a test to pass" is hard when a good refactor
   changes pixels.

6. **UI rules are not independent.** The calculator's rules compose cleanly. Here,
   fixing the phone inspector affects graph space and selected-node visibility.
   "Rule 1, then rule 2" assumes isolation that UI does not have, so a later green
   can silently break an earlier rule.

7. **External systems make rules non-deterministic.** LCA API, Supabase auth, MCP
   servers, and AI streaming need mocks. The test then checks the mock, not the
   app — a gap the pure function never has.

8. **The intended audience does not match this codebase.** The calculator targets a
   non-programmer stating rules. No non-programmer can agree a rule about result-cache
   eviction, MCP reconnection, or the auth-bypass build guard. On the parts that
   matter most, the method becomes "agent decides, human approves."

9. **The workflow rules conflict with how this repo is run.** The calculator works
   on `main`, with no branches, issues, or pull requests, and commits once. This repo
   uses issues and PRs, keeps a baseline ledger (100 unit / 59 responsive / 56
   visual), and treats a failing visual test as a regression. A single unreviewed
   commit on `main` for a layout change has a large blast radius.

10. **Test names can drift from what they check.** A test called "selected node stays
    visible" might really only check a CSS gap in one state. The hand-check is meant
    to catch this, but hand-checking dozens of rules across three viewports per change
    is not realistic.

11. **"Smallest change" fights good UI structure.** Hardcoding a value to get green is
    fine for a price. Hardcoding a layout mode inside a component recreates the tangle
    the approach is trying to remove.

## Recommendation

Use the **discipline** everywhere and the **mechanism** where it fits:

- For pure UI decisions, use the full calculator-style loop with `vitest`. This is
  where it shines.
- For rendered behavior (overflow, reachability, focus, dialogs in view), use the
  same numbered-rule and red/green habits, but run them with Playwright and treat
  them as slower evidence rather than instant proof.
- For appearance and taste, rely on the hand-check. Passing tests are not enough on
  their own; they can check the wrong thing.

In short: the rule system transfers well as a working method, but its guarantees —
determinism, clean pass/fail, independent rules, an honest red — do not fully carry
over, because UI correctness is stateful, rendered, and partly aesthetic.
