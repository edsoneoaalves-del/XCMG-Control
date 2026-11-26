begin;
alter table public.xcmg_aso_regras alter column max_days set default 40;
alter table public.xcmg_aso_regras alter column limite set default 3;
do $$ begin
  if exists (select 1 from public.xcmg_aso_regras where id=1 and min_days>40) then
    raise exception 'Antecedência mínima superior a 40 dias; ajuste a configuração antes de executar esta migração.';
  end if;
end $$;
update public.xcmg_aso_regras set max_days=40, limite=3, diferentes=true where id=1;
commit;
