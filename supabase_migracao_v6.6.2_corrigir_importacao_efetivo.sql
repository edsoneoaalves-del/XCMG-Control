-- XCMG Control v6.6.2 — corrige importação quando o nome já existe.
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

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

    atual := null;
    select * into atual
      from public.xcmg_colaboradores
     where trim(matricula)=trim(item->>'matricula')
        or lower(trim(nome_completo))=lower(trim(item->>'nome_completo'))
     order by case when trim(matricula)=trim(item->>'matricula') then 0 else 1 end
     limit 1;

    if found then
      update public.xcmg_colaboradores set
        matricula=trim(item->>'matricula'),
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

      insert into public.xcmg_efetivo_historico
        (colaborador_id,tipo,campo,valor_anterior,valor_novo,motivo,descricao)
      values
        (cid,'Importação','planilha','Cadastro anterior','Dados conferidos/atualizados',
         'Importação do efetivo','Cadastro localizado pela matrícula ou pelo nome e atualizado pela planilha');
    else
      insert into public.xcmg_colaboradores
        (matricula,nome_completo,nome_exibicao,funcao,area,data_admissao,data_nascimento,cpf,turma,status)
      values
        (trim(item->>'matricula'),trim(item->>'nome_completo'),trim(item->>'nome_exibicao'),
         trim(coalesce(item->>'funcao','')),trim(coalesce(item->>'area','')),
         nullif(item->>'data_admissao','')::date,nullif(item->>'data_nascimento','')::date,
         trim(coalesce(item->>'cpf','')),upper(trim(coalesce(item->>'turma',''))),
         coalesce(nullif(trim(item->>'status'),''),'Ativo'))
      returning id into cid;

      insert into public.xcmg_efetivo_historico
        (colaborador_id,tipo,campo,valor_novo,motivo,descricao)
      values
        (cid,'Importação','cadastro','Cadastrado','Importação do efetivo',
         'Colaborador incluído pela planilha do efetivo');
    end if;
    total := total + 1;
  end loop;

  return total;
end;
$$;

grant execute on function public.xcmg_importar_efetivo(jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
