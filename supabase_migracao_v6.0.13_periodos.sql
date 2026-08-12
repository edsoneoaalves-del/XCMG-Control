-- XCMG Control v6.0.13 - períodos excepcionais de fechamento
-- Seguro para os dados existentes: não remove nem altera registros.

alter table public.xcmg_config
  add column if not exists periodos_fechamento jsonb not null default '[]'::jsonb;

update public.xcmg_config
set periodos_fechamento = '[]'::jsonb
where periodos_fechamento is null;

comment on column public.xcmg_config.periodos_fechamento is
'Períodos excepcionais de fechamento. O padrão do aplicativo continua sendo do dia 10 ao dia 09.';
