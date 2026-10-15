/* Tracking compartilhado por todas as páginas. Não modifica fetch, XHR ou APIs. */
(function () {
  "use strict";
  if (window.TrackingParams) return;

  var KEY = "tracking_params_v1";
  var TTL = 30 * 24 * 60 * 60 * 1000;
  var CHUNK_SIZE = 3000;
  var anchors = new WeakMap();
  var ownedInputs = new WeakSet();
  var registeredForms = new WeakSet();
  var submissionParams = new WeakMap();
  var queued = false;
  var lastSearch = window.location.search;
  var nativeReplace = window.history.replaceState.bind(window.history);
  var nativeAssign = window.location.assign.bind(window.location);
  var nativeLocationReplace = window.location.replace.bind(window.location);
  var nativeOpen = window.open.bind(window);

  function parse(raw) {
    try {
      var value = JSON.parse(raw);
      if (
        !value ||
        value.version !== 1 ||
        !Number.isFinite(value.expiresAt) ||
        value.expiresAt <= Date.now() ||
        !Number.isFinite(value.updatedAt) ||
        !Number.isFinite(value.firstAccess) ||
        value.firstAccess < 0 ||
        value.firstAccess > 8640000000000000 ||
        !Array.isArray(value.params) ||
        !value.params.every(function (pair) {
          return (
            Array.isArray(pair) &&
            pair.length === 2 &&
            typeof pair[0] === "string" &&
            typeof pair[1] === "string"
          );
        })
      )
        return null;
      ["firstSource", "firstCampaign"].forEach(function (key) {
        var touch = value[key];
        if (!touch || typeof touch.value !== "string" || !Number.isFinite(touch.at))
          value[key] = null;
      });
      return value;
    } catch (_) {
      return null;
    }
  }

  function merge(base, incoming) {
    var params = new URLSearchParams(base);
    var next = new URLSearchParams(incoming);
    next.forEach(function (_, name) {
      params.delete(name);
    });
    next.forEach(function (value, name) {
      params.append(name, value);
    });
    return Array.from(params.entries());
  }

  function cookieMap() {
    try {
      return new Map(
        document.cookie.split(/;\s*/).map(function (part) {
          var at = part.indexOf("=");
          return [part.slice(0, at), part.slice(at + 1)];
        }),
      );
    } catch (_) {
      return new Map();
    }
  }

  function readCookie() {
    try {
      var cookies = cookieMap();
      var count = Number(cookies.get(KEY + "_count"));
      if (!Number.isSafeInteger(count) || count < 1 || count > cookies.size) return null;
      var raw = "";
      for (var i = 0; i < count; i++) {
        var chunk = cookies.get(KEY + "_" + i);
        if (chunk === undefined) return null;
        raw += chunk;
      }
      return parse(decodeURIComponent(raw));
    } catch (_) {
      return null;
    }
  }

  function readLocal() {
    try {
      return parse(window.localStorage.getItem(KEY));
    } catch (_) {
      return null;
    }
  }

  function earliest(a, b) {
    return !a ? b : !b ? a : a.at <= b.at ? a : b;
  }

  function restore() {
    var records = [readLocal(), readCookie()].filter(Boolean).sort(function (a, b) {
      return a.updatedAt - b.updatedAt;
    });
    var result = null;
    records.forEach(function (record) {
      result = result
        ? Object.assign({}, record, {
            params: merge(result.params, record.params),
            firstAccess: Math.min(result.firstAccess, record.firstAccess),
            firstSource: earliest(result.firstSource, record.firstSource),
            firstCampaign: earliest(result.firstCampaign, record.firstCampaign),
          })
        : record;
    });
    return result;
  }

  var now = Date.now();
  var state = restore() || {
    version: 1,
    params: [],
    firstAccess: now,
    firstSource: null,
    firstCampaign: null,
    updatedAt: now,
    expiresAt: now + TTL,
  };

  function persist() {
    var raw = JSON.stringify(state);
    try {
      window.localStorage.setItem(KEY, raw);
    } catch (_) {
      /* Cookie reserva. */
    }
    try {
      var encoded = encodeURIComponent(raw);
      var count = Math.ceil(encoded.length / CHUNK_SIZE);
      var cookies = cookieMap();
      var suffix =
        "; Path=/; SameSite=Lax; Max-Age=" +
        Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000)) +
        "; Expires=" +
        new Date(state.expiresAt).toUTCString() +
        (window.location.protocol === "https:" ? "; Secure" : "");
      // Divisão evita o limite de tamanho de um cookie individual.
      for (var i = 0; i < count; i++) {
        document.cookie =
          KEY + "_" + i + "=" + encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) + suffix;
      }
      document.cookie = KEY + "_count=" + count + suffix;
      cookies.forEach(function (_, name) {
        if (
          name.startsWith(KEY + "_") &&
          /^\d+$/.test(name.slice(KEY.length + 1)) &&
          Number(name.slice(KEY.length + 1)) >= count
        ) {
          document.cookie = name + "=; Path=/; Max-Age=0; SameSite=Lax";
        }
      });
    } catch (_) {
      /* O estado em memória mantém o fluxo funcional. */
    }
  }

  function capture() {
    var incoming = new URLSearchParams(window.location.search);
    if (!Array.from(incoming).length) return;
    var at = Date.now();
    state.params = merge(state.params, incoming);
    if (!state.firstSource && incoming.has("utm_source"))
      state.firstSource = { value: incoming.get("utm_source"), at: at };
    if (!state.firstCampaign && incoming.has("utm_campaign"))
      state.firstCampaign = { value: incoming.get("utm_campaign"), at: at };
    state.updatedAt = at;
    state.expiresAt = at + TTL;
  }

  function addToUrl(input) {
    if (input == null) return input;
    var raw = String(input);
    if (!raw.trim() || /^(?:#|mailto:|tel:|javascript:)/i.test(raw.trim())) return raw;
    try {
      var url = new URL(raw, document.baseURI);
      // URLs de documentos HTTP(S); nunca reescrever conteúdo data:, blob:, etc.
      if (url.protocol !== "https:" && url.protocol !== "http:") return raw;
      var existing = new Set(url.searchParams.keys());
      var changed = false;
      state.params.forEach(function (pair) {
        if (!existing.has(pair[0])) {
          url.searchParams.append(pair[0], pair[1]);
          changed = true;
        }
      });
      return changed ? url.href : raw;
    } catch (_) {
      return raw;
    }
  }

  function keepVisible() {
    var next = addToUrl(window.location.href);
    if (next !== window.location.href) {
      try {
        nativeReplace(window.history.state, "", next);
      } catch (_) {
        /* URL continua intacta. */
      }
    }
    lastSearch = window.location.search;
  }

  function decorateAnchor(anchor) {
    var href = anchor.getAttribute("href");
    if (href === null) return;
    var prior = anchors.get(anchor);
    var original = prior && prior.decorated === href ? prior.original : href;
    var decorated = addToUrl(original);
    anchors.set(anchor, { original: original, decorated: decorated });
    if (decorated !== href) anchor.setAttribute("href", decorated);
  }

  var elementsGetter = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "elements").get;
  function formControls(form) {
    return Array.from(elementsGetter.call(form));
  }
  function formParams(form, submitter) {
    var params = new URLSearchParams(state.params);
    try {
      var action = submitter && submitter.getAttribute("formaction");
      var url = new URL(
        action || form.getAttribute("action") || window.location.href,
        document.baseURI,
      );
      params = new URLSearchParams(merge(params, url.searchParams));
    } catch (_) {
      /* Mantém os parâmetros capturados. */
    }
    return params;
  }

  function prepareForm(form, submitter) {
    if (!registeredForms.has(form)) {
      registeredForms.add(form);
      form.addEventListener("formdata", function (event) {
        var existing = new Set(event.formData.keys());
        (submissionParams.get(form) || formParams(form, null)).forEach(function (value, name) {
          if (!existing.has(name)) event.formData.append(name, value);
        });
      });
    }
    var controls = formControls(form);
    var existing = new Set(
      controls
        .filter(function (control) {
          return !ownedInputs.has(control);
        })
        .map(function (control) {
          return control.getAttribute("name");
        }),
    );
    var desired = [];
    var params = formParams(form, submitter);
    submissionParams.set(form, params);
    params.forEach(function (value, name) {
      // Nomes reservados são enviados por formdata sem sombrear submit/action/elements.
      if (!existing.has(name) && !(name in HTMLFormElement.prototype)) desired.push([name, value]);
    });
    var current = controls.filter(function (control) {
      return ownedInputs.has(control);
    });
    if (
      JSON.stringify(
        current.map(function (input) {
          return [input.name, input.value];
        }),
      ) === JSON.stringify(desired)
    )
      return;
    current.forEach(function (input) {
      input.remove();
    });
    desired.forEach(function (pair) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = pair[0];
      input.value = pair[1];
      ownedInputs.add(input);
      form.appendChild(input);
    });
  }

  function process() {
    if (!window.document) return;
    document.querySelectorAll("a[href]").forEach(decorateAnchor);
    document.querySelectorAll("form").forEach(function (form) {
      prepareForm(form, null);
    });
  }
  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () {
      queued = false;
      process();
    });
  }
  function refresh() {
    if (window.location.search !== lastSearch) capture();
    keepVisible();
    persist();
    schedule();
  }

  capture();
  persist();
  keepVisible();
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      var anchor = target.closest("a[href]");
      if (anchor) decorateAnchor(anchor);
      var button = target.closest("button,input");
      if (button && button.form) prepareForm(button.form, button);
    },
    true,
  );
  document.addEventListener(
    "submit",
    function (event) {
      if (event.target instanceof HTMLFormElement) prepareForm(event.target, event.submitter);
    },
    true,
  );
  ["submit", "requestSubmit"].forEach(function (method) {
    var original = HTMLFormElement.prototype[method];
    if (typeof original !== "function") return;
    HTMLFormElement.prototype[method] = function () {
      prepareForm(this, arguments[0]);
      return original.apply(this, arguments);
    };
  });
  ["pushState", "replaceState"].forEach(function (method) {
    var original = window.history[method];
    window.history[method] = function () {
      var args = Array.from(arguments);
      if (args.length > 2 && args[2] != null) args[2] = addToUrl(args[2]);
      var result = original.apply(this, args);
      refresh();
      return result;
    };
  });
  window.open = function () {
    var args = Array.from(arguments);
    if (args.length && args[0]) args[0] = addToUrl(args[0]);
    return nativeOpen.apply(window, args);
  };

  // Location é não configurável: não sobrescrever seus métodos nativos.
  // Navigation API cobre atribuições diretas quando disponível; os helpers abaixo
  // cobrem redirecionamentos explícitos também nos demais navegadores.
  if (window.navigation && typeof window.navigation.addEventListener === "function") {
    window.navigation.addEventListener("navigate", function (event) {
      if (
        !event.cancelable ||
        event.defaultPrevented ||
        event.hashChange ||
        event.formData ||
        event.downloadRequest != null ||
        event.navigationType === "traverse" ||
        event.navigationType === "reload"
      )
        return;
      var next = addToUrl(event.destination.url);
      if (next === event.destination.url) return;
      event.preventDefault();
      if (event.defaultPrevented) {
        if (event.navigationType === "replace") nativeLocationReplace(next);
        else nativeAssign(next);
      }
    });
  }
  window.addEventListener("popstate", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("storage", function (event) {
    if (event.key !== KEY) return;
    var saved = restore();
    if (saved) state = saved;
    // Não persistir aqui: evita ciclos de escrita entre abas.
    keepVisible();
    schedule();
  });
  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["href", "action", "method", "name", "form", "formaction"],
  });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", process, { once: true });
  else process();

  window.TrackingParams = Object.freeze({
    addToUrl: addToUrl,
    assign: function (url) {
      nativeAssign(addToUrl(url));
    },
    replace: function (url) {
      nativeLocationReplace(addToUrl(url));
    },
    open: function (url, target, features) {
      return nativeOpen(addToUrl(url), target, features);
    },
    refresh: refresh,
    getParameters: function () {
      return new URLSearchParams(state.params);
    },
    getFirstTouch: function () {
      return {
        first_access_at: new Date(state.firstAccess).toISOString(),
        utm_source: state.firstSource ? state.firstSource.value : null,
        utm_campaign: state.firstCampaign ? state.firstCampaign.value : null,
      };
    },
  });
})();
