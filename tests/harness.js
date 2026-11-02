/* Headless harness: runs app.js with a minimal DOM stub and prints the
 * ?test=1 acceptance results (captured from the #test-results panel). */
const fs = require('fs');
const path = require('path');

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

const SHIFT_MAP = (() => {
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const map = {};
  for (const m of html.matchAll(/data-key="([^"]+)"(?:\s+data-shift="([^"]+)")?/g)) {
    if (m[2]) map[m[1]] = m[2]; else if (!(m[1] in map)) map[m[1]] = undefined;
  }
  return map;
})();

const byId = {};
['lcd-text', 'ann-shift', 'ann-input', 'ann-pend', 'ann-begin', 'lcd-cursor', 'lcd-label', 'device', 'keypad'].forEach(id => { byId[id] = el(id); });

const buttons = {};
Object.keys(SHIFT_MAP).concat(['SHIFT']).forEach(k => {
  buttons[k] = { dataset: { key: k, shift: SHIFT_MAP[k] } };
});

const documentStub = {
  readyState: 'complete',
  getElementById(id) { return byId[id] || el(id); },
  createElement(t) { return el(t); },
  querySelector(sel) {
    const m = sel.match(/data-key="([^"]+)"\]$/);
    return m ? (buttons[m[1]] || null) : null;
  },
  querySelectorAll() { return []; },
  addEventListener() {},
};

const store = {};
const windowStub = {
  location: { search: '?test=1' },
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

const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
// expose internals so we can read the test panel after init
eval(src + '\n;');

/* The panel is appended to device; harvest its list items. */
const panel = byId.device._children.find(c => c.tag === 'section');
if (!panel) { console.log('NO PANEL'); process.exit(1); }
const items = (panel._ol && panel._ol._children) || [];
let fails = 0;
for (const it of items) {
  console.log(it.className.toUpperCase().padEnd(5), it.textContent);
  if (it.className !== 'pass') fails++;
}
console.log('---', items.length - fails + '/' + items.length, 'pass');
process.exitCode = fails ? 1 : 0;
