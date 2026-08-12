-- XCMG Control 4.1 - acesso direto, sem login
-- ATENÇÃO: os dados ficam compartilhados para qualquer pessoa que tenha o link do aplicativo.

-- Remove as políticas antigas vinculadas a usuários.
drop policy if exists "xcmg_config_select_own" on public.xcmg_config;
drop policy if exists "xcmg_config_insert_own" on public.xcmg_config;
drop policy if exists "xcmg_config_update_own" on public.xcmg_config;
drop policy if exists "xcmg_config_delete_own" on public.xcmg_config;
drop policy if exists "xcmg_registros_select_own" on public.xcmg_registros;
drop policy if exists "xcmg_registros_insert_own" on public.xcmg_registros;
drop policy if exists "xcmg_registros_update_own" on public.xcmg_registros;
drop policy if exists "xcmg_registros_delete_own" on public.xcmg_registros;

-- Preserva uma configuração existente e converte para configuração única compartilhada.
do $$
declare
  cfg record;
begin
  if to_regclass('public.xcmg_config') is not null then
    select turma, efetivo_total, nome_sistema, desenvolvedor, estilo_simbolos
      into cfg from public.xcmg_config limit 1;
    drop table public.xcmg_config cascade;
  end if;

  create table public.xcmg_config (
    id smallint primary key default 1 check (id = 1),
    turma text not null default 'Turma D',
    efetivo_total integer not null default 0 check (efetivo_total >= 0),
    nome_sistema text not null default 'XCMG Control',
    desenvolvedor text not null default 'Edson de Oliveira Alves',
    estilo_simbolos text not null default 'completo' check (estilo_simbolos in ('completo','simples','nenhum')),
    updated_at timestamptz not null default now()
  );

  if cfg is not null then
    insert into public.xcmg_config (id,turma,efetivo_total,nome_sistema,desenvolvedor,estilo_simbolos)
    values (1,cfg.turma,cfg.efetivo_total,cfg.nome_sistema,cfg.desenvolvedor,cfg.estilo_simbolos)
    on conflict (id) do update set
      turma=excluded.turma, efetivo_total=excluded.efetivo_total,
      nome_sistema=excluded.nome_sistema, desenvolvedor=excluded.desenvolvedor,
      estilo_simbolos=excluded.estilo_simbolos, updated_at=now();
  else
    insert into public.xcmg_config (id) values (1) on conflict do nothing;
  end if;
end $$;

-- Cria a tabela de registros caso ainda não exista.
create table if not exists public.xcmg_registros (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('Férias','Atestado','Falta não justificada','Desligamento','Outras justificativas','Folga compensada')),
  nome text not null,
  funcao text not null default '',
  local text not null default '',
  inicio date,
  fim date,
  observacao text not null default '',
  foto_url text not null default '',
  foto_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint xcmg_periodo_valido check (fim is null or inicio is null or fim >= inicio)
);


-- Atualiza os tipos antigos, acrescenta os novos tipos e os campos de foto.
alter table public.xcmg_registros add column if not exists foto_url text not null default '';
alter table public.xcmg_registros add column if not exists foto_path text not null default '';

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.xcmg_registros'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.xcmg_registros drop constraint %I',c.conname);
  end loop;
end $$;

update public.xcmg_registros set tipo='Atestado' where tipo='Atestado Médico';
update public.xcmg_registros set tipo='Falta não justificada' where tipo='Falta Não Justificada';

alter table public.xcmg_registros
  add constraint xcmg_registros_tipo_check
  check (tipo in ('Férias','Atestado','Falta não justificada','Desligamento','Outras justificativas','Folga compensada'));

-- Bucket público para fotos opcionais das ocorrências.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('xcmg-ocorrencias','xcmg-ocorrencias',true,5242880,array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "xcmg_fotos_select_publico" on storage.objects;
drop policy if exists "xcmg_fotos_insert_publico" on storage.objects;
drop policy if exists "xcmg_fotos_update_publico" on storage.objects;
drop policy if exists "xcmg_fotos_delete_publico" on storage.objects;
create policy "xcmg_fotos_select_publico" on storage.objects for select to anon, authenticated using (bucket_id='xcmg-ocorrencias');
create policy "xcmg_fotos_insert_publico" on storage.objects for insert to anon, authenticated with check (bucket_id='xcmg-ocorrencias');
create policy "xcmg_fotos_update_publico" on storage.objects for update to anon, authenticated using (bucket_id='xcmg-ocorrencias') with check (bucket_id='xcmg-ocorrencias');
create policy "xcmg_fotos_delete_publico" on storage.objects for delete to anon, authenticated using (bucket_id='xcmg-ocorrencias');

-- Na migração da versão 4.0, mantém os registros e remove apenas a identificação do usuário.
do $$
declare c record;
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='xcmg_registros' and column_name='user_id') then
    for c in select conname from pg_constraint where conrelid='public.xcmg_registros'::regclass and contype='f' loop
      execute format('alter table public.xcmg_registros drop constraint %I',c.conname);
    end loop;
    alter table public.xcmg_registros drop column user_id;
  end if;
end $$;

drop index if exists public.xcmg_registros_user_id_idx;
create index if not exists xcmg_registros_periodo_idx on public.xcmg_registros(inicio,fim);

-- Mantém o RLS ativo, porém libera o acesso público usando somente a chave publicável do projeto.
alter table public.xcmg_config enable row level security;
alter table public.xcmg_registros enable row level security;

drop policy if exists "xcmg_config_publico" on public.xcmg_config;
drop policy if exists "xcmg_registros_publico" on public.xcmg_registros;
create policy "xcmg_config_publico" on public.xcmg_config for all to anon, authenticated using (true) with check (true);
create policy "xcmg_registros_publico" on public.xcmg_registros for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.xcmg_config to anon, authenticated;
grant select, insert, update, delete on public.xcmg_registros to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Atualizações em tempo real.
do $$
begin
  alter publication supabase_realtime add table public.xcmg_registros;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.xcmg_config;
exception when duplicate_object then null;
end $$;


-- Cadastro compartilhado de colaboradores (versão 4.2.2).
create table if not exists public.xcmg_colaboradores (
  id bigint generated always as identity primary key,
  nome_completo text not null,
  nome_exibicao text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint xcmg_colaborador_nome_nao_vazio check (length(trim(nome_completo)) > 0),
  constraint xcmg_colaborador_exibicao_nao_vazia check (length(trim(nome_exibicao)) > 0)
);

create unique index if not exists xcmg_colaboradores_nome_unico_idx
  on public.xcmg_colaboradores (lower(trim(nome_completo)));
create index if not exists xcmg_colaboradores_exibicao_idx
  on public.xcmg_colaboradores (nome_exibicao);

alter table public.xcmg_colaboradores enable row level security;
drop policy if exists "xcmg_colaboradores_publico" on public.xcmg_colaboradores;
create policy "xcmg_colaboradores_publico"
  on public.xcmg_colaboradores for all to anon, authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.xcmg_colaboradores to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Substitui toda a lista anterior em uma única operação.
create or replace function public.xcmg_substituir_colaboradores(lista jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  if lista is null or jsonb_typeof(lista) <> 'array' then
    raise exception 'A lista de colaboradores deve ser um array JSON.';
  end if;

  delete from public.xcmg_colaboradores;

  for item in select value from jsonb_array_elements(lista)
  loop
    if length(trim(coalesce(item->>'nome_completo',''))) > 0
       and length(trim(coalesce(item->>'nome_exibicao',''))) > 0 then
      insert into public.xcmg_colaboradores (nome_completo,nome_exibicao)
      values (trim(item->>'nome_completo'),trim(item->>'nome_exibicao'))
      on conflict do nothing;
    end if;
  end loop;

  return (select count(*)::integer from public.xcmg_colaboradores);
end;
$$;

grant execute on function public.xcmg_substituir_colaboradores(jsonb) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.xcmg_colaboradores;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';


-- XCMG Control 4.2.4 - dados completos do colaborador e relatório Excel do RH.
alter table public.xcmg_colaboradores add column if not exists matricula text not null default '';
alter table public.xcmg_colaboradores add column if not exists funcao text not null default '';
alter table public.xcmg_colaboradores add column if not exists area text not null default '';

alter table public.xcmg_registros add column if not exists matricula text not null default '';
alter table public.xcmg_registros add column if not exists funcao_colaborador text not null default '';
alter table public.xcmg_registros add column if not exists area text not null default '';
alter table public.xcmg_registros add column if not exists cid text not null default '';
alter table public.xcmg_registros add column if not exists descricao text not null default '';
alter table public.xcmg_registros add column if not exists atestado_fisico text not null default 'N/A';
alter table public.xcmg_registros add column if not exists enviado_grupo text not null default 'N/A';
alter table public.xcmg_registros add column if not exists motivo text not null default '';

create or replace function public.xcmg_substituir_colaboradores(lista jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  if lista is null or jsonb_typeof(lista) <> 'array' then
    raise exception 'A lista de colaboradores deve ser um array JSON.';
  end if;

  delete from public.xcmg_colaboradores where id is not null;

  insert into public.xcmg_colaboradores (
    matricula, nome_completo, nome_exibicao, funcao, area
  )
  select
    trim(coalesce(matricula,'')),
    trim(nome_completo),
    trim(nome_exibicao),
    trim(coalesce(funcao,'')),
    trim(coalesce(area,''))
  from jsonb_to_recordset(lista)
    as dados(matricula text, nome_completo text, nome_exibicao text, funcao text, area text)
  where length(trim(coalesce(nome_completo, ''))) > 0
    and length(trim(coalesce(nome_exibicao, ''))) > 0
  on conflict do nothing;

  get diagnostics total = row_count;
  return total;
end;
$$;

grant execute on function public.xcmg_substituir_colaboradores(jsonb) to anon, authenticated;
notify pgrst, 'reload schema';


-- Versão 4.2.6: nome completo preservado no registro.
alter table public.xcmg_registros add column if not exists nome_completo text not null default '';
notify pgrst, 'reload schema';


-- Versão 6.0.5: categoria do RH preservada no registro.
alter table public.xcmg_registros add column if not exists categoria text not null default '';
notify pgrst, 'reload schema';

alter table public.xcmg_config add column if not exists categorias_rh jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';

-- v6.0.13 - períodos excepcionais de fechamento
alter table public.xcmg_config add column if not exists periodos_fechamento jsonb not null default '[]'::jsonb;
