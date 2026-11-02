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
    marginBasis: 'MAR',
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
    shiftArmed: false,    // transient; forced false on restore
    dispArmed: false,
    decimalRegister: false
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
    return (neg ? '-' : '') + sci(digits, p.exp, disp > 0 ? disp : 1);
  }

  if (disp === 0) {
    /* full-precision mode: all significant digits, no trailing zeros */
    var f2 = p.frac.replace(/0+$/, '');
    var out = p.int + (f2 ? decSep + f2 : '');
    if ((neg ? 1 : 0) + out.length > 12) {
      return (neg ? '-' : '') + sci((p.int + p.frac).replace(/^0+(?=\d)/, ''), expOf(p), 9);
    }
    return (neg ? '-' : '') + groupInt(out.split(decSep)[0] || out, grpSep) + (f2 ? decSep + f2 : '');
  }

  var r = roundDigits(p.int, p.frac, disp);
  var body = r.int + (disp > 0 ? decSep + r.frac : '');
  if ((neg ? 1 : 0) + body.length > 12) {
    return (neg ? '-' : '') + sci((p.int + p.frac).replace(/^0+(?=\d)/, ''), expOf(p), disp);
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
  if (s.dispArmed) { s.modes.disp = Number(d); s.dispArmed = false; saveState(s); render(); return; }
  if (s.decimalRegister && s.rclMode) { registerSelect('.' + d); return; }
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
  var core = s.entry.replace('-', '').replace('.', '');
  if (core.length >= MAX_DIGITS) return;   // 12-digit mantissa cap
  if (s.entry === '0' || s.entry === '-0') s.entry = (s.entry.charAt(0) === '-' ? '-' : '') + d;
  else s.entry += d;
  saveState(s); render();
}

function pressDecimal() {
  var s = state;
  if (!s.power) return;
  if (s.msg && s.msg.kind === 'error') return;
  if (s.rclMode) { s.decimalRegister = true; saveState(s); render(); return; }
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
    s.displayVal = s.twoVal[s.twoVal.shown];
  } else if (s.pendOp && s.first !== null) {   // swap last two numbers entered
    var t = s.first; s.first = s.displayVal; s.displayVal = t;
  } else if (s.other !== null) {               // swap the INPUT pair
    var u = s.other; s.other = s.displayVal; s.displayVal = u;
  }
  saveState(s); render();
}

/* ===================== §5 KEY DISPATCH AND INITIALIZATION ================= */
var state;
function result(value) {
  if (!isFinite(value)) { setError('Error - Func'); return; }
  state.displayVal = value; state.entry = ''; state.entering = false;
  state.other = null; state.inputArmed = false;
  saveState(state); render();
}
function businessRegister(name) {
  if (state.entering) { commitEntry(); state[name] = state.displayVal; }
  else state.displayVal = state[name];
  saveState(state); render();
}
function validPeriods() {
  return Number.isFinite(state.PYR) && state.PYR > 0;
}
function effectiveRate() {
  if (!validPeriods() || 1 + state.IYR / (100 * state.PYR) <= 0) { setError('Error - Func'); return; }
  result(100 * Math.expm1(state.PYR * Math.log1p(state.IYR / (100 * state.PYR))));
  state.EFF = state.displayVal; saveState(state);
}
function nominalRate() {
  if (state.entering) { businessRegister('IYR'); return; }
  if (!validPeriods() || 1 + state.EFF / 100 <= 0) { setError('Error - Func'); return; }
  result(100 * state.PYR * Math.expm1(Math.log1p(state.EFF / 100) / state.PYR));
  state.IYR = state.displayVal; saveState(state);
}
function effectiveKey() {
  if (state.entering) { businessRegister('EFF'); return; }
  effectiveRate();
}
function paymentFactor(rate, periods) {
  if (Math.abs(rate) < 1e-12) return periods;
  return Math.expm1(periods * Math.log1p(rate)) / rate;
}
function tvmBalance(rate) {
  if (rate <= -1 || !Number.isFinite(rate)) return NaN;
  var growth = Math.exp(state.N * Math.log1p(rate));
  var timing = state.modes.annuity === 'BEGIN' ? 1 + rate : 1;
  return state.PV * growth + state.PMT * timing * paymentFactor(rate, state.N) + state.FV;
}
function solveRate() {
  var points = [-0.999999999, -0.99, -0.9, -0.5, -0.1, -0.01, -0.001, 0];
  for (var p = -5; p <= 6; p += 0.2) points.push(Math.pow(10, p));
  var low, high, fl;
  for (var j = 0; j < points.length - 1; j++) {
    var fa = tvmBalance(points[j]), fb = tvmBalance(points[j + 1]);
    if (fa === 0) return points[j];
    if (Number.isFinite(fa) && Number.isFinite(fb) && fa * fb < 0) {
      low = points[j]; high = points[j + 1]; fl = fa; break;
    }
  }
  if (low === undefined) return NaN;
  for (var k = 0; k < 120; k++) {
    var mid = (low + high) / 2, fm = tvmBalance(mid);
    if (!Number.isFinite(fm)) return NaN;
    if (Math.abs(fm) < 1e-12 || high - low < 1e-14 * Math.max(1, Math.abs(mid))) return mid;
    if (fl * fm <= 0) high = mid;
    else { low = mid; fl = fm; }
  }
  return (low + high) / 2;
}
function solveTvm(name) {
  if (!validPeriods() || !Number.isFinite(state.N)) { setError('Error - Func'); return; }
  var rate = state.IYR / (100 * state.PYR);
  if (rate <= -1) { setError('Error - Func'); return; }
  var growth = Math.exp(state.N * Math.log1p(rate));
  var factor = paymentFactor(rate, state.N) * (state.modes.annuity === 'BEGIN' ? 1 + rate : 1);
  var value;
  if (name === 'FV') value = -state.PV * growth - state.PMT * factor;
  else if (name === 'PV') value = -(state.FV + state.PMT * factor) / growth;
  else if (name === 'PMT') value = -(state.PV * growth + state.FV) / factor;
  else if (name === 'N') {
    if (Math.abs(rate) < 1e-12) value = -(state.PV + state.FV) / state.PMT;
    else {
      var payment = state.PMT * (state.modes.annuity === 'BEGIN' ? 1 + rate : 1) / rate;
      var ratio = (payment - state.FV) / (state.PV + payment);
      value = ratio > 0 ? Math.log(ratio) / Math.log1p(rate) : NaN;
    }
  } else if (name === 'IYR') value = solveRate() * state.PYR * 100;
  if (!Number.isFinite(value) || (name === 'N' && value < 0)) { setError('Error - Func'); return; }
  state[name] = value;
  result(value);
}
function tvmKey(name) {
  if (state.entering) businessRegister(name);
  else solveTvm(name);
}
function registerSelect(key) {
  var index = key.charAt(0) === '.' ? 10 + Number(key.charAt(1)) : Number(key);
  if (!Number.isInteger(index) || index < 0 || index >= state.R.length) return;
  if (state.rclMode === 'STO') { commitEntry(); state.R[index] = state.displayVal; }
  else result(state.R[index]);
  state.rclMode = null; state.decimalRegister = false;
  saveState(state); render();
}
function clearAll() {
  var modes = state.modes;
  state = defaultState(); state.modes = modes;
  saveState(state); render();
}
function percent() {
  commitEntry();
  if (state.pendOp && state.first !== null) result(state.first * state.displayVal / 100);
  else if (state.other !== null) result(state.other ? state.displayVal / state.other * 100 : NaN);
  else result(state.displayVal / 100);
}
function percentChange() {
  commitEntry();
  if (state.other === null || state.other === 0) { setError('Error - Func'); return; }
  result((state.displayVal - state.other) / state.other * 100);
}
function factorial() {
  commitEntry();
  var n = state.displayVal;
  if (!Number.isInteger(n) || n < 0 || n > 170) { setError('Error - Func'); return; }
  var value = 1;
  for (var i = 2; i <= n; i++) value *= i;
  result(value);
}
function marginResult(markup) {
  var value;
  if (markup) value = state.CST ? (state.PRC - state.CST) / state.CST * 100 : NaN;
  else value = state.PRC ? (state.PRC - state.CST) / state.PRC * 100 : NaN;
  if (!Number.isFinite(value)) { setError('Error - Func'); return; }
  state.MAR = value; state.marginBasis = markup ? 'MU' : 'MAR'; result(value);
}
function solveBusinessRegister(name) {
  if (state.entering) { businessRegister(name); return; }
  if (name === 'CST') {
    var margin = state.MAR;
    result(state.marginBasis === 'MU' ? state.PRC / (1 + margin / 100) : state.PRC * (1 - margin / 100));
    state.CST = state.displayVal;
  } else if (name === 'PRC') {
    var markup = state.MAR;
    result(state.marginBasis === 'MU' ? state.CST * (1 + markup / 100) : state.CST / (1 - markup / 100));
    state.PRC = state.displayVal;
  }
  saveState(state);
}
function amortize() {
  if (state.entering) {
    var periods = Math.round(parseEntry(state.entry));
    if (periods < 1 || periods > 999 || periods !== parseEntry(state.entry)) { setError('Error - Func'); return; }
    state.amort = { periods: periods, done: 0, balance: state.PV, interest: 0, principal: 0, stage: 0 };
  }
  var a = state.amort;
  if (!a || !validPeriods() || !Number.isFinite(state.PMT)) { setError('Error - Func'); return; }
  if (a.stage === 0) {
    a.interest = 0; a.principal = 0;
    var rate = state.IYR / (100 * state.PYR);
    for (var i = 0; i < a.periods; i++) {
      var interest = a.balance * rate;
      var principal = -state.PMT - interest;
      a.interest += interest;
      a.principal += principal;
      a.balance -= principal;
      a.done++;
    }
    a.stage = 1; state.label = 'Int'; result(a.interest);
  } else if (a.stage === 1) {
    a.stage = 2; state.label = 'Prin'; result(a.principal);
  } else {
    a.stage = 0; state.label = 'bAL'; result(a.balance);
  }
  state.amort = a; saveState(state); render();
}
function enterCashFlow() {
  commitEntry();
  if (state.cfs.length >= MAX_CF_GROUPS) { setError('Error - Full'); return; }
  state.cfs.push({ cf: state.displayVal, nj: 1 });
  state.cfView = state.cfs.length - 1;
  state.label = 'CF ' + state.cfView;
  saveState(state); render();
}
function setCashFlowCount() {
  commitEntry();
  var n = Math.round(state.displayVal);
  if (!state.cfs.length || n < 1 || n > 99 || Math.abs(n - state.displayVal) > 1e-10) {
    setError('Error - Func'); return;
  }
  state.cfs[state.cfs.length - 1].nj = n;
  state.label = 'n ' + n;
  saveState(state); render();
}
function cashFlowNpv(periodRate) {
  if (periodRate <= -1 || !Number.isFinite(periodRate) || !state.cfs.length) return NaN;
  var total = state.cfs[0].cf;
  var period = 0;
  for (var i = 1; i < state.cfs.length; i++) {
    var flow = state.cfs[i];
    for (var j = 0; j < flow.nj; j++) {
      period++;
      total += flow.cf * Math.exp(-period * Math.log1p(periodRate));
    }
  }
  return total;
}
function npvResult() {
  if (!validPeriods() || 1 + state.IYR / 100 <= 0) { setError('Error - Func'); return; }
  var rate = Math.expm1(Math.log1p(state.IYR / 100) / state.PYR);
  result(cashFlowNpv(rate));
}
function solveIrrPeriod() {
  var points = [-0.999999999, -0.99, -0.9, -0.5, -0.1, -0.01, 0];
  for (var p = -5; p <= 6; p += 0.1) points.push(Math.pow(10, p));
  var roots = [];
  for (var i = 0; i < points.length - 1; i++) {
    var lo = points[i], hi = points[i + 1];
    var flo = cashFlowNpv(lo), fhi = cashFlowNpv(hi);
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) continue;
    if (flo === 0) { roots.push(lo); continue; }
    for (var k = 0; k < 100; k++) {
      var mid = (lo + hi) / 2, fm = cashFlowNpv(mid);
      if (!Number.isFinite(fm)) break;
      if (Math.abs(fm) < 1e-10 || hi - lo < 1e-13 * Math.max(1, Math.abs(mid))) { lo = hi = mid; break; }
      if (flo * fm <= 0) hi = mid;
      else { lo = mid; flo = fm; }
    }
    roots.push((lo + hi) / 2);
  }
  if (!roots.length) return NaN;
  var positive = roots.filter(function (r) { return r > 0; });
  return positive.length ? Math.min.apply(Math, positive) : roots[0];
}
function irrResult() {
  if (!validPeriods()) { setError('Error - Func'); return; }
  var rate = solveIrrPeriod();
  if (!Number.isFinite(rate)) { setError('Error - Func'); return; }
  result(100 * Math.expm1(state.PYR * Math.log1p(rate)));
}
function accumulateStats(sign) {
  commitEntry();
  var x = state.other === null ? state.displayVal : state.other;
  var y = state.other === null ? 0 : state.displayVal;
  var st = state.stats;
  st.n += sign;
  st.sx += sign * x;
  st.sx2 += sign * x * x;
  st.sy += sign * y;
  st.sy2 += sign * y * y;
  st.sxy += sign * x * y;
  if (Math.abs(st.n) < 1e-12) state.stats = defaultState().stats;
  state.other = null; state.inputArmed = false;
  state.label = null; saveState(state); render();
}
function statsPair(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) { setError('Error - Func'); return; }
  state.twoVal = { a: a, b: b, shown: 'a' };
  result(a);
  state.twoVal = { a: a, b: b, shown: 'a' };
  saveState(state); render();
}
function statFunction(kind) {
  var s = state.stats, n = s.n;
  if (n <= 0) { setError('Error - Func'); return; }
  var xbar = s.sx / n, ybar = s.sy / n;
  var dx = s.sx2 - s.sx * s.sx / n;
  var dy = s.sy2 - s.sy * s.sy / n;
  var cross = s.sxy - s.sx * s.sy / n;
  var slopeDen = n * s.sx2 - s.sx * s.sx;
  var slope = slopeDen ? (n * s.sxy - s.sx * s.sy) / slopeDen : NaN;
  var corrDen = Math.sqrt(Math.max(0, dx * dy));
  var corr = corrDen ? cross / corrDen : NaN;
  var x = state.displayVal;
  if (kind === 'MEAN') { statsPair(xbar, ybar); return; }
  if (kind === 'SAMPLE') {
    if (n <= 1) { setError('Error - Func'); return; }
    statsPair(Math.sqrt(Math.max(0, dx / (n - 1))), Math.sqrt(Math.max(0, dy / (n - 1)))); return;
  }
  if (kind === 'POP') { statsPair(Math.sqrt(Math.max(0, dx / n)), Math.sqrt(Math.max(0, dy / n))); return; }
  if (kind === 'XR') { statsPair(slope ? (x - (ybar - slope * xbar)) / slope : NaN, corr); return; }
  if (kind === 'YM') { statsPair(ybar + slope * (x - xbar), slope); return; }
  if (kind === 'WEIGHTED') {
    var weighted = s.sy ? s.sxy / s.sy : NaN;
    result(weighted); return;
  }
}
var dispatch = {
  DECIMAL: pressDecimal, NEGATE: pressSign, SCI_E: pressE,
  BACK: pressBackspace, CLEAR: pressC, INPUT: pressInput,
  EQUALS: pressEquals, SWAP: pressSwap,
  ADD: function () { pressOp('+'); }, SUB: function () { pressOp('-'); },
  MUL: function () { pressOp('*'); }, DIV: function () { pressOp('/'); },
  YX: function () { pressOp('^'); },
  PCT: percent, PCTCHG: percentChange, FACT: factorial,
  N: function () { tvmKey('N'); }, IYR: function () { tvmKey('IYR'); },
  PV: function () { tvmKey('PV'); }, PMT: function () { tvmKey('PMT'); },
  FV: function () { tvmKey('FV'); }, CST: function () { solveBusinessRegister('CST'); },
  NOM: nominalRate, EFF: effectiveKey,
  CFJ: enterCashFlow, NJ: setCashFlowCount,
  NPV: npvResult, IRR: irrResult,
  SIGMA_PLUS: function () { accumulateStats(1); },
  SIGMA_MINUS: function () { accumulateStats(-1); },
  XBAR_YBAR: function () { statFunction('MEAN'); },
  SX_SY: function () { statFunction('SAMPLE'); },
  SIGMAX_SIGMAY: function () { statFunction('POP'); },
  XHAT_R: function () { statFunction('XR'); },
  YHAT_M: function () { statFunction('YM'); },
  XBARW: function () { statFunction('WEIGHTED'); },
  PRC: function () { solveBusinessRegister('PRC'); }, MAR: function () {
    if (state.entering) businessRegister('MAR'); else marginResult(false);
  },
  MU: function () { marginResult(true); }, AMORT: amortize,
  LPAREN: pressParenOpen, RPAREN: pressParenClose,
  PYR: function () { businessRegister('PYR'); },
  XPYR: function () { commitEntry(); result(state.displayVal * state.PYR); },
  TO_M: function () { commitEntry(); state.M = state.displayVal; saveState(state); render(); },
  RM: function () { result(state.M); },
  M_PLUS: function () { commitEntry(); state.M += state.displayVal; saveState(state); render(); },
  RCL: function () { state.rclMode = 'RCL'; saveState(state); render(); },
  STO: function () { state.rclMode = 'STO'; saveState(state); render(); },
  CLEARALL: clearAll,
  CLSIGMA: function () { state.stats = defaultState().stats; saveState(state); render(); },
  DISP: function () { state.dispArmed = true; saveState(state); render(); },
  SHIFT: function () { state.shiftArmed = !state.shiftArmed; saveState(state); render(); },
  BEGEND: function () { state.modes.annuity = state.modes.annuity === 'END' ? 'BEGIN' : 'END'; saveState(state); render(); },
  PERIOD_COMMA: function () { state.modes.sep = state.modes.sep === '.' ? ',' : '.'; saveState(state); render(); },
  RND: function () { commitEntry(); state.displayVal = roundValue(state.displayVal, state.modes.disp); saveState(state); render(); },
  SQUARE: function () { commitEntry(); result(state.displayVal * state.displayVal); },
  SQRT: function () { commitEntry(); if (state.displayVal < 0) setError('Error - Func'); else { state.displayVal = Math.sqrt(state.displayVal); saveState(state); render(); } },
  RECIP: function () { commitEntry(); if (!state.displayVal) setError('Error - Func'); else { state.displayVal = 1 / state.displayVal; saveState(state); render(); } },
  EXP: function () { commitEntry(); result(Math.exp(state.displayVal)); },
  LN: function () { commitEntry(); if (state.displayVal <= 0) setError('Error - Func'); else { state.displayVal = Math.log(state.displayVal); saveState(state); render(); } },
  OFF: function () { state = defaultState(); state.power = false; clearStorage(); render(); }
};

function handleKey(key) {
  if (!state.power && key !== 'CLEAR') return;
  if (state.dispArmed && key === 'CLEAR') { state.dispArmed = false; state.modes.disp = 0; saveState(state); render(); return; }
  if (/^[0-9]$/.test(key)) { pressDigit(key); return; }
  var action = dispatch[key];
  if (action) action();
}

function pressButton(button) {
  var key = state.shiftArmed && button.dataset.shift ? button.dataset.shift : button.dataset.key;
  if (key !== 'SHIFT' && state.shiftArmed) {
    state.shiftArmed = false;
    saveState(state);
  }
  if (state.rclMode === 'RCL' && /^(N|IYR|PV|PMT|FV|PYR|EFF|CST|PRC|MAR)$/.test(key)) {
    state.rclMode = null;
    result(state[key]);
    return;
  }
  handleKey(key);
  render();
}

var keySequence = '';
var shortcutKeys = {
  '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV',
  '.': 'DECIMAL', ',': 'DECIMAL', Enter: 'EQUALS', '=': 'EQUALS',
  Backspace: 'BACK', Escape: 'CLEAR', '%': 'PCT', '^': 'YX',
  '!': 'FACT', e: 'EXP', l: 'LN', s: 'SQRT', q: 'SQUARE',
  n: 'N', i: 'IYR', p: 'PV', m: 'PMT', f: 'FV', c: 'CST',
  r: 'RCL', a: 'AMORT', g: 'SWAP', v: 'INPUT', x: 'SIGMA_PLUS', y: 'MAR'
};
function handleKeyboard(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.key === 'Shift') {
    if (!state.shiftArmed) { state.shiftArmed = true; render(); }
    return;
  }
  if (event.key === ';' && !keySequence) {
    keySequence = ';'; event.preventDefault(); return;
  }
  if (keySequence) {
    event.preventDefault();
    if (/^[1-7]$/.test(event.key) && keySequence === ';') { keySequence += event.key; return; }
    if (/^[1-6]$/.test(event.key) && keySequence.length === 2) {
      var rows = document.querySelectorAll('#keypad .key-row');
      var button = rows[Number(keySequence.charAt(1)) - 1].querySelectorAll('button')[Number(event.key) - 1];
      keySequence = '';
      if (button) pressButton(button);
      return;
    }
    keySequence = '';
    return;
  }
  var key = event.key;
  if (state.shiftArmed && /^Digit[0-9]$/.test(event.code)) key = event.code.slice(-1);
  var buttonKey = /^[0-9]$/.test(key) ? key : shortcutKeys[key];
  if (!buttonKey) return;
  event.preventDefault();
  var button = document.querySelector('#keypad button[data-key="' + buttonKey + '"]');
  if (button) pressButton(button);
  else handleKey(buttonKey);
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
    pressButton(button);
  });
  document.addEventListener('keydown', handleKeyboard);
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})(window);

