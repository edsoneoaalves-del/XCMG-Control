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
