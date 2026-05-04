// pages/admin/Backup.jsx  (ou .tsx se usar TypeScript)
// Requer: @supabase/supabase-js instalado e cliente em lib/supabase.js
// Instale: npm install @supabase/supabase-js

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase"; // ajuste o caminho

// ─── Constantes ─────────────────────────────────────────────
const EVENTO_BADGES = {
  BACKUP:  { label: "BACKUP",  cls: "badge-info"    },
  RESTORE: { label: "RESTORE", cls: "badge-warning"  },
  PURGE:   { label: "PURGE",   cls: "badge-danger"   },
  LOGIN:   { label: "LOGIN",   cls: "badge-neutral"  },
  ERRO:    { label: "ERRO",    cls: "badge-danger"   },
};

const TABELAS_BACKUP = [
  "noticias", "noticia_versoes", "avisos", "vagas",
  "candidaturas", "mensagens_contato", "newsletters",
  "admin_usuarios", "site_textos", "app_config",
];

// ─── Utilitários ────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatBytes(kb) {
  if (!kb) return "—";
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// ─── Componente principal ───────────────────────────────────
export default function BackupPage() {
  const [backups, setBackups]       = useState([]);
  const [logs, setLogs]             = useState([]);
  const [config, setConfig]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [restoring, setRestoring]   = useState(null); // backup id em restauração
  const [filterEvento, setFilterEvento] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [msg, setMsg]               = useState(null); // { type, text }

  // ── Carregamento inicial ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: bkps }, { data: lgList }, { data: cfg }] = await Promise.all([
      supabase.from("backups_db").select("*").order("criado_em", { ascending: false }).limit(10),
      supabase.from("backup_logs").select("*").order("criado_em", { ascending: false }).limit(100),
      supabase.from("backup_ciclo_config").select("*").eq("id", 1).single(),
    ]);
    setBackups(bkps ?? []);
    setLogs(lgList ?? []);
    setConfig(cfg);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Registrar acesso no log ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("backup_logs").insert({
        evento: "LOGIN",
        usuario: user.email ?? user.id,
        status: "ok",
        mensagem: "Acesso ao painel de backup",
      });
    })();
  }, []);

  // ── Backup manual ──
  async function executarBackup() {
    setRunningBackup(true);
    setMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-diario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ manual: true, usuario: user?.email ?? "admin" }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ type: "success", text: `Backup criado com sucesso · ${formatBytes(json.tamanho_kb)} · ${json.registros?.toLocaleString("pt-BR")} registros` });
        await fetchAll();
      } else {
        setMsg({ type: "error", text: `Erro: ${json.error}` });
      }
    } catch (e) {
      setMsg({ type: "error", text: `Erro de conexão: ${e.message}` });
    } finally {
      setRunningBackup(false);
    }
  }

  // ── Restauração ──
  async function restaurarBackup(backup, modo = "upsert") {
    if (!window.confirm(`Restaurar backup de ${formatDate(backup.criado_em)}?\nModo: ${modo}`)) return;
    setRestoring(backup.id);
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      const payload = backup.payload;
      let totalRestored = 0;

      for (const tabela of TABELAS_BACKUP) {
        const rows = payload?.tabelas?.[tabela];
        if (!rows || rows.length === 0) continue;

        if (modo === "upsert") {
          const { error } = await supabase.from(tabela).upsert(rows, { onConflict: "id" });
          if (error) throw new Error(`${tabela}: ${error.message}`);
        } else {
          await supabase.from(tabela).delete().neq("id", "___noop___");
          const { error } = await supabase.from(tabela).insert(rows);
          if (error) throw new Error(`${tabela}: ${error.message}`);
        }
        totalRestored += rows.length;
      }

      await supabase.from("backup_logs").insert({
        evento: "RESTORE",
        usuario: user?.email ?? "admin",
        backup_id: backup.id,
        tabela: "todas",
        registros: totalRestored,
        status: "ok",
        mensagem: `Restauração concluída · ${totalRestored} registros · modo ${modo}`,
        metadados: { backup_data: backup.criado_em, modo },
      });

      setMsg({ type: "success", text: `Restauração concluída · ${totalRestored.toLocaleString("pt-BR")} registros` });
      await fetchAll();
    } catch (e) {
      await supabase.from("backup_logs").insert({
        evento: "ERRO",
        usuario: user?.email ?? "admin",
        backup_id: backup.id,
        status: "erro",
        mensagem: `Falha na restauração: ${e.message}`,
      });
      setMsg({ type: "error", text: `Erro na restauração: ${e.message}` });
    } finally {
      setRestoring(null);
    }
  }

  // ── Purge manual ──
  async function purgeManual() {
    if (!window.confirm("Excluir TODOS os backups do ciclo atual? Esta ação é irreversível.")) return;
    const { error } = await supabase.rpc("backup_purge_ciclo");
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "Purge executado com sucesso. Novo ciclo iniciado." });
      await fetchAll();
    }
  }

  // ── Logs filtrados ──
  const logsFiltrados = logs.filter(l =>
    (!filterEvento || l.evento === filterEvento) &&
    (!filterSearch || l.mensagem?.toLowerCase().includes(filterSearch.toLowerCase()))
  );

  // ── Métricas ──
  const cicloAtual   = config?.ciclo_atual ?? "—";
  const diaAtual     = backups.filter(b => b.ciclo === config?.ciclo_atual).length;
  const ultimoBkp    = backups[0];
  const totalReg     = ultimoBkp?.total_registros ?? 0;
  const logsHoje     = logs.filter(l => new Date(l.criado_em).toDateString() === new Date().toDateString()).length;

  // ── Ciclo visual ──
  const diasCiclo = Array.from({ length: 10 }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Carregando backups...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Backup & Restauração</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerenciamento automático · Supabase · ciclo de 10 dias
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Agendador ativo
          </span>
          <button
            onClick={executarBackup}
            disabled={runningBackup}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
          >
            {runningBackup ? "Gerando..." : "Backup agora"}
          </button>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          msg.type === "success"
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total de backups", value: backups.length, sub: "de 10 máximo" },
          { label: "Ciclo atual", value: `Ciclo ${cicloAtual}`, sub: `Dia ${diaAtual} de 10` },
          { label: "Último backup", value: ultimoBkp ? formatDate(ultimoBkp.criado_em).slice(0, 16) : "—", sub: formatBytes(ultimoBkp?.tamanho_kb) },
          { label: "Registros gravados", value: totalReg.toLocaleString("pt-BR"), sub: "último backup" },
          { label: "Logs hoje", value: logsHoje, sub: "eventos registrados" },
        ].map((m, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">{m.label}</p>
            <p className="text-xl font-medium text-gray-900">{m.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Ciclo + Escopo */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Ciclo */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-[13px] font-medium text-gray-700 mb-3">Ciclo de retenção</h2>
          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-3">
            dias 1–10 → manter · dia 11 → purge automático
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {diasCiclo.map(d => (
              <div
                key={d}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-medium border
                  ${d < diaAtual ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : d === diaAtual ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-gray-50 text-gray-400 border-gray-200"}`}
              >
                {d}
              </div>
            ))}
            <div className="w-2" />
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-medium border bg-red-50 text-red-700 border-red-200">
              11
            </div>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(diaAtual / 10) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400">{diaAtual * 10}% do ciclo concluído</p>
          <button
            onClick={purgeManual}
            className="mt-4 text-[12px] text-red-600 hover:underline"
          >
            Executar purge manual do ciclo atual →
          </button>
        </div>

        {/* Escopo */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-[13px] font-medium text-gray-700 mb-3">Escopo do backup</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Notícias", "Avisos", "Mensagens contato", "Vagas",
              "Candidaturas", "Usuários admin", "Newsletters", "Config / textos",
              "Versões notícias", "App config",
            ].map(t => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5">
                    <path d="M1 4l2 2 4-4" />
                  </svg>
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de backups */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-[13px] font-medium text-gray-700 mb-4">Backups armazenados</h2>
        {backups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum backup ainda.</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b, i) => (
              <div
                key={b.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm
                  ${i === 0
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-gray-100 bg-gray-50"}`}
              >
                <span className="w-6 h-6 rounded-full border border-gray-200 bg-white flex items-center justify-center text-[10px] font-medium text-gray-500 flex-shrink-0">
                  {b.dia_no_ciclo}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800">{formatDate(b.criado_em)}</span>
                  {i === 0 && (
                    <span className="ml-2 text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      mais recente
                    </span>
                  )}
                  <span className="ml-2 text-[11px] text-gray-400">
                    por {b.criado_por}
                  </span>
                </div>
                <span className="text-[12px] text-gray-400 min-w-[56px] text-right">
                  {formatBytes(b.tamanho_kb)}
                </span>
                <span className="text-[12px] text-gray-400 min-w-[80px] text-right">
                  {b.total_registros?.toLocaleString("pt-BR")} reg.
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => restaurarBackup(b, "upsert")}
                    disabled={restoring === b.id}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white transition disabled:opacity-40"
                  >
                    {restoring === b.id ? "Restaurando..." : "Restaurar"}
                  </button>
                  <button
                    onClick={() => restaurarBackup(b, "replace")}
                    disabled={restoring === b.id}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition disabled:opacity-40"
                  >
                    Sobrescrever
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log de atividades */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-[13px] font-medium text-gray-700 mb-4">Log de atividades</h2>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select
            value={filterEvento}
            onChange={e => setFilterEvento(e.target.value)}
            className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
          >
            <option value="">Todos os eventos</option>
            {Object.keys(EVENTO_BADGES).map(e => (
              <option key={e}>{e}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Buscar mensagem..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 w-52"
          />
          <button
            onClick={() => { setFilterEvento(""); setFilterSearch(""); }}
            className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            Limpar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100">
                {["Data / hora", "Evento", "Usuário", "Tabela", "Registros", "Status", "Mensagem"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2 pr-4 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logsFiltrados.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                    {formatDate(l.criado_em)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full font-mono
                      ${l.evento === "BACKUP"  ? "bg-blue-50 text-blue-700" :
                        l.evento === "RESTORE" ? "bg-amber-50 text-amber-700" :
                        l.evento === "PURGE"   ? "bg-red-50 text-red-700" :
                        l.evento === "ERRO"    ? "bg-red-50 text-red-700" :
                                                 "bg-gray-100 text-gray-500"}`}>
                      {l.evento}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{l.usuario}</td>
                  <td className="py-2 pr-4 text-gray-500">{l.tabela ?? "—"}</td>
                  <td className="py-2 pr-4 text-right text-gray-500">
                    {l.registros != null ? l.registros.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full
                      ${l.status === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400 max-w-xs">{l.mensagem}</td>
                </tr>
              ))}
              {logsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Nenhum log encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
