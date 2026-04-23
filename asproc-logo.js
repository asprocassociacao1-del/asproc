// Carrega a logomarca do Supabase e aplica em todas as img.nav-logo da página
(function () {
  var SB_URL = 'https://wiatqtiyiznscjyoxxww.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXRxdGl5aXpuc2NqeW94eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc0MDEsImV4cCI6MjA5MTE0MzQwMX0.xgaaZWX5kG3XowDtpR9Xd8S2S0nV-JTnv4ZwnP33PY8';

  function applyLogo(url) {
    document.querySelectorAll('img.nav-logo').forEach(function (img) {
      img.src = url;
    });
  }

  fetch(SB_URL + '/rest/v1/app_config?key=eq.logo_url&select=value', {
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
  })
    .then(function (r) { return r.ok ? r.json() : Promise.resolve([]); })
    .then(function (data) {
      if (!data || !data.length || !data[0].value) return;
      var url = data[0].value;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { applyLogo(url); });
      } else {
        applyLogo(url);
      }
    })
    .catch(function () {});
})();
