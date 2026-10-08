-- ════════════════════════════════════════════════════════════════════
-- Publicações agendadas no SERVIDOR (funciona com o admin fechado)
--
-- 1. publicar_agendados(): publica tudo o que está pendente e já venceu.
--    Cada item é tratado separadamente: se um falhar, ele vai para
--    status 'erro' (com a mensagem) e os outros seguem normalmente.
-- 2. pg_cron roda a função a cada minuto.
-- O admin também chama a função (RPC) a cada 30s quando está aberto.
--
-- Pode rodar de novo sem problema (idempotente).
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

create or replace function public.publicar_agendados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ag record;
  n  integer := 0;
begin
  for ag in
    select * from publicacoes_agendadas
    where status = 'pendente' and publicar_em <= now()
    order by publicar_em
    for update skip locked
  loop
    begin
      if ag.tabela = 'noticias' then
        update noticias set publicado = true where id::text = ag.registro_id;
      elsif ag.tabela = 'vagas' then
        update vagas set status = 'aberta' where id::text = ag.registro_id;
      elsif ag.tabela = 'avisos' then
        update avisos set publicado = true where id::text = ag.registro_id;
      else
        raise exception 'Tipo desconhecido: %', ag.tabela;
      end if;

      if not found then
        raise exception 'O item não existe mais (pode ter sido excluído).';
      end if;

      update publicacoes_agendadas
         set status = 'publicado', publicado_em = now(), erro_msg = null
       where id = ag.id;
      n := n + 1;
    exception when others then
      update publicacoes_agendadas
         set status = 'erro', erro_msg = sqlerrm
       where id = ag.id;
    end;
  end loop;
  return n;
end;
$$;

revoke all on function public.publicar_agendados() from public, anon;
grant execute on function public.publicar_agendados() to authenticated;

-- (Re)cria o job: a cada minuto
select cron.unschedule(jobid) from cron.job where jobname = 'publicar-agendados';
select cron.schedule('publicar-agendados', '* * * * *', $job$select public.publicar_agendados();$job$);
