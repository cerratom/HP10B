# ISSUES — HP-10B Web Calculator

Log of bugs, defects, and surprising behaviors, plus **how each was fixed**.

Format (add new entries at the top of "Open" or "Resolved"):

```
## I<id> — <short title>
- **Date found:** YYYY-MM-DD
- **Status:** Open | In Progress | Resolved
- **Severity:** low | medium | high | blocking
- **Symptom:** what the user/developer sees.
- **Repro:** steps to reproduce (key sequence, e.g. `12 [N] 5 [I/YR] …`).
- **Root cause:** why it happened.
- **Fix:** what changed (file/section), and how it was verified.
```

---

## Open

### I1 — Large `replace_file` payloads cause JSON parse errors
- **Date found:** 2026-11-01
- **Status:** In Progress
- **Severity:** high
- **Symptom:** `"Unterminated string in JSON at position 19336 (line 1 column 19337)"` — the Bionic tool-call layer fails to serialize/deserialize the tool call when `new_content` is very large (~200+ lines).
- **Repro:** Call `replace_file` with a `new_content` string exceeding ~19 KB. The JSON payload is truncated or corrupted, producing the parse error in the Bionic UI/console.
- **Root cause:** The tool-call JSON envelope has a practical size limit or the string contains characters (e.g. unescaped quotes, newlines in certain contexts) that break the JSON encoding at the transport layer.
- **Fix (workaround):** Write files in **smaller chunks** — use `replace_file` for the first ~100 lines, then append via `edit_file_tool` (which uses smaller, targeted replacements). Alternatively, write via `shell_command` with `cat << 'EOF' > file` heredocs to bypass the JSON tool-call layer entirely.
- **Verification:** No JSON errors in Bionic console when writing files ≤ ~100 lines per call.

## Resolved

### I2 — Decimal rounding lost fractional digits on carry
- **Date found:** 2026-11-01
- **Status:** Resolved
- **Symptom:** Values such as 36.915 formatted incorrectly at two decimal places.
- **Repro:** Display 36.915 with `DISP 2`.
- **Root cause:** The prior digit carry routine concatenated the integer and fractional portions without restoring the decimal position.
- **Fix:** `roundDigits` now rounds the combined decimal digits and splits them at the requested precision.
- **Verification:** Code inspection and `git diff --check`; browser example verification remains part of T1.1.

---

## Conventions

- Every `Resolved` issue should name the commit or CHANGELOG entry that fixed it.
- If a fix changes behavior, also add a note in `DECISIONS.md` if it was a choice.
- When a feature's worked-example fails, open an issue **and** keep the task at
  `Done` (not `Verified`) until it's `Resolved`.
