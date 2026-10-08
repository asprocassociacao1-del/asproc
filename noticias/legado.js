/*
 * legado.js — páginas estáticas antigas de notícia (/noticias/<arquivo>.html)
 *
 * Essas páginas foram geradas pelo admin e enviadas ao GitHub no modelo antigo.
 * Se a notícia existe (publicada) no Supabase, a pessoa é levada para a versão
 * dinâmica (/noticias/?n=slug), que sempre mostra a edição mais recente.
 * Se não existir no banco, a página estática continua aparecendo normalmente.
 * Robôs do WhatsApp/Facebook não executam JS, então continuam lendo as meta tags
 * desta página estática para o preview.
 */
(function () {
  var m = location.pathname.match(/\/noticias\/([^\/?#]+)\.html$/i);
  if (!m) return;
  var file = decodeURIComponent(m[1]);
  if (!file || file === 'index' || file === 'noticias') return;
  if (/[?&]estatica=1/.test(location.search)) return; // força ver a versão antiga

  var SB_URL = 'https://wiatqtiyiznscjyoxxww.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXRxdGl5aXpuc2NqeW94eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc0MDEsImV4cCI6MjA5MTE0MzQwMX0.xgaaZWX5kG3XowDtpR9Xd8S2S0nV-JTnv4ZwnP33PY8';

  var root = document.documentElement;
  root.style.visibility = 'hidden';
  var shown = false;
  function show() { if (shown) return; shown = true; root.style.visibility = ''; }
  setTimeout(show, 2500); // nunca deixa a página em branco

  var or = '(slug.eq.' + file + ',url_externa.ilike.*/' + file + '.html)';
  fetch(SB_URL + '/rest/v1/noticias?select=slug&publicado=eq.true&or=' + encodeURIComponent(or) + '&limit=1', {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
  })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      var sl = rows && rows[0] && rows[0].slug ? String(rows[0].slug).trim() : '';
      if (sl) location.replace('/noticias/?n=' + encodeURIComponent(sl) + location.hash);
      else show();
    })
    .catch(show);
})();
