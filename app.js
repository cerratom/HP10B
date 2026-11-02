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
    modes: { annuity: 'END', disp: 2, fullPrecision: false, sep: '.' },
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
    stoOp: null,          // pending STO <op> register arithmetic ('+'|'-'|'*'|'/')
    pctK: false,          // a % result just produced; K stores it as a "±n%" constant
    pctVal: null,         // the operand before % was applied (for `n [+] x [%] K`)
    dispHold: false,      // DISP then '=': temporarily view the full-precision mantissa
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
function formatValue(v, disp, sep, fullPrecision) {
  if (!isFinite(v)) v = (v > 0 ? 1 : -1) * Math.pow(10, 308); // clamp overflow
  if (Object.is(v, -0) || v === 0) v = 0;
  var decSep = sep, grpSep = (sep === '.') ? ',' : '.';

  function sci(value, requestedDp) {
    var dp = Math.max(0, requestedDp);
    var output;
    do {
      var parts = Math.abs(value).toExponential(dp).split('e');
      output = (value < 0 ? '-' : '') + parts[0].replace('.', decSep) + 'E' + String(Number(parts[1]));
      if (output.length <= 12 || dp === 0) break;
      dp--;
    } while (dp >= 0);
    return output;
  }

  if (v === 0) {
    return disp > 0 ? '0' + decSep + new Array(disp + 1).join('0') : '0';
  }
  var p = canonParts(v);
  var neg = p.neg;

  if (p.sci) {
    return sci(v, fullPrecision ? 10 : disp);
  }

  if (fullPrecision) {
    /* "DISP then hold =": 12-digit mantissa, decimal point hidden,
     * trailing zeros shown (manual p. 28: 1.42857… → 142857142857) */
    var m = Math.abs(v).toPrecision(12);            // e.g. "9.88000000000E+2"
    var mant = m.indexOf('e') >= 0 ? m.slice(0, m.indexOf('e')) : m;
    mant = mant.replace('.', '');
    if (mant.length > 12) mant = mant.slice(0, 12);
    return (neg ? '-' : '') + mant;
  }

  var r = roundDigits(p.int, p.frac, disp);
  var body = r.int + (disp > 0 ? decSep + r.frac : '');
  var fixed = (neg ? '-' : '') + groupInt(r.int, grpSep) + (disp > 0 ? decSep + r.frac : '');
  return fixed.length <= 12 ? fixed : sci(v, disp);
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
  if (p.sci) return parseFloat(v.toExponential(dp));
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
      : formatValue(s.displayVal, s.modes.disp, s.modes.sep, s.modes.fullPrecision);
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
  if (s.dispArmed) { commitEntry(); s.modes.disp = Number(d); s.modes.fullPrecision = false; s.dispArmed = false; saveState(s); render(); return; }
  if (s.decimalRegister && s.rclMode) { registerSelect('.' + d); return; }
  if (s.rclMode) { registerSelect(d); return; }  // STO/RCL two-step selection
  if (s.msg && s.msg.kind === 'status') clearMessage();
  if (!s.entering) {
    s.entry = ''; s.entering = true;
    s.label = null; s.twoVal = null;             // new entry starts fresh
    s.pctK = false;
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

function powerOn() {
  state = defaultState();
  state.power = true;
  saveState(state);
  render();
}

function hardClearEntry() {
  var s = state;
  s.entry = ''; s.entering = false;
  s.displayVal = 0;
  s.pendOp = null; s.first = null;
  s.other = null; s.inputArmed = false;
  s.label = null; s.twoVal = null;
  s.msg = null;
  s.constOp = null; s.stoOp = null; s.pctVal = null; s.pctK = false;
  if (s.amort) s.amort.stageActive = false;    // C ends the Int/Prin/bAL cycle
  saveState(s); render();
}

/* Binary operators (+ − × ÷ y^x) ------------------------------------------- */
function pressOp(op) {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  if (op === '%') { percent(); return; }
  if (s.rclMode === 'STO' && /^[+\-*/]$/.test(op)) {   // STO <op> Rn (manual p. 81)
    s.stoOp = op; saveState(s); render(); return;
  }
  if (s.constOp && !s.entering && !s.parenStack.length) {
    /* K constant active (manual p. 35): `3 [×] 5 [K] [4] [=]` → 20. The op key
     * re-arms with a new operand; a new number key clears the constant. */
    s.constOp = { op: op, val: s.displayVal, pct: false };
    s.pendOp = null; s.first = null;
    s.inputArmed = false; s.label = null; s.twoVal = null;
    saveState(s); render(); return;
  }
  if (s.pendOp && s.first !== null) {
    // execute pending op first (immediate execution, no precedence)
    var r = applyBinary(s.pendOp, s.first, s.displayVal);
    if (typeof r !== 'number') { setError('Error - Func'); return; }
    s.displayVal = r;
  }
  s.pendOp = op; s.first = s.displayVal;
  s.constOp = null;                            // operator after a number cancels K
  if (s.other === null) s.inputArmed = false;
  s.label = null; s.twoVal = null;
  saveState(s); render();
}

function pressK() {
  var s = state;
  if (!s.power || (s.msg && s.msg.kind === 'error')) return;
  commitEntry();
  if (s.constOp) { pressEquals(); return; }     // K K → apply the constant
  if (s.pctK && s.pendOp) {                      // `10 [+] 10 [%] [K]` → "+10%" (manual p. 36)
    s.constOp = { op: s.pendOp, val: s.pctVal, pct: true };
    s.pctK = false;
  } else if (s.pendOp && s.first !== null) {     // `5 [+] 2 [K]` → "+2"
    s.constOp = { op: s.pendOp, val: s.displayVal, pct: false };
  }
  saveState(s); render();                        // pending op stays armed: first '=' chains
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
  if (s.amort && s.amort.stageActive) { cycleAmortStage(); return; }  // Int → Prin → bAL (manual p. 15)
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
    var cv = c.pct ? c.val / 100 : c.val;
    var res;
    switch (c.op) {
      case '+': res = d + (c.pct ? d * cv : cv); break;
      case '-': res = d - (c.pct ? d * cv : cv); break;
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
  if (!isFinite(value)) { setError(isNaN(value) ? 'Error - Func' : 'OFLO'); return; }
  state.displayVal = value; state.entry = ''; state.entering = false;
  state.other = null; state.inputArmed = false;
  saveState(state); render();
}
function businessRegister(name) {
  if (state.entering) {
    commitEntry();
    if (name === 'PYR' && (!Number.isInteger(state.displayVal) || state.displayVal < 1 || state.displayVal > 999)) {
      setError('Error - P Yr'); return;
    }
    state[name] = state.displayVal;
  }
  else state.displayVal = state[name];
  saveState(state); render();
}
function validPeriods() {
  return Number.isInteger(state.PYR) && state.PYR >= 1 && state.PYR <= 999;
}
function effectiveRate() {
  if (!validPeriods()) { setError('Error - P Yr'); return; }
  if (1 + state.IYR / (100 * state.PYR) <= 0) { setError('Error - Int'); return; }
  result(100 * Math.expm1(state.PYR * Math.log1p(state.IYR / (100 * state.PYR))));
  state.EFF = state.displayVal; saveState(state);
}
function nominalRate() {
  if (state.entering) { businessRegister('IYR'); return; }
  if (!validPeriods()) { setError('Error - P Yr'); return; }
  if (1 + state.EFF / 100 <= 0) { setError('Error - Int'); return; }
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
  if (state.N <= 0.99999 || state.N >= 1e10) return NaN;
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
  if (!validPeriods()) { setError('Error - P Yr'); return; }
  if (name === 'IYR' && (state.N <= 0.99999 || state.N >= 1e10)) { setError('Error - n'); return; }
  if (!Number.isFinite(state.N)) { setError('Error - Func'); return; }
  var rate = state.IYR / (100 * state.PYR);
  if (name !== 'IYR' && rate <= -1) { setError('Error - Int'); return; }
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
  if (!Number.isFinite(value) || (name === 'N' && value < 0)) { setError(name === 'IYR' ? 'Error - Soln' : 'Error - Func'); return; }
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
  /* R0..R14 alias the cash-flow list when flows have been entered
   * (manual p. 30: "registers for storing numbers, cash flows, and statistics";
   *  p. 80: STO replaces a cash flow) */
  var isCF = index < state.cfs.length;
  if (state.rclMode === 'STO') {
    commitEntry();
    if (isCF) state.cfs[index].cf = state.displayVal;
    else if (state.stoOp) {
      var r = applyBinary(state.stoOp, state.R[index], state.displayVal);
      if (typeof r !== 'number') { setError('Error - Func'); state.rclMode = null; state.stoOp = null; saveState(state); render(); return; }
      state.R[index] = r; state.displayVal = r;
      state.stoOp = null;
    } else state.R[index] = state.displayVal;
  }
  else result(isCF ? state.cfs[index].cf : state.R[index]);
  state.rclMode = null; state.decimalRegister = false;
  saveState(state); render();
}
function clearAll() {
  var modes = state.modes;
  state = defaultState(); state.modes = modes;
  setStatus('ALL CLr');
}
function percent() {
  commitEntry();
  if (state.pendOp && (state.pendOp === '+' || state.pendOp === '-') && state.first !== null) {
    state.pctK = true;                         // a following K stores a "+n%" constant
    state.pctVal = state.displayVal;
    result(state.first * state.displayVal / 100);
  }
  else if (state.other !== null) result(state.other ? state.displayVal / state.other * 100 : NaN);
  else result(state.displayVal / 100);
}
function percentChange() {
  commitEntry();
  if (state.pendOp && state.first !== null) pressEquals();
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
function powerKey() {
  if (state.other === null) { pressOp('^'); return; }
  commitEntry();
  var base = state.other, exponent = state.displayVal;
  state.other = null; state.inputArmed = false;
  var value = applyBinary('^', base, exponent);
  if (typeof value !== 'number') { setError('Error - Func'); return; }
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
/* AMORT (⇧FV), manual p. 15 + ch. 6: an INPUT pair gives first..last period
 * (`1 [INPUT] 12`), a bare number gives periods 1..n. AMORT shows `PEr s- e`;
 * `=` then cycles Int → Prin → bAL. Interest/principal display follows the
 * payment sign (money paid out is negative). */
function amortize() {
  var s = state;
  var start = null, end = null;
  if (s.inputArmed && s.other !== null) {
    commitEntry();
    if (!Number.isInteger(s.other) || !Number.isInteger(s.displayVal)) { setError('Error - Per'); return; }
    start = s.other; end = s.displayVal;
  } else if (s.entering) {
    commitEntry();
    if (!Number.isInteger(s.displayVal)) { setError('Error - Per'); return; }
    start = 1; end = s.displayVal;
  } else if (s.amort && s.amort.stageActive) {
    cycleAmortStage();
    return;
  }
  if (!validPeriods()) { setError('Error - P Yr'); return; }
  if (start === null || !Number.isFinite(s.PMT)) { setError('Error - Func'); return; }
  if (start < 1 || end > 999 || start > end) { setError('Error - Per'); return; }
  var rate = s.IYR / (100 * s.PYR);
  var balance = s.PV, interest = 0, principal = 0;
  for (var i = 1; i <= end; i++) {
    /* Per the manual's worked examples (p. 15), each period's interest is
     * rounded to cents before the principal is derived. */
    var it = Math.round(balance * rate * 100) / 100;
    var pr = -s.PMT - it;
    if (i >= start) { interest += it; principal += pr; }
    balance -= pr;
  }
  s.amort = { start: start, end: end, done: end, balance: balance,
              interest: interest, principal: principal, stage: 0, stageActive: true };
  s.other = null; s.inputArmed = false;
  setStatus('PEr ' + start + '- ' + end);
}
function cycleAmortStage() {
  var a = state.amort;
  state.msg = null;
  if (a.stage === 0) { a.stage = 1; state.label = 'Int'; state.displayVal = -a.interest; }
  else if (a.stage === 1) { a.stage = 2; state.label = 'Prin'; state.displayVal = -a.principal; }
  else { a.stage = 0; state.label = 'bAL'; state.displayVal = a.balance; }
  saveState(state); render();
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
    setError('Error - Per'); return;
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
  if (!validPeriods()) { setError('Error - P Yr'); return; }
  var rate = state.IYR / (100 * state.PYR);
  if (1 + rate <= 0) { setError('Error - Int'); return; }
  var npv = cashFlowNpv(rate);
  if (Number.isFinite(npv)) state.PV = npv;   // NPV is stored in PV (manual p. 84)
  result(npv);
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
  if (!validPeriods()) { setError('Error - P Yr'); return; }
  var rate = solveIrrPeriod();
  if (!Number.isFinite(rate)) { setError('Error - Soln'); return; }
  var irr = 100 * rate * state.PYR;            // nominal annual, per manual (IRR/YR ÷ P/YR = per period)
  state.IYR = irr;                             // IRR/YR is stored in I/YR (manual p. 84)
  result(irr);
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
  if (!Number.isFinite(a) || !Number.isFinite(b)) { setError('Error - Stat'); return; }
  state.twoVal = { a: a, b: b, shown: 'a' };
  result(a);
  state.twoVal = { a: a, b: b, shown: 'a' };
  saveState(state); render();
}
function statFunction(kind) {
  commitEntry();
  var s = state.stats, n = s.n;
  if (n <= 0) { setError('Error - Stat'); return; }
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
    if (n <= 1) { setError('Error - Stat'); return; }
    statsPair(Math.sqrt(Math.max(0, dx / (n - 1))), Math.sqrt(Math.max(0, dy / (n - 1)))); return;
  }
  if (kind === 'POP') { statsPair(Math.sqrt(Math.max(0, dx / n)), Math.sqrt(Math.max(0, dy / n))); return; }
  if (kind === 'XR') {
    if (!s.sx || !s.sy || !slope) { setError('Error - Stat'); return; }
    statsPair((x - (ybar - slope * xbar)) / slope, corr); return;
  }
  if (kind === 'YM') {
    if (!slopeDen) { setError('Error - Stat'); return; }
    statsPair(ybar + slope * (x - xbar), slope); return;
  }
  if (kind === 'WEIGHTED') {
    var weighted = s.sy ? s.sxy / s.sy : NaN;
    if (!Number.isFinite(weighted)) setError('Error - Stat');
    else result(weighted);
    return;
  }
}
var dispatch = {
  DECIMAL: pressDecimal, NEGATE: pressSign, SCI_E: pressE,
  BACK: pressBackspace, CLEAR: pressC, INPUT: pressInput,
  EQUALS: pressEquals, SWAP: pressSwap, K: pressK,
  ADD: function () { pressOp('+'); }, SUB: function () { pressOp('-'); },
  MUL: function () { pressOp('*'); }, DIV: function () { pressOp('/'); },
  YX: powerKey,
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
    if (state.entering) { businessRegister('MAR'); state.marginBasis = 'MAR'; saveState(state); }
    else marginResult(false);
  },
  MU: function () {
    // entering: store markup % in MAR/MU register (manual p. 34); else compute markup
    if (state.entering) { businessRegister('MAR'); state.marginBasis = 'MU'; saveState(state); }
    else marginResult(true);
  }, AMORT: amortize,
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
  DISP: function () { commitEntry(); state.dispArmed = true; saveState(state); render(); },
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
  if (state.dispArmed && key === 'EQUALS') {   // DISP then '=': full 12-digit mantissa view
    state.dispArmed = false; state.dispHold = true;
    state.modes.fullPrecision = true; saveState(state); render(); return;
  }
  if (state.dispHold) {                        // any key returns to the normal display
    state.dispHold = false;
    if (key === 'EQUALS') { state.modes.fullPrecision = false; saveState(state); render(); return; }
    state.modes.fullPrecision = false;
  }
  if (state.dispArmed && key === 'CLEAR') { state.dispArmed = false; state.modes.fullPrecision = true; saveState(state); render(); return; }
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
  if (state.rclMode && /^(N|IYR|PV|PMT|FV|PYR|EFF|CST|PRC|MAR)$/.test(key)) {
    if (state.msg && state.msg.kind === 'status') clearMessage();  // status ends on next keypress
    if (state.rclMode === 'RCL') {
      state.rclMode = null;
      result(state[key]);
      return;
    }
    if (state.rclMode === 'STO') {              // STO followed by a register name
      commitEntry(); state[key] = state.displayVal;
      state.rclMode = null; saveState(state); render();
      return;
    }
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
  r: 'RCL', a: 'AMORT', g: 'SWAP', k: 'K', v: 'INPUT', x: 'SIGMA_PLUS', y: 'MAR'
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

function runAcceptanceChecks() {
  var panel = document.createElement('section');
  panel.id = 'test-results';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<strong>Acceptance checks</strong><ol></ol>';
  document.getElementById('device').appendChild(panel);
  var list = panel.querySelector('ol');
  var original = JSON.parse(JSON.stringify(state));
  function key(name, shifted) {
    if (shifted !== true) {   // strict: forEach passes the array index as 2nd arg
      if (/^[0-9]$/.test(name)) { pressDigit(name); return; }
      if (name === '.') { pressDecimal(); return; }
    }
    var button = document.querySelector('#keypad button[data-key="' + name + '"]');
    if (!button) throw new Error('Missing key ' + name);
    if (shifted) state.shiftArmed = true;
    pressButton(button);
  }
  function enter(value) { String(value).split('').forEach(key); }
  var checks = [
    { id: 'A1', run: function () { '10'.split('').forEach(key); key('IYR', true); '12'.split('').forEach(key); key('PMT', true); key('PV', true); }, expected: '10.47' },
    { id: 'A2', run: function () { '200'.split('').forEach(key); key('MUL'); '25'.split('').forEach(key); key('PCT'); key('EQUALS'); }, expected: '50.00' },
    { id: 'A3', run: function () { '200'.split('').forEach(key); key('SUB'); '25'.split('').forEach(key); key('PCT'); key('EQUALS'); }, expected: '150.00' },
    { id: 'A4', run: function () { '1250'.split('').forEach(key); key('ADD'); key('7'); key('PCT'); var interest = dom.main.textContent; key('EQUALS'); return [interest, dom.main.textContent]; }, expected: ['87.50', '1,337.50'] },
    { id: 'A5', run: function () { '291'.split('').forEach(key); key('.'); key('7'); key('INPUT'); '316'.split('').forEach(key); key('.'); key('8'); key('PCT', true); }, expected: '8.60' },
    { id: 'A6', run: function () { '12'.split('').forEach(key); key('MUL'); key('5'); key('INPUT'); '65'.split('').forEach(key); key('ADD'); '18'.split('').forEach(key); key('PCT', true); }, expected: '38.33' },
    { id: 'A7', run: function () { '17'.split('').forEach(key); key('INPUT'); '29'.split('').forEach(key); key('PCT', true); }, expected: '70.59' },
    { id: 'A8', run: function () { '255'.split('').forEach(key); key('CST'); '300'.split('').forEach(key); key('PRC'); key('MAR'); }, expected: '15.00' },
    /* manual p. 22 — chained calculation: 6.9 × 5.35 ÷ .91 (÷ shows 36.92 first) */
    { id: 'A9', run: function () { enter('6.9'); key('MUL'); enter('5.35'); key('DIV'); var inter = dom.main.textContent; enter('.91'); key('EQUALS'); return [inter, dom.main.textContent]; }, expected: ['36.92', '40.57'] },
    { id: 'A10', run: function () { key('4'); key('ADD'); key('9'); key('MUL'); key('3'); key('EQUALS'); }, expected: '39.00' },
    /* manual pp. 17-18 at-a-glance — CF0 -40,000; CF1 4,700; CF2 7,000 x2; CF3 23,000 */
    { id: 'A11', run: function () { key('INPUT', true); enter('12'); key('PMT', true); enter('40000'); key('NEGATE'); key('CFJ'); enter('4700'); key('CFJ'); enter('7000'); key('CFJ'); key('2'); key('CFJ', true); enter('23000'); key('CFJ'); key('CST', true); var irr = dom.main.textContent; enter('10'); key('IYR'); key('PRC', true); return [irr, dom.main.textContent]; }, expected: ['15.96', '622.85'] },
    /* manual p. 13 at-a-glance — $14,000 loan, 360 months at 10% I/YR, solve PMT */
    { id: 'A12', run: function () { enter('12'); key('PMT', true); enter('360'); key('N'); enter('10'); key('IYR'); enter('14000'); key('PV'); key('0'); key('FV'); key('PMT'); }, expected: '-122.86' },
    /* manual p. 90 example 2 — heights/weights two-variable stats */
    { id: 'A13', run: function () { key('TO_M', true); [[193, 90], [182, 81], [177, 83], [185, 77]].forEach(function (pair) { enter(String(pair[0])); key('INPUT'); enter(String(pair[1])); key('SIGMA_PLUS'); }); key('7', true); var xbar = dom.main.textContent; key('K', true); var ybar = dom.main.textContent; key('9', true); var sigx = dom.main.textContent; key('K', true); return [xbar, ybar, sigx, dom.main.textContent]; }, expected: ['184.25', '82.75', '5.80', '4.71'] },
    /* manual pp. 89-90 example 1 — one-variable sail-change times: mean and Sx */
    { id: 'A14', run: function () { key('TO_M', true); '4.5 4 2 3.25 3.5 3.75'.split(' ').forEach(function (v) { enter(v); key('SIGMA_PLUS'); }); key('7', true); var mean = dom.main.textContent; key('8', true); return [mean, dom.main.textContent]; }, expected: ['3.50', '0.85'] },
    /* manual p. 92 forecasting example — regression b, m, r for advertising/sales data */
    { id: 'A15', run: function () { key('TO_M', true); [[2, 1400], [1, 920], [3, 1100], [5, 2265], [5, 2890], [4, 2200]].forEach(function (pair) { enter(String(pair[0])); key('INPUT'); enter(String(pair[1])); key('SIGMA_PLUS'); }); key('0'); key('5', true); var intercept = dom.main.textContent; key('K', true); var slope = dom.main.textContent; key('4', true); key('K', true); return [intercept, slope, dom.main.textContent]; }, expected: ['376.25', '425.88', '0.90'] },
    /* manual p. 34 — markup on cost; markup then margin */
    { id: 'A16', run: function () { enter('19'); key('CST'); enter('60'); key('MAR', true); key('PRC'); }, expected: '30.40' },
    { id: 'A17', run: function () { enter('9.6'); key('CST'); enter('15'); key('MAR', true); key('PRC'); var price = dom.main.textContent; key('MAR'); return [price, dom.main.textContent]; }, expected: ['11.04', '13.04'] },
    /* manual p. 37 — M register: store, add, subtract (via +/− M+), recall */
    { id: 'A18', run: function () { enter('17'); key('TO_M'); enter('14.25'); key('M_PLUS'); enter('16.95'); key('M_PLUS'); enter('4.65'); key('NEGATE'); key('M_PLUS'); key('RM'); }, expected: '43.55' },
    /* manual p. 36 — K constants: "+2", "y^x 3", and "+10%" */
    { id: 'A19', run: function () {
      enter('5'); key('ADD'); key('2'); key('K');
      key('EQUALS'); var first = dom.main.textContent;              // 5 + 2
      enter('6'); key('EQUALS'); var second = dom.main.textContent; // 6 + 2
      enter('7'); key('EQUALS');
      return [first, second, dom.main.textContent];                 // 7 + 2
    }, expected: ['7.00', '8.00', '9.00'] },
    { id: 'A20', run: function () {
      enter('10'); key('ADD'); enter('10'); key('PCT'); key('K');
      var shown = dom.main.textContent;                             // 10% of 10 = 1.00
      key('EQUALS'); var first = dom.main.textContent;              // 10 + 1 = 11
      key('EQUALS'); var second = dom.main.textContent;             // 11 + 10% = 12.10
      enter('25'); key('EQUALS');
      return [shown, first, second, dom.main.textContent];          // 25 + 10% = 27.50
    }, expected: ['1.00', '11.00', '12.10', '27.50'] },
    { id: 'A21', run: function () {
      enter('2'); key('MUL', true); enter('3'); key('K');
      var stored = dom.main.textContent;                            // constant "y^x 3"
      key('EQUALS'); var first = dom.main.textContent;              // 2^3
      enter('4'); key('EQUALS');
      return [stored, first, dom.main.textContent];                 // 4^3
    }, expected: ['3.00', '8.00', '64.00'] },
    /* manual p. 14 — TVM What if: re-enter PMT, solve PV; then new IYR */
    { id: 'A22', run: function () {
      enter('12'); key('PMT', true); enter('360'); key('N'); enter('10'); key('IYR'); enter('14000'); key('PV'); enter('0'); key('FV');
      enter('100'); key('NEGATE'); key('PMT');
      key('PV'); var borrow = dom.main.textContent;                 // 11,395.08
      enter('9.5'); key('IYR'); key('PV');
      return [borrow, dom.main.textContent];                        // 11,892.67
    }, expected: ['11,395.08', '11,892.67'] },
    /* manual p. 15 — amortize period 20 of the p. 13 loan: = cycles Int → Prin → bAL */
    { id: 'A23', run: function () {
      enter('12'); key('PMT', true); enter('360'); key('N'); enter('10'); key('IYR'); enter('14000'); key('PV'); enter('0'); key('FV'); key('PMT');
      enter('20'); key('INPUT'); key('FV', true);                   // ⇧AMORT → "PEr 20- 20"
      key('EQUALS'); var interest = dom.main.textContent;           // Int −115.61
      key('EQUALS'); var principal = dom.main.textContent;          // Prin −7.25
      key('EQUALS');
      return [interest, principal, dom.main.textContent];           // bAL 13,865.83
    }, expected: ['-115.61', '-7.25', '13,865.83'] },
    /* manual p. 15 — amortize payments 1..12 via an INPUT range */
    { id: 'A24', run: function () {
      enter('12'); key('PMT', true); enter('360'); key('N'); enter('10'); key('IYR'); enter('14000'); key('PV'); enter('0'); key('FV'); key('PMT');
      enter('1'); key('INPUT'); enter('12'); key('FV', true);       // ⇧AMORT → "PEr 1- 12"
      key('EQUALS'); var interest = dom.main.textContent;           // Int −1,396.50
      key('EQUALS'); var principal = dom.main.textContent;          // Prin −77.82
      key('EQUALS');
      return [interest, principal, dom.main.textContent];           // bAL 13,922.18
    }, expected: ['-1,396.50', '-77.82', '13,922.18'] },
    /* manual p. 28 — DISP then '=' shows all 12 digits (decimal point hidden) */
    { id: 'A25', run: function () {
      enter('10'); key('DIV'); key('7'); key('EQUALS');
      var shown = dom.main.textContent;                             // 1.43
      key('EQUALS', true); key('EQUALS');                           // ⇧DISP then =
      var full = dom.main.textContent;                              // 142857142857
      key('EQUALS');                                                // back to normal view
      return [shown, full, dom.main.textContent];
    }, expected: ['1.43', '142857142857', '1.43'] },
    /* manual p. 29 — RND rounds the stored number to the displayed format */
    { id: 'A26', run: function () {
      enter('9.87654321'); key('EQUALS', true); key('2');           // ⇧DISP 2
      var fixed = dom.main.textContent;                             // 9.88
      key('EQUALS', true); key('EQUALS');                           // full view: 987654321000
      var full = dom.main.textContent;
      key('EQUALS');                                                // back to 9.88
      key('BACK', true);                                            // ⇧RND
      var rounded = dom.main.textContent;                           // 9.88
      key('EQUALS', true); key('EQUALS');                           // stored value is now rounded
      return [fixed, full, rounded, dom.main.textContent];          // 988000000000
    }, expected: ['9.88', '987654321000', '9.88', '988000000000'] },
    /* manual pp. 80-84 — discounted contract: NPV 27,199.92; replace CF0 via STO; IRR 12.49 */
    { id: 'A27', run: function () {
      key('INPUT', true);                                           // CLEAR ALL
      enter('12'); key('PMT', true);
      enter('0'); key('CFJ'); enter('0'); key('CFJ'); key('3'); key('CFJ', true);
      enter('5000'); key('CFJ'); enter('0'); key('CFJ'); key('4'); key('CFJ', true);
      enter('5000'); key('CFJ'); key('2'); key('CFJ', true);
      enter('0'); key('CFJ'); key('4'); key('CFJ', true);
      enter('7500'); key('CFJ'); enter('0'); key('CFJ'); key('9'); key('CFJ', true);
      enter('10000'); key('CFJ');
      enter('15'); key('IYR'); key('PRC', true);                    // ⇧NPV
      var npv = dom.main.textContent;                               // 27,199.92
      enter('28000'); key('NEGATE'); key('RCL', true); key('0');    // ⇧STO 0 replaces CF0
      var stored = dom.main.textContent;                            // -28,000.00
      key('CST', true);                                             // ⇧IRR/YR
      var irr = dom.main.textContent;                               // 12.49
      key('RCL'); key('IYR');                                       // IRR auto-stored in I/YR (p. 84)
      return [npv, stored, irr, dom.main.textContent];
    }, expected: ['27,199.92', '-28,000.00', '12.49', '12.49'] },
    /* manual p. 26 — 1/x inside a pending addition computes first */
    { id: 'A28', run: function () {
      enter('3.57'); key('ADD'); enter('2.36'); key('DIV', true);   // ⇧1/x → 0.42
      var recip = dom.main.textContent;
      key('EQUALS');                                                // 3.57 + 1/2.36
      return [recip, dom.main.textContent];
    }, expected: ['0.42', '3.99'] },
    /* manual p. 27 — DISP n changes displayed decimals and rounds the display */
    { id: 'A29', run: function () {
      key('CLEAR'); key('EQUALS', true); key('3');                  // ⇧DISP 3
      var zero = dom.main.textContent;                              // 0.000
      enter('45.6'); key('MUL'); enter('.1256'); key('EQUALS');     // 5.727
      var three = dom.main.textContent;
      key('EQUALS', true); key('9');                                // ⇧DISP 9 → 5.727360000
      var nine = dom.main.textContent;
      key('EQUALS', true); key('2');                                // ⇧DISP 2 → 5.73
      return [zero, three, nine, dom.main.textContent];
    }, expected: ['0.000', '5.727', '5.727360000', '5.73'] },
    /* manual p. 27 — scientific notation: automatic (1.00E14) and entered (4.00E-12) */
    { id: 'A30', run: function () {
      enter('10000000'); key('MUL'); enter('10000000'); key('EQUALS');
      var big = dom.main.textContent;                               // 1.00E14
      enter('4'); key('NEGATE', true); key('NEGATE'); key('1'); key('2'); // 4 ⇧E +/− 12
      key('K', true);                                                     // SWAP commits the entry without computing
      return [big, dom.main.textContent];                                 // 4.00E-12
    }, expected: ['1.00E14', '4.00E-12'] },
    /* manual pp. 78-79 — uneven cash flows IRR/YR 21.22; RCL 0 views CF0 */
    { id: 'A31', run: function () {
      key('INPUT', true);                                           // CLEAR ALL
      enter('12'); key('PMT', true);
      enter('11000'); key('NEGATE'); key('CFJ');                    // CF0 = -11,000
      enter('0'); key('CFJ'); key('6'); key('CFJ', true);
      enter('1000'); key('CFJ'); key('3'); key('CFJ', true);
      enter('10000'); key('CFJ');
      key('CST', true);                                             // ⇧IRR/YR
      var irr = dom.main.textContent;                               // 21.22
      key('RCL'); key('0');                                         // RCL 0 → CF0
      return [irr, dom.main.textContent];
    }, expected: ['21.22', '-11,000.00'] },
    /* manual p. 9 + error appendix — divide by zero shows Error - Func;
     * C clears the message and restores the number displayed before it */
    { id: 'A32', run: function () {
      enter('5'); key('DIV'); enter('0'); key('EQUALS');
      var err = dom.main.textContent;                               // Error - Func
      key('CLEAR');                                                 // C restores
      return [err, dom.main.textContent];                           // the divisor (0) was last displayed
    }, expected: ['Error - Func', '0.00'] },
    /* manual p. 9 — C clears the current entry */
    { id: 'A33', run: function () {
      enter('123.45'); key('CLEAR');
      var cleared = dom.main.textContent;                           // 0.00
      enter('9'); key('ADD'); enter('1'); key('EQUALS');            // calculator still live
      return [cleared, dom.main.textContent];                       // 10.00
    }, expected: ['0.00', '10.00'] },
    /* manual p. 10 — ⇧INPUT clears everything (ALL CLr); ⇧CLΣ clears statistics */
    { id: 'A34', run: function () {
      enter('360'); key('N');
      key('INPUT', true);                                           // ⇧CLEAR ALL
      var status = dom.main.textContent;                            // ALL CLr
      key('RCL'); key('N');
      var nNow = dom.main.textContent;                              // 0.00
      enter('5'); key('SIGMA_PLUS'); enter('7'); key('SIGMA_PLUS');
      key('TO_M', true);                                            // ⇧CLΣ
      enter('10'); key('SIGMA_PLUS'); key('7', true);               // x̄ of only {10}
      return [status, nNow, dom.main.textContent];                  // 10.00
    }, expected: ['ALL CLr', '0.00', '10.00'] }
  ];
  checks.forEach(function (check) {
    state = defaultState(); render();
    var item = document.createElement('li');
    try {
      var returned = check.run();
      var actual = returned === undefined ? dom.main.textContent : returned;
      var passed = JSON.stringify(actual) === JSON.stringify(check.expected);
      item.textContent = check.id + ': ' + (passed ? 'PASS' : 'FAIL') + ' (expected ' + JSON.stringify(check.expected) + ', got ' + JSON.stringify(actual) + ')';
      item.className = passed ? 'pass' : 'fail';
    } catch (error) {
      item.textContent = check.id + ': ERROR (' + error.message + ')';
      item.className = 'fail';
    }
    list.appendChild(item);
  });
  state = original; saveState(state); render();
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
  if (new URLSearchParams(window.location.search).has('test')) runAcceptanceChecks();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})(window);

