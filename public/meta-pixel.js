/* Meta Pixel: inicialização e PageView únicos por carregamento do documento. */
(function () {
  "use strict";
  if (window.__metaPixel1078609691707266) return;
  window.__metaPixel1078609691707266 = true;

  // Bootstrap oficial: a biblioteca remota é carregada de forma assíncrona.
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq("init", "1078609691707266");
  window.fbq("track", "PageView");
})();
