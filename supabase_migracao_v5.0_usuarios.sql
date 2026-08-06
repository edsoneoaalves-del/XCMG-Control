-- XCMG Control v5.0 - usuários e permissões (sem auditoria)
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.xcmg_usuarios (
  id bigint generated always as identity primary key,
  nome text not null,
  login text not null,
  senha_hash text not null,
  administrador boolean not null default false,
  permissoes jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint xcmg_usuario_nome_check check (length(trim(nome)) > 0),
  constraint xcmg_usuario_login_check check (length(trim(login)) >= 3),
  constraint xcmg_usuario_permissoes_check check (jsonb_typeof(permissoes) = 'array')
);

create unique index if not exists xcmg_usuarios_login_unico_idx
  on public.xcmg_usuarios (lower(trim(login)));

create table if not exists public.xcmg_sessoes (
  token text primary key,
  usuario_id bigint not null references public.xcmg_usuarios(id) on delete cascade,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists xcmg_sessoes_usuario_idx on public.xcmg_sessoes(usuario_id);
create index if not exists xcmg_sessoes_expira_idx on public.xcmg_sessoes(expira_em);

alter table public.xcmg_usuarios enable row level security;
alter table public.xcmg_sessoes enable row level security;
revoke all on public.xcmg_usuarios from anon, authenticated;
revoke all on public.xcmg_sessoes from anon, authenticated;

-- Primeiro administrador. Altere a senha após entrar.
insert into public.xcmg_usuarios (nome,login,senha_hash,administrador,permissoes,ativo)
select 'Administrador','admin',extensions.crypt('Admin@123',extensions.gen_salt('bf')),true,'[]'::jsonb,true
where not exists (select 1 from public.xcmg_usuarios);

create or replace function public.xcmg_login(p_login text, p_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.xcmg_usuarios%rowtype;
  v_token text;
begin
  delete from public.xcmg_sessoes where expira_em <= now();
  select * into u from public.xcmg_usuarios
   where lower(trim(login)) = lower(trim(p_login)) and ativo = true limit 1;
  if u.id is null or u.senha_hash <> extensions.crypt(coalesce(p_senha,''),u.senha_hash) then
    raise exception 'Usuário ou senha inválidos.';
  end if;
  v_token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.xcmg_sessoes(token,usuario_id,expira_em)
  values(v_token,u.id,now()+interval '30 days');
  return jsonb_build_object('token',v_token,'id',u.id,'nome',u.nome,'login',u.login,'administrador',u.administrador,'permissoes',u.permissoes);
end;
$$;

create or replace function public.xcmg_validar_sessao(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare u public.xcmg_usuarios%rowtype;
begin
  select u.* into u from public.xcmg_sessoes s join public.xcmg_usuarios u on u.id=s.usuario_id
   where s.token=p_token and s.expira_em>now() and u.ativo=true limit 1;
  if u.id is null then return null; end if;
  update public.xcmg_sessoes set expira_em=now()+interval '30 days' where token=p_token;
  return jsonb_build_object('token',p_token,'id',u.id,'nome',u.nome,'login',u.login,'administrador',u.administrador,'permissoes',u.permissoes);
end;
$$;

create or replace function public.xcmg_logout(p_token text)
returns void language sql security definer set search_path=public as $$
  delete from public.xcmg_sessoes where token=p_token;
$$;

create or replace function public.xcmg_pode_gerenciar_usuarios(p_token text)
returns boolean language sql security definer stable set search_path=public as $$
  select coalesce(bool_or(u.administrador or u.permissoes ? 'usuarios_gerenciar'),false)
  from public.xcmg_sessoes s join public.xcmg_usuarios u on u.id=s.usuario_id
  where s.token=p_token and s.expira_em>now() and u.ativo=true;
$$;

create or replace function public.xcmg_listar_usuarios(p_token text)
returns table(id bigint,nome text,login text,administrador boolean,permissoes jsonb,ativo boolean)
language plpgsql security definer set search_path=public as $$
begin
  if not public.xcmg_pode_gerenciar_usuarios(p_token) then raise exception 'Acesso não autorizado.'; end if;
  return query select u.id,u.nome,u.login,u.administrador,u.permissoes,u.ativo from public.xcmg_usuarios u order by u.nome;
end;$$;

create or replace function public.xcmg_criar_usuario(p_token text,p_nome text,p_login text,p_senha text,p_administrador boolean,p_permissoes jsonb)
returns bigint language plpgsql security definer set search_path=public,extensions as $$
declare v_id bigint;
begin
  if not public.xcmg_pode_gerenciar_usuarios(p_token) then raise exception 'Acesso não autorizado.'; end if;
  if length(trim(coalesce(p_senha,'')))<6 then raise exception 'A senha deve ter pelo menos 6 caracteres.'; end if;
  insert into public.xcmg_usuarios(nome,login,senha_hash,administrador,permissoes)
  values(trim(p_nome),lower(trim(p_login)),extensions.crypt(p_senha,extensions.gen_salt('bf')),coalesce(p_administrador,false),coalesce(p_permissoes,'[]'::jsonb))
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Este login já está cadastrado.';
end;$$;

create or replace function public.xcmg_atualizar_usuario(p_token text,p_id bigint,p_nome text,p_login text,p_administrador boolean,p_permissoes jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.xcmg_pode_gerenciar_usuarios(p_token) then raise exception 'Acesso não autorizado.'; end if;
  update public.xcmg_usuarios set nome=trim(p_nome),login=lower(trim(p_login)),administrador=coalesce(p_administrador,false),permissoes=coalesce(p_permissoes,'[]'::jsonb),updated_at=now() where id=p_id;
exception when unique_violation then raise exception 'Este login já está cadastrado.';
end;$$;

create or replace function public.xcmg_redefinir_senha_usuario(p_token text,p_id bigint,p_nova_senha text)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  if not public.xcmg_pode_gerenciar_usuarios(p_token) then raise exception 'Acesso não autorizado.'; end if;
  if length(trim(coalesce(p_nova_senha,'')))<6 then raise exception 'A senha deve ter pelo menos 6 caracteres.'; end if;
  update public.xcmg_usuarios set senha_hash=extensions.crypt(p_nova_senha,extensions.gen_salt('bf')),updated_at=now() where id=p_id;
  delete from public.xcmg_sessoes where usuario_id=p_id and token<>p_token;
end;$$;

create or replace function public.xcmg_alterar_status_usuario(p_token text,p_id bigint,p_ativo boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_meu_id bigint;
begin
  if not public.xcmg_pode_gerenciar_usuarios(p_token) then raise exception 'Acesso não autorizado.'; end if;
  select usuario_id into v_meu_id from public.xcmg_sessoes where token=p_token and expira_em>now();
  if v_meu_id=p_id and p_ativo=false then raise exception 'Você não pode desativar o próprio usuário.'; end if;
  update public.xcmg_usuarios set ativo=p_ativo,updated_at=now() where id=p_id;
  if not p_ativo then delete from public.xcmg_sessoes where usuario_id=p_id; end if;
end;$$;

grant execute on function public.xcmg_login(text,text) to anon,authenticated;
grant execute on function public.xcmg_validar_sessao(text) to anon,authenticated;
grant execute on function public.xcmg_logout(text) to anon,authenticated;
grant execute on function public.xcmg_listar_usuarios(text) to anon,authenticated;
grant execute on function public.xcmg_criar_usuario(text,text,text,text,boolean,jsonb) to anon,authenticated;
grant execute on function public.xcmg_atualizar_usuario(text,bigint,text,text,boolean,jsonb) to anon,authenticated;
grant execute on function public.xcmg_redefinir_senha_usuario(text,bigint,text) to anon,authenticated;
grant execute on function public.xcmg_alterar_status_usuario(text,bigint,boolean) to anon,authenticated;

notify pgrst, 'reload schema';
