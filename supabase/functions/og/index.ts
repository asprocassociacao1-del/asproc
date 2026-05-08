/**
 * Supabase Edge Function — og
 *
 * Bots (WhatsApp, Telegram, etc.) recebem HTML com meta OG.
 * Navegadores reais recebem redirect 302 direto para avisos.html.
 *
 * URL: https://wiatqtiyiznscjyoxxww.supabase.co/functions/v1/og?aviso=5
 *
 * Deploy:
 *   supabase functions deploy og --no-verify-jwt --project-ref wiatqtiyiznscjyoxxww
 */

const BASE        = 'https://www.asproc.org.br';
const DEFAULT_IMG = `${BASE}/og-default.jpg`;

// User-agents de bots de preview de links
const BOT_RE = /whatsapp|telegram|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|applebot|google|bingbot|pinterest|tumblr|vkshare|xing|w3c_validator|curl|python|java|wget/i;

function isBot(req: Request): boolean {
  const ua = req.headers.get('user-agent') ?? '';
  return BOT_RE.test(ua);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
    });
  }

  const params = new URL(req.url).searchParams;
  const id     = parseInt(params.get('aviso') ?? '0', 10);

  const SB_URL = Deno.env.get('SUPABASE_URL')      ?? 'https://wiatqtiyiznscjyoxxww.supabase.co';
  const SB_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXRxdGl5aXpuc2NqeW94eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc0MDEsImV4cCI6MjA5MTE0MzQwMX0.xgaaZWX5kG3XowDtpR9Xd8S2S0nV-JTnv4ZwnP33PY8';

  const destino = id > 0 ? `${BASE}/avisos.html?aviso=${id}` : `${BASE}/avisos.html`;

  // Navegadores reais: redirect 302 imediato
  if (!isBot(req)) {
    return new Response(null, {
      status: 302,
      headers: { Location: destino, 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Bots: busca dados e serve HTML com meta OG
  let titulo    = 'Avisos e Documentos – ASPROC';
  let descricao = 'Acompanhe os avisos e informativos da Associação dos Produtores Rurais de Carauari – ASPROC. Comunidades Ribeirinhas do Médio Juruá.';
  let imagem    = DEFAULT_IMG;

  if (id > 0) {
    try {
      const resp = await fetch(
        `${SB_URL}/rest/v1/avisos?id=eq.${id}&select=titulo,resumo,descricao,capa_url&limit=1`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      );
      if (resp.ok) {
        const rows = await resp.json();
        const av   = rows?.[0];
        if (av) {
          if (av.titulo) titulo = `${av.titulo.trim()} – ASPROC`;

          let raw: string = av.resumo?.trim() ?? '';
          if (!raw && av.descricao) {
            raw = av.descricao.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          if (raw.length > 300) {
            const cut = raw.lastIndexOf(' ', 300);
            raw = raw.slice(0, cut > 0 ? cut : 300) + '…';
          }
          if (raw) descricao = raw;

          if (av.capa_url) imagem = av.capa_url.trim();
        }
      }
    } catch (_) { /* usa defaults */ }
  }

  const h = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${h(titulo)}</title>
  <meta property="og:site_name" content="ASPROC">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${h(titulo)}">
  <meta property="og:description" content="${h(descricao)}">
  <meta property="og:image" content="${h(imagem)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${h(destino)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${h(titulo)}">
  <meta name="twitter:description" content="${h(descricao)}">
  <meta name="twitter:image" content="${h(imagem)}">
</head>
<body></body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
