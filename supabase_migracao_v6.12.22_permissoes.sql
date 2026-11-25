begin;
create or replace function public.xcmg_aso_regras_salvar(p_token text,p_limit integer,p_different boolean,p_first boolean,p_min_days integer,p_max_days integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
if not public.xcmg_aso_permitido(p_token,'aso_configurar') then raise exception 'Acesso negado'; end if;
update public.xcmg_aso_regras set limite=p_limit,diferentes=p_different,primeiro=p_first,min_days=p_min_days,max_days=p_max_days where id=1; end $$;
revoke all on function public.xcmg_aso_regras_salvar(text,integer,boolean,boolean,integer,integer) from public;
grant execute on function public.xcmg_aso_regras_salvar(text,integer,boolean,boolean,integer,integer) to anon,authenticated;
commit;
notify pgrst, 'reload schema';
