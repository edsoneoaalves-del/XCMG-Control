begin;
alter table public.xcmg_aso_regras alter column max_days set default 40;
-- Preserve other rules; reject incompatible custom minimum rather than silently changing it.
do $$ begin
  if exists (select 1 from public.xcmg_aso_regras where id=1 and min_days>40) then
    raise exception 'Antecedência mínima superior a 40 dias; ajuste a configuração antes de executar esta migração.';
  end if;
end $$;
update public.xcmg_aso_regras set max_days=40 where id=1;
commit;
