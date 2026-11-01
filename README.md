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

This repository is currently in the **specification** phase. The build (the actual
`index.html` / `styles.css` / `app.js`) is a later phase driven by the spec.

- 🤖 **[AGENTS.md](AGENTS.md)** — the entry point for the agent that builds the app.
- 📄 **[specs.md](specs.md)** — the authoritative, detailed specification (the main deliverable).

### Project management (in `Project_Management/`)

- 📋 **[PROGRESS.md](Project_Management/PROGRESS.md)** — live task board (done / in progress / pending).
- 📜 **[CHANGELOG.md](Project_Management/CHANGELOG.md)** — append-only history of changes.
- 🧭 **[DECISIONS.md](Project_Management/DECISIONS.md)** — decision log (why we made each choice).
- 🐞 **[ISSUES.md](Project_Management/ISSUES.md)** — issues/bugs log and how they were fixed.

## How to run (once built)

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
├── index.html          # entry point (build phase)
├── styles.css          # exact HP-10B look (build phase)
├── app.js              # state machine + engines + keyboard (build phase)
├── .gitignore
├── Assets/             # source of truth (photo + manual)
│   ├── HP-10B.jpg
│   └── User_Manual.pdf
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
