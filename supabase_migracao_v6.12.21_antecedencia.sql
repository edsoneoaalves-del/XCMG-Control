begin;
alter table public.xcmg_aso_regras add column if not exists min_days integer not null default 15;
alter table public.xcmg_aso_regras add column if not exists max_days integer not null default 60;
alter table public.xcmg_aso_regras drop constraint if exists xcmg_aso_janela_check;
alter table public.xcmg_aso_regras add constraint xcmg_aso_janela_check check(min_days >= 15 and max_days >= min_days and max_days <= 365);
create or replace function public.xcmg_aso_regras_ler(p_token text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ begin
if not public.xcmg_aso_permitido(p_token,'aso_ver') then raise exception 'Acesso negado'; end if;
return (select jsonb_build_object('limit',limite,'different',diferentes,'first',primeiro,'minDays',min_days,'maxDays',max_days) from public.xcmg_aso_regras where id=1); end $$;
create or replace function public.xcmg_aso_regras_salvar(p_token text,p_limit integer,p_different boolean,p_first boolean,p_min_days integer,p_max_days integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
if not exists(select 1 from public.xcmg_sessoes s join public.xcmg_usuarios u on u.id=s.usuario_id where s.token=p_token and s.expira_em>now() and u.ativo and u.administrador) then raise exception 'Acesso negado'; end if;
update public.xcmg_aso_regras set limite=p_limit,diferentes=p_different,primeiro=p_first,min_days=p_min_days,max_days=p_max_days where id=1; end $$;
revoke all on function public.xcmg_aso_regras_salvar(text,integer,boolean,boolean,integer,integer) from public;
grant execute on function public.xcmg_aso_regras_salvar(text,integer,boolean,boolean,integer,integer) to anon,authenticated;
commit;
notify pgrst, 'reload schema';
