-- XCMG Control v6.6.0 — módulo Efetivo.
-- Execute uma única vez no SQL Editor do Supabase antes de usar o novo módulo.

alter table public.xcmg_colaboradores add column if not exists data_admissao date;
alter table public.xcmg_colaboradores add column if not exists data_nascimento date;
alter table public.xcmg_colaboradores add column if not exists cpf text not null default '';
alter table public.xcmg_colaboradores add column if not exists turma text not null default '';
alter table public.xcmg_colaboradores add column if not exists status text not null default 'Ativo';

update public.xcmg_colaboradores set status='Ativo' where trim(coalesce(status,''))='';

create unique index if not exists xcmg_colaboradores_matricula_unica_idx
  on public.xcmg_colaboradores (trim(matricula))
  where length(trim(matricula)) > 0;

create table if not exists public.xcmg_efetivo_historico (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references public.xcmg_colaboradores(id) on delete restrict,
  tipo text not null default 'Atualização cadastral',
  campo text not null default '',
  valor_anterior text not null default '',
  valor_novo text not null default '',
  motivo text not null default '',
  descricao text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists xcmg_efetivo_historico_colaborador_idx
  on public.xcmg_efetivo_historico (colaborador_id, created_at desc);

alter table public.xcmg_efetivo_historico enable row level security;
drop policy if exists "xcmg_efetivo_historico_publico" on public.xcmg_efetivo_historico;
create policy "xcmg_efetivo_historico_publico"
  on public.xcmg_efetivo_historico for all to anon, authenticated
  using (true) with check (true);
grant select, insert, update on public.xcmg_efetivo_historico to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

create or replace function public.xcmg_importar_efetivo(lista jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  atual public.xcmg_colaboradores%rowtype;
  cid bigint;
  total integer := 0;
begin
  if lista is null or jsonb_typeof(lista) <> 'array' then
    raise exception 'A lista do efetivo deve ser um array JSON.';
  end if;

  for item in select value from jsonb_array_elements(lista)
  loop
    if length(trim(coalesce(item->>'matricula',''))) = 0
       or length(trim(coalesce(item->>'nome_completo',''))) = 0 then
      continue;
    end if;

    select * into atual from public.xcmg_colaboradores
      where trim(matricula)=trim(item->>'matricula') limit 1;

    if found then
      update public.xcmg_colaboradores set
        nome_completo=trim(item->>'nome_completo'),
        nome_exibicao=trim(item->>'nome_exibicao'),
        funcao=trim(coalesce(item->>'funcao','')),
        area=trim(coalesce(item->>'area','')),
        data_admissao=nullif(item->>'data_admissao','')::date,
        data_nascimento=nullif(item->>'data_nascimento','')::date,
        cpf=trim(coalesce(item->>'cpf','')),
        turma=upper(trim(coalesce(item->>'turma',''))),
        status=coalesce(nullif(trim(item->>'status'),''),'Ativo'),
        updated_at=now()
      where id=atual.id returning id into cid;

      if row(atual.nome_completo,atual.funcao,atual.area,atual.data_admissao,atual.data_nascimento,atual.cpf,atual.turma,atual.status)
         is distinct from row(trim(item->>'nome_completo'),trim(coalesce(item->>'funcao','')),trim(coalesce(item->>'area','')),nullif(item->>'data_admissao','')::date,nullif(item->>'data_nascimento','')::date,trim(coalesce(item->>'cpf','')),upper(trim(coalesce(item->>'turma',''))),coalesce(nullif(trim(item->>'status'),''),'Ativo')) then
        insert into public.xcmg_efetivo_historico(colaborador_id,tipo,campo,valor_anterior,valor_novo,motivo,descricao)
        values(cid,'Importação','planilha','Dados anteriores','Dados atualizados','Importação do efetivo','Cadastro atualizado pela importação da planilha');
      end if;
    else
      insert into public.xcmg_colaboradores(matricula,nome_completo,nome_exibicao,funcao,area,data_admissao,data_nascimento,cpf,turma,status)
      values(trim(item->>'matricula'),trim(item->>'nome_completo'),trim(item->>'nome_exibicao'),trim(coalesce(item->>'funcao','')),trim(coalesce(item->>'area','')),nullif(item->>'data_admissao','')::date,nullif(item->>'data_nascimento','')::date,trim(coalesce(item->>'cpf','')),upper(trim(coalesce(item->>'turma',''))),coalesce(nullif(trim(item->>'status'),''),'Ativo'))
      returning id into cid;
      insert into public.xcmg_efetivo_historico(colaborador_id,tipo,campo,valor_novo,motivo,descricao)
      values(cid,'Importação','cadastro','Cadastrado','Importação inicial','Colaborador incluído pela planilha do efetivo');
    end if;
    total := total + 1;
  end loop;
  return total;
end;
$$;

grant execute on function public.xcmg_importar_efetivo(jsonb) to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.xcmg_efetivo_historico;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
