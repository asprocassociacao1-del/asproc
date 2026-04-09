/**
 * ASPROC – Patch de Vagas Dinâmicas
 * ===================================
 * Cole este <script> no final do <body> do index_asproc.html
 * e do trabalhe-conosco.html, após todos os outros scripts.
 *
 * Ele lê as vagas da tabela `vagas` no Supabase e substitui
 * os cards hardcoded pelos dados reais do banco.
 *
 * Dependências: nenhuma (usa apenas fetch nativo)
 */

(function () {
  'use strict';

  /* ── Configuração Supabase ─────────────────────────────────── */
  const SB_URL = 'https://wiatqtiyiznscjyoxxww.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXRxdGl5aXpuc2NqeW94eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc0MDEsImV4cCI6MjA5MTE0MzQwMX0.xgaaZWX5kG3XowDtpR9Xd8S2S0nV-JTnv4ZwnP33PY8';

  /* ── Utilitários ───────────────────────────────────────────── */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function statusLabel(status) {
    const map = { aberta: '● Aberta', encerrada: '● Encerrada', suspensa: '● Suspensa' };
    return map[status] || status;
  }

  function statusClass(status) {
    return status === 'aberta' ? 'ab' : status === 'encerrada' ? 'enc' : 'sus';
  }

  /* ── Buscar vagas ─────────────────────────────────────────── */
  async function fetchVagas(soAberta) {
    let url = `${SB_URL}/rest/v1/vagas?select=*&order=created_at.desc`;
    if (soAberta) url += "&status=eq.aberta";
    const res = await fetch(url, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    if (!res.ok) throw new Error('Erro Supabase: ' + res.status);
    return res.json();
  }

  /* ══════════════════════════════════════════════════════════════
     PÁGINA PRINCIPAL (index_asproc.html)
     – Substitui os cards da seção #vagas e o popup
  ══════════════════════════════════════════════════════════════ */
  function patchIndex(vagas) {
    const container = document.querySelector('.cards-contratacao');
    if (!container) return;

    if (!vagas.length) {
      container.innerHTML = '<p style="color:rgba(245,240,232,.5);text-align:center;width:100%;padding:2rem">Nenhuma vaga aberta no momento.</p>';
      return;
    }

    // Monta popup dinâmico
    const vagaInfo = {};
    vagas.forEach(v => {
      vagaInfo['vaga_' + v.id] = {
        title: v.titulo,
        desc: v.descricao || '',
        prazo: v.prazo ? formatDate(v.prazo) : null,
        edital: v.edital_url || null,
        regime: v.regime,
        local: v.local
      };
    });

    // Sobrescreve openVagaPopup
    window.openVagaPopup = function (key) {
      const info = vagaInfo[key];
      if (!info) return;
      const el = id => document.getElementById(id);
      if (el('vagaPopupTitle')) el('vagaPopupTitle').textContent = info.title;
      if (el('vagaPopupDesc')) {
        let html = info.desc;
        if (info.prazo) html += `<br><br>⏰ <strong>Prazo:</strong> ${info.prazo}`;
        if (info.regime) html += `&nbsp;|&nbsp;📋 ${info.regime}`;
        if (info.local) html += `&nbsp;|&nbsp;📍 ${info.local}`;
        el('vagaPopupDesc').innerHTML = html;
      }
      // Botão "Ver mais" no popup — abre trabalhe-conosco.html
      const btnMore = document.getElementById('vagaPopupVerMais');
      if (btnMore) btnMore.href = 'trabalhe-conosco.html';
      document.getElementById('vagaPopup')?.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    // Renderiza os cards
    container.innerHTML = '';
    vagas.forEach((v, i) => {
      const key = 'vaga_' + v.id;
      const card = document.createElement('div');
      card.className = 'card-contratacao reveal';
      card.style.transitionDelay = (i * 0.15) + 's';
      card.style.cursor = 'pointer';
      card.onclick = () => window.openVagaPopup(key);

      // Imagem padrão caso não haja URL de imagem
      const imgSrc = v.imagem_url
        ? v.imagem_url
        : 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80';

      card.innerHTML = `
        <img src="${imgSrc}" alt="${v.titulo}" loading="lazy"
             style="width:100%;height:220px;object-fit:cover;display:block">
        <div style="padding:1rem 1.2rem 1.2rem">
          <span style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
                       color:${v.status === 'aberta' ? 'var(--verde-neon)' : '#f87171'};
                       background:${v.status === 'aberta' ? 'rgba(123,201,92,.1)' : 'rgba(248,113,113,.1)'};
                       border:1px solid ${v.status === 'aberta' ? 'rgba(123,201,92,.3)' : 'rgba(248,113,113,.3)'};
                       padding:.2rem .65rem;border-radius:20px;display:inline-block;margin-bottom:.7rem">
            ${statusLabel(v.status)}
          </span>
          <div style="font-family:'Fraunces',serif;font-size:1rem;font-weight:700;margin-bottom:.4rem;line-height:1.3">
            ${v.titulo}
          </div>
          <div style="font-size:.8rem;color:rgba(245,240,232,.55);display:flex;gap:.6rem;flex-wrap:wrap">
            ${v.local ? `<span>📍 ${v.local}</span>` : ''}
            ${v.regime ? `<span>📋 ${v.regime}</span>` : ''}
            ${v.prazo ? `<span>⏰ até ${formatDate(v.prazo)}</span>` : ''}
          </div>
        </div>`;
      container.appendChild(card);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PÁGINA TRABALHE CONOSCO (trabalhe-conosco.html)
     – Substitui .vagas-grid e popula o <select> de candidatura
  ══════════════════════════════════════════════════════════════ */
  function patchTrabalhe(vagas) {
    const grid = document.querySelector('.vagas-grid');
    if (!grid) return;

    if (!vagas.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;
                    color:rgba(245,240,232,.5);font-size:1rem">
          Nenhuma vaga aberta no momento.<br>
          <a href="#cf-sec" style="color:var(--verde-neon);margin-top:.8rem;display:inline-block">
            Envie candidatura espontânea →
          </a>
        </div>`;
    } else {
      grid.innerHTML = '';
      vagas.forEach((v, i) => {
        const chips = [v.local, v.carga_horaria, v.regime, v.escolaridade]
          .filter(Boolean)
          .map(c => `<span class="chip">${c}</span>`)
          .join('');

        const prazoStr = v.prazo ? `⏰ Prazo: ${formatDate(v.prazo)}` : '⏰ Prazo em aberto';

        const card = document.createElement('div');
        card.className = 'vcard reveal';
        if (i > 0) card.style.transitionDelay = (i * 0.12) + 's';

        // Imagem padrão
        const imgSrc = v.imagem_url
          ? v.imagem_url
          : 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80';

        card.innerHTML = `
          <div class="vc-img">
            <img src="${imgSrc}" alt="${v.titulo}" loading="lazy">
          </div>
          <div class="vc-body">
            <span class="vc-status ${statusClass(v.status)}">${statusLabel(v.status)}</span>
            <div class="vc-prazo">${prazoStr}</div>
            <div class="vc-title">${v.titulo}</div>
            <div class="vc-desc">${v.descricao || ''}</div>
            <div class="vc-chips">${chips}</div>
            <div class="vc-btns">
              ${v.edital_url
                ? `<a href="${v.edital_url}" class="vbtn-dl" target="_blank" rel="noopener">⬇ Baixar Edital</a>`
                : `<span class="vbtn-dl" style="opacity:.4;cursor:default">Edital em breve</span>`}
              ${v.status === 'aberta'
                ? `<button class="vbtn-apply" onclick="window._setVaga && window._setVaga('${v.titulo.replace(/'/g, "\\'")}')">Candidatar-se →</button>`
                : `<span class="vbtn-apply" style="opacity:.35;cursor:default">Encerrada</span>`}
            </div>
          </div>`;
        grid.appendChild(card);
      });
    }

    // Atualiza o <select> de vagas no formulário
    const sel = document.getElementById('cf-vaga');
    if (sel) {
      sel.innerHTML = '<option value="">Selecionar vaga…</option>';
      vagas
        .filter(v => v.status === 'aberta')
        .forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.titulo;
          opt.textContent = v.titulo;
          sel.appendChild(opt);
        });
      const esp = document.createElement('option');
      esp.value = 'Candidatura Espontânea';
      esp.textContent = 'Candidatura Espontânea';
      sel.appendChild(esp);
    }

    // Expõe função para os botões "Candidatar-se"
    window._setVaga = function (nome) {
      const s = document.getElementById('cf-vaga');
      if (s) {
        s.value = nome;
        // fallback: se opção não existir ainda, cria
        if (!s.value) {
          const o = document.createElement('option');
          o.value = nome;
          o.textContent = nome;
          s.appendChild(o);
          s.value = nome;
        }
      }
      const sec = document.getElementById('cf-sec');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    };

    // Compatibilidade com setVaga() original
    if (typeof window.setVaga !== 'function') {
      window.setVaga = window._setVaga;
    }

    // Atualiza contador de vagas abertas (se existir)
    const total = vagas.filter(v => v.status === 'aberta').length;
    document.querySelectorAll('.vagas-count, #vagas-count').forEach(el => {
      el.textContent = total;
    });
  }

  /* ── Inicialização ────────────────────────────────────────── */
  async function init() {
    const isIndex = !!document.querySelector('.cards-contratacao');
    const isTrabalhe = !!document.querySelector('.vagas-grid');
    if (!isIndex && !isTrabalhe) return;

    // Adiciona classe de status encerrada no CSS se não existir
    if (!document.getElementById('_vd_styles')) {
      const s = document.createElement('style');
      s.id = '_vd_styles';
      s.textContent = `
        .vc-status.enc { background:rgba(248,113,113,.12); color:#f87171;
                         border:1px solid rgba(248,113,113,.3); }
        .vc-status.sus { background:rgba(250,204,21,.12); color:#fbbf24;
                         border:1px solid rgba(250,204,21,.3); }
        .vagas-grid .vcard { cursor:default; }
      `;
      document.head.appendChild(s);
    }

    try {
      const vagas = await fetchVagas(isIndex); // no index só abre
      if (isIndex)    patchIndex(vagas);
      if (isTrabalhe) patchTrabalhe(vagas);
    } catch (err) {
      console.warn('[ASPROC Vagas] Erro ao carregar vagas:', err.message);
      // Mantém conteúdo estático em caso de falha
    }
  }

  // Aguarda DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
