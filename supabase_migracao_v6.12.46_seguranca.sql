begin;
-- Proteção adicional para gravações ASO, inclusive clientes antigos.
create or replace function public.xcmg_aso_validar_gravacao() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.xcmg_colaboradores%rowtype; regras public.xcmg_aso_regras%rowtype; fim date; turma text; pos integer; func text; hoje date := (now() at time zone 'America/Belem')::date;
begin
  perform pg_advisory_xact_lock(61245,1);
  select * into strict c from public.xcmg_colaboradores where id=new.colaborador_id;
  select * into strict regras from public.xcmg_aso_regras where id=1;
  fim:=coalesce(new.vencimento_excepcional,(new.data_exame+interval '1 year')::date);
  if new.data_exame is null or new.data_exame>hoje or fim<=new.data_exame or new.status not in ('Não programado','Programado','Renovado') then raise exception 'Datas ou status inválidos'; end if;
  if new.status='Programado' and new.data_prevista is null then raise exception 'Agendamento sem data'; end if;
  if new.data_prevista is null then return new; end if;
  turma:=regexp_replace(upper(trim(c.turma)),'^TURMA\s+','');
  pos:=((new.data_prevista-date '2026-09-02')%6+6)%6;
  if new.data_prevista<hoje or fim-new.data_prevista not between regras.min_days and regras.max_days or extract(dow from new.data_prevista)=0 or turma is null or turma not in ('A','B','C','D') or (turma in ('A','B') and pos>=3) or (turma in ('C','D') and pos<3) or (turma=any(regras.strict_teams) and pos not in (0,3)) then raise exception 'Data fora da escala ou antecedência permitida'; end if;
  if exists(select 1 from public.xcmg_programacao_ferias f where (f.colaborador_id=c.id or (f.colaborador_id is null and ((nullif(trim(f.matricula),'') is not null and trim(f.matricula)=trim(c.matricula)) or lower(trim(f.nome_completo))=lower(trim(c.nome_completo))))) and new.data_prevista between f.inicio and f.fim and upper(trim(f.status_aprovacao)) not in ('CANCELADO','NÃO APROVADO','NAO APROVADO','REPROGRAMAR')) then raise exception 'Conflito com férias programadas'; end if;
  if lower(trim(coalesce(c.status,'Ativo'))) <> 'ativo' then raise exception 'Colaborador inativo'; end if;
  if exists(select 1 from public.xcmg_registros r where
    ((nullif(trim(r.matricula),'') is not null and trim(r.matricula)=trim(c.matricula)) or lower(trim(coalesce(nullif(r.nome_completo,''),r.nome)))=lower(trim(c.nome_completo)))
    and r.inicio<=new.data_prevista and (r.fim is null or r.fim>=new.data_prevista)
    and lower(trim(r.tipo))<>'folga compensada'
    and not (lower(trim(r.tipo))='férias' and (lower(coalesce(r.descricao,'')) like '%férias programadas%' or lower(coalesce(r.observacao,'')) like '%retorno previsto%')))
  then raise exception 'Conflito com ausência ou afastamento'; end if;
  if (select count(*) from public.xcmg_aso a where a.data_prevista=new.data_prevista and a.colaborador_id<>new.colaborador_id)>=regras.limite then raise exception 'Limite diário atingido'; end if;
  func:=regexp_replace(lower(trim(coalesce(c.funcao,''))),'\s+',' ','g');
  if func ~ '\moperadora?\M' and func ~ '\mguindastes?\M' then func:='operador de guindaste'; end if;
  if regras.diferentes and exists(select 1 from public.xcmg_aso a join public.xcmg_colaboradores x on x.id=a.colaborador_id cross join lateral (select regexp_replace(lower(trim(coalesce(x.funcao,''))),'\s+',' ','g') as f) q where a.data_prevista=new.data_prevista and a.colaborador_id<>new.colaborador_id and (func='' or q.f='' or func=case when q.f ~ '\moperadora?\M' and q.f ~ '\mguindastes?\M' then 'operador de guindaste' else q.f end)) then raise exception 'Conflito de função'; end if;
  return new;
end $$;
revoke all on function public.xcmg_aso_validar_gravacao() from public;
drop trigger if exists xcmg_aso_validar_gravacao on public.xcmg_aso;
create trigger xcmg_aso_validar_gravacao before insert or update on public.xcmg_aso for each row execute function public.xcmg_aso_validar_gravacao();

create or replace function public.xcmg_aso_salvar(p_token text,p_id bigint,p_exame date,p_vencimento date,p_prevista date,p_status text,p_revisao integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare oldrow public.xcmg_aso%rowtype; hist jsonb; fim date; begin
if not public.xcmg_aso_permitido(p_token,'aso_editar') then raise exception 'Acesso negado'; end if;
perform pg_advisory_xact_lock(p_id);
if not exists(select 1 from public.xcmg_colaboradores where id=p_id) then raise exception 'Colaborador inexistente'; end if;
select * into oldrow from public.xcmg_aso where colaborador_id=p_id;
if coalesce(oldrow.revisao,0)<>p_revisao then raise exception 'Registro alterado. Atualize a lista.'; end if;
fim:=coalesce(p_vencimento,(p_exame+interval '1 year')::date);
if p_exame is null or p_exame>(now() at time zone 'America/Belem')::date or fim<p_exame or p_status not in ('Não programado','Programado','Renovado') or (p_prevista is not null and (p_prevista>=fim or extract(dow from p_prevista)=0)) then raise exception 'Dados inválidos'; end if;
if p_status='Renovado' and (oldrow.revisao is null or (p_exame<>oldrow.data_exame and (p_exame<=oldrow.data_exame or fim<>(p_exame+interval '1 year')::date or p_prevista is not null))) then raise exception 'Renovação inválida'; end if;
hist:=coalesce(oldrow.historico,'[]'::jsonb);
if oldrow.revisao is not null then hist:=hist||jsonb_build_array(jsonb_build_object('data_exame',oldrow.data_exame,'vencimento_excepcional',oldrow.vencimento_excepcional,'data_prevista',oldrow.data_prevista,'status',oldrow.status,'alterado_em',now(),'usuario_id',(select usuario_id from public.xcmg_sessoes where token=p_token and expira_em>now()))); end if;
insert into public.xcmg_aso values(p_id,p_exame,p_vencimento,p_prevista,p_status,hist,p_revisao+1) on conflict(colaborador_id) do update set data_exame=excluded.data_exame,vencimento_excepcional=excluded.vencimento_excepcional,data_prevista=excluded.data_prevista,status=excluded.status,historico=excluded.historico,revisao=excluded.revisao;
end $$;




commit;
notify pgrst, 'reload schema';
