/**
 * Supabase Edge Function — og-vaga
 *
 * Preview Open Graph para vagas de trabalho da ASPROC.
 * Bots (WhatsApp, Telegram…) recebem HTML com meta OG.
 * Navegadores recebem redirect 302 para trabalhe-conosco.html.
 *
 * URL: https://wiatqtiyiznscjyoxxww.supabase.co/functions/v1/og-vaga?vaga=3
 *
 * Deploy:
 *   supabase functions deploy og-vaga --no-verify-jwt --project-ref wiatqtiyiznscjyoxxww
 */

const BASE        = 'https://www.asproc.org.br';
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80';
const SB_URL      = 'https://wiatqtiyiznscjyoxxww.supabase.co';
const SB_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXRxdGl5aXpuc2NqeW94eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc0MDEsImV4cCI6MjA5MTE0MzQwMX0.xgaaZWX5kG3XowDtpR9Xd8S2S0nV-JTnv4ZwnP33PY8';

const BROWSER_RE = /mozilla|chrome|safari|firefox|opera|edge|msie/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
    });
  }

  const id = parseInt(new URL(req.url).searchParams.get('vaga') ?? '0', 10);
  const ua = req.headers.get('user-agent') ?? '';

  const destino = `${BASE}/trabalhe-conosco.html`;

  // Navegadores → redirect 302
  if (BROWSER_RE.test(ua)) {
    return new Response(null, {
      status: 302,
      headers: { Location: destino, 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Bots → busca dados e serve HTML com meta OG
  let titulo    = 'Trabalhe Conosco – ASPROC';
  let descricao = 'Confira as vagas abertas na Associação dos Produtores Rurais de Carauari – ASPROC. Comunidades Ribeirinhas do Médio Juruá.';
  let imagem    = DEFAULT_IMG;

  if (id > 0) {
    try {
      const resp = await fetch(
        `${SB_URL}/rest/v1/vagas?id=eq.${id}&select=titulo,resumo,descricao,imagem_url&limit=1`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      );
      if (resp.ok) {
        const vaga = (await resp.json())?.[0];
        if (vaga) {
          if (vaga.titulo) titulo = `${vaga.titulo.trim()} – ASPROC`;

          let raw: string = vaga.resumo?.trim() ?? '';
          if (!raw && vaga.descricao) {
            raw = vaga.descricao.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          if (raw.length > 300) {
            const cut = raw.lastIndexOf(' ', 300);
            raw = raw.slice(0, cut > 0 ? cut : 300) + '…';
          }
          if (raw) descricao = raw;
          if (vaga.imagem_url) imagem = vaga.imagem_url.trim();
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
