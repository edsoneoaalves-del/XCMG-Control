-- XCMG Control 4.2.5 - campo Motivo para o relatório do RH.
-- Esta migração preserva todos os registros existentes.

alter table public.xcmg_registros
  add column if not exists motivo text not null default '';

notify pgrst, 'reload schema';
