begin;
alter table public.xcmg_aso_regras add column if not exists strict_teams text[] not null default array['D']::text[];
alter table public.xcmg_aso_regras drop constraint if exists xcmg_aso_strict_teams_check;
alter table public.xcmg_aso_regras add constraint xcmg_aso_strict_teams_check check (strict_teams <@ array['A','B','C','D']::text[] and array_position(strict_teams,null) is null);
create or replace function public.xcmg_aso_regras_ler(p_token text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ begin
if not public.xcmg_aso_permitido(p_token,'aso_ver') then raise exception 'Acesso negado'; end if;
return (select jsonb_build_object('limit',limite,'different',diferentes,'first',primeiro,'minDays',min_days,'maxDays',max_days,'strictTeams',strict_teams) from public.xcmg_aso_regras where id=1); end $$;
create or replace function public.xcmg_aso_regras_salvar(p_token text,p_limit integer,p_different boolean,p_first boolean,p_min_days integer,p_max_days integer,p_strict_teams text[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
if not public.xcmg_aso_permitido(p_token,'aso_configurar') then raise exception 'Acesso negado'; end if;
update public.xcmg_aso_regras set limite=p_limit,diferentes=p_different,primeiro=p_first,min_days=p_min_days,max_days=p_max_days,strict_teams=p_strict_teams where id=1; end $$;
revoke all on function public.xcmg_aso_regras_salvar(text,integer,boolean,boolean,integer,integer,text[]) from public;
grant execute on function public.xcmg_aso_regras_salvar(text,integer,boolean,boolean,integer,integer,text[]) to anon,authenticated;
commit;
notify pgrst, 'reload schema';
