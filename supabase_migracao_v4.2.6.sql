-- XCMG Control 4.2.6 - preserva o nome completo em cada ocorrência.
-- Não apaga registros existentes.

alter table public.xcmg_registros
  add column if not exists nome_completo text not null default '';

-- Preenche registros antigos usando o cadastro atual, quando houver correspondência.
update public.xcmg_registros r
set nome_completo = c.nome_completo,
    matricula = case when coalesce(r.matricula,'')='' then coalesce(c.matricula,'') else r.matricula end,
    funcao_colaborador = case when coalesce(r.funcao_colaborador,'')='' then coalesce(c.funcao,'') else r.funcao_colaborador end,
    area = case when coalesce(r.area,'')='' then coalesce(c.area,'') else r.area end
from public.xcmg_colaboradores c
where coalesce(r.nome_completo,'')=''
  and (
    (coalesce(r.matricula,'')<>'' and r.matricula=c.matricula)
    or r.nome=c.nome_exibicao
    or r.nome=c.nome_completo
  );

-- Para registros sem correspondência, mantém o nome já registrado.
update public.xcmg_registros
set nome_completo = nome
where coalesce(nome_completo,'')='';

notify pgrst, 'reload schema';
