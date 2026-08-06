-- XCMG Control 6.0.5 - preserva a categoria escolhida em cada ocorrência.
alter table public.xcmg_registros add column if not exists categoria text not null default '';
notify pgrst, 'reload schema';

alter table public.xcmg_config add column if not exists categorias_rh jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
