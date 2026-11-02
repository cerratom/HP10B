/* ============================================================================
 * HP-10B Web Calculator — application logic (vanilla JS, no dependencies)
 * ----------------------------------------------------------------------------
 * Spec:      specs.md  (authoritative; manual wins on behavior, photo on look)
 * Manual:    Assets/User_Manual.pdf (HP-10B Owner's Manual, Ed. 6, 1994)
 * State:     single serializable object persisted to sessionStorage (h10b.state.v1)
 * Sections:  §1 state   §2 format  §3 display  §4 entry/arith  §5 math
 *            §6 business %  §7 interest conv  §8 TVM  §9 cash flows/NPV/IRR
 *            §10 statistics  §11 amortization  §12 registers/K/clearing/power
 *            §13 key dispatch + keyboard  §14 self-test (?test=1)  §15 init
 * ==========================================================================*/
(function (global) {
'use strict';

/* ============================= §1 STATE =================================== */

var STORE_KEY = 'h10b.state.v1';
var VERSION   = 1;
var MAX_DIGITS = 12;      // device: signed 12-digit mantissa + 3-digit exponent
var MAX_CF_GROUPS = 15;   // CF0 + up to 14 groups (manual "Features")
var MAX_PARENS = 5;       // "Error - Full": more than five pending operations

function defaultState() {
  return {
    v: VERSION,
    power: true,
    /* registers */
    N: 0, IYR: 0, PV: 0, PMT: 0, FV: 0,      // TVM (I/YR shared with NOM %)
    CST: 0, PRC: 0, MAR: 0,                  // MAR shared with MU
    PYR: 12, EFF: 0, M: 0,
    R: [0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0],     // R0..R9, R.0..R.4
    cfs: [],                                 // [{cf, nj}] cash-flow groups
    stats: { n: 0, sx: 0, sy: 0, sx2: 0, sy2: 0, sxy: 0 },
    /* modes (survive CLEAR ALL and power off) */
    modes: { annuity: 'END', disp: 2, sep: '.' },
    /* transient entry / operation context */
    displayVal: 0,        // committed value shown when not entering
    entry: '',            // in-progress digit buffer (string)
    entering: false,
    pendOp: null,         // '+','-','*','/','^' awaiting second operand
    first: null,          // first operand of pending op
    other: null,          // value held via INPUT (two-number context)
    inputArmed: false,    // ':' annunciator / two-value context active
    constOp: null,        // K constant {op:'+'|'-'|'*'|'/'|'^', val, pct}
    lastBin: null,        // {op, b} for automatic-constant repeat of '='
    rclMode: null,        // 'STO' | 'RCL' awaiting register selection
    cfView: -1,           // index of cash-flow group currently viewed (>=0)
    parenStack: [],       // [{op, first}] pushed by '('
    twoVal: null,         // {a, b, shown} SWAP-toggleable result pair
    amort: null,          // active amortization context (see §11)
    msg: null,            // {text, kind:'status'|'error', restore:number|null}
    label: null,          // top-line label ('Int','Prin','bAL','CF 2','n 2')
    shiftArmed: false     // transient; forced false on restore
  };
}

/* ---- persistence (sessionStorage, guarded) ------------------------------ */

var storageOK = true;
function saveState(s) {
  if (!storageOK) return;
  try {
    var snap = JSON.parse(JSON.stringify(s));
    snap.shiftArmed = false;           // never persist an armed shift
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(snap));
  } catch (e) { storageOK = false; }   // private browsing / file:// quirks
}
function loadState() {
  if (!storageOK) return null;
  try {
    var raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    var s = JSON.parse(raw);
    if (!s || s.v !== VERSION) return null;   // schema mismatch → fresh start
    var d = defaultState();
    for (var k in d) { if (!(k in s)) s[k] = d[k]; }  // forward-fill fields
    s.shiftArmed = false;
    return s;
  } catch (e) { storageOK = false; return null; }
}
function clearStorage() {
  try { window.sessionStorage.removeItem(STORE_KEY); } catch (e) {}
}

/* ========================= §2 NUMBER FORMATTING =========================== */
/* The device does decimal arithmetic on a 12-digit mantissa and rounds the
 * DISPLAY half-away-from-zero. JS doubles are binary, so we format from the
 * canonical shortest decimal string of the value (String(v)) and round digit
 * by digit — this reproduces e.g. 6.9×5.35 = 36.915 → "36.92" exactly as the
 * device does (a naive Math.round would give 36.91).                          */

function canonParts(v) {
  // returns {neg, int, frac} for plain form or {sci:true, neg, mant, exp}
  var neg = v < 0;
  var a = Math.abs(v);
  if (a === 0) return { neg: false, int: '0', frac: '' };
  var s = String(a);                    // shortest round-trip decimal
  var eIdx = s.indexOf('e');
  if (eIdx >= 0) {
    var mantStr = s.slice(0, eIdx).replace('.', '');
    var exp = parseInt(s.slice(eIdx + 1), 10);
    return sciParts(mantStr, exp, neg);
  }
  var dot = s.indexOf('.');
  if (dot < 0) return { neg: neg, int: s, frac: '' };
  return { neg: neg, int: s.slice(0, dot), frac: s.slice(dot + 1) };
}
function sciParts(mantStr, exp, neg) {
  // normalize to one leading digit: mant = d.ddd..., exp adjusted
  var digits = mantStr.replace(/^0+(?=\d)/, '');
  if (!digits) return { sci: true, neg: !!neg, mant: '0', frac: '', exp: 0 };
  var mInt = digits.charAt(0), mFrac = digits.slice(1);
  var e = exp + (mantStr.indexOf('.') >= 0 ? 0 : (digits.length - 1));
  if (mantStr.indexOf('.') >= 0) e = exp; // mantissa already d.ddd form
  return { sci: true, neg: !!neg, int: mInt, frac: mFrac, exp: e };
}

/* Round the decimal digit string half-AWAY-FROM-ZERO to `dp` places. */
function roundDigits(intStr, fracStr, dp) {
  var keep = (fracStr + '0'.repeat(dp)).slice(0, dp);
  var combined = BigInt(intStr + keep);
  if (fracStr.charAt(dp) >= '5') combined += 1n;
  var digits = combined.toString().padStart(dp + 1, '0');
  return { int: dp ? digits.slice(0, -dp) : digits,
    frac: dp ? digits.slice(-dp) : '' };
}

function groupInt(intStr, sep) {
  var g = '', s = intStr;
  while (s.length > 3) { g = sep + s.slice(-3) + g; s = s.slice(0, -3); }
  return s + g;
}

/* Main formatter: value → display string (≤12 chars incl. sign/sep). */
function formatValue(v, disp, sep) {
  if (!isFinite(v)) v = (v > 0 ? 1 : -1) * Math.pow(10, 308); // clamp overflow
  if (Object.is(v, -0) || v === 0) v = 0;
  var decSep = sep, grpSep = (sep === '.') ? ',' : '.';

  function sci(mantDigits, expVal, dp) {
    // "1.00E14" / "4.00E-12" style: mantissa with `dp` decimals + E + signed exp
    var m = mantDigits;
    while (m.length <= dp) m += '0';
    var mm = m.charAt(0) + decSep + m.slice(1, 1 + dp);
    return mm + 'E' + (expVal < 0 ? '-' : '') + String(Math.abs(expVal));
  }

  if (v === 0) {
    return disp > 0 ? '0' + decSep + new Array(disp + 1).join('0') : '0';
  }
  var p = canonParts(v);
  var neg = p.neg;

  if (p.sci) {
    // value naturally in scientific range → device shows E notation
    var digits = p.int + p.frac;
    return sci(digits, p.exp, disp > 0 ? disp : 1);
  }

  if (disp === 0) {
    /* full-precision mode: all significant digits, no trailing zeros */
    var f2 = p.frac.replace(/0+$/, '');
    var out = p.int + (f2 ? decSep + f2 : '');
    if ((neg ? 1 : 0) + out.length > 12) {
      return sci((p.int + p.frac).replace(/^0+(?=\d)/, ''), expOf(p), disp === 0 ? 9 : 0);
    }
    return (neg ? '-' : '') + groupInt(out.split(decSep)[0] || out, grpSep) + (f2 ? decSep + f2 : '');
  }

  var r = roundDigits(p.int, p.frac, disp);
  var body = r.int + (disp > 0 ? decSep + r.frac : '');
  if ((neg ? 1 : 0) + body.length > 12) {
    return sci((p.int + p.frac).replace(/^0+(?=\d)/, ''), expOf(p), disp);
  }
  return (neg ? '-' : '') + groupInt(r.int, grpSep) + (disp > 0 ? decSep + r.frac : '');
}
function expOf(p) {
  // exponent such that value = ±(int.frac)×10^exp with int having one digit
  var digits = p.int.replace(/^0+(?=\d)/, '') + p.frac;
  if (!digits || /^0+$/.test(digits)) return 0;
  var dotPos = p.int.replace(/^0+(?=\d)/, '').length - 1;
  return (p.exp || 0) + dotPos;
}

/* Round a stored value to `dp` decimal places half-away-from-zero (RND key). */
function roundValue(v, dp) {
  if (v === 0 || !isFinite(v)) return v;
  var p = canonParts(v);
  if (p.sci) return v; // scientific-range rounding is handled separately later
  var r = roundDigits(p.int, p.frac, dp);
  var s = r.int + '.' + (r.frac || '0');
  var out = parseFloat(s);
  return (v < 0 ? -out : out) || 0;
}

/* Parse the entry buffer string ("−12.5E-3" style, ASCII '-' sign). */
function parseEntry(buf) {
  if (!buf || buf === '-' || buf === '.') return 0;
  var t = buf;
  if (/e-?$/.test(t)) t = t.replace(/e-?$/, '');   // incomplete exponent → base
  var v = parseFloat(t);
  return isFinite(v) ? v : 0;
}


/* ========================= §3 DISPLAY & MESSAGES ========================== */

var dom = {};   // populated in init()
function render() {
  if (!dom.main) return;
  var s = state;
  if (!s.power) {
    dom.main.textContent = '';
    dom.cursor.hidden = true;
    setAnnunciators(s);
    return;
  }
  var text;
  if (s.msg && s.msg.kind === 'error') {
    text = s.msg.text;                       // errors replace the value line
  } else if (s.msg && s.msg.kind === 'status' && !s.label) {
    text = s.msg.text;
  } else {
    text = s.entering ? (s.entry || '0').replace('.', s.modes.sep).replace('e', 'E')
      : formatValue(s.displayVal, s.modes.disp, s.modes.sep);
  }
  dom.main.textContent = text;
  dom.cursor.hidden = !(s.entering && !s.msg);
  setAnnunciators(s);
}
function setAnnunciators(s) {
  dom.annShift.classList.toggle('active', s.power && s.shiftArmed);
  dom.annInput.classList.toggle('active', s.power && (s.inputArmed || !!s.twoVal));
  dom.annPend.classList.toggle('active', s.power && !!s.pendOp);
  dom.annBegin.classList.toggle('active', s.power && s.modes.annuity === 'BEGIN');
  dom.labelEl.textContent = s.power ? (s.label || '') : '';
}

/* Messages ----------------------------------------------------------------- */
function setStatus(text) {
  state.msg = { text: text, kind: 'status', restore: null };
  state.label = null;
  saveState(state); render();
}
function setError(text) {
  // device: C or ◄ clears the message AND restores original display contents
  state.msg = { text: text, kind: 'error', restore: state.displayVal };
  state.entry = ''; state.entering = false;
  state.pendOp = null; state.first = null;
  state.other = null; state.inputArmed = false;
  state.label = null; state.twoVal = null;
  saveState(state); render();
}
function clearMessage() {
  if (!state.msg) return false;
  if (state.msg.kind === 'error' && typeof state.msg.restore === 'number') {
    state.displayVal = state.msg.restore;
  }
  state.msg = null;
  saveState(state); render();
  return true;
}

/* ===================== §4 ENTRY & IMMEDIATE ARITHMETIC ==================== */

function commitEntry() {
  // move in-progress buffer into displayVal (called before any op/function)
  if (state.entering || state.entry !== '') {
    state.displayVal = parseEntry(state.entry);
    state.entry = '';
    state.entering = false;
  }
}

function pressDigit(d) {
  var s = state;
  if (!s.power) return;
  if (s.msg && s.msg.kind === 'error') return;   // only C/◄ work in error
  if (s.rclMode) { registerSelect(d); return; }  // STO/RCL two-step selection
  if (s.msg && s.msg.kind === 'status') clearMessage();
  if (!s.entering) {
    s.entry = ''; s.entering = true;
    s.label = null; s.twoVal = null;             // new entry starts fresh
  }
  var em = /^-?[0-9.]*[Ee]-?\d*$/.test(s.entry)
    ? s.entry.match(/^(.*?[Ee])(-?)(\d*)$/) : null;
  if (em) {
    // typing in the exponent part (max 3 digits, one sign)
    if (em[3].length < 3) s.entry = em[1] + em[2] + em[3] + d;
    saveState(s); render(); return;
  }
  var core = s.entry.replace('-', '');
  if (core.length >= MAX_DIGITS) return;   // 12-digit mantissa cap
  if (s.entry === '0' || s.entry === '-0') s.entry = (s.entry.charAt(0) === '-' ? '-' : '') + d;
  else s.entry += d;
  saveState(s); render();
}

function pressDecimal() {
  var s = state;
  if (!s.power) return;
  if (s.msg && s.msg.kind === 'error') return;
  if (s.rclMode) { registerSelect('.'); return; } // '.' selects R.0–R.4 registers
  if (s.msg && s.msg.kind === 'status') clearMessage();
  if (!s.entering) { s.entry = ''; s.entering = true; s.label = null; s.twoVal = null; }
  var base = s.entry.replace(/E.*$/, '');
  if (base.indexOf('.') < 0 && !/E/i.test(s.entry)) s.entry += '.';
  saveState(s); render();
}

function pressSign() {
  var s = state;
  if (!s.power) return;
  if (s.msg && s.msg.kind === 'error') return;
  if (s.rclMode) { s.rclMode = null; saveState(s); render(); return; } // cancel
  if (s.entering && /e$/i.test(s.entry)) {
    s.entry += '-';                             // "…E" → negative exponent marker
    saveState(s); render(); return;
  }
  var em2 = s.entering ? s.entry.match(/^(.*?[Ee])(-?)(\d+)$/) : null;
  if (em2) {
    s.entry = em2[1] + (em2[2] ? '' : '-') + em2[3];   // toggle exponent sign
    saveState(s); render(); return;
  }
  if (s.entering) s.entry = s.entry.charAt(0) === '-' ? s.entry.slice(1) : '-' + s.entry;
  else s.displayVal = -s.displayVal || 0;
  saveState(s); render();
}

function pressE() {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  if (s.rclMode) { s.rclMode = null; saveState(s); render(); return; }
  if (s.msg && s.msg.kind === 'status') clearMessage();
  if (!s.entering) { s.entry = ''; s.entering = true; s.label = null; s.twoVal = null; }
  if (/E/i.test(s.entry)) return;               // one E per entry
  var base = s.entry.replace(/^-/, '');
  if (base === '' || base === '.') base = '1';
  s.entry = (s.entry.charAt(0) === '-' ? '-' : '') + base + 'e';
  saveState(s); render();
}

function pressBackspace() {
  var s = state;
  if (!s.power) return;
  if (s.msg && s.msg.kind === 'error') { clearMessage(); return; }
  if (s.rclMode) { s.rclMode = null; saveState(s); render(); return; } // cancel step
  if (s.entering) {
    s.entry = s.entry.slice(0, -1);
    if (s.entry === '' || s.entry === '-') { s.entry = ''; s.entering = false; }
    saveState(s); render();
    return;
  }
  // not entering: clear display + cancel current calculation
  hardClearEntry();
}

function pressC() {
  var s = state;
  if (!s.power) { powerOn(); return; }          // C is the ON key when off
  if (s.msg && s.msg.kind === 'error') { clearMessage(); return; }
  if (s.rclMode) { s.rclMode = null; saveState(s); render(); return; }
  hardClearEntry();
}

function hardClearEntry() {
  var s = state;
  s.entry = ''; s.entering = false;
  s.displayVal = 0;
  s.pendOp = null; s.first = null;
  s.other = null; s.inputArmed = false;
  s.label = null; s.twoVal = null;
  s.msg = null;
  saveState(s); render();
}

/* Binary operators (+ − × ÷ y^x) ------------------------------------------- */
function pressOp(op) {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  if (s.pendOp && s.first !== null) {
    // execute pending op first (immediate execution, no precedence)
    var r = applyBinary(s.pendOp, s.first, s.displayVal);
    if (typeof r !== 'number') { setError('Error - Func'); return; }
    s.displayVal = r;
  }
  s.pendOp = op; s.first = s.displayVal;
  s.other = null; s.inputArmed = false;
  s.label = null; s.twoVal = null;
  saveState(s); render();
}

function applyBinary(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': if (b === 0) return 'ERR_DIV'; return a / b;
    case '^': {
      if (a < 0 && Math.floor(b) !== b) return 'ERR_FUNC';   // neg base, non-int exp
      var r = Math.pow(a, b);
      if (!isFinite(r)) return 'ERR_FUNC';
      return r;
    }
  }
  return a;
}

function pressEquals() {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  closeAllParens(false);
  if (s.pendOp && s.first !== null) {
    var r = applyBinary(s.pendOp, s.first, s.displayVal);
    if (r === 'ERR_DIV') { setError('Error - Func'); return; }
    if (r === 'ERR_FUNC') { setError('Error - Func'); return; }
    s.lastBin = { op: s.pendOp, b: s.displayVal };   // automatic constant
    s.displayVal = r;
    s.pendOp = null; s.first = null;
  } else if (s.constOp) {
    /* K-constant active: apply stored operation to the display value */
    var c = s.constOp;
    var d = s.displayVal;
    var cv = c.pct ? d * (c.val / 100) : c.val;
    var res;
    switch (c.op) {
      case '+': res = d + (c.pct ? d * c.val / 100 : c.val); break;
      case '-': res = d - (c.pct ? d * c.val / 100 : c.val); break;
      case '*': res = d * cv; break;
      case '/': if (cv === 0) { setError('Error - Func'); return; } res = d / cv; break;
      case '^': res = Math.pow(d, cv); if (!isFinite(res)) { setError('Error - Func'); return; } break;
    }
    s.displayVal = res;
  } else if (s.lastBin) {
    /* automatic constant: repeat last binary op on the result */
    var r2 = applyBinary(s.lastBin.op, s.displayVal, s.lastBin.b);
    if (r2 === 'ERR_DIV' || r2 === 'ERR_FUNC') { setError('Error - Func'); return; }
    s.displayVal = r2;
  }
  saveState(s); render();
}

/* Parentheses: '(' pushes pending context, ')' pops one level, '=' closes all */
function pressParenOpen() {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  if (s.parenStack.length >= MAX_PARENS) { setError('Error - Full'); return; }
  s.parenStack.push({ op: s.pendOp, first: s.first });
  s.pendOp = null; s.first = null;
  saveState(s); render();
}
function pressParenClose() {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  closeOneParen();
  saveState(s); render();
}
function closeAllParens(executePending) {
  var s = state;
  while (s.parenStack.length) {
    if (executePending && s.pendOp && s.first !== null) {
      var r = applyBinary(s.pendOp, s.first, s.displayVal);
      if (r === 'ERR_DIV' || r === 'ERR_FUNC') return false;
      s.displayVal = r; s.pendOp = null; s.first = null;
    }
    closeOneParen();
  }
  return true;
}
function closeOneParen() {
  var s = state;
  if (!s.parenStack.length) return;
  // finish any pending op inside this level first
  if (s.pendOp && s.first !== null) {
    var r = applyBinary(s.pendOp, s.first, s.displayVal);
    if (r === 'ERR_DIV' || r === 'ERR_FUNC') { setError('Error - Func'); return; }
    s.displayVal = r; s.pendOp = null; s.first = null;
  }
  var saved = s.parenStack.pop();
  if (saved.op && saved.first !== null) {
    var r2 = applyBinary(saved.op, saved.first, s.displayVal);
    if (r2 === 'ERR_DIV' || r2 === 'ERR_FUNC') { setError('Error - Func'); return; }
    s.displayVal = r2;
  }
}

/* INPUT — separates two numbers for two-number functions ------------------- */
function pressInput() {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  closeAllParens(true);
  if (s.pendOp && s.first !== null) {          // finish pending op first
    var r = applyBinary(s.pendOp, s.first, s.displayVal);
    if (r === 'ERR_DIV' || r === 'ERR_FUNC') { setError('Error - Func'); return; }
    s.displayVal = r; s.pendOp = null; s.first = null;
  }
  if (s.other === null) {
    s.other = s.displayVal;                    // hold first value
    s.inputArmed = true;                       // ':' annunciator
  } else {
    /* second value entered: two-number context complete — functions like
     * %CHG / stats Σ+ consume (other, displayVal) when pressed */
    s.inputArmed = false;
  }
  saveState(s); render();
}

/* SWAP — exchange last two numbers / hidden second result of a pair -------- */
function pressSwap() {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  if (s.twoVal) {                              // toggle x̄↔ȳ, Sx↔Sy, x̂↔r, ŷ↔m …
    s.twoVal.shown = (s.twoVal.shown === 'a') ? 'b' : 'a';
  } else if (s.pendOp && s.first !== null) {   // swap last two numbers entered
    var t = s.first; s.first = s.displayVal; s.displayVal = t;
  } else if (s.other !== null) {               // swap the INPUT pair
    var u = s.other; s.other = s.displayVal; s.displayVal = u;
  }
  saveState(s); render();
}

/* ===================== §5 KEY DISPATCH AND INITIALIZATION ================= */
var state;
var dispatch = {
  DECIMAL: pressDecimal, NEGATE: pressSign, SCI_E: pressE,
  BACK: pressBackspace, CLEAR: pressC, INPUT: pressInput,
  EQUALS: pressEquals, SWAP: pressSwap,
  ADD: function () { pressOp('+'); }, SUB: function () { pressOp('-'); },
  MUL: function () { pressOp('*'); }, DIV: function () { pressOp('/'); },
  YX: function () { pressOp('^'); },
  SHIFT: function () { state.shiftArmed = !state.shiftArmed; saveState(state); render(); },
  BEGEND: function () { state.modes.annuity = state.modes.annuity === 'END' ? 'BEGIN' : 'END'; saveState(state); render(); },
  PERIOD_COMMA: function () { state.modes.sep = state.modes.sep === '.' ? ',' : '.'; saveState(state); render(); },
  RND: function () { commitEntry(); state.displayVal = roundValue(state.displayVal, state.modes.disp); saveState(state); render(); },
  SQUARE: function () { commitEntry(); state.displayVal *= state.displayVal; saveState(state); render(); },
  SQRT: function () { commitEntry(); if (state.displayVal < 0) setError('Error - Func'); else { state.displayVal = Math.sqrt(state.displayVal); saveState(state); render(); } },
  RECIP: function () { commitEntry(); if (!state.displayVal) setError('Error - Func'); else { state.displayVal = 1 / state.displayVal; saveState(state); render(); } },
  EXP: function () { commitEntry(); state.displayVal = Math.exp(state.displayVal); saveState(state); render(); },
  LN: function () { commitEntry(); if (state.displayVal <= 0) setError('Error - Func'); else { state.displayVal = Math.log(state.displayVal); saveState(state); render(); } },
  OFF: function () { state = defaultState(); state.power = false; clearStorage(); render(); }
};

function handleKey(key) {
  if (!state.power && key !== 'CLEAR') return;
  if (/^[0-9]$/.test(key)) { pressDigit(key); return; }
  var action = dispatch[key];
  if (action) action();
}

function init() {
  dom.main = document.getElementById('lcd-text');
  dom.annShift = document.getElementById('ann-shift');
  dom.annInput = document.getElementById('ann-input');
  dom.annPend = document.getElementById('ann-pend');
  dom.annBegin = document.getElementById('ann-begin');
  dom.cursor = document.getElementById('lcd-cursor');
  dom.labelEl = document.getElementById('lcd-label');
  state = loadState() || defaultState();
  document.getElementById('keypad').addEventListener('click', function (event) {
    var button = event.target.closest('button[data-key]');
    if (!button) return;
    var key = state.shiftArmed && button.dataset.shift ? button.dataset.shift : button.dataset.key;
    if (key !== 'SHIFT' && state.shiftArmed) {
      state.shiftArmed = false;
      saveState(state);
    }
    handleKey(key);
    render();
  });
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})(window);

