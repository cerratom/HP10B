/* Debug harness: dumps internal state after targeted sequences. */
const fs = require('fs');

function el(tag) {
  return {
    tag, textContent: '', hidden: false, className: '', _children: [],
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, appendChild(c) { this._children.push(c); },
    innerHTML: '',
    querySelector(sel) { if (sel === 'ol') { this._ol = this._ol || el('ol'); return this._ol; } return null; },
    addEventListener() {},
    closest() { return null; },
  };
}

const SHIFT_MAP = {
  N: 'XPYR', IYR: 'NOM', PV: 'EFF', PMT: 'PYR', FV: 'AMORT',
  SIGMA_PLUS: 'SIGMA_MINUS', PCT: 'PCTCHG', RCL: 'STO', CFJ: 'NJ',
  CST: 'IRR', PRC: 'NPV', MAR: 'MU', INPUT: 'CLEARALL', TO_M: 'CLSIGMA',
  RM: 'LPAREN', M_PLUS: 'RPAREN', BACK: 'RND', NEGATE: 'SCI_E',
  '7': 'XBAR_YBAR', '8': 'SX_SY', '9': 'SIGMAX_SIGMAY', DIV: 'RECIP',
  SWAP: 'XHAT_R', '4': 'YHAT_M', '5': 'XBARW', '6': 'YX', MUL: 'SQR',
  '1': 'EXP', '2': 'LN', '3': 'FACT', SUB: 'SQRT', CLEAR: 'OFF',
  '0': 'BEGEND', DECIMAL: 'PERIOD_COMMA', EQUALS: 'DISP', ADD: 'SQUARE',
};

const byId = {};
['lcd-text', 'ann-shift', 'ann-input', 'ann-pend', 'ann-begin', 'lcd-cursor', 'lcd-label', 'device', 'keypad'].forEach(id => { byId[id] = el(id); });
const buttons = {};
Object.keys(SHIFT_MAP).forEach(k => { buttons[k] = { dataset: { key: k, shift: SHIFT_MAP[k] } }; });

const documentStub = {
  readyState: 'complete',
  getElementById(id) { return byId[id] || el(id); },
  createElement(t) { return el(t); },
  querySelector(sel) { const m = sel.match(/data-key="([^"]+)"\]$/); return m ? (buttons[m[1]] || null) : null; },
  querySelectorAll() { return []; },
  _listeners: {},
  addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
};

const store = {};
const windowStub = {
  location: { search: '' },
  sessionStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};
windowStub.document = documentStub;
global.window = windowStub;
global.document = documentStub;

let src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
src = src.replace(/\}\)\(window\);\s*$/,
  'globalThis.__dbg = function () { return { state: state, dom: dom, pressButton: pressButton, defaultState: defaultState }; };\n})(window);');
eval(src);

const dbg = globalThis.__dbg();
function key(name, shifted) {
  const s = dbg.state === undefined ? null : null;
  const st = dbg.get ? null : null;
}

function withState(fn) { fn(); }

function run() {
  const get = () => __dbg();
  function key(name, shifted) {
    const st = get().state;
    if (/^[0-9]$/.test(name)) { dbg.pressButton(buttons[name]); return; }
    if (name === '.') { dbg.pressButton(buttons['DECIMAL']); return; }
    const b = buttons[name];
    if (!b) throw new Error('Missing key ' + name);
    if (shifted) get().state.shiftArmed = true;
    dbg.pressButton(b);
  }
  function enter(v) { String(v).split('').forEach(key); }

  // ---- A11 debug: cash flows
  get().state.shiftArmed = false;
  Object.assign(get().state, get().defaultState());
  key('INPUT', true);
  enter('12'); key('PMT', true);
  enter('40000'); key('NEGATE'); key('CFJ');
  enter('4700'); key('CFJ');
  enter('7000'); key('CFJ');
  key('2'); key('CFJ', true);
  enter('23000'); key('CFJ');
  console.log('A11 cfs =', JSON.stringify(get().state.cfs), 'PYR =', get().state.PYR);
  key('CST', true);
  console.log('A11 IRR display =', get().dom.main.textContent);

  // ---- A13 debug: stats
  Object.assign(get().state, get().defaultState());
  key('TO_M', true);
  [[193, 90], [182, 81], [177, 83], [185, 77]].forEach(p => {
    enter(String(p[0])); key('INPUT'); enter(String(p[1])); key('SIGMA_PLUS');
  });
  console.log('A13 stats =', JSON.stringify(get().state.stats));
  key('7', true);
  const s = get().state;
  console.log('A13 after shift-7 display =', get().dom.main.textContent, 'shiftArmed =', s.shiftArmed,
    'entry =', JSON.stringify(s.entry), 'entering =', s.entering, 'displayVal =', s.displayVal, 'twoVal =', JSON.stringify(s.twoVal), 'msg =', JSON.stringify(s.msg));
}
run();
