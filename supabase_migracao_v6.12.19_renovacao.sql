begin;
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
if oldrow.revisao is not null then hist:=hist||jsonb_build_array(jsonb_build_object('data_exame',oldrow.data_exame,'vencimento_excepcional',oldrow.vencimento_excepcional,'data_prevista',oldrow.data_prevista,'status',oldrow.status,'alterado_em',now())); end if;
insert into public.xcmg_aso values(p_id,p_exame,p_vencimento,p_prevista,p_status,hist,p_revisao+1) on conflict(colaborador_id) do update set data_exame=excluded.data_exame,vencimento_excepcional=excluded.vencimento_excepcional,data_prevista=excluded.data_prevista,status=excluded.status,historico=excluded.historico,revisao=excluded.revisao;
end $$;

commit;
notify pgrst, 'reload schema';
