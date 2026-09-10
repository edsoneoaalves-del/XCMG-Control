-- XCMG Control v6.7.0 — módulo independente de Férias.
-- Execute uma única vez no SQL Editor do Supabase.

alter table public.xcmg_programacao_ferias add column if not exists colaborador_id bigint references public.xcmg_colaboradores(id) on delete restrict;
alter table public.xcmg_programacao_ferias add column if not exists data_admissao date;
alter table public.xcmg_programacao_ferias add column if not exists dias integer not null default 30;
alter table public.xcmg_programacao_ferias add column if not exists abono text not null default 'NÃO';
alter table public.xcmg_programacao_ferias add column if not exists decimo_terceiro text not null default 'NÃO';
alter table public.xcmg_programacao_ferias add column if not exists status_aprovacao text not null default 'A PROGRAMAR';
alter table public.xcmg_programacao_ferias add column if not exists observacao text not null default '';
alter table public.xcmg_programacao_ferias add column if not exists justificativa_conflito text not null default '';
alter table public.xcmg_programacao_ferias add column if not exists aprovado_por text not null default '';
alter table public.xcmg_programacao_ferias add column if not exists aprovado_em timestamptz;

update public.xcmg_programacao_ferias
set dias=(fim-inicio)+1
where dias is null or dias <= 0;

create table if not exists public.xcmg_ferias_historico (
  id bigint generated always as identity primary key,
  programacao_id bigint not null references public.xcmg_programacao_ferias(id) on delete restrict,
  acao text not null,
  status_anterior text not null default '',
  status_novo text not null default '',
  usuario text not null default '',
  observacao text not null default '',
  created_at timestamptz not null default now()
);

alter table public.xcmg_ferias_historico enable row level security;
drop policy if exists "xcmg_ferias_historico_publico" on public.xcmg_ferias_historico;
create policy "xcmg_ferias_historico_publico" on public.xcmg_ferias_historico
for all to anon, authenticated using (true) with check (true);
grant select, insert, update on public.xcmg_ferias_historico to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.xcmg_ferias_historico;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
