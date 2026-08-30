/* Bridge: wires the overlay to the Tailr server.
 *
 * Appended to the overlay by the CLI, so the overlay file stays a pure,
 * transport-agnostic artifact and the demo can still run without a server.
 *
 * The server is authoritative about whether a run is open. This file only
 * carries messages: it never decides the state itself.
 */
(function () {
  'use strict';
  if (!window.__tailr || window.__tailr.__bridged) return;
  window.__tailr.__bridged = true;

  var API = '/__tailr/';
  var T = window.__tailr;

  T.transport = {
    send: function (payload) {
      fetch(API + 'batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (r.ok) return null;
        return r.json().catch(function () { return {}; }).then(function (b) {
          throw new Error(b.error || ('Tailr server returned ' + r.status));
        });
      }).catch(function (err) {
        // Report through the overlay's own failure path so the batch comes back
        // to the user instead of hanging on a send that never landed.
        if (T.state.agent) T.state.agent.error = err.message;
        T.finish(false);
      });
    }
  };

  /* ── live run state ────────────────────────────────────── */
  var es = null, retry = 0, retryTimer = null;

  function connect() {
    if (es) { try { es.close(); } catch (e) {} }
    try { es = new EventSource(API + 'events'); } catch (e) { return schedule(); }

    es.onopen = function () { retry = 0; };
    es.onmessage = function (ev) {
      var data;
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      T.sync(data.run);
    };
    es.onerror = function () {
      // The dev server restarting takes the stream with it; back off and return.
      try { es.close(); } catch (e) {}
      es = null;
      schedule();
    };
  }

  function schedule() {
    if (retryTimer) return;
    var wait = Math.min(1000 * Math.pow(2, retry++), 15000);
    retryTimer = setTimeout(function () { retryTimer = null; connect(); }, wait);
  }

  connect();
  addEventListener('pagehide', function () { if (es) try { es.close(); } catch (e) {} });
})();
