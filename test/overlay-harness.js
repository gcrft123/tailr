/* A DOM for the overlay to run in.
 *
 * These tests are about the mark lifecycle — what a gesture stages, what the
 * send lock refuses, what choosing a version commits — and none of that needs
 * layout or paint. jsdom has neither, which is exactly why the three shims
 * below exist, and why what does need them (the morph, where a pill lands, how
 * any of it looks) is not tested here and should not be faked into looking
 * tested. The overlay is the one part of Tailr a person sees; a green suite
 * here is not a substitute for opening it.
 *
 * jsdom is a devDependency, so a clone with no node_modules still runs the
 * rest of the suite: `available` is false there and the overlay tests skip,
 * loudly in CI, where skipping would mean nobody is running them at all.
 */
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../src/overlay/tailr.js', import.meta.url), 'utf8');

let JSDOM = null;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  if (process.env.CI) {
    throw new Error(
      'jsdom is missing in CI, so the overlay tests would have skipped silently. ' +
      'The workflow installs devDependencies before running the suite; that step has failed.'
    );
  }
}

export const available = !!JSDOM;
export const needsDom = available ? {} : { skip: 'jsdom is not installed — run npm install' };

/** The page a reviewer is marking up: ordinary content, none of it Tailr's. */
const PAGE = `<!doctype html><html><head><title>Northwind</title></head><body>
  <header id="top"><h1 id="title">Invoices</h1></header>
  <main>
    <section id="list">
      <div id="row-1" class="row">Bellweather Ltd</div>
      <div id="row-2" class="row">Kestrel &amp; Co</div>
    </section>
    <button id="cta">Export</button>
  </main>
</body></html>`;

/**
 * Boot the overlay over a sample page and hand back the seams a test drives it
 * through: the same public object the CLI talks to, and a transport that
 * records batches instead of sending them.
 */
export async function mountOverlay({ html = PAGE, url = 'http://localhost:4100/' } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const doc = window.document;

  /* Reduced motion is a real setting, and honouring it is the overlay's own
     answer to an environment that cannot animate. jsdom always reports false. */
  window.matchMedia = (q) => ({
    media: q,
    matches: /prefers-reduced-motion/.test(q),
    onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; }
  });
  /* No layout, so no hit-testing. The overlay already falls back to the event's
     own target when the point resolves to nothing, which is the path a
     dispatched event should take anyway. */
  doc.elementFromPoint = () => null;
  /* jsdom implements no `CSS` global, and the overlay wants CSS.escape when it
     builds the selector that addresses a mark. Escaping everything outside the
     identifier-safe set is enough for one, and keeps the selectors a test reads
     the same as the ones a browser would produce. */
  window.CSS = window.CSS || {
    escape: (v) => String(v).replace(/[^\w\u00A0-\uFFFF-]/g, (c) => '\\' + c)
                            .replace(/^(\d)/, '\\3$1 ')
  };
  /* No Web Animations. Every call is behind `reduced` or behind a zero-sized
     rect here, so nothing should reach this — it exists so that a change which
     does reach it fails on its assertion rather than on a missing API. */
  window.Element.prototype.animate = function () {
    return { cancel() {}, finish() {}, onfinish: null, finished: Promise.resolve() };
  };

  /* The overlay defers mount() to DOMContentLoaded, so it is loaded into a
     document that has finished parsing — then mount() runs on the spot and a
     test has an island to click the moment this resolves. */
  await new Promise((done) => {
    if (doc.readyState === 'complete') done();
    else window.addEventListener('load', done, { once: true });
  });
  const sent = [];
  const exits = [];
  /* Everything the overlay builds is built inside the jsdom realm, so its
     arrays and objects fail a strict deep-equal against Node's own. Round-trip
     them through JSON, which is what the bridge does to them anyway — so a
     test compares what the agent would actually read. */
  const plain = (v) => JSON.parse(JSON.stringify(v));

  let tailr;
  function boot() {
    window.eval(SOURCE);
    tailr = window.__tailr;
    tailr.transport = {
      send: (batch) => { sent.push(plain(batch)); },
      exit: () => { exits.push(Date.now()); }
    };
  }
  boot();

  const at = (sel) => {
    const el = doc.querySelector(sel);
    if (!el) throw new Error(`no element matches ${sel}`);
    return el;
  };
  /* Everything Tailr draws is inside one shadow root on one host, so a test
     reaches its controls where the reviewer's pointer does rather than
     through document. */
  const shadow = () => doc.querySelector('[data-tailr]').shadowRoot;

  function mouse(type, target, opts = {}) {
    const el = typeof target === 'string' ? at(target) : target;
    const e = new window.MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      altKey: true, clientX: 10, clientY: 10, ...opts
    });
    el.dispatchEvent(e);
    return e;
  }

  return {
    window, document: doc, sent, exits, at, shadow, mouse,
    get tailr() { return tailr; },
    get state() { return tailr.state; },

    /* What the reviewer does after the agent reports back. The overlay comes
       off the page and is loaded again into the same browser, so what survives
       is whatever it wrote to storage — which is the promise the README makes
       about marks, and the only state in which a version can be chosen. */
    async reload() {
      tailr.destroy();
      boot();
      await delay(0);
      return this;
    },

    /** Everything staged, in the shape the agent is handed. */
    payload: () => plain(tailr.payload()),

    /** Right-click with the key down: a removal, with no composer to answer. */
    remove: (sel) => mouse('contextmenu', sel),

    /** Shift-click with the key down: a mark on a place rather than a thing. */
    point: (opts = {}) => mouse('click', doc.body, { shiftKey: true, ...opts }),

    /** Click with the key down. The comment waits 260ms for a double-click. */
    async comment(sel) {
      mouse('click', sel);
      await delay(300);
    },

    /** Answer whatever composer is open, the way Add does. */
    compose(text, { versions = 1, slider = false } = {}) {
      const root = shadow();
      const c = root && root.querySelector('.composer');
      if (!c) throw new Error('no composer is open');
      c.querySelector('textarea').value = text;
      for (let i = 1; i < versions; i++) click(c.querySelector('[data-act="mult"]'));
      if (slider) click(c.querySelector('[data-act="slide"]'));
      click(c.querySelector('[data-act="save"]'));
    },

    /** Click something in the island, by the action it carries. */
    act(selector) {
      const root = shadow();
      const n = root && root.querySelector(selector);
      if (!n) throw new Error(`nothing in the island matches ${selector}`);
      click(n);
      return n;
    },

    destroy() { try { tailr.destroy(); } catch {} window.close(); }
  };

  function click(n) {
    if (!n) throw new Error('nothing to click');
    n.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }
}

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
