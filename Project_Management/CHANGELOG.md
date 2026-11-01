# CHANGELOG — HP-10B Web Calculator

Append-only history of changes. **Never edit or delete past entries** — add new ones
at the top (or bottom) of the "Releases / entries" section.

Format (keep it consistent):

```
### <date> — <short title>
- What changed (1–3 bullets).
- Related: T# task IDs, issue IDs, decision IDs.
```

---

## Entries

### 2026-11-01 — specs.md authored (T0.2 → Done)

- Wrote the full authoritative `specs.md` (17 sections + 2 appendices): overview, tech
  stack, key map (verified against `Assets/HP-10B.jpg`), display/annunciators, state
  model, feature specs (TVM, interest conversion, NPV/IRR, business %, statistics,
  amortization, math, arithmetic), numeric formatting, clearing, persistence
  (`sessionStorage`), messages/errors/power, acceptance tests, keyboard mapping,
  non-functional requirements, file structure, workflow.
- Corrected key-map ambiguity: `OFF`/`ON` sit on the `C` key; the orange key is the
  bare SHIFT key. 6th column confirmed as `Σ+`/`Σ−` (row 1) and `MAR`/`MU` (row 2).
- Open items to confirm against the manual are tracked in `specs.md → Appendix B`.
- Related: T0.2.

### 2026-11-01 — v0.1.0 — Specification & project scaffolding

- Initialized git repository (branch `main`).
- Created `README.md`, `.gitignore`, and the `Project_Management/` folder holding
  `PROGRESS.md`, `CHANGELOG.md`, `DECISIONS.md`, `ISSUES.md` (admin files grouped
  apart from the app code at the repo root).
- Created `AGENTS.md` — the entry-point instruction file for the building agent.
- Locked in core decisions (see `DECISIONS.md`): JS-only (no backend), `index.html`
  entry point, `sessionStorage` persistence, 3-file app structure.
- **Pending:** `specs.md` (the authoritative specification) — the main deliverable.
- Related: T0.1, T0.2.
