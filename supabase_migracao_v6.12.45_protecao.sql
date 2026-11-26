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
  if (select count(*) from public.xcmg_aso a where a.data_prevista=new.data_prevista and a.colaborador_id<>new.colaborador_id)>=regras.limite then raise exception 'Limite diário atingido'; end if;
  func:=regexp_replace(lower(trim(coalesce(c.funcao,''))),'\s+',' ','g');
  if func ~ '\moperadora?\M' and func ~ '\mguindastes?\M' then func:='operador de guindaste'; end if;
  if regras.diferentes and exists(select 1 from public.xcmg_aso a join public.xcmg_colaboradores x on x.id=a.colaborador_id cross join lateral (select regexp_replace(lower(trim(coalesce(x.funcao,''))),'\s+',' ','g') as f) q where a.data_prevista=new.data_prevista and a.colaborador_id<>new.colaborador_id and (func='' or q.f='' or func=case when q.f ~ '\moperadora?\M' and q.f ~ '\mguindastes?\M' then 'operador de guindaste' else q.f end)) then raise exception 'Conflito de função'; end if;
  return new;
end $$;
revoke all on function public.xcmg_aso_validar_gravacao() from public;
drop trigger if exists xcmg_aso_validar_gravacao on public.xcmg_aso;
create trigger xcmg_aso_validar_gravacao before insert or update on public.xcmg_aso for each row execute function public.xcmg_aso_validar_gravacao();
commit;
