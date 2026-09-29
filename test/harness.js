/**
 * Харнеси умумии тест: DOM-и сохта + контексти vm.
 * Ҳам protocol.test.js ва ҳам scale.test.js аз ин истифода мебаранд.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { webcrypto } = require('crypto');

function makeDom() {
  class El {
    constructor(tag) {
      this.tagName = (tag || 'div').toUpperCase();
      this.children = [];
      this.parent = null;
      this._cls = new Set();
      this.dataset = {};
      this.style = {};
      this._attrs = {};
      this._html = '';
      this.textContent = '';
      this.value = '';
      this.disabled = false;
      this._handlers = {};
      this.focus = () => {};
      this.blur = () => {};
      const self = this;
      this.classList = {
        add: (...c) => c.forEach((x) => self._cls.add(x)),
        remove: (...c) => c.forEach((x) => self._cls.delete(x)),
        contains: (c) => self._cls.has(c),
        toggle: (c, force) => {
          const on = force === undefined ? !self._cls.has(c) : !!force;
          if (on) self._cls.add(c); else self._cls.delete(c);
          return on;
        }
      };
    }
    get className() { return [...this._cls].join(' '); }
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get innerHTML() { return this._html; }
    set innerHTML(v) { this._html = String(v); this.children.forEach((c) => (c.parent = null)); this.children = []; }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); }
    setAttribute(k, v) { this._attrs[k] = String(v); }
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; }
    addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); }
    click() { (this._handlers.click || []).forEach((f) => f({ target: this, preventDefault() {} })); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const want = sel.replace(/^\./, '');
      const isClass = sel.startsWith('.');
      const walk = (n) => n.children.forEach((c) => {
        if (isClass ? c._cls.has(want) : c.tagName === sel.toUpperCase()) out.push(c);
        walk(c);
      });
      walk(this);
      return out;
    }
    closest() { return null; }
    getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); }
  }

  const root = new El('root');
  const byId = new Map();
  const document = {
    getElementById(id) {
      if (!byId.has(id)) { const e = new El('div'); e.id = id; byId.set(id, e); root.appendChild(e); }
      return byId.get(id);
    },
    createElement: (t) => new El(t),
    querySelector: (s) => root.querySelector(s),
    querySelectorAll: (s) => root.querySelectorAll(s),
    addEventListener() {},
    documentElement: new El('html'),
    body: new El('body'),
    title: ''
  };
  return { document, El, root };
}

/**
 * Хотираи сохта. Калидҳо ҳамчун хосиятҳои оддӣ нигоҳ дошта мешаванд —
 * то `Object.keys(storage)` мисли браузери воқеӣ кор кунад
 * (ин барои санҷиши пок кардани кеш лозим аст).
 */
function makeStorage() {
  const stg = {};
  const def = (name, fn) => Object.defineProperty(stg, name, { value: fn, enumerable: false });
  def('getItem', (k) => (k in stg ? stg[k] : null));
  def('setItem', (k, v) => { stg[k] = String(v); });
  def('removeItem', (k) => { delete stg[k]; });
  def('clear', () => { Object.keys(stg).forEach((k) => delete stg[k]); });
  return stg;
}

function makeRunner(dir) {
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  const src = {
    config: read('config.js'),
    auth: read('crypto-auth.js'),
    uzlatin: read('uz-latin.js'),
    i18n: read('i18n.js'),
    cpp: read('questions.js'),
    js: read('questions-js.js'),
    app: read('app.js')
  };

  const bus = [];

  /**
   * @param {object} opts
   *   crypto  — true: имзои воқеӣ фаъол (паёмҳо асинхронӣ мешаванд)
   *   search  — сатри ?query дар URL
   *   hash    — қисми #... дар URL (калиди кушоди муаллим)
   *   isolated— true: BroadcastChannel/localStorage бо дигарон мубодила намекунад
   */
  function makeCtx(label, opts) {
    opts = opts || {};
    const { document, root } = makeDom();
    const localStorage = makeStorage();
    const sessionStorage = makeStorage();

    class FakeBC {
      constructor(name) {
        this.name = name; this.onmessage = null;
        this._isolated = !!opts.isolated;
        bus.push(this);
      }
      postMessage(msg) {
        if (this._isolated) return;
        const copy = JSON.parse(JSON.stringify(msg));
        bus.forEach((c) => {
          if (c !== this && !c._isolated && c.name === this.name && c.onmessage) c.onmessage({ data: copy });
        });
      }
    }

    const sandbox = {
      console: { log() {}, warn() {}, error() {} },
      document,
      localStorage,
      sessionStorage,
      BroadcastChannel: FakeBC,
      URLSearchParams,
      setTimeout, clearTimeout, setInterval, clearInterval,
      requestAnimationFrame: () => 0,
      Math, Date, JSON, Set, Map, Array, Object, String, Number, Promise,
      Uint8Array, Uint32Array, DataView, ArrayBuffer, Buffer,
      TextEncoder, TextDecoder,
      btoa: (b) => Buffer.from(b, 'binary').toString('base64'),
      atob: (b) => Buffer.from(b, 'base64').toString('binary'),
      Blob: function () {},
      URL: { createObjectURL: () => '', revokeObjectURL() {} },
      alert() {}, confirm: () => true, prompt: () => '',
      navigator: {},
      __label: label,
      __root: root
    };
    if (opts.crypto) sandbox.crypto = webcrypto;

    sandbox.window = sandbox;
    sandbox.window.location = {
      origin: 'http://localhost:8080',
      pathname: '/index.html',
      search: opts.search || '',
      hash: opts.hash || '',
      href: 'http://localhost:8080/index.html'
    };
    sandbox.window.history = { replaceState() {}, pushState() {} };
    sandbox.window.addEventListener = () => {};
    sandbox.window.scrollTo = () => {};

    const ctx = vm.createContext(sandbox);
    ['config', 'auth', 'uzlatin', 'i18n', 'cpp', 'js', 'app'].forEach((k) => vm.runInContext(src[k], ctx));
    vm.runInContext('applyI18n(); initUI(); checkUrlParams(); globalThis.__S = S;', ctx);
    return ctx;
  }

  return { makeCtx, bus, src };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { makeDom, makeStorage, makeRunner, sleep };
