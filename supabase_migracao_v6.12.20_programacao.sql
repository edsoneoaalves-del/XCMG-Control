begin;
create table if not exists public.xcmg_aso_regras (id integer primary key check(id=1), limite integer not null check(limite between 1 and 6), diferentes boolean not null, primeiro boolean not null);
alter table public.xcmg_aso_regras enable row level security;
revoke all on public.xcmg_aso_regras from anon, authenticated;
insert into public.xcmg_aso_regras values(1,2,true,true) on conflict(id) do nothing;
create or replace function public.xcmg_aso_regras_ler(p_token text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ begin
if not public.xcmg_aso_permitido(p_token,'aso_ver') then raise exception 'Acesso negado'; end if;
return (select jsonb_build_object('limit',limite,'different',diferentes,'first',primeiro) from public.xcmg_aso_regras where id=1); end $$;
create or replace function public.xcmg_aso_regras_salvar(p_token text,p_limit integer,p_different boolean,p_first boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
if not exists(select 1 from public.xcmg_sessoes s join public.xcmg_usuarios u on u.id=s.usuario_id where s.token=p_token and s.expira_em>now() and u.ativo and u.administrador) then raise exception 'Acesso negado'; end if;
update public.xcmg_aso_regras set limite=p_limit,diferentes=p_different,primeiro=p_first where id=1; end $$;
revoke all on function public.xcmg_aso_regras_ler(text),public.xcmg_aso_regras_salvar(text,integer,boolean,boolean) from public;
grant execute on function public.xcmg_aso_regras_ler(text),public.xcmg_aso_regras_salvar(text,integer,boolean,boolean) to anon,authenticated;
commit;
notify pgrst, 'reload schema';
