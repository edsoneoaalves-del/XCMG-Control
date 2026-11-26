begin;
alter table public.xcmg_aso_regras alter column max_days set default 60;
-- Preserve other rules; reject incompatible custom minimum rather than silently changing it.
do $$ begin
  if exists (select 1 from public.xcmg_aso_regras where id=1 and min_days>60) then
    raise exception 'Antecedência mínima superior a 60 dias; ajuste a configuração antes de executar esta migração.';
  end if;
end $$;
update public.xcmg_aso_regras set max_days=60 where id=1;
commit;
