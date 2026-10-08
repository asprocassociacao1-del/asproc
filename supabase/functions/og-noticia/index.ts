/**
 * Supabase Edge Function — og-noticia
 *
 * Link de compartilhamento das notícias:
 *   https://wiatqtiyiznscjyoxxww.supabase.co/functions/v1/og-noticia?n=<slug>
 *
 * - Robôs (WhatsApp, Facebook, Telegram, X…) recebem HTML com meta OG
 *   (título, resumo e imagem da notícia) → preview bonito.
 * - Pessoas (navegador) recebem redirect 302 para a página da notícia.
 *
 * Deploy (uma única vez):
 *   supabase functions deploy og-noticia --no-verify-jwt --project-ref wiatqtiyiznscjyoxxww
 * ou pelo painel: Edge Functions → Deploy a new function → nome "og-noticia"
 * → cole este código → desmarque "Verify JWT".
 */

const BASE        = 'https://www.asproc.org.br';
const DEFAULT_IMG = `${BASE}/images/noticias-bg-01.webp`;
const SB_URL      = 'https://wiatqtiyiznscjyoxxww.supabase.co';
const SB_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXRxdGl5aXpuc2NqeW94eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc0MDEsImV4cCI6MjA5MTE0MzQwMX0.xgaaZWX5kG3XowDtpR9Xd8S2S0nV-JTnv4ZwnP33PY8';

// Qualquer UA que não pareça um navegador real é tratado como bot.
// (O WhatsApp usa "WhatsApp/2.x", o Facebook "facebookexternalhit" etc.)
const BOT_RE     = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|skypeuripreview|googlebot|bingbot|embedly|pinterest|vkshare|redditbot|applebot/i;
const BROWSER_RE = /mozilla|chrome|safari|firefox|opera|edge|msie/i;

const h = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
    });
  }

  const url  = new URL(req.url);
  const slug = (url.searchParams.get('n') ?? url.searchParams.get('slug') ?? '')
    .trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120);
  const ua   = req.headers.get('user-agent') ?? '';

  const destino = slug ? `${BASE}/noticias/?n=${encodeURIComponent(slug)}` : `${BASE}/noticias.html`;

  // Navegadores reais → redirect 302 direto
  if (!BOT_RE.test(ua) && BROWSER_RE.test(ua)) {
    return new Response(null, {
      status: 302,
      headers: { Location: destino, 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Bots → busca dados e serve HTML com meta OG
  let titulo    = 'Notícias – ASPROC';
  let descricao = 'Notícias da Associação dos Produtores Rurais de Carauari – ASPROC. Comunidades ribeirinhas do Médio Juruá.';
  let imagem    = DEFAULT_IMG;

  if (slug) {
    try {
      const resp = await fetch(
        `${SB_URL}/rest/v1/noticias?slug=eq.${encodeURIComponent(slug)}&publicado=eq.true&select=titulo,resumo,conteudo,imagem_url&limit=1`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
      );
      if (resp.ok) {
        const n = (await resp.json())?.[0];
        if (n) {
          if (n.titulo) titulo = `${String(n.titulo).trim()} – ASPROC`;
          let raw: string = String(n.resumo ?? '').trim();
          if (!raw && n.conteudo) {
            raw = String(n.conteudo).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          if (raw.length > 300) {
            const cut = raw.lastIndexOf(' ', 300);
            raw = raw.slice(0, cut > 0 ? cut : 300) + '…';
          }
          if (raw) descricao = raw;
          if (n.imagem_url) imagem = String(n.imagem_url).trim();
        }
      }
    } catch (_) { /* usa defaults */ }
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${h(titulo)}</title>
  <meta name="description" content="${h(descricao)}">
  <meta property="og:site_name" content="ASPROC">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:title" content="${h(titulo)}">
  <meta property="og:description" content="${h(descricao)}">
  <meta property="og:image" content="${h(imagem)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${h(titulo)}">
  <meta name="twitter:description" content="${h(descricao)}">
  <meta name="twitter:image" content="${h(imagem)}">
</head>
<body><a href="${h(destino)}">${h(titulo)}</a></body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
