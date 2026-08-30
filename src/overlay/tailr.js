/* Tailr — markup overlay
 * World: Island. One small dark object at the corner of someone else's app,
 * which changes shape to match its state. See DESIGN.md.
 *
 * THESIS: mark the running app, hand the agent one batch. The tool is a guest:
 *   it never dims, insets, pads, resizes or restyles the page under it.
 * OWN-WORLD: near-black opaque pills, paper-cream for the one committed action,
 *   halo-paired outlines on the page, small corner reference badges. No glass,
 *   no leaders, no callout balloons, no second bar.
 * STORY: hold Alt, mark what's wrong, press Send once, reload into the result.
 * FIRST VIEWPORT: the host app untouched; one capsule at bottom-right.
 * FORM: user-pinned (Wispr Flow reference) — beats the roll. Motion is the
 *   identity: shape morphs 320-420ms, content cross-fades a beat behind.
 */
(function () {
  'use strict';
  if (window.__tailr) return;

  var ORIGIN_KEY = 'tailr:' + location.origin;
  var LEARN_KEY = 'tailr:learned:' + location.origin;
  var STORE_V = 2;            // bumped when a stored verdict stops being trustworthy
  var SETTLE_MS = 1500;       // grace for a route to render before it is judged
  var enteredAt = Date.now(); // when the current route came on screen
  var EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAC = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  var ALT = MAC ? '⌥' : 'Alt';
  var SHIFT = MAC ? '⇧' : 'Shift';

  /* ── state ─────────────────────────────────────────────── */
  var S = {
    marks: [],
    seq: 1,
    armed: false,
    latched: false,
    hover: null,        // element under cursor while armed
    agent: null,        // null | {phase:'working'|'done'|'failed', served:[], total:n}
    locked: false,
    expanded: null,     // 'batch' | 'agent' | null
    teach: false,       // the key is being shown rather than the staged list
    learn: { welcomed: false, marked: false, sent: false }
  };

  function loadLearn() {
    try { Object.assign(S.learn, JSON.parse(localStorage.getItem(LEARN_KEY) || '{}')); } catch (e) {}
  }
  function learned(key) {
    if (S.learn[key]) return;
    S.learn[key] = true;
    try { localStorage.setItem(LEARN_KEY, JSON.stringify(S.learn)); } catch (e) {}
  }

  /* ── persistence ───────────────────────────────────────── */
  function save() {
    try {
      localStorage.setItem(ORIGIN_KEY, JSON.stringify({
        v: STORE_V,
        seq: S.seq,
        marks: S.marks.map(function (m) {
          return {
            id: m.id, n: m.n, type: m.type, route: m.route, selector: m.selector,
            address: m.address, comment: m.comment, before: m.before, after: m.after,
            x: m.x, y: m.y, snippet: m.snippet, tag: m.tag, status: m.status
          };
        })
      }));
      if (S.storageFailed) { S.storageFailed = false; renderIsland(); }
    } catch (e) {
      // Private mode, a full quota, or blocked site data. The whole loop rests
      // on staged markup surviving, so a silent failure here is the worst kind.
      if (!S.storageFailed) { S.storageFailed = true; renderIsland(); }
    }
  }
  function load() {
    try {
      var raw = localStorage.getItem(ORIGIN_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      S.seq = d.seq || 1;
      // Before the store carried a version, a mark was orphaned for being on
      // another route — a verdict about where the reviewer was standing, not
      // about the element. Drop those and let reconcile re-derive them.
      var trustOrphans = d.v >= STORE_V;
      // Marks the agent already applied are history once the page reloads.
      S.marks = (d.marks || []).filter(function (m) { return m.status !== 'served'; }).map(function (m) {
        if (m.type === 'insert') m.type = 'point';   // the two were merged
        if (m.status === 'orphan' && !trustOrphans) m.status = 'staged';
        m.el = null;
        // Only the route on screen can be looked at, and even it may still be
        // rendering. Adopt an element when one is already there; everything
        // else is left to reconcile, which counts misses before it declares
        // anything gone. Orphaning from here would condemn every mark made on
        // a page the reviewer has since navigated away from.
        if (m.selector && m.route === routeKey()) {
          var hit = safeQuery(m.selector);
          if (hit && sameElement(m, hit)) {
            m.el = hit;
            if (m.status === 'orphan') m.status = 'staged';
          }
        }
        return m;
      });
    } catch (e) {}
  }
  function safeQuery(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }

  /* Which page a mark belongs to. A hash router changes the view without ever
     touching the pathname, so a route-shaped hash (#/orders, #!/orders) is part
     of the address; a plain anchor (#pricing) is not — it is the same page. */
  function routeKey() {
    var h = location.hash;
    return location.pathname + (/^#!?\//.test(h) ? h : '');
  }

  /* Frameworks replace nodes on every render, so a live element reference goes
     stale without the mark being gone. Re-resolve before declaring an orphan,
     and only orphan after it has stayed missing across a few checks. */
  /* Re-anchoring to the wrong element is worse than losing the anchor: the
     agent would act on it. Adopt a re-resolved node only when its identity
     still matches; otherwise let the mark orphan and say so. */
  function sameElement(m, el) {
    if (m.tag && el.tagName !== m.tag) return false;
    return snippetOf(el) === m.snippet;
  }
  /* Orphaning is a claim about the element, so it may only be made about the
     page the mark was made on, once that page has had a chance to render. Off
     the route, or before it settles, absence is not evidence. */
  function reconcile() {
    var changed = false;
    var settling = document.readyState === 'loading' || Date.now() - enteredAt < SETTLE_MS;
    S.marks.forEach(function (m) {
      if (!m.selector || m.status === 'served') return;
      // Not the page this mark was made on — nothing here says anything about it.
      if (m.route !== routeKey()) return;
      if (m.el && m.el.isConnected) { m.misses = 0; return; }
      var found = safeQuery(m.selector);
      if (found && sameElement(m, found)) {
        m.el = found; m.misses = 0;
        if (m.status === 'orphan') { m.status = 'staged'; changed = true; }
        return;
      }
      m.el = null;
      // A client-rendered route arrives after the overlay does. Keep looking
      // rather than counting an element that has not been drawn yet as gone.
      if (settling) return;
      m.misses = (m.misses || 0) + 1;
      if (m.misses >= 3 && m.status !== 'orphan') { m.status = 'orphan'; changed = true; }
    });
    if (changed) { save(); renderMarks(); renderIsland(); }
  }

  /* A single-page app changes route without a reload, so marks belonging to the
     new route must appear and the old ones must leave. */
  function watchRoute() {
    var last = routeKey();
    function check() {
      if (routeKey() === last) return;
      last = routeKey();
      // A route the reviewer has just walked into is rendering, not missing:
      // start its marks on a clean count inside a fresh settle window.
      enteredAt = Date.now();
      S.marks.forEach(function (m) { if (m.route === last) m.misses = 0; });
      closeComposer();
      reconcile(); renderMarks(); renderIsland();
    }
    ['pushState', 'replaceState'].forEach(function (k) {
      var orig = history[k];
      if (typeof orig !== 'function') return;
      history[k] = function () { var r = orig.apply(this, arguments); setTimeout(check, 0); return r; };
    });
    addEventListener('popstate', function () { setTimeout(check, 0); });
    addEventListener('hashchange', function () { setTimeout(check, 0); });
  }

  /* ── element addressing (best-effort source resolution) ── */
  function sourceAddress(el) {
    for (var k in el) {
      if (k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0) {
        var f = el[k];
        while (f) {
          var s = f._debugSource;
          if (s && s.fileName) return baseName(s.fileName) + ':' + s.lineNumber;
          f = f._debugOwner || f.return;
        }
      }
    }
    // Build-time source attributes usually sit on the component root, not the
    // leaf you clicked, so walk up for the nearest one.
    var node = el, hops = 0;
    while (node && node.nodeType === 1 && hops < 8) {
      var attr = node.getAttribute('data-tailr-source') || node.getAttribute('data-source');
      if (attr) return baseName(attr) + (node === el ? '' : ' › ' + describe(el));
      node = node.parentElement; hops++;
    }
    return null;
  }
  function baseName(p) { var parts = String(p).split('/'); return parts[parts.length - 1]; }

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [], node = el, depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      var part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break; }
      var p = node.parentElement;
      if (p) {
        var same = Array.prototype.filter.call(p.children, function (c) { return c.tagName === node.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = p; depth++;
    }
    return parts.join(' > ');
  }

  function describe(el) {
    var t = el.tagName.toLowerCase();
    var cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return t + cls;
  }
  function snippetOf(el) {
    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return txt.length > 70 ? txt.slice(0, 70) + '…' : txt;
  }

  /* ── shadow root + styles ──────────────────────────────── */
  var host = document.createElement('div');
  host.setAttribute('data-tailr', '');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + CSS_TEXT() + '</style><div class="layer"></div><div class="island" part="island"></div>';
  var layer, island;

  function mount() {
    document.documentElement.appendChild(host);
    layer = root.querySelector('.layer');
    island = root.querySelector('.island');
    // clicking a reference number reopens that mark for editing or deletion
    layer.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-mark]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var m = S.marks.find(function (x) { return x.id === b.getAttribute('data-mark'); });
      if (!m || m.status === 'served') return;
      var r = isPoint(m)
        ? { left: m.x - scrollX, top: m.y - scrollY, bottom: m.y - scrollY, right: m.x - scrollX }
        : m.el.getBoundingClientRect();
      openComposer(m, r, true);
    }, true);
    if (!S.learn.welcomed) { S.teach = true; S.expanded = 'batch'; }
    renderIsland();
    renderMarks();
    watchRoute();
    reconcileTimer = setInterval(reconcile, 700);
    wake();
  }

  /* ── marks ─────────────────────────────────────────────── */
  function addMark(type, el, extra) {
    var m = Object.assign({
      id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
      n: S.seq++,
      type: type,
      route: routeKey(),
      el: el || null,
      selector: el ? selectorFor(el) : null,
      address: el ? (sourceAddress(el) || describe(el)) : routeKey(),
      snippet: el ? snippetOf(el) : '',
      tag: el ? el.tagName : null,
      comment: '',
      status: 'staged'
    }, extra || {});
    S.marks.push(m);
    if (!S.learn.marked) { learned('marked'); S.teach = false; }
    save(); renderMarks(); renderIsland();
    return m;
  }
  function removeMark(id) {
    var m = S.marks.find(function (x) { return x.id === id; });
    if (m && m.type === 'text' && m.el && m.before != null) m.el.textContent = m.before;
    S.marks = S.marks.filter(function (x) { return x.id !== id; });
    save(); renderMarks(); renderIsland();
  }
  function markOnRoute(m) { return m.route === routeKey(); }

  /* ── on-page rendering ─────────────────────────────────── */
  var nodes = {}, reconcileTimer = null;
  function renderMarks() {
    wake();
    var seen = {};
    S.marks.forEach(function (m) {
      if (!markOnRoute(m) || m.status === 'orphan') return;
      // Nothing to point at yet — the route is still rendering. Don't plant a
      // badge at the origin. One already on screen stays: a re-render is not a
      // disappearance, and it holds its place until reconcile rules either way.
      if (!isPoint(m) && !(m.el && m.el.isConnected) && !nodes[m.id]) return;
      seen[m.id] = 1;
      var n = nodes[m.id];
      if (!n) {
        n = document.createElement('div');
        n.className = 'mark';
        n.innerHTML = '<div class="ring"></div><div class="pt"></div>' +
                      '<div class="badge" data-mark="' + m.id + '"></div>';
        layer.appendChild(n);
        nodes[m.id] = n;
        if (!reduced) n.animate(
          [{ transform: 'scale(.94)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 180, easing: EASE });
      }
      n.className = 'mark t-' + m.type + (m.status === 'served' ? ' served' : '') +
        (isPoint(m) ? ' point' : '') +
        // the reference number is redundant while its own composer is open
        (composer && composer.mark.id === m.id ? ' composing' : '');
      n.querySelector('.badge').textContent = pad(m.n);
      position(n, m);
    });
    Object.keys(nodes).forEach(function (id) {
      if (!seen[id]) { nodes[id].remove(); delete nodes[id]; }
    });
  }
  function isPoint(m) { return m.type === 'point' || m.type === 'insert'; }
  function position(n, m) {
    if (isPoint(m)) {
      n.style.transform = 'translate(' + (m.x - scrollX) + 'px,' + (m.y - scrollY) + 'px)';
      n.style.width = n.style.height = '0px';
      return;
    }
    if (!m.el || !m.el.isConnected) return;
    var r = m.el.getBoundingClientRect();
    n.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
    n.style.width = r.width + 'px';
    n.style.height = r.height + 'px';
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* This runs inside somebody else's application, so it must not hold a frame
     open when there is nothing to draw. */
  var raf = null;
  function tick() {
    var live = false;
    for (var i = 0; i < S.marks.length; i++) {
      var n = nodes[S.marks[i].id];
      if (n) { position(n, S.marks[i]); live = true; }
    }
    if (S.armed && S.hover) { drawHover(S.hover); live = true; }
    if (composer) live = true;
    if (!live) { raf = null; return; }
    raf = requestAnimationFrame(tick);
  }
  function wake() { if (raf === null) raf = requestAnimationFrame(tick); }

  /* ── hover inspector ───────────────────────────────────── */
  var hoverEl = document.createElement('div');
  hoverEl.className = 'hover';
  hoverEl.innerHTML = '<div class="ring"></div><div class="addr"></div>';
  function drawHover(el) {
    if (!el.isConnected) return;
    var r = el.getBoundingClientRect();
    hoverEl.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
    hoverEl.style.width = r.width + 'px';
    hoverEl.style.height = r.height + 'px';
    hoverEl.querySelector('.addr').textContent = sourceAddress(el) || describe(el);
  }
  var ghostEl = document.createElement('div');
  ghostEl.className = 'pindot';

  /* ── arming ────────────────────────────────────────────── */
  function arm(on) {
    if (S.armed === on) return;
    S.armed = on;
    // reinforcement at the point of use, and only until they have marked once
    if (on && !S.learn.marked) S.teach = true;
    else if (!on && !S.expanded) S.teach = false;
    if (on) {
      wake();
      layer.appendChild(hoverEl);
      document.documentElement.setAttribute('data-tailr-armed', '');
    } else {
      hoverEl.remove(); hideGhost();
      S.hover = null;
      document.documentElement.removeAttribute('data-tailr-armed');
    }
    renderIsland();
  }

  function isOurs(el) { return !el || el === host || host.contains(el) || el.closest && el.closest('[data-tailr]'); }

  // Alt+Shift pins a dot to the cursor; it can be dropped anywhere on screen.
  function updateGhost(x, y) {
    if (!ghostEl.isConnected) layer.appendChild(ghostEl);
    ghostEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  function hideGhost() { if (ghostEl.isConnected) ghostEl.remove(); }

  /* ── composer (a textbox ON the element) ───────────────── */
  var composer = null;
  function openComposer(m, anchorRect, editing) {
    closeComposer();
    var c = document.createElement('div');
    c.className = 'composer';
    c.innerHTML =
      '<div class="c-head"><span class="c-badge">' + pad(m.n) + '</span>' +
      '<span class="c-kind">' + kindLabel(m.type) + '</span>' +
      '<span class="c-addr">' + esc(m.address) + '</span></div>' +
      '<textarea rows="2" placeholder="' + placeholderFor(m.type) + '"></textarea>' +
      '<div class="c-foot"><button class="ghost" data-act="cancel">' +
      (editing ? 'Delete' : 'Discard') + '</button>' +
      '<button class="paper" data-act="save">' + (editing ? 'Save' : 'Add') + '</button></div>';
    // Position before it is in the document, so it never flashes at the origin.
    place(c, anchorRect);
    layer.appendChild(c);
    var original = m.comment;
    var returnFocus = document.activeElement;
    composer = { el: c, mark: m, editing: !!editing, original: original,
                 returnFocus: returnFocus, commit: function () { commit(); } };
    renderMarks();
    var ta = c.querySelector('textarea');
    ta.value = m.comment || '';
    setTimeout(function () { ta.focus(); }, 20);
    if (!reduced) c.animate([{ opacity: 0, transform: 'translateY(4px) scale(.98)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 200, easing: EASE });

    c.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-act');
      if (a === 'save') commit();
      if (a === 'cancel') { editing ? removeMark(m.id) : cancel(); if (editing) closeComposer(); }
    });
    ta.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { cancel(); }
      // Enter submits; Shift+Enter breaks the line.
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    });
    // Escape abandons the edit; it never destroys a mark that already existed.
    function cancel() {
      if (editing) { m.comment = original; closeComposer(); }
      else { removeMark(m.id); closeComposer(); }
    }
    function commit() {
      if (!composer || composer.mark.id !== m.id) return;
      m.comment = ta.value.trim();
      if (!m.comment && m.type !== 'remove') { removeMark(m.id); closeComposer(); return; }
      save(); closeComposer(); renderMarks(); renderIsland();
    }
  }
  function place(c, r) {
    var w = 268, gap = 8;
    var left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    var top = r.bottom + gap;
    if (top + 150 > innerHeight) top = Math.max(8, r.top - 150 - gap);
    // left/top, not transform: the entry animation animates transform and would
    // otherwise stomp the position, flashing the composer at the origin.
    c.style.left = left + 'px';
    c.style.top = top + 'px';
  }
  function closeComposer() {
    if (!composer) return;
    var back = composer.returnFocus;
    composer.el.remove(); composer = null;
    renderMarks();
    if (back && back.isConnected && typeof back.focus === 'function') {
      try { back.focus({ preventScroll: true }); } catch (e) {}
    }
  }
  function kindLabel(t) {
    return { comment: 'Comment', remove: 'Remove', text: 'Text', point: 'Spot', insert: 'Spot' }[t] || t;
  }
  function placeholderFor(t) {
    return { comment: 'What should change here?', remove: 'Why remove it? (optional)',
      point: 'What should happen here?', insert: 'What should happen here?' }[t] || '';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]; }); }

  /* ── inline text editing ───────────────────────────────── */
  /* What a double-click means to edit is the element that owns the whole
     visible string. Requiring a childless element missed most of the real web:
     a heading with one bold word, a button with an icon, a link inside a list
     item — all have element children and all are plainly text. Inline children
     are part of the string; a block-level descendant means this is a container,
     not a sentence. */
  var BLOCK_SEL = 'address,article,aside,blockquote,canvas,dd,div,dl,dt,fieldset,figcaption,' +
    'figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr,iframe,li,main,nav,ol,p,pre,section,' +
    'table,tbody,td,tfoot,th,thead,tr,ul,video';
  /* Elements that hold a string rather than a layout. Climbing into one is how
     a click on a letter-span — the shape text animations and i18n wrappers
     leave behind — reaches the heading it belongs to, while a click on a label
     inside a flex row stays on the label instead of swallowing the row. */
  var TEXT_TAG = /^(H1|H2|H3|H4|H5|H6|P|LI|DT|DD|TD|TH|CAPTION|FIGCAPTION|BLOCKQUOTE|LABEL|BUTTON|A|SUMMARY|LEGEND)$/;
  function textHost(el) {
    if (!el || el.nodeType !== 1 || isOurs(el)) return null;
    var node = el;
    for (var hops = 0; hops < 4; hops++) {
      var p = node.parentElement;
      if (!p || p === document.body || p === document.documentElement || isOurs(p)) break;
      // a pure wrapper adds no text of its own; a text tag owns the line
      var wrapper = p.textContent.trim() === node.textContent.trim();
      if (!wrapper && !TEXT_TAG.test(p.tagName)) break;
      if (p.querySelector(BLOCK_SEL)) break;
      node = p;
    }
    if (!node.textContent.trim()) return null;
    if (node.querySelector(BLOCK_SEL)) return null;
    return node;
  }

  function editText(el) {
    var before = el.textContent;
    var m = addMark('text', el, { before: before, after: before });
    el.setAttribute('data-tailr-editing', '');
    el.contentEditable = 'true';
    // App-like pages routinely set user-select:none, which leaves a
    // contenteditable element with no caret and no way to type into it. Tailr
    // is a guest and does not restyle the page, so this is scoped to the
    // element being edited and put back exactly as it was when editing ends.
    var priorStyle = el.getAttribute('style');
    el.style.setProperty('user-select', 'text', 'important');
    el.style.setProperty('-webkit-user-select', 'text', 'important');
    el.focus();
    var sel = getSelection(); sel.selectAllChildren(el);
    function end() {
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-tailr-editing');
      if (priorStyle === null) el.removeAttribute('style'); else el.setAttribute('style', priorStyle);
      el.removeEventListener('blur', end);
      el.removeEventListener('keydown', key);
      m.after = el.textContent;
      if (m.after === m.before) removeMark(m.id);
      else { save(); renderMarks(); renderIsland(); }
    }
    function key(e) {
      e.stopPropagation();
      if (e.key === 'Escape') { el.textContent = before; el.blur(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
    }
    el.addEventListener('blur', end);
    el.addEventListener('keydown', key);
  }

  /* ── island ──────────────────────────────────────────────
     Built once and updated in place. Rebuilding the nodes re-fired the
     pointer events that caused the render, which is what made it flicker. */
  function staged() { return S.marks.filter(function (m) { return m.status !== 'served'; }); }

  var IS = null, leaveT = null, PX = 0, PY = 0;
  var CORNER_KEY = 'tailr:corner:' + location.origin;
  var drag = null, clickSuppressed = false;
  try { S.corner = localStorage.getItem(CORNER_KEY) || 'br'; } catch (e) { S.corner = 'br'; }

  function applyCorner() {
    island.className = 'island c-' + S.corner +
      (S.corner[0] === 't' ? ' top' : ' bottom') +
      (S.corner[1] === 'l' ? ' left' : ' right');
  }

  function bindDrag() {
    island.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      drag = { sx: e.clientX, sy: e.clientY, moved: false, samples: [], id: e.pointerId, captured: false };
    });
    island.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.sqrt(dx * dx + dy * dy) > 4) {
        drag.moved = true;
        island.classList.add('dragging');
        // Capture only once a drag is real. Capturing on pointerdown retargets
        // the click that follows to the island, so every button inside it dies.
        try { island.setPointerCapture(drag.id); drag.captured = true; } catch (err) {}
        if (S.expanded) { S.expanded = null; renderIsland(); }
      }
      if (!drag.moved) return;
      island.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      drag.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (drag.samples.length > 6) drag.samples.shift();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      island.addEventListener(t, function (e) {
        if (!drag) return;
        var d = drag; drag = null;
        if (d.captured) { try { island.releasePointerCapture(d.id); } catch (err) {} }
        if (!d.moved) { island.classList.remove('dragging'); return; }
        // a drag must never also fire Send
        clickSuppressed = true;
        setTimeout(function () { clickSuppressed = false; }, 0);

        // Throw it: project the release velocity forward, then snap to whichever
        // quadrant it would have landed in.
        var vx = 0, vy = 0;
        if (d.samples.length >= 2) {
          var a = d.samples[0], b = d.samples[d.samples.length - 1];
          var dt = Math.max(1, b.t - a.t);
          vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt;
        }
        var r = island.getBoundingClientRect();
        var cx = r.left + r.width / 2 + vx * 160;
        var cy = r.top + r.height / 2 + vy * 160;
        settle((cy < innerHeight / 2 ? 't' : 'b') + (cx < innerWidth / 2 ? 'l' : 'r'), r);
      });
    });
  }

  function settle(corner, fromRect) {
    var A = fromRect || island.getBoundingClientRect();
    S.corner = corner;
    try { localStorage.setItem(CORNER_KEY, corner); } catch (e) {}
    island.style.transform = '';
    island.classList.remove('dragging');
    applyCorner();
    var B = island.getBoundingClientRect();
    if (reduced) return;
    island.animate(
      [{ transform: 'translate(' + (A.left - B.left) + 'px,' + (A.top - B.top) + 'px)' },
       { transform: 'translate(0,0)' }],
      { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }
  addEventListener('pointermove', function (e) { PX = e.clientX; PY = e.clientY; }, true);

  var IS_live = null, lastAnnounce = '';
  function announce(msg) {
    if (!IS_live || msg === lastAnnounce) return;
    lastAnnounce = msg; IS_live.textContent = msg;
  }
  function buildIsland() {
    island.innerHTML = '';
    var agent = document.createElement('div');
    agent.className = 'pill agent'; agent.hidden = true;
    agent.innerHTML = '<div class="ainner"><div class="aico"></div><div class="body"></div></div>';
    var batch = document.createElement('div');
    batch.className = 'pill batch';
    batch.setAttribute('role', 'button');
    batch.innerHTML = '<div class="list"></div><div class="row"></div>';
    agent.setAttribute('role', 'status');
    var live = document.createElement('div');
    live.className = 'sr'; live.setAttribute('aria-live', 'polite');
    island.appendChild(agent);   // the agent pill sits to the LEFT
    island.appendChild(batch);
    island.appendChild(live);
    IS_live = live;
    // Focus opens the panel too, so the list is reachable without a pointer.
    island.addEventListener('focusin', function (e) {
      var p = e.target.closest && e.target.closest('[data-pill]');
      if (p) setExpanded(p.getAttribute('data-pill'));
    });
    island.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.expanded) { e.stopPropagation(); setExpanded(null); island.blur(); return; }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var row = e.target.closest && e.target.closest('.li[data-act="edit"]');
      if (row) { e.preventDefault(); e.stopPropagation(); return editMark(row.getAttribute('data-id')); }
      var p = e.target.closest && e.target.closest('[data-pill]');
      if (!p) return;
      e.preventDefault(); e.stopPropagation();
      if (p.getAttribute('data-pill') === 'batch') islandClick({ target: p.querySelector('.row') || p });
      else setExpanded(S.expanded === 'agent' ? null : 'agent');
    });
    agent.setAttribute('data-pill', 'agent');
    batch.setAttribute('data-pill', 'batch');
    IS = { agent: agent, aico: agent.querySelector('.aico'), abody: agent.querySelector('.body'),
           batch: batch, list: batch.querySelector('.list'), row: batch.querySelector('.row') };
    bindHover(batch, 'batch'); bindHover(agent, 'agent');
    applyCorner(); bindDrag();
  }
  function bindHover(node, name) {
    node.addEventListener('pointerenter', function () {
      if (drag) return;
      clearTimeout(leaveT); setExpanded(name);
    });
    node.addEventListener('pointerleave', function () {
      // Confirm against real bounds: removing a row can fire leave while the
      // pointer is still over the pill, which used to snap it shut.
      clearTimeout(leaveT);
      leaveT = setTimeout(function () {
        if (S.expanded === name && !inside(node)) setExpanded(null);
      }, 140);
    });
  }
  function inside(node) {
    var r = node.getBoundingClientRect();
    return PX >= r.left - 2 && PX <= r.right + 2 && PY >= r.top - 2 && PY <= r.bottom + 2;
  }
  function setExpanded(v) { if (S.expanded === v) return; S.expanded = v; renderIsland(); }

  function renderIsland() {
    if (!IS) buildIsland();
    var count = staged().length;
    var needsReload = !!(S.agent && S.agent.phase === 'done');
    var sig = [count, S.locked, S.armed, S.expanded, needsReload, S.teach, S.learn.welcomed,
      S.agent ? S.agent.phase : '-', S.agent ? S.agent.served.length : 0,
      S.marks.map(function (m) { return m.id + m.status; }).join(',')].join('|');
    if (sig === renderIsland._sig) return;
    renderIsland._sig = sig;

    var b0 = IS.batch.getBoundingClientRect();
    var a0 = IS.agent.hidden ? null : IS.agent.getBoundingClientRect();

    var dormant = count === 0 && !needsReload;
    var teaching = S.teach || (S.expanded === 'batch' && count === 0);
    var welcoming = teaching && !S.learn.welcomed;
    // The dismiss belongs to the welcome, not to any one row state — a reviewer
    // arriving while a finished run is still on the server must still be able
    // to put the card away.
    var dismiss = welcoming ? '<button class="paper row-dismiss" data-act="gotit">Got it</button>' : '';
    IS.row.className = 'row' + (welcoming ? ' has-dismiss' : '');
    if (dormant) {
      IS.row.innerHTML = dismiss +
        '<span class="dot ' + (S.armed ? 'live' : '') + '"></span>' +
        '<span class="hint">' + (S.armed ? 'Marking' : 'Hold ' + ALT + ' to mark') + '</span>';
    } else {
      var label = needsReload ? 'Needs refresh'
        : S.locked ? 'Sent'
        : count === 1 ? 'Send' : 'Send batch';
      IS.row.innerHTML = dismiss +
        (count ? '<span class="count">' + count + '</span>' : '') +
        '<span class="send">' + label + '</span>';
    }

    var open = (S.expanded === 'batch' && count > 0) || teaching;
    IS.batch.className = 'pill batch ' +
      (dormant ? 'dormant' : (needsReload || S.locked) ? 'locked' : 'ready') +
      (open ? ' open' : '') + (teaching ? ' teaching' : '');
    IS.list.innerHTML = teaching ? keyHtml(!S.learn.welcomed) : (open ? listHtml() : '');

    if (S.agent) {
      var wasHidden = IS.agent.hidden;
      IS.agent.hidden = false;
      // Rewriting this node restarts the CSS animation, so the spinner would
      // reset every time a mark came back. Only touch it when the phase changes.
      if (IS.aicoPhase !== S.agent.phase) {
        IS.aico.innerHTML = agentIcon(S.agent);
        IS.aicoPhase = S.agent.phase;
      }
      IS.abody.innerHTML = S.expanded === 'agent' ? agentBody(S.agent) : '';
      IS.agent.className = 'pill agent ' + S.agent.phase + (S.expanded === 'agent' ? ' open' : '');
      if (wasHidden) a0 = { width: 0, height: 38 };
    } else {
      IS.agent.hidden = true;
      IS.aicoPhase = null;
    }

    morph(IS.batch, b0);
    if (!IS.agent.hidden) morph(IS.agent, a0);
  }

  /* one object, many shapes — measure, swap, animate both axes */
  function morph(el, from) {
    if (reduced || !from) return;
    // `from` was measured while the previous animation was still running, so a
    // re-hover mid-close resumes from the current shape rather than snapping.
    if (el.__anim) { el.__anim.cancel(); el.__anim = null; }
    if (el.__fades) { el.__fades.forEach(function (a) { a.cancel(); }); }
    var to = el.getBoundingClientRect();
    if (Math.abs(from.width - to.width) < 1 && Math.abs(from.height - to.height) < 1) return;
    // Shorten the travel when the shape is already part-way there.
    var span = Math.max(Math.abs(to.width - from.width), Math.abs(to.height - from.height));
    var full = Math.max(to.width, from.width, to.height, from.height, 1);
    var dur = Math.max(140, Math.min(380, 380 * (span / full) + 140));
    el.__anim = el.animate(
      [{ width: from.width + 'px', height: from.height + 'px' },
       { width: to.width + 'px', height: to.height + 'px' }],
      { duration: dur, easing: EASE });
    el.__fades = [];
    var inner = el.querySelectorAll('.list, .body');
    for (var i = 0; i < inner.length; i++) {
      if (!inner[i].firstChild) continue;
      el.__fades.push(inner[i].animate(
        [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 140, delay: Math.min(90, dur * 0.25), easing: EASE, fill: 'backwards' }));
    }
  }

  function agentIcon(a) {
    if (a.phase === 'working') return '<span class="loader"></span>';
    if (a.phase === 'done') return '<span class="ico ok">✓</span>';
    return '<span class="ico bad">!</span>';
  }
  function agentBody(a) {
    if (a.phase === 'working')
      return '<div class="btitle">Agent is working</div>' +
        '<div class="bmeta">' + a.served.length + ' of ' + a.total + ' applied</div>' +
        '<div class="bact"><button class="ghost" data-act="abandon">Cancel</button></div>';
    if (a.phase === 'done')
      return '<div class="btitle">' + a.total + (a.total === 1 ? ' change' : ' changes') + ' applied</div>' +
        '<div class="bmeta">Reload to see them. Anything you staged since is kept.</div>' +
        '<div class="bact"><button class="paper" data-act="reload">Reload</button></div>';
    return '<div class="btitle bad">Returned incomplete</div>' +
      '<div class="bmeta">' + (a.error ? esc(a.error) + ' ' : '') +
        a.served.length + ' of ' + a.total + " applied. Tailr can't say why — check your agent session.</div>" +
      '<div class="bact"><button class="paper" data-act="resend">Re-send ' + (a.total - a.served.length) + '</button></div>';
  }
  /* The gestures are only usable while Alt is held, so the moment Alt goes down
     with nothing yet marked is the honest place to teach them. It lives in the
     island because a modal over an application Tailr does not own would break
     the one rule the whole design rests on. */
  function keyHtml(welcome) {
    var rows = [
      ['Click', 'Comment on an element'],
      ['Right-click', 'Remove an element'],
      ['Double-click', 'Edit text'],
      [SHIFT + ' Click', 'Comment on a spot']
    ];
    var h = '<div class="teach">';
    if (welcome) {
      h += '<div class="t-head">Mark up this page</div>' +
           '<div class="t-sub">Hold ' + ALT + ' and click anything that should change, ' +
           'then send the batch to your agent.</div>';
    }
    h += '<div class="t-when">While ' + ALT + ' is held</div><dl class="t-key">';
    rows.forEach(function (r) {
      h += '<div class="t-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
    });
    h += '</dl>';
    return h + '</div>';
  }

  function listHtml() {
    var byRoute = {}, orph = [];
    staged().forEach(function (m) {
      if (m.status === 'orphan') orph.push(m);
      else (byRoute[m.route] = byRoute[m.route] || []).push(m);
    });
    var h = '';
    if (S.storageFailed) {
      h += '<div class="grp bad">Not being saved — this browser is blocking site data. ' +
           'Send before you reload.</div>';
    }
    if (orph.length) {
      h += '<div class="grp bad">Orphaned — element no longer on the page</div>';
      orph.forEach(function (m) { h += rowHtml(m, true); });
    }
    Object.keys(byRoute).forEach(function (r) {
      h += '<div class="grp">' + esc(r) + '</div>';
      byRoute[r].forEach(function (m) { h += rowHtml(m, false); });
    });
    return h;
  }
  function rowHtml(m, orphan) {
    var text = m.type === 'text' ? '“' + esc(m.before) + '” → “' + esc(m.after) + '”' : esc(m.comment || m.snippet);
    // The on-page badge is deliberately small so it never covers what it labels,
    // which leaves it under the minimum target size. The row is its equivalent —
    // and the only route to editing a mark without a pointer.
    var editable = m.route === routeKey() && (isPoint(m) || (m.el && m.el.isConnected));
    var attrs = editable
      ? ' role="button" tabindex="0" data-act="edit" data-id="' + m.id + '" title="Edit mark ' + pad(m.n) + '"'
      : '';
    return '<div class="li' + (orphan ? ' orph' : '') + (editable ? ' editable' : '') + '"' + attrs + '>' +
      '<span class="li-n ' + m.type + '">' + pad(m.n) + '</span>' +
      '<span class="li-k">' + kindLabel(m.type) + '</span>' +
      '<span class="li-a">' + esc(m.address) + '</span>' +
      '<span class="li-c" title="' + text.replace(/"/g, '&quot;') + '">' + text + '</span>' +
      '<button class="li-x" data-act="drop" data-id="' + m.id +
      '" aria-label="Remove mark ' + pad(m.n) + '">×</button></div>';
  }

  /* ── send flow ─────────────────────────────────────────── */
  function send() {
    var batch = staged();
    if (!batch.length || S.locked) return;
    S.locked = true;
    learned('sent');
    S.agent = { phase: 'working', served: [], total: batch.length };
    S.expanded = null;
    renderIsland();
    try {
      window.__tailr.transport.send(payload(batch));
    } catch (e) {
      // The bridge is the one thing Tailr cannot see inside. If handing off
      // throws, say so immediately rather than locking on a run that never began.
      S.agent.error = 'Tailr could not reach the agent bridge.';
      finish(false);
    }
  }
  function payload(batch) {
    return {
      origin: location.origin,
      sentAt: new Date().toISOString(),
      marks: batch.map(function (m) {
        return { ref: pad(m.n), type: m.type, route: m.route, address: m.address,
          selector: m.selector, element: m.snippet, comment: m.comment,
          before: m.before, after: m.after, x: m.x, y: m.y, orphaned: m.status === 'orphan' };
      })
    };
  }
  /* Idempotent: the bridge replays the full served list on every update, so
     this must be safe to call repeatedly with the same ref. */
  function served(ref) {
    var m = S.marks.find(function (x) { return pad(x.n) === ref; });
    if (!m || m.status === 'served') return;
    m.status = 'served';
    if (S.agent && S.agent.served.indexOf(ref) === -1) S.agent.served.push(ref);
    save(); renderMarks(); renderIsland();
  }
  function abandon() {
    // Nothing guarantees the agent ever answers. The user must always be able
    // to take their batch back rather than sit in a permanent locked state.
    S.agent = null; S.locked = false; S.expanded = null;
    S.marks.forEach(function (m) { if (m.status !== 'served') m.status = 'staged'; });
    save(); renderMarks(); renderIsland();
  }
  function finish(ok) {
    if (!S.agent) return;
    S.agent.phase = ok ? 'done' : 'failed';
    S.locked = !ok ? false : true;
    if (!ok) S.marks.forEach(function (m) { if (m.status === 'served') return; m.status = 'staged'; });
    renderIsland();
  }

  /* ── events ────────────────────────────────────────────── */
  function onKeyDown(e) {
    if (e.key === 'Alt') {
      e.preventDefault();               // Windows/Linux: stop menu-bar focus
      if (!S.latched) arm(true);
      var now = Date.now();
      if (now - (onKeyDown._t || 0) < 320) { S.latched = true; arm(true); }
      onKeyDown._t = now;
    }
    if (e.key === 'Escape') {
      if (composer) {
        if (composer.editing) composer.mark.comment = composer.original;
        else removeMark(composer.mark.id);
        closeComposer();
      }
      else if (S.latched) { S.latched = false; arm(false); }
      else if (S.expanded) { S.expanded = null; renderIsland(); }
    }
    if (!S.latched || composer) return;
    // latched-mode verbs + structural walking
    var el = S.hover;
    if (!el) return;
    var k = e.key.toLowerCase();
    if (k === 'arrowup' && el.parentElement && !isOurs(el.parentElement)) { S.hover = el.parentElement; e.preventDefault(); }
    if (k === 'arrowdown' && el.firstElementChild) { S.hover = el.firstElementChild; e.preventDefault(); }
    if (k === 'arrowright' && el.nextElementSibling) { S.hover = el.nextElementSibling; e.preventDefault(); }
    if (k === 'arrowleft' && el.previousElementSibling) { S.hover = el.previousElementSibling; e.preventDefault(); }
    if (k === 'c') { e.preventDefault(); openComposer(addMark('comment', el), el.getBoundingClientRect()); }
    if (k === 'r') { e.preventDefault(); addMark('remove', el); }
    if (k === 'e') { e.preventDefault(); var h = textHost(el); if (h) editText(h); }
  }
  function onKeyUp(e) {
    if (e.key === 'Alt') { e.preventDefault(); if (!S.latched) arm(false); }
    if (e.key === 'Shift') hideGhost();
  }
  function onMove(e) {
    if (e.altKey && !S.armed) arm(true);
    else if (!e.altKey && S.armed && !S.latched) arm(false);
    if (!S.armed) return;
    if (e.altKey && e.shiftKey) { updateGhost(e.clientX, e.clientY); hoverEl.style.opacity = '0'; return; }
    hoverEl.style.opacity = '1';
    hideGhost();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !isOurs(el)) S.hover = el;
  }
  /* Arming derives from the event's own altKey, not only from a keydown we
     happened to see. A focus change, a swallowed keydown, or a synthetic click
     must never leave a gesture unrecognised. */
  function guard(e) {
    // Gate on the event's own modifier state, never on the sticky armed flag.
    // A missed Alt keyup — window blur, a release outside the frame — would
    // otherwise leave Tailr swallowing ordinary clicks on the host app.
    var live = e.altKey || S.latched;
    if (S.armed !== live) arm(live);
    if (!live || isOurs(e.target)) return false;
    e.preventDefault(); e.stopPropagation(); return true;
  }
  function targetAt(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !isOurs(el)) return el;
    return (S.hover && S.hover.isConnected) ? S.hover : e.target;
  }
  function onDown(e) { if (guard(e)) {} }            // kills alt-click download + middle autoscroll
  function onCtx(e) {
    if (!guard(e)) return;
    var rel = targetAt(e);
    var existing = S.marks.find(function (m) {
      return m.type === 'remove' && m.el === rel && m.status !== 'served';
    });
    if (existing) removeMark(existing.id); else addMark('remove', rel);
  }
  function onAux(e) {
    if (!guard(e)) return;
    if (e.button !== 1) return;
    // hidden alias for the same mark — a shortcut for anyone with a middle button,
    // never taught, because Shift-click already reaches every pointing device
    placePoint(e);
  }
  /* A double-click also delivers two single clicks. Hold the comment briefly so
     a dblclick on the same target wins instead of stacking marks. */
  var clickTimer = null;
  /* A mark anchored to a place rather than a thing. Whether the reviewer wants
     something new there or is just noting the spot is carried by what they
     write, not by which gesture they used. */
  function placePoint(e) {
    hideGhost();
    var m = addMark('point', null, { x: e.clientX + scrollX, y: e.clientY + scrollY });
    openComposer(m, { left: e.clientX, top: e.clientY, bottom: e.clientY, right: e.clientX });
  }

  function onClick(e) {
    if (!guard(e)) return;
    if (composer) { composer.commit(); return; }
    if (e.shiftKey) {
      placePoint(e);
      return;
    }
    var el = targetAt(e), rect = el.getBoundingClientRect();
    clearTimeout(clickTimer);
    clickTimer = setTimeout(function () {
      clickTimer = null;
      openComposer(addMark('comment', el), rect);
    }, 260);
  }
  function onDbl(e) {
    if (!guard(e)) return;
    var host = textHost(targetAt(e));
    // Nothing here is a string — a container, an image, a gap between blocks.
    // Leave the pending click alone so the gesture still lands as a comment
    // rather than being answered with nothing at all.
    if (!host) return;
    clearTimeout(clickTimer); clickTimer = null;
    editText(host);
  }

  function editMark(id) {
    var m = S.marks.find(function (x) { return x.id === id; });
    if (!m || m.status === 'served') return;
    setExpanded(null);
    var open = function () {
      var r = isPoint(m)
        ? { left: m.x - scrollX, top: m.y - scrollY, bottom: m.y - scrollY, right: m.x - scrollX }
        : m.el.getBoundingClientRect();
      openComposer(m, r, true);
    };
    if (!isPoint(m) && m.el && m.el.isConnected) {
      m.el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      setTimeout(open, reduced ? 0 : 320);
    } else open();
  }

  /* island interaction */
  function islandClick(e) {
    if (clickSuppressed) return;
    var b = e.target.closest && e.target.closest('[data-act]');
    if (b) {
      e.stopPropagation();
      var a = b.getAttribute('data-act');
      if (a === 'drop') { clearTimeout(leaveT); removeMark(b.getAttribute('data-id')); }
      if (a === 'edit') editMark(b.getAttribute('data-id'));
      if (a === 'reload') location.reload();
      if (a === 'resend') { S.agent = null; S.locked = false; renderIsland(); }
      if (a === 'abandon') abandon();
      if (a === 'gotit') { learned('welcomed'); S.teach = false; S.expanded = null; renderIsland(); }
      return;
    }
    if (e.target.closest('.batch') && !S.locked && !(S.agent && S.agent.phase === 'done') && staged().length) send();
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('contextmenu', onCtx, true);
  document.addEventListener('auxclick', onAux, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('dblclick', onDbl, true);
  addEventListener('blur', function () { if (!S.latched) arm(false); });

  /* ── public ────────────────────────────────────────────── */
  window.__tailr = {
    state: S,
    send: send,
    served: served,
    finish: finish,
    payload: function () { return payload(staged()); },
    /* Reflect authoritative run state from the bridge. The server is the only
       thing that knows whether a run is still open, so the overlay follows it
       rather than keeping its own idea of the truth. */
    sync: function (run) {
      if (!run) {
        // the server forgot the run (restarted, or it was reset) — give the
        // batch back rather than sitting locked against nothing
        if (S.agent && S.agent.phase === 'working') abandon();
        return;
      }
      if (run.phase === 'working') {
        S.locked = true;
        if (!S.agent || S.agent.phase !== 'working') S.agent = { phase: 'working', served: [], total: run.total };
        S.agent.total = run.total;
        S.agent.served = (run.served || []).slice();
        (run.served || []).forEach(served);
        renderIsland();
        return;
      }
      if (!S.agent) S.agent = { phase: 'working', served: (run.served || []).slice(), total: run.total };
      (run.served || []).forEach(function (ref) { served(ref); });
      S.agent.served = (run.served || []).slice();
      S.agent.total = run.total;
      if (run.error) S.agent.error = run.error;
      finish(run.phase === 'done');
    },
    clear: function () {
      closeComposer();
      S.marks = []; S.seq = 1; S.agent = null; S.locked = false;
      save(); renderMarks(); renderIsland();
    },
    destroy: function () {
      if (raf !== null) cancelAnimationFrame(raf);
      if (reconcileTimer) clearInterval(reconcileTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('contextmenu', onCtx, true);
      document.removeEventListener('auxclick', onAux, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('dblclick', onDbl, true);
      document.documentElement.removeAttribute('data-tailr-armed');
      host.remove();
      delete window.__tailr;
    },
    // Replaced by the CLI with the real local-server bridge. Left unreplaced,
    // a Send would otherwise disappear silently — so it fails where the user
    // can see it, through the same path a dead bridge takes.
    transport: {
      send: function () {
        if (S.agent) S.agent.error = 'Tailr is not connected to a session.';
        finish(false);
      }
    }
  };

  loadLearn();
  load();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  root.addEventListener('click', islandClick);

  /* ── styles ────────────────────────────────────────────── */
  function CSS_TEXT() { return `
:host{all:initial;direction:ltr}
/* user-authored text keeps its own direction inside our LTR chrome */
.li-c,.bmeta,.composer textarea,.c-addr{unicode-bidi:plaintext}
*{box-sizing:border-box;margin:0;padding:0;font-family:ui-sans-serif,-apple-system,'SF Pro Text','Segoe UI',system-ui,sans-serif}
.layer{position:fixed;inset:0;pointer-events:none}

/* halo-paired outlines: read on white, black, or a photograph */
.hover,.mark{position:absolute;top:0;left:0;pointer-events:none;will-change:transform}
.hover .ring,.mark .ring{position:absolute;inset:0;border-radius:3px;
  box-shadow:0 0 0 1px #0B0B0C, 0 0 0 2px rgba(255, 255, 255, 0.92)}
.mark.t-remove .ring{box-shadow:0 0 0 1.5px #E8483C, 0 0 0 2.5px rgba(255, 255, 255, 0.92)}
.mark.served .ring{box-shadow:0 0 0 1px rgba(11, 11, 12, 0.28), 0 0 0 2px rgba(255, 255, 255, 0.5)}
.hover .addr{position:absolute;left:0;top:-19px;height:17px;display:flex;align-items:center;
  padding:0 6px;background:#0B0B0C;color:#fff;border-radius:5px;
  font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10.5px;letter-spacing:-.01em;
  white-space:nowrap;box-shadow:0 0 0 1px rgba(255, 255, 255, 0.5);
  max-width:min(340px,90vw);overflow:hidden;text-overflow:ellipsis}
.mark .badge{position:absolute;left:-1px;top:-9px;pointer-events:auto;cursor:pointer;transition:opacity .12s;min-width:17px;height:17px;padding:0 4px;
  display:flex;align-items:center;justify-content:center;background:#0B0B0C;color:#fff;
  border-radius:5px;font-size:10px;font-weight:700;font-variant-numeric:tabular-nums;
  box-shadow:0 0 0 1px rgba(255, 255, 255, 0.65)}
.mark.t-remove .badge{background:#E8483C}
.mark.served .badge{background:rgba(11, 11, 12, 0.35)}
.mark .pt{display:none}
.mark.point .ring{display:none}
.mark.point .pt{display:block;position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;
  background:#0B0B0C;box-shadow:0 0 0 2px rgba(255, 255, 255, 0.92)}
.mark.point .badge{left:10px;top:-8px}
.mark.composing .badge{opacity:0}
.pindot{position:absolute;top:0;left:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;
  background:#0B0B0C;box-shadow:0 0 0 2px rgba(255, 255, 255, 0.92);pointer-events:none}

/* composer — a textbox ON the element */
.composer{position:absolute;width:268px;pointer-events:auto;background:#0B0B0C;
  border-radius:12px;padding:10px;color:#fff;
  box-shadow:0 10px 34px rgba(0, 0, 0, 0.34),0 0 0 1px rgba(255, 255, 255, 0.10)}
.c-head{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.c-badge{min-width:17px;height:17px;padding:0 4px;display:flex;align-items:center;justify-content:center;
  background:rgba(255, 255, 255, 0.12);border-radius:5px;font-size:10px;font-weight:700;font-variant-numeric:tabular-nums}
.c-kind{font-size:11px;font-weight:650;letter-spacing:-.005em}
.c-addr{margin-left:auto;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10.5px;
  color:rgba(255, 255, 255, 0.56);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.composer textarea{width:100%;background:rgba(255, 255, 255, 0.06);border:none;outline:none;color:#fff;
  border-radius:9px;padding:8px;font-size:12.5px;line-height:1.45;resize:none;
  max-height:180px;overflow-y:auto;overflow-wrap:break-word}
.composer textarea::-webkit-scrollbar{width:0;display:none}
.composer textarea::placeholder{color:rgba(255, 255, 255, 0.56)}
.composer textarea:focus{box-shadow:0 0 0 2px rgba(47, 212, 168, 0.55)}
.c-foot{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}
button{border:none;cursor:pointer;font-size:12px;font-weight:650;border-radius:999px;padding:6px 14px;
  font-family:inherit;letter-spacing:-.005em}
button.paper{background:#F2EDE1;color:#0B0B0C}
button.ghost{background:transparent;color:rgba(255, 255, 255, 0.56)}
button.ghost:hover{color:#fff}
:focus-visible{outline:2px solid #2FD4A8;outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* the island */
.island{position:fixed;display:flex;gap:8px;pointer-events:auto;overflow:visible;
  max-width:calc(100vw - 40px);
  touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.island textarea,.island input{user-select:text;-webkit-user-select:text}
.island.dragging{cursor:grabbing}
/* the island lives in a corner; the second pill always sits outboard of the first */
.island.c-br{right:20px;bottom:20px;flex-direction:row;align-items:flex-end}
.island.c-bl{left:20px;bottom:20px;flex-direction:row-reverse;align-items:flex-end}
.island.c-tr{right:20px;top:20px;flex-direction:row;align-items:flex-start}
.island.c-tl{left:20px;top:20px;flex-direction:row-reverse;align-items:flex-start}
/* A pill grows away from the edge it is anchored to, so its content must be
   packed against that edge — otherwise it overflows past the anchor while the
   box catches up, and the icon visibly flies out and slides back. */
.island.top .pill{justify-content:flex-start}
.island.top .batch{flex-direction:column-reverse;justify-content:flex-end}
.island.top .list{padding:0 6px 6px}
.island.left .row{justify-content:flex-start}
/* the icon keeps the anchored corner — the one point that does not move */
.island.right .ainner{flex-direction:row-reverse}
.island.left .ainner{flex-direction:row}
.island.bottom .ainner{align-items:flex-end}
.island.top .ainner{align-items:flex-start}
.island.right .body{padding-left:14px;padding-right:0}
.island.left .body{padding-left:0;padding-right:14px}
.island.right .bact{justify-content:flex-start;margin-left:-4px}
.island.left .bact{justify-content:flex-end;margin-right:-4px}
.pill{background:#0B0B0C;border-radius:19px;color:#fff;overflow:hidden;cursor:pointer;
  max-width:calc(100vw - 40px);
  box-shadow:0 8px 30px rgba(0, 0, 0, 0.30),0 0 0 1px rgba(255, 255, 255, 0.10);
  display:flex;flex-direction:column;justify-content:flex-end}
.pill[hidden]{display:none}
.list:empty{display:none}
.row{display:flex;align-items:center;justify-content:flex-end;gap:8px;height:38px;padding:0 14px;
  white-space:nowrap;flex:0 0 auto;min-width:0}
.dot{width:7px;height:7px;border-radius:50%;background:rgba(255, 255, 255, 0.28);flex:0 0 auto;transition:background .12s}
.dot.live{background:#2FD4A8;box-shadow:0 0 8px rgba(47, 212, 168, 0.7)}
.hint{font-size:12.5px;font-weight:500;color:rgba(255, 255, 255, 0.56);letter-spacing:-.005em}
.count{min-width:20px;height:20px;padding:0 6px;display:flex;align-items:center;justify-content:center;
  background:#F2EDE1;color:#0B0B0C;border-radius:999px;font-size:11.5px;font-weight:700;
  font-variant-numeric:tabular-nums}
.send{font-size:13px;font-weight:650;letter-spacing:-.005em}
.batch.locked{cursor:default}
.batch.locked .count{background:rgba(255, 255, 255, 0.14);color:rgba(255, 255, 255, 0.56)}
.batch.locked .send{color:rgba(255, 255, 255, 0.56)}

.list{max-height:min(280px,60vh);overflow-y:auto;padding:6px 6px 0;
  min-width:min(430px,calc(100vw - 56px));max-width:min(560px,calc(100vw - 56px));
  scrollbar-width:none;-ms-overflow-style:none}
.list::-webkit-scrollbar{width:0;height:0;display:none}
.batch.teaching .list{max-height:min(440px,78vh)}
.teach{padding:4px 10px 10px;min-width:min(300px,calc(100vw - 56px));max-width:340px}
.t-head{font-size:13px;font-weight:650;letter-spacing:-.005em;margin:6px 0 4px}
.t-sub{font-size:12.5px;line-height:1.45;color:rgba(255, 255, 255, 0.56);margin-bottom:14px;
  overflow-wrap:break-word}
.t-when{font-size:11px;font-weight:650;color:rgba(255, 255, 255, 0.56);margin-bottom:6px}
.t-key{margin:0}
.t-row{display:flex;align-items:baseline;gap:10px;padding:4px 0;min-width:0}
.t-row dt{flex:0 0 96px;font-size:11.5px;font-weight:650;color:rgba(255, 255, 255, 0.56);
  white-space:nowrap}
.t-row dd{margin:0;font-size:12.5px;flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.row-dismiss{margin-right:auto}
.row.has-dismiss{padding-left:6px}
.grp{padding:6px 8px 4px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;
  color:rgba(255, 255, 255, 0.56);overflow-wrap:anywhere}
.grp.bad{color:#E8483C}
.li{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 8px;border-radius:9px;min-width:0}
.li.editable{cursor:pointer}
.li.editable:hover,.li.editable:focus-visible{background:rgba(255, 255, 255, 0.06)}
.li-n{min-width:19px;height:19px;padding:0 4px;display:flex;align-items:center;justify-content:center;
  background:rgba(255, 255, 255, 0.12);border-radius:5px;font-size:10px;font-weight:700;
  font-variant-numeric:tabular-nums;flex:0 0 auto}
.li-n.remove{background:#E8483C}
.li-k{font-size:11px;font-weight:650;width:52px;flex:0 0 auto;color:rgba(255, 255, 255, 0.56)}
.li-a{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10.5px;color:rgba(255, 255, 255, 0.56);
  width:118px;flex:0 0 118px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.li-c{font-size:12.5px;flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.li.orph .li-n{background:transparent;color:#E8483C;box-shadow:inset 0 0 0 1px #E8483C}
.li-x{background:transparent;color:rgba(255, 255, 255, 0.56);font-size:13px;font-weight:400;
  width:26px;height:26px;flex:0 0 26px;display:flex;align-items:center;justify-content:center;
  padding:0;border-radius:999px}
.li-x:hover{background:rgba(255, 255, 255, 0.12);color:#FFFFFF}

.ainner{display:flex}
.aico{flex:0 0 auto;width:38px;height:38px;display:flex;align-items:center;justify-content:center}
.aico > *{width:18px;height:18px;box-sizing:border-box;flex:0 0 auto}
.loader{border-radius:50%;border:2px solid rgba(255, 255, 255, 0.18);
  border-top-color:#F0A93B;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.ico{border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;line-height:1}
.ico.ok{background:#2FD4A8;color:#04231B}
.ico.bad{background:#E8483C;color:#fff}
.body{min-width:232px;max-width:286px;padding:10px 0}
.agent:not(.open) .body{display:none}
.btitle{font-size:13px;font-weight:650;letter-spacing:-.005em;margin-bottom:4px;overflow-wrap:break-word}
.btitle.bad{color:#E8483C}
.bmeta{font-size:12px;line-height:1.45;color:rgba(255, 255, 255, 0.56);overflow-wrap:break-word}
.bact{display:flex;margin-top:10px}
@media (prefers-reduced-motion:reduce){.loader{animation-duration:1.6s}}
`; }
})();
