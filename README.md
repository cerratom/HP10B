# HP-10B Web Calculator

A faithful, web-based recreation of the **HP-10B Business/Financial Calculator**.

- **Full feature parity** with the original (TVM, interest conversion, NPV/IRR,
  business percentages, statistics & regression, amortization, math functions).
- **Pixel-faithful UI** — matches the physical calculator in `Assets/HP-10B.jpg`.
- **Pure vanilla JS** — no frameworks, no build step, no backend, no dependencies.
- **Single entry point** — open `index.html` directly (works over `file://` or any
  static host).
- **Keyboard support** — full keyboard mapping in addition to the on-screen keys.
- **Session persistence** — state is saved to `sessionStorage` and restored on
  refresh (mirrors the calculator's volatile memory model).

## Status

**Shipped — `v1.0.0`.** The full HP-10B feature set is implemented and verified: all
34 acceptance checks (`index.html?test=1`) pass in Chromium, Chrome, Firefox, Edge
and Safari. Live at **https://cerratom.github.io/HP10B/** (GitHub Pages, served from `main`).

- 🤖 **[AGENTS.md](AGENTS.md)** — the entry point for the agent that builds the app.
- 📄 **[specs.md](specs.md)** — the authoritative, detailed specification.
- 🧯 **[Project_Management/PROGRESS.md → "Stopping point"]** — where the project paused and how to resume.

### Project management (in `Project_Management/`)

- 📋 **[PROGRESS.md](Project_Management/PROGRESS.md)** — live task board (done / in progress / pending).
- 📜 **[CHANGELOG.md](Project_Management/CHANGELOG.md)** — append-only history of changes.
- 🧭 **[DECISIONS.md](Project_Management/DECISIONS.md)** — decision log (why we made each choice).
- 🐞 **[ISSUES.md](Project_Management/ISSUES.md)** — issues/bugs log and how they were fixed.

## How to run

No build step. Just open the file:

```
# Option A — open directly
open index.html            # macOS
xdg-open index.html        # Linux

# Option B — any static server (optional)
python3 -m http.server 8000
# then visit http://localhost:8000/
```

> A server is **not required** — the app is designed to run from `file://`.

## Keyboard

Digits, decimal point, `+ - * /`, `Enter`, `Backspace`, `Escape`, and `%` work directly.
Press `Shift` to arm the yellow function of the next key. Shortcuts include `n` (N),
`i` (I/YR), `p` (PV), `m` (PMT), `f` (FV), `v` (INPUT), `k` (K), `g` (SWAP), `e` (eˣ),
`l` (LN), `s` (√x), and `q` (x²).

Every physical key is reachable by typing `;` followed by its row and column.
For example, `;11` presses N, `;16` presses Σ+, and `;61` presses SHIFT.
Rows count from the top and columns from the left. Use `Shift` or `;61` before
the sequence to access the yellow function.

## Testing

- **In-browser acceptance suite:** open `index.html?test=1` — runs 34 checks (A1–A34)
  whose expected values are transcribed from the HP-10B manual, and prints PASS/FAIL.
- **Headless regression (Node, no browser):** `node tests/harness.js` — expects
  `--- 34/34 pass`; it derives its key/shift map from `index.html`.
- **Debug aid:** `node tests/debug.js` dumps internal state after targeted sequences.

## Source of truth

- `Assets/HP-10B.jpg` — photo of the physical calculator (authoritative for layout & colors).
- `Assets/User_Manual.pdf` — HP-10B Owner's Manual (Edition 6, 1994) — authoritative for
  behavior, functions, and worked examples (used as acceptance tests).

## Repository layout

```
H10B_Calculator/
├── README.md           # this file — overview + how to run
├── AGENTS.md           # entry point for the building agent
├── specs.md            # ← authoritative specification
├── index.html          # entry point
├── styles.css          # exact HP-10B look
├── app.js              # state machine + engines + keyboard
├── .gitignore
├── Assets/             # source of truth (photo + manual)
│   ├── HP-10B.jpg
│   └── User_Manual.pdf
├── tests/              # dev-only test tooling (not part of the app)
│   ├── harness.js      # headless 34-check regression suite
│   └── debug.js        # instrumented state dumper
└── Project_Management/ # record-keeping
    ├── PROGRESS.md     # task board
    ├── CHANGELOG.md    # append-only history
    ├── DECISIONS.md    # decision log
    └── ISSUES.md       # issues/bugs log
```

## Contributing / workflow

This is a long-lived project. When you make changes:

1. Update **`Project_Management/PROGRESS.md`** (move the relevant task to the new status).
2. Append an entry to **`Project_Management/CHANGELOG.md`**.
3. If you made a non-obvious choice, record it in **`Project_Management/DECISIONS.md`**.
4. If you hit/fixed a bug, record it in **`Project_Management/ISSUES.md`**.
5. `git commit` with a clear message.

See **`AGENTS.md`** and **`specs.md` → Project Workflow** for the full rules and status vocabulary.
