(function () {
  'use strict';

  var SB_URL = 'https://wiatqtiyiznscjyoxxww.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXRxdGl5aXpuc2NqeW94eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc0MDEsImV4cCI6MjA5MTE0MzQwMX0.xgaaZWX5kG3XowDtpR9Xd8S2S0nV-JTnv4ZwnP33PY8';
  var CONFIG_KEY = 'menu_visibility';

  var ITEMS = [
    { key: 'inicio', hrefs: ['index.html'] },
    { key: 'sobre', hrefs: ['sobre.html'] },
    { key: 'projetos', hrefs: ['programas-projetos.html'] },
    { key: 'noticias', hrefs: ['noticias.html'] },
    { key: 'avisos', hrefs: ['avisos.html'] },
    { key: 'comunidades', hrefs: ['comunidades.html'], defaultVisible: false },
    { key: 'trabalhe', hrefs: ['trabalhe-conosco.html'] },
    { key: 'loja', hrefs: ['loja.asproc.org.br'] }
  ];

  function defaultVisibility() {
    return ITEMS.reduce(function (acc, item) {
      acc[item.key] = item.defaultVisible !== false;
      return acc;
    }, {});
  }

  function normalizeHref(raw) {
    if (!raw) return '';
    try {
      return new URL(raw, window.location.href).href.toLowerCase();
    } catch (_) {
      return String(raw).toLowerCase();
    }
  }

  function itemMatches(anchor, item) {
    var attr = anchor.getAttribute('href') || '';
    var href = normalizeHref(attr);
    var raw = attr.toLowerCase();
    return item.hrefs.some(function (needle) {
      needle = needle.toLowerCase();
      return href.indexOf(needle) !== -1 || raw.indexOf(needle) !== -1;
    });
  }

  function targetFor(anchor) {
    return anchor.closest('li') || anchor;
  }

  function applyVisibility(config) {
    var state = Object.assign(defaultVisibility(), config || {});
    ITEMS.forEach(function (item) {
      var visible = state[item.key] !== false;
      document.querySelectorAll('a[href]').forEach(function (anchor) {
        if (!itemMatches(anchor, item)) return;
        var target = targetFor(anchor);
        target.dataset.menuVisibilityKey = item.key;
        target.hidden = !visible;
        target.style.display = visible ? '' : 'none';
      });
    });
  }

  function parseConfig(value) {
    if (!value) return {};
    try {
      var parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  async function fetchVisibility() {
    try {
      var res = await fetch(SB_URL + '/rest/v1/app_config?key=eq.' + CONFIG_KEY + '&select=value&limit=1', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
      });
      if (!res.ok) return {};
      var data = await res.json();
      return data && data.length ? parseConfig(data[0].value) : {};
    } catch (_) {
      return {};
    }
  }

  async function init() {
    applyVisibility({});
    var remote = await fetchVisibility();
    applyVisibility(remote);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
