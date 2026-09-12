(function(){
'use strict';
const $=id=>document.getElementById(id);
const SUPABASE_URL='https://exsvzguzgfwuclincgov.supabase.co';
const SUPABASE_KEY='sb_publishable_UhqP2AmVQ2zg7wfllbJSvg_xmiD5sFM';
const REG_KEY='xcmg_registros_v2',CFG_KEY='xcmg_config_v2',COL_KEY='xcmg_colaboradores_cache_v1',FERIAS_KEY='xcmg_programacao_ferias_v1',FERIAS_TABLE='xcmg_programacao_ferias',FERIAS_CICLOS_KEY='xcmg_ferias_ciclos_manuais_v1',QUEUE_KEY='xcmg_fila_offline_v1',MIG_KEY='xcmg_supabase_migrado_v41',VIEW_KEY='xcmg_mostrar_todos_registros',MOTIVOS_KEY='xcmg_motivos_rh_v2',CATEGORIAS_KEY='xcmg_categorias_rh_v3',HF_KEY='xcmg_homem_frota_v1',HF_TABLE='xcmg_homem_frota';
const CATS=['Férias','Atestado','Falta não justificada','Desligamento','Outras justificativas','Folga compensada'];
const MOTIVOS_POR_CATEGORIA={
  'Férias':['Férias','Folga compensada'],
  'Saúde':['Atestado Médico','Exame Periódico'],
  'Ausências':['Falta justificada','Falta Não Justificada'],
  'Eventos':['Casamento','Nascimento','Óbito de familiar'],
  'Outros':['Desligamento','Outras justificativas']
};
const MOTIVOS_PADRAO=Object.values(MOTIVOS_POR_CATEGORIA).flat();
const ICONES_CATEGORIA={'Férias':'📅','Saúde':'🏥','Ausências':'⚠️','Eventos':'🎉','Outros':'📄'};
let categoriasRH=[];
const PADRAO={turma:'Turma D',efetivoTotal:0,nomeSistema:'XCMG Control',desenvolvedor:'Edson de Oliveira Alves',estiloSimbolos:'completo',periodosFechamento:[]};
let registros=[],colaboradores=[],homemFrota=lerLocal(HF_KEY,[]),programacaoFerias=[],ajustesCiclosFerias=lerLocal(FERIAS_CICLOS_KEY,{}),feriasNuvemDisponivel=false,config={...PADRAO},editando=null,editandoEfetivoId=null,editandoFeriasId=null,cicloProgramacaoSelecionado=null,promptInstalacao=null,canalRealtime=null,carregando=false,importandoColaboradores=false,fotoAtual={url:'',path:''},removerFotoAtual=false,editandoPeriodoId=null,editandoHFId=null,hfVinculoId=null,hfNuvemDisponivel=false;
let conexaoReal=navigator.onLine!==false,verificandoConexao=false;
const AUTH_KEY='xcmg_auth_v5',LAST_LOGIN_KEY='xcmg_ultimo_login_v5',OFFLINE_CRED_KEY='xcmg_credencial_offline_v1';let usuarioAtual=null,editandoUsuarioId=null;

const THEME_KEY='xcmg_tema_v6';
function aplicarTema(tema){
  const escolhido=tema==='light'?'light':'dark';
  document.documentElement.dataset.theme=escolhido;
  const claro=escolhido==='light';
  try{localStorage.setItem(THEME_KEY,escolhido)}catch{}
  const botao=$('btnTema');
  if(botao){
    const icone=botao.querySelector('.theme-icon');
    const texto=botao.querySelector('.theme-label');
    if(icone)icone.textContent=claro?'☾':'☀';
    if(texto)texto.textContent=claro?'Escuro':'Claro';
    botao.title=claro?'Ativar tema escuro':'Ativar tema claro';
    botao.setAttribute('aria-label',botao.title);
  }
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',claro?'#f4f7fb':'#061625');
}
function alternarTema(){aplicarTema(document.documentElement.dataset.theme==='dark'?'light':'dark')}

const db=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;

function lerLocal(k,p){try{const v=JSON.parse(localStorage.getItem(k));return v??p}catch{return p}}

async function hashCredencial(login,senha){
  const texto=`${String(login||'').trim().toLowerCase()}::${String(senha||'')}`;
  if(window.crypto?.subtle){
    const bytes=new TextEncoder().encode(texto);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  let h=2166136261;for(let i=0;i<texto.length;i++){h^=texto.charCodeAt(i);h=Math.imul(h,16777619)}return String(h>>>0);
}
async function salvarCredencialOffline(login,senha,usuario){
  try{gravarLocal(OFFLINE_CRED_KEY,{login:String(login).trim().toLowerCase(),hash:await hashCredencial(login,senha),usuario,atualizado_em:new Date().toISOString()})}catch(e){console.warn('Não foi possível salvar o acesso offline',e)}
}
async function autenticarOffline(login,senha){
  const cred=lerLocal(OFFLINE_CRED_KEY,null);
  if(!cred?.usuario||cred.login!==String(login).trim().toLowerCase())return null;
  const hash=await hashCredencial(login,senha);
  return hash===cred.hash?cred.usuario:null;
}
function abrirAplicacaoComUsuario(usuario,mensagem='Acesso liberado.'){
  usuarioAtual=usuario;localStorage.setItem(AUTH_KEY,JSON.stringify(usuario));
  $('loginStatus').textContent=mensagem;$('loginScreen').classList.add('hidden');$('appShell').classList.remove('hidden');$('loginSenha').value='';$('loginSenha').type='password';$('btnVerSenhaLogin').textContent='👁';
  aplicarPermissoes();const primeira=Array.from(document.querySelectorAll('.nav-item:not(.hidden)'))[0];if(primeira)abrirPagina(primeira.dataset.page);
  setTimeout(()=>carregarDepoisDoLogin(),0);
}

function gravarLocal(k,v){localStorage.setItem(k,JSON.stringify(v))}
function salvarCacheLocal(){gravarLocal(REG_KEY,registros);gravarLocal(CFG_KEY,config);gravarLocal(COL_KEY,colaboradores);gravarLocal(HF_KEY,homemFrota)}
function filaOffline(){return lerLocal(QUEUE_KEY,[])}
function adicionarFilaOffline(acao){const fila=filaOffline();fila.push({...acao,criado_em:new Date().toISOString()});gravarLocal(QUEUE_KEY,fila);statusNuvem(`Offline • ${fila.length} alteração(ões) pendente(s)`,true)}
function estaOnline(){return navigator.onLine!==false&&conexaoReal!==false}
async function verificarConexaoReal(){
  if(verificandoConexao)return estaOnline();
  if(navigator.onLine===false){conexaoReal=false;statusNuvem('Offline');return false}
  verificandoConexao=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/`,{method:'GET',headers:{apikey:SUPABASE_KEY},cache:'no-store',signal:controller.signal});
    conexaoReal=true;statusNuvem('Online');return true;
  }catch(e){
    conexaoReal=false;statusNuvem('Offline');return false;
  }finally{clearTimeout(timer);verificandoConexao=false}
}
function carregarCacheOffline(){registros=lerLocal(REG_KEY,[]);homemFrota=lerLocal(HF_KEY,[]);config={...PADRAO,...lerLocal(CFG_KEY,{})};colaboradores=lerLocal(COL_KEY,[]);carregarProgramacaoFeriasLocal();reconstruirProgramacaoFeriasDosRegistros();carregarConfig();atualizarTudo();statusNuvem(`Offline • ${filaOffline().length} alteração(ões) pendente(s)`,true)}
async function sincronizarFilaOffline(){if(!estaOnline()||!usuarioAtual||!db)return;const fila=filaOffline();if(!fila.length){statusNuvem('Sincronizado');return}statusNuvem(`Sincronizando ${fila.length} alteração(ões)...`);const restante=[];for(const item of fila){try{if(item.entidade==='registro'){if(item.operacao==='insert'){const dados={...item.dados};delete dados.id_local;const {error}=await db.from('xcmg_registros').insert(dados);if(error)throw error}else if(item.operacao==='update'){const {error}=await db.from('xcmg_registros').update(item.dados).eq('id',item.id);if(error)throw error}else if(item.operacao==='delete'){const {error}=await db.from('xcmg_registros').delete().eq('id',item.id);if(error)throw error}}else if(item.entidade==='colaborador'){if(item.operacao==='insert'){const dados={...item.dados};delete dados.id_local;const {error}=await db.from('xcmg_colaboradores').insert(dados);if(error)throw error}else if(item.operacao==='delete'){const {error}=await db.from('xcmg_colaboradores').delete().eq('id',item.id);if(error)throw error}}else if(item.entidade==='config'){const {error}=await db.from('xcmg_config').upsert(item.dados);if(error)throw error}else if(item.entidade==='categorias'){const {error}=await db.from('xcmg_config').update({categorias_rh:item.dados}).eq('id',1);if(error)throw error}else if(item.entidade==='ferias_programacao'){const {error}=await db.from(FERIAS_TABLE).upsert(item.dados,{onConflict:'nome_chave,inicio,fim'});if(error)throw error}}catch(e){console.error('Falha ao sincronizar item offline',item,e);restante.push(item)}}gravarLocal(QUEUE_KEY,restante);if(restante.length){statusNuvem(`Online • ${restante.length} pendência(s)`,true)}else{await carregarNuvem(true);statusNuvem('Sincronizado')}}

function hoje(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function dataBR(v){if(!v)return'';const [a,m,d]=v.split('-');return `${d}/${m}/${a}`}
function dataHoraBR(d=new Date()){return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function periodoPadrao(data){if(!data)return null;const [a,m,d]=data.split('-').map(Number);let inicio,fim;if(d>=10){inicio=new Date(a,m-1,10);fim=new Date(a,m,9)}else{inicio=new Date(a,m-2,10);fim=new Date(a,m-1,9)}const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;return{inicio:iso(inicio),fim:iso(fim),personalizado:false}}
function normalizarPeriodosFechamento(){const lista=Array.isArray(config.periodosFechamento)?config.periodosFechamento:[];config.periodosFechamento=lista.filter(p=>p&&p.inicio&&p.fim&&p.fim>=p.inicio).map((p,i)=>({id:String(p.id||`periodo-${p.inicio}-${p.fim}-${i}`),inicio:p.inicio,fim:p.fim})).sort((a,b)=>a.inicio.localeCompare(b.inicio));return config.periodosFechamento}
function periodoFechamentoInfo(data){if(!data)return null;const custom=normalizarPeriodosFechamento().find(p=>data>=p.inicio&&data<=p.fim);if(custom)return{...custom,personalizado:true};return periodoPadrao(data)}
function periodoFechamento(data){const p=periodoFechamentoInfo(data);return p?`${dataBR(p.inicio)} a ${dataBR(p.fim)}`:''}
function valorPeriodoFechamento(data){return periodoFechamento(data)}
function periodo(i,f){if(i&&f)return i===f?dataBR(i):`${dataBR(i)} a ${dataBR(f)}`;if(i)return`A partir de ${dataBR(i)}`;if(f)return`Até ${dataBR(f)}`;return''}
function ehEspelhoProgramacaoFerias(r){
  if(!r||normalizarTexto(r.tipo)!=='ferias')return false;
  const descricao=normalizarTexto(r.descricao||'');
  const obs=normalizarTexto(r.observacao||'');
  return descricao.includes('ferias programadas')||obs.includes('retorno previsto');
}
function identidadePessoa(r){
  const nome=normalizarTexto(r?.nome_completo||r?.nome||'').replace(/\s+/g,' ').trim();
  const matricula=String(r?.matricula||'').trim();
  // O nome é a chave visual mais estável entre registros antigos e a programação.
  // A matrícula fica como fallback quando o nome não estiver disponível.
  return nome?`n:${nome}`:(matricula?`m:${matricula}`:'');
}
function chavePessoaPeriodo(r){
  return `${normalizarTexto(r?.tipo||'')}|${identidadePessoa(r)}|${dataISOFlex(r?.inicio)}|${dataISOFlex(r?.fim)}`;
}
function mesmaPessoa(a,b){
  const ma=String(a?.matricula||'').trim(),mb=String(b?.matricula||'').trim();
  if(ma&&mb&&ma===mb)return true;
  const na=normalizarTexto(a?.nome_completo||a?.nome||'').replace(/\s+/g,' ').trim();
  const nb=normalizarTexto(b?.nome_completo||b?.nome||'').replace(/\s+/g,' ').trim();
  return Boolean(na&&nb&&na===nb);
}
function mesmoPeriodoFerias(a,b){
  return dataISOFlex(a?.inicio)===dataISOFlex(b?.inicio)&&dataISOFlex(a?.fim)===dataISOFlex(b?.fim);
}
function programacaoComoRegistro(p){
  const item=normalizarProgramacaoFerias(p);if(!item)return null;
  return {
    ...item,
    id:`ferias-prog-${chaveProgramacaoFerias(item)}`,
    tipo:'Férias',categoria:'Férias',motivo:'Férias',descricao:'Férias programadas',
    funcao_colaborador:item.funcao_colaborador||item.funcao||'',
    funcao:item.funcao_colaborador||item.funcao||'',
    local:item.local||item.area||'',area:item.area||item.local||'',
    observacao:item.retorno?`Retorno: ${dataBR(item.retorno)}`:'',
    origem_programacao:true
  };
}
function deduplicarRegistros(lista){
  const map=new Map();
  for(const r of lista||[]){
    if(!r)continue;
    const k=chavePessoaPeriodo(r);
    const atual=map.get(k);
    // Se houver a mesma férias nas duas fontes, a programação oficial do Supabase prevalece.
    if(!atual||r.origem_programacao||!atual.origem_programacao)map.set(k,r);
  }
  return [...map.values()];
}
function contarPessoasUnicas(lista){
  const chaves=new Set();
  for(const r of lista||[]){const id=identidadePessoa(r);if(id)chaves.add(id)}
  return chaves.size;
}
// v6.10.21 — a Relação de Férias é exclusiva do Efetivo ATIVO. Registros de ex-colaboradores permanecem no banco/histórico, mas não entram na relação nem nos indicadores atuais.
function programacaoPertenceEfetivoAtivo(r){
  const mat=String(r?.matricula||'').replace(/\D/g,'');
  const nome=normalizarTexto(r?.nome_completo||r?.nome||'').replace(/\s+/g,' ').trim();
  return (Array.isArray(colaboradores)?colaboradores:[]).some(c=>{
    if(!colaboradorAtivo(c))return false;
    const cm=String(c?.matricula||'').replace(/\D/g,'');
    const cn=normalizarTexto(c?.nome_completo||c?.nome_exibicao||'').replace(/\s+/g,' ').trim();
    return (mat&&cm&&mat===cm)||(!mat&&nome&&cn===nome);
  });
}
function programacoesFeriasEfetivoAtivo(){return consolidarProgramacaoFeriasCanonica(programacaoFerias).filter(programacaoPertenceEfetivoAtivo)}
function programacoesAtivasNaData(data){
  const ref=dataISOFlex(data);if(!ref)return[];
  return programacoesFeriasEfetivoAtivo().filter(r=>statusFeriasControle(r,ref)==='EM FÉRIAS').map(programacaoComoRegistro).filter(Boolean);
}
function historicoProgramacaoFeriasAte(data){
  const ref=dataISOFlex(data);if(!ref)return[];
  return consolidarProgramacaoFeriasCanonica(programacaoFerias).filter(r=>statusFeriasControle(r,ref)==='REALIZADO').map(programacaoComoRegistro).filter(Boolean);
}
function registrosManuais(){return registros.filter(r=>!ehEspelhoProgramacaoFerias(r))}
function ativosNaData(data){
  if(!data)return deduplicarRegistros(registrosManuais());
  const ref=dataISOFlex(data);
  const programadas=programacoesAtivasNaData(ref);
  const manuaisAtivos=registrosManuais().filter(r=>ref>=(dataISOFlex(r.inicio)||'0000-01-01')&&ref<=(dataISOFlex(r.fim)||'9999-12-31'));
  const manuaisSemDuplicarFerias=manuaisAtivos.filter(r=>{
    if(normalizarTexto(r.tipo)!=='ferias')return true;
    // Férias da programação oficial têm prioridade. Um registro manual equivalente não entra novamente.
    return !programadas.some(p=>mesmaPessoa(r,p)&&mesmoPeriodoFerias(r,p));
  });
  return deduplicarRegistros([...manuaisSemDuplicarFerias,...programadas]);
}
function historicoAteData(data){
  const ref=dataISOFlex(data)||hoje();
  const manuais=registrosManuais().filter(r=>{
    if(normalizarTexto(r.tipo)!=='ferias')return true;
    return !ehEspelhoProgramacaoFerias(r);
  });
  return deduplicarRegistros([...manuais,...historicoProgramacaoFeriasAte(ref)]);
}
// Consulta consolidada da tela Registros:
// - nunca mostra férias futuras;
// - mostra férias programadas que estão ativas na Data do painel, mesmo sem lançamento manual;
// - mantém férias concluídas no histórico;
// - a programação oficial prevalece sobre uma cópia manual equivalente.
function registrosConsultaAteData(data){
  const ref=dataISOFlex(data)||hoje();
  const manuais=registrosManuais().filter(r=>{
    const inicio=dataISOFlex(r.inicio)||'0000-01-01';
    // Registros manuais futuros também não entram na consulta até a data do painel.
    if(inicio>ref)return false;
    if(normalizarTexto(r.tipo)!=='ferias')return true;
    return !ehEspelhoProgramacaoFerias(r);
  });
  const programadasAtivas=programacoesAtivasNaData(ref);
  const programadasConcluidas=historicoProgramacaoFeriasAte(ref);
  const programadas=[...programadasAtivas,...programadasConcluidas];
  const manuaisSemDuplicarFerias=manuais.filter(r=>{
    if(normalizarTexto(r.tipo)!=='ferias')return true;
    return !programadas.some(p=>mesmaPessoa(r,p)&&mesmoPeriodoFerias(r,p));
  });
  return deduplicarRegistros([...manuaisSemDuplicarFerias,...programadas]);
}
function escapar(t){return String(t??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function classeTipo(t){return t==='Férias'?'type-ferias':t==='Atestado'||t==='Atestado Médico'?'type-atestado':t==='Desligamento'?'type-desligamento':t==='Folga compensada'?'type-folga':t==='Outras justificativas'?'type-outras':'type-falta'}
function iconeTipo(t){return t==='Férias'?'☂':t==='Atestado'||t==='Atestado Médico'?'✚':t==='Desligamento'?'▯':t==='Folga compensada'?'↻':t==='Outras justificativas'?'●':'!'}
function statusNuvem(texto,erro=false){
  const el=$('cloudStatus');if(!el)return;
  const t=String(texto||'');
  el.classList.remove('cloud-error','cloud-syncing','cloud-online','cloud-offline');
  if(!estaOnline() || erro || /^offline/i.test(t) || /^desconectado/i.test(t)){
    el.textContent='● OFFLINE';
    el.classList.add('cloud-offline');
    el.title=t || 'Sem conexão com a internet';
    return;
  }
  if(/sincronizando|carregando|salvando|enviando|restabelecida/i.test(t)){
    el.textContent='● SINCRONIZANDO...';
    el.classList.add('cloud-syncing');
    el.title=t;
    return;
  }
  el.textContent='● ONLINE';
  el.classList.add('cloud-online');
  el.title=t || 'Conectado';
}
function abrirPagina(nome){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===nome));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===nome));const tit={dashboard:'Dashboard',ocorrencias:editando?'Editar ocorrência':'Ocorrências',colaboradores:'Efetivo',homemfrota:'Homem × Frota',escala:'Escala',ferias:'Férias',registros:'Registros',mensagem:'WhatsApp',configuracoes:'Configurações',usuarios:'Usuários'};const sub={dashboard:`Controle de ausências, férias e disponibilidade da ${config.turma||'Turma D'}.`,ocorrencias:'Cadastro e atualização de ocorrências.',colaboradores:'Cadastro e importação da lista de colaboradores.',homemfrota:'Cobertura automática das posições operacionais por área, função e equipamento.',escala:'Calendário automático do regime 3×3 das Turmas A, B, C e D.',ferias:'Planejamento anual, aprovação do RH e acompanhamento dos prazos.',registros:'Consulta e manutenção dos registros.',mensagem:'Geração de relatório para WhatsApp.',configuracoes:'Preferências e backup do aplicativo.',usuarios:'Cadastro de usuários e permissões individuais.'};$('pageTitle').textContent=tit[nome]||'XCMG Control';$('pageSubtitle').textContent=sub[nome]||'';window.scrollTo({top:0,behavior:'smooth'});setTimeout(atualizarStickyMobileDashboard,80)}
function contar(lista,tipo){return lista.filter(x=>x.tipo===tipo).length}
function diferencaDiasISO(inicio,fim){if(!inicio||!fim)return null;const a=new Date(`${inicio}T12:00:00`),b=new Date(`${fim}T12:00:00`);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return null;return Math.round((b-a)/86400000)}
function diasInclusivosISO(inicio,fim){const d=diferencaDiasISO(inicio,fim);return d===null||d<0?'':d+1}
function somarDiasInclusivosISO(inicio,dias){const qtd=Number.parseInt(dias,10);if(!inicio||!Number.isInteger(qtd)||qtd<1)return'';const d=new Date(`${inicio}T12:00:00`);if(Number.isNaN(d.getTime()))return'';d.setDate(d.getDate()+qtd-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function atualizarPeriodoPorDias(){const inicio=$('inicio')?.value||'',dias=$('dias')?.value||'';if(!inicio||!dias)return;const fim=somarDiasInclusivosISO(inicio,dias);if(fim)$('fim').value=fim}
function atualizarDiasPorPeriodo(){const inicio=$('inicio')?.value||'',fim=$('fim')?.value||'';if(!inicio||!fim){if($('dias'))$('dias').value='';return}const qtd=diasInclusivosISO(inicio,fim);if($('dias'))$('dias').value=qtd||''}
function ehRegistroFerias(r){const campos=[r?.tipo,r?.categoria,r?.motivo,r?.descricao].map(normalizarTexto);return campos.some(v=>v==='ferias'||v.includes('ferias programad'))}
function dataISOFlex(v){if(!v)return'';if(v instanceof Date&&!Number.isNaN(v.getTime())){const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,'0'),d=String(v.getDate()).padStart(2,'0');return `${y}-${m}-${d}`};const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=s.match(/^(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{2,4})$/);if(m){let a=m[3];if(a.length===2)a=`20${a}`;return `${a}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`};return''}
function normalizarProgramacaoFerias(r){if(!r)return null;const inicio=dataISOFlex(r.inicio||r.inicio_ferias||r.data_inicio),fim=dataISOFlex(r.fim||r.fim_ferias||r.data_fim),retorno=dataISOFlex(r.retorno||r.data_retorno);if(!inicio)return null;return{...r,tipo:'Férias',categoria:'Férias',motivo:r.motivo||'Férias',descricao:r.descricao||'Férias programadas',nome_completo:String(r.nome_completo||r.nome||'').trim().toUpperCase(),nome:String(r.nome_completo||r.nome||'').trim().toUpperCase(),inicio,fim,retorno,dias:Number(r.dias||diasInclusivosISO(inicio,fim)||30),status_aprovacao:r.status_aprovacao||'A PROGRAMAR',abono:r.abono||'NÃO',decimo_terceiro:r.decimo_terceiro||'NÃO',observacao:r.observacao||'',data_admissao:dataISOFlex(r.data_admissao)}}
function dadosEfetivoFerias(r){
  // v6.10.6 — normaliza a programação e recompõe dados do Efetivo sem depender da planilha.
  const item=normalizarProgramacaoFerias(r);if(!item)return null;
  const id=String(item.colaborador_id||'').trim(),mat=String(item.matricula||'').replace(/\D/g,''),nome=normalizarTexto(item.nome_completo||item.nome||'').replace(/\s+/g,' ').trim();
  const c=(Array.isArray(colaboradores)?colaboradores:[]).find(x=>{
    if(id&&String(x.id||'').trim()===id)return true;
    if(mat&&String(x.matricula||'').replace(/\D/g,'')===mat)return true;
    return nome&&normalizarTexto(x.nome_completo||x.nome_exibicao||x.nome||'').replace(/\s+/g,' ').trim()===nome;
  })||null;
  if(!c)return item;
  const nomeEfetivo=String(c.nome_completo||c.nome_exibicao||item.nome_completo||item.nome||'').trim().toUpperCase();
  return{...item,colaborador_id:item.colaborador_id||c.id||null,nome_completo:nomeEfetivo,nome:nomeEfetivo,matricula:String(c.matricula||item.matricula||'').trim(),funcao:String(c.funcao||item.funcao_colaborador||item.funcao||'').trim().toUpperCase(),funcao_colaborador:String(c.funcao||item.funcao_colaborador||item.funcao||'').trim().toUpperCase(),area:String(c.area||item.area||item.local||'').trim().toUpperCase(),local:String(c.area||item.area||item.local||'').trim().toUpperCase(),data_admissao:dataISOFlex(c.data_admissao||item.data_admissao)};
}
function chaveProgramacaoFerias(r){const mat=String(r?.matricula||'').trim(),nome=normalizarTexto(r?.nome_completo||r?.nome||'');return `${mat||nome}|${dataISOFlex(r?.inicio)}|${dataISOFlex(r?.fim)}`}
// v6.10.11 — chave canônica: depois de recompor os dados pelo Efetivo, a mesma pessoa/período
// sempre gera uma única chave, mesmo que um registro antigo tenha vindo sem matrícula ou colaborador_id.
function chaveProgramacaoFeriasCanonica(r){
  const item=dadosEfetivoFerias(r)||normalizarProgramacaoFerias(r);if(!item)return'';
  const id=String(item.colaborador_id||'').trim(),mat=String(item.matricula||'').replace(/\D/g,''),nome=normalizarTexto(item.nome_completo||item.nome||'').replace(/\s+/g,' ').trim();
  const pessoa=id?`id:${id}`:mat?`mat:${mat}`:`nome:${nome}`;
  return `${pessoa}|${dataISOFlex(item.inicio)}|${dataISOFlex(item.fim)}`;
}
function consolidarProgramacaoFeriasCanonica(lista){
  const map=new Map();
  for(const bruto of (Array.isArray(lista)?lista:[])){
    const item=dadosEfetivoFerias(bruto)||normalizarProgramacaoFerias(bruto);if(!item)continue;
    const chave=chaveProgramacaoFeriasCanonica(item);if(!chave)continue;
    const anterior=map.get(chave);
    if(!anterior){map.set(chave,item);continue}
    // Mantém um único registro por colaborador + período, preferindo o mais recente/completo.
    const ta=String(anterior.atualizado_em||anterior.updated_at||anterior.created_at||''),tb=String(item.atualizado_em||item.updated_at||item.created_at||'');
    const escolhido=tb>=ta?{...anterior,...item}:{...item,...anterior};
    map.set(chave,escolhido);
  }
  return [...map.values()];
}
function carregarProgramacaoFeriasLocal(){
  // v6.10.14 — a chave oficial é soberana. Bases legadas só entram em recuperação quando ela estiver vazia.
  const principal=lerLocal(FERIAS_KEY,[]);
  if(Array.isArray(principal)&&principal.length){
    programacaoFerias=consolidarProgramacaoFeriasCanonica(principal);
    gravarLocal(FERIAS_KEY,programacaoFerias);
    return programacaoFerias;
  }
  const recuperadas=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      if(k===FERIAS_KEY)continue;
      if(/ferias/i.test(k)&&/program/i.test(k)){
        let v=[];try{v=JSON.parse(localStorage.getItem(k)||'[]')}catch{}
        if(Array.isArray(v))recuperadas.push(...v);
      }
    }
  }catch(e){console.warn('Recuperação de férias legadas ignorada',e)}
  programacaoFerias=consolidarProgramacaoFeriasCanonica(recuperadas);
  if(programacaoFerias.length)gravarLocal(FERIAS_KEY,programacaoFerias);
  return programacaoFerias;
}
function salvarProgramacaoFerias(lista){programacaoFerias=consolidarProgramacaoFeriasCanonica([...carregarProgramacaoFeriasLocal(),...(Array.isArray(lista)?lista:[])]).sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio))||nomeCompletoRegistro(a).localeCompare(nomeCompletoRegistro(b),'pt-BR'));gravarLocal(FERIAS_KEY,programacaoFerias);return programacaoFerias}

function chaveNomeFerias(nome){return normalizarTexto(nome).replace(/\s+/g,' ').trim()}
function payloadProgramacaoFerias(r){const item=normalizarProgramacaoFerias(r);if(!item)return null;return{nome_chave:chaveNomeFerias(item.nome_completo||item.nome||''),nome_completo:String(item.nome_completo||item.nome||'').trim().toUpperCase(),matricula:String(item.matricula||'').trim(),funcao:String(item.funcao_colaborador||item.funcao||'').trim().toUpperCase(),area:String(item.area||item.local||'').trim().toUpperCase(),inicio:item.inicio,fim:item.fim||item.inicio,retorno:item.retorno||null,origem:item.origem||'planilha',atualizado_em:new Date().toISOString(),colaborador_id:item.colaborador_id||null,data_admissao:item.data_admissao||null,dias:Number(item.dias||30),abono:item.abono||'NÃO',decimo_terceiro:item.decimo_terceiro||'NÃO',status_aprovacao:item.status_aprovacao||'A PROGRAMAR',observacao:item.observacao||'',justificativa_conflito:item.justificativa_conflito||''}}
async function carregarProgramacaoFeriasNuvem(){
  // v6.10.14 — Supabase é a fonte oficial quando online. Cache/legados apenas recuperam chaves ausentes.
  const cache=(lerLocal(FERIAS_KEY,[])||[]).map(normalizarProgramacaoFerias).filter(Boolean);
  const legados=(Array.isArray(registros)?registros:[]).filter(ehRegistroFerias).map(r=>normalizarProgramacaoFerias({...r,origem:r.origem||'registro'})).filter(Boolean);
  if(!db||!estaOnline()){
    programacaoFerias=consolidarProgramacaoFeriasCanonica(cache.length?cache:legados);
    gravarLocal(FERIAS_KEY,programacaoFerias);
    return false;
  }
  try{
    const {data,error}=await db.from(FERIAS_TABLE).select('*').order('inicio',{ascending:true});
    if(error)throw error;
    const canceladas=(data||[]).filter(r=>normalizarTexto(r?.status_aprovacao)==='cancelado');
    if(canceladas.length){
      // v6.10.18: registro cancelado fica apenas como histórico/túmulo no banco.
      // O nome_chave é alterado para liberar a restrição única e permitir nova programação no mesmo período.
      for(const r of canceladas){
        if(r?.id&&!String(r.nome_chave||'').startsWith('cancelado-')){
          const {error:erroLiberacao}=await db.from(FERIAS_TABLE).update({nome_chave:chaveCancelamentoFerias(r),atualizado_em:new Date().toISOString()}).eq('id',r.id);
          if(erroLiberacao)console.warn('Não foi possível liberar uma programação cancelada antiga.',erroLiberacao);
        }
      }
    }
    const nuvem=(data||[]).filter(r=>normalizarTexto(r?.status_aprovacao)!=='cancelado').map(r=>normalizarProgramacaoFerias(dadosEfetivoFerias({...r,nome:r.nome_completo,funcao_colaborador:r.funcao||'',local:r.area||''}))).filter(Boolean);
    const mapa=new Map();
    const inserir=(r,forcar=false)=>{const item=dadosEfetivoFerias(r)||normalizarProgramacaoFerias(r);if(!item)return;const k=chaveProgramacaoFeriasCanonica(item);if(!k)return;if(forcar||!mapa.has(k))mapa.set(k,item)};
    // Legados < cache < nuvem. A nuvem sempre vence para a mesma pessoa/período.
    legados.filter(r=>normalizarTexto(r?.status_aprovacao)!=='cancelado').forEach(r=>inserir(r,false));
    cache.filter(r=>normalizarTexto(r?.status_aprovacao)!=='cancelado').forEach(r=>inserir(r,true));
    nuvem.forEach(r=>inserir(r,true));
    programacaoFerias=[...mapa.values()].sort((a,b)=>String(a.inicio||'').localeCompare(String(b.inicio||''))||nomeCompletoRegistro(a).localeCompare(nomeCompletoRegistro(b),'pt-BR'));
    const chavesNuvem=new Set(nuvem.map(chaveProgramacaoFeriasCanonica));
    const recuperarNuvem=programacaoFerias.filter(x=>!chavesNuvem.has(chaveProgramacaoFeriasCanonica(x))).map(payloadProgramacaoFerias).filter(x=>x&&x.nome_chave&&x.inicio&&x.fim);
    if(recuperarNuvem.length){
      const {error:erroRecuperacao}=await db.from(FERIAS_TABLE).upsert(recuperarNuvem,{onConflict:'nome_chave,inicio,fim'});
      if(erroRecuperacao)console.warn('Não foi possível restaurar toda a base de férias na nuvem; mantendo cópia local.',erroRecuperacao);
    }
    gravarLocal(FERIAS_KEY,programacaoFerias);
    feriasNuvemDisponivel=true;atualizarStatusFonteFerias();
    const ref=$('dataPainel')?.value||hoje();renderizarProximasFerias(ref);renderizarProgramacaoFerias();
    return true;
  }catch(e){
    feriasNuvemDisponivel=false;console.warn('Tabela de programação de férias indisponível; preservando cache.',e);
    programacaoFerias=consolidarProgramacaoFeriasCanonica(cache.length?cache:legados);gravarLocal(FERIAS_KEY,programacaoFerias);atualizarStatusFonteFerias(e);
    const ref=$('dataPainel')?.value||hoje();renderizarProximasFerias(ref);renderizarProgramacaoFerias();
    return false;
  }
}
function atualizarStatusFonteFerias(erro){const el=$('statusFonteFerias');if(!el)return;if(feriasNuvemDisponivel){el.textContent='Fonte: Supabase • programação sincronizada entre dispositivos';el.classList.remove('cloud-error')}else{el.textContent='Fonte local ativa. Para sincronizar entre dispositivos, execute supabase_migracao_v6.4.0_ferias.sql no Supabase.';el.classList.add('cloud-error');if(erro)el.title=erro.message||String(erro)}}
function projetoSupabaseAtual(){try{return new URL(SUPABASE_URL).hostname.split('.')[0]}catch{return SUPABASE_URL}}
async function salvarProgramacaoFeriasNuvem(lista){
  const bruto=(Array.isArray(lista)?lista:[]).map(payloadProgramacaoFerias).filter(x=>x&&x.nome_chave&&x.inicio&&x.fim);
  const unicos=new Map();for(const x of bruto)unicos.set(`${x.nome_chave}|${x.inicio}|${x.fim}`,x);
  const payload=[...unicos.values()];
  if(!payload.length)throw new Error('Nenhuma programação válida foi preparada para gravação.');
  if(!estaOnline()||!db)throw new Error('Sem conexão com o Supabase. A importação não foi concluída.');
  const projeto=projetoSupabaseAtual();
  try{
    const teste=await db.from(FERIAS_TABLE).select('id',{count:'exact',head:true});
    if(teste.error)throw new Error(`Tabela ${FERIAS_TABLE} indisponível no projeto ${projeto}: ${teste.error.message||teste.error.details||teste.error}`);
    let gravadas=0;
    const lote=100;
    for(let i=0;i<payload.length;i+=lote){
      const parte=payload.slice(i,i+lote);
      const {data,error}=await db.from(FERIAS_TABLE).upsert(parte,{onConflict:'nome_chave,inicio,fim'}).select('id,nome_chave,inicio,fim');
      if(error)throw new Error(`Falha ao gravar lote ${Math.floor(i/lote)+1}: ${error.message||error.details||error}`);
      gravadas+=(data||[]).length;
    }
    const {data:confirmacao,error:erroConfirmacao,count}=await db.from(FERIAS_TABLE).select('id,nome_chave,nome_completo,inicio,fim,retorno',{count:'exact'}).in('nome_chave',[...new Set(payload.map(x=>x.nome_chave))]);
    if(erroConfirmacao)throw new Error(`Gravação enviada, mas a conferência falhou: ${erroConfirmacao.message||erroConfirmacao}`);
    const chavesConfirmadas=new Set((confirmacao||[]).map(x=>`${x.nome_chave}|${dataISOFlex(x.inicio)}|${dataISOFlex(x.fim)}`));
    const faltantes=payload.filter(x=>!chavesConfirmadas.has(`${x.nome_chave}|${x.inicio}|${x.fim}`));
    if(faltantes.length)throw new Error(`${faltantes.length} programação(ões) não foram encontradas após a gravação no Supabase.`);
    feriasNuvemDisponivel=true;
    await carregarProgramacaoFeriasNuvem();
    return{gravadas:payload.length,nuvem:true,duplicadasRemovidas:bruto.length-payload.length,totalTabela:count??programacaoFerias.length,projeto};
  }catch(e){
    feriasNuvemDisponivel=false;console.error('IMPORTAÇÃO DE FÉRIAS — ERRO SUPABASE',e);atualizarStatusFonteFerias(e);throw e;
  }
}
function reconstruirProgramacaoFeriasDosRegistros(){if(programacaoFerias.length)return programacaoFerias;const ferias=registros.filter(r=>ehRegistroFerias(r)).map(r=>normalizarProgramacaoFerias({...r,retorno:r.retorno||''})).filter(Boolean);if(ferias.length)salvarProgramacaoFerias(ferias);else carregarProgramacaoFeriasLocal();return programacaoFerias}
function espelhoFeriasLocal(){return carregarProgramacaoFeriasLocal()}
function salvarEspelhoFerias(lista){return salvarProgramacaoFerias(lista)}
function proximasFerias(data){
  const ref=dataISOFlex(data);if(!ref)return[];
  if(!programacaoFerias.length)reconstruirProgramacaoFeriasDosRegistros();
  return programacoesFeriasEfetivoAtivo().map(r=>({...r,diasAte:diferencaDiasISO(ref,r.inicio),situacao:statusFeriasControle(r,ref)})).filter(r=>r.diasAte!==null&&r.diasAte>=1&&!['CANCELADO','NÃO APROVADO','REPROGRAMAR','REALIZADO'].includes(r.situacao)).sort((a,b)=>a.diasAte-b.diasAte||String(a.inicio).localeCompare(String(b.inicio))||nomeCompletoRegistro(a).localeCompare(nomeCompletoRegistro(b),'pt-BR'));
}
function statusProgramacaoFerias(r,ref){const hojeRef=dataISOFlex(ref)||hoje(),inicio=dataISOFlex(r.inicio),fim=dataISOFlex(r.fim),retorno=dataISOFlex(r.retorno);if(retorno&&hojeRef>=retorno)return'Concluída';if(inicio&&fim&&hojeRef>=inicio&&hojeRef<=fim)return'Em férias';if(inicio&&hojeRef<inicio)return'Programada';return'Concluída'}
function renderizarProgramacaoFeriasLegacyA(){const el=$('listaProgramacaoFerias'),total=$('totalProgramacaoFerias');if(!el)return;if(!programacaoFerias.length)reconstruirProgramacaoFeriasDosRegistros();const ref=$('dataPainel')?.value||hoje();const q=normalizarTexto($('pesquisaProgramacaoFerias')?.value||'');const filtro=$('filtroStatusFerias')?.value||'Todos';const base=[...programacaoFerias].sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio)));const lista=base.filter(r=>{const st=statusProgramacaoFerias(r,ref);const nome=normalizarTexto(nomeCompletoRegistro(r));const dados=normalizarTexto([r.matricula,r.funcao_colaborador||r.funcao].filter(Boolean).join(' '));return(!q||nome.includes(q)||dados.includes(q))&&(filtro==='Todos'||st===filtro)});if(total)total.textContent=`${base.length} programação(ões)`;if(!lista.length){el.innerHTML='<div class="vacation-program-empty">Nenhuma programação encontrada para este filtro.</div>';return}el.innerHTML=`<div class="vacation-program-table"><div class="vacation-program-head"><span>Colaborador</span><span>Início</span><span>Fim</span><span>Retorno</span><span>Status</span></div>${lista.map(r=>{const st=statusProgramacaoFerias(r,ref);return`<div class="vacation-program-row"><span><strong>${escapar(nomeCompletoRegistro(r))}</strong><small>${escapar([r.matricula,r.funcao_colaborador||r.funcao].filter(Boolean).join(' • '))}</small></span><span>${dataBR(r.inicio)||'—'}</span><span>${dataBR(r.fim)||'—'}</span><span>${dataBR(r.retorno)||'—'}</span><span><b class="vacation-program-status ${st.toLowerCase().replace(' ','-').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}">${st}</b></span></div>`}).join('')}</div>`}
function renderizarProximasFerias(data){const painel=$('painelProximasFerias'),lista=$('listaProximasFerias'),total=$('totalProximasFerias');if(!painel||!lista)return;const itens=proximasFerias(data);painel.hidden=false;if(total)total.textContent=itens.length;if(!itens.length){lista.innerHTML='<div class="vacation-alert-empty">Nenhuma férias futura programada.</div>';return}const visiveis=itens.slice(0,5);lista.innerHTML=visiveis.map(r=>{const d=r.diasAte;const faixa=d<=2?'urgent':d<=6?'attention':d<=10?'notice':'future';const texto=d===1?'Falta 1 dia':`Faltam ${d} dias`;return `<div class="vacation-alert-row ${faixa}"><div class="vacation-alert-person"><strong title="${escapar(nomeCompletoRegistro(r))}">${escapar(nomeCompletoRegistro(r))}</strong><small>${escapar(r.funcao_colaborador||r.funcao||'Função não informada')}</small></div><div class="vacation-alert-period"><span>${dataBR(r.inicio)}${r.fim?` → ${dataBR(r.fim)}`:''}</span><b>${texto}</b></div></div>`}).join('')+(itens.length>5?`<div class="vacation-alert-more">+${itens.length-5} férias futura(s) programada(s)</div>`:'')}
function statusEfetivo(c){return String(c?.status||'Ativo').trim()||'Ativo'}
function colaboradorAtivo(c){return normalizarTexto(statusEfetivo(c))==='ativo'}
function efetivoAtual(){
  const vistos=new Set();
  for(const c of colaboradores.filter(colaboradorAtivo)){
    const matricula=String(c?.matricula||'').trim();
    const nome=normalizarTexto(c?.nome_completo||c?.nome_exibicao||'');
    const chave=matricula?`m:${matricula}`:(nome?`n:${nome}`:'');
    if(chave)vistos.add(chave);
  }
  return vistos.size;
}
function sincronizarEfetivoVisual(){
  const total=efetivoAtual();
  config.efetivoTotal=total;
  const campo=$('efetivoTotal');
  if(campo)campo.value=total;
  return total;
}

function renderizarAniversariantes(data){
  const ref=dataISOFlex(data)||hoje(), lista=$('listaAniversariantes'), total=$('totalAniversariantes'), titulo=$('tituloAniversariantes');
  if(!lista)return;
  const [ano,mes,dia]=ref.split('-').map(Number);
  const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  if(titulo)titulo.textContent=`Aniversariantes de ${meses[mes-1]||'mês'}`;
  const itens=colaboradores.filter(colaboradorAtivo).map(c=>{
    const nasc=dataISOFlex(c.data_nascimento);if(!nasc)return null;
    const [,m,d]=nasc.split('-').map(Number);if(m!==mes)return null;
    return{...c,dia:d,hoje:d===dia};
  }).filter(Boolean).sort((a,b)=>a.dia-b.dia||String(a.nome_completo||a.nome_exibicao||'').localeCompare(String(b.nome_completo||b.nome_exibicao||''),'pt-BR'));
  if(total)total.textContent=itens.length;
  if(!itens.length){lista.innerHTML='<div class="birthday-empty">Nenhum aniversariante ativo neste mês.</div>';return;}
  const visiveis=itens.slice(0,8);
  lista.innerHTML=visiveis.map(c=>{
    const passado=c.dia<dia?' past':'';
    const nome=organizarNome(c.nome_completo||c.nome_exibicao||'Colaborador');
    return `<div class="birthday-row${c.hoje?' today':''}${passado}"><span class="birthday-day">${String(c.dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}</span><div class="birthday-person"><strong title="${escapar(nome)}">${escapar(nome)}</strong><small>${escapar([c.funcao,c.area].filter(Boolean).join(' • ')||'Dados não informados')}</small></div>${c.hoje?'<b class="birthday-today">🎉 HOJE</b>':''}</div>`;
  }).join('')+(itens.length>8?`<div class="birthday-more">+${itens.length-8} aniversariante(s) neste mês</div>`:'');
}
function atualizarDashboard(){const dataPainelAtual=$('dataPainel').value;renderizarAniversariantes(dataPainelAtual);const ativos=ativosNaData(dataPainelAtual);const efetivo=sincronizarEfetivoVisual();const ausentes=contarPessoasUnicas(ativos.filter(x=>x.tipo!=='Desligamento'));const disponiveis=Math.max(efetivo-ausentes,0);const disponibilidadePct=efetivo>0?Math.round((disponiveis/efetivo)*1000)/10:0;$('kpiEfetivo').textContent=efetivo;$('kpiDisponiveis').textContent=disponiveis;if($('kpiDisponibilidadePct'))$('kpiDisponibilidadePct').textContent=`${String(disponibilidadePct).replace('.',',')}%`;if($('kpiDisponibilidadeTexto'))$('kpiDisponibilidadeTexto').textContent=`${disponiveis} de ${efetivo} disponíveis`;if($('kpiDisponibilidadeBar'))$('kpiDisponibilidadeBar').style.width=`${Math.max(0,Math.min(disponibilidadePct,100))}%`;// v6.10.2 — Efetivo de férias calculado pela DATA, independente do texto do Status/RH.
const feriasAtivasOficiais=programacoesAtivasNaData(dataPainelAtual);
const feriasAtivasManuais=registrosManuais().filter(r=>normalizarTexto(r.tipo)==='ferias'&&dataPainelAtual>=(dataISOFlex(r.inicio)||'0000-01-01')&&dataPainelAtual<=(dataISOFlex(r.fim)||'9999-12-31'));
const efetivoFerias=contarPessoasUnicas(deduplicarRegistros([...feriasAtivasManuais,...feriasAtivasOficiais]));
$('kpiFerias').textContent=efetivoFerias;$('kpiAtestados').textContent=contarPessoasUnicas(ativos.filter(x=>x.tipo==='Atestado'||x.tipo==='Atestado Médico'));$('kpiDesligamentos').textContent=contarPessoasUnicas(ativos.filter(x=>x.tipo==='Desligamento'));$('kpiFaltas').textContent=contarPessoasUnicas(ativos.filter(x=>x.tipo==='Falta não justificada'||x.tipo==='Falta Não Justificada'));renderizarOcorrenciasPainel(ativos,dataPainelAtual);renderizarProximasFerias(dataPainelAtual);atualizarLocais(ativos);atualizarResumoCategorias(ativos);$('ultimaAtualizacao').textContent=dataHoraBR();$('teamBadge').textContent=config.turma||'Turma D';$('developerSidebar').textContent=(config.desenvolvedor||'Edson Alves').replace(' de Oliveira','')}
function nomeCompacto(nome){const n=String(nome||'Colaborador não informado').trim();if(n.length<=13)return n;const partes=n.split(/\s+/).filter(Boolean);if(partes.length===1)return n.slice(0,12)+'…';return `${partes[0]} ${partes[partes.length-1].charAt(0).toUpperCase()}.`}
let visualizacaoOcorrenciasDashboard='dia';
function selecionarVisualizacaoOcorrencias(modo){
  visualizacaoOcorrenciasDashboard=modo==='atuais'?'atuais':'dia';
  const data=$('dataPainel')?.value||hoje();
  const ativos=ativosNaData(data);
  renderizarOcorrenciasPainel(ativos,data);
}
window.selecionarVisualizacaoOcorrencias=selecionarVisualizacaoOcorrencias;
function dataCurtaDashboard(v){const br=dataBR(v);return br?`${br.slice(0,6)}${br.slice(-2)}`:'—'}
function ocorrenciasDoDia(data){const ref=dataISOFlex(data);if(!ref)return[];return ativosNaData(ref)}
function renderizarOcorrenciasPainel(ativos,data){
  // v6.5.56: o layout continua 100% igual nas duas abas, mas a fonte dos dados é independente.
  // 'Ocorrências do dia' respeita a data selecionada no Dashboard.
  // 'Ocorrências atuais' sempre considera o que está ativo HOJE, sem depender da data selecionada.
  const lista=visualizacaoOcorrenciasDashboard==='dia'
    ? ocorrenciasDoDia(data)
    : ativosNaData(hoje());
  renderizarOcorrenciasDia(lista);
  document.querySelectorAll('[data-occurrence-view]').forEach(b=>b.classList.toggle('active',b.dataset.occurrenceView===visualizacaoOcorrenciasDashboard));
  const sub=$('ocorrenciasPainelSubtitulo');
  if(sub){sub.textContent='';sub.style.display='none';}
  const total=$('totalOcorrenciasAtuais');
  if(total){const n=lista.length;total.textContent=visualizacaoOcorrenciasDashboard==='dia'?`${n} ocorrência${n===1?'':'s'} no dia selecionado.`:`${n} ocorrência${n===1?' atual':'s atuais'}.`}
}
function renderizarOcorrenciasDia(lista){
  const visiveis=lista.slice(0,20),el=$('ocorrenciasAtuais');if(!el)return;
  const dataCurta=v=>{const iso=dataISOFlex(v);if(!iso)return'—';const [a,m,d]=iso.split('-');return `${d}/${m}/${String(a).slice(-2)}`};
  el.innerHTML=visiveis.length?visiveis.map(r=>{const inicio=dataCurta(r.inicio);const fimRaw=r.fim||r.retorno||'';const final=(fimRaw&&String(fimRaw).startsWith('9999-'))?'Em aberto':(fimRaw?dataCurta(fimRaw):'Em aberto');const area=String(r.local||'').trim()||areaRegistroPainel(r);return `<div class="current-row occurrence-day-row ${classeTipo(r.tipo)}"><div class="person"><span class="type-icon${['Falta não justificada','Falta Não Justificada'].includes(r.tipo)?' occurrence-falta-alert':''}">${iconeTipo(r.tipo)}</span><div class="person-text"><strong title="${escapar(nomeCompletoRegistro(r))}">${escapar(nomeCompletoRegistro(r))}</strong><small title="${escapar(r.funcao||'Função não informada')}">${escapar(r.funcao||'Função não informada')}</small></div></div><div class="occurrence-day-bottom"><div class="row-meta occurrence-day-local"><b>${escapar(area)}</b></div><span class="occurrence-day-separator">•</span><div class="row-meta occurrence-day-period"><b><span class="occurrence-day-area-mobile">${escapar(area)} <span class="occurrence-day-area-dot">•</span> </span>${inicio} <span class="occ-date-arrow">→</span> ${final}</b></div></div><span class="tag occurrence-day-tag${['Falta não justificada','Falta Não Justificada'].includes(r.tipo)?' occurrence-day-falta-farol':''}">${escapar(r.tipo.toUpperCase())}</span></div>`}).join(''):'<div class="empty">Nenhuma ocorrência ativa nesta data.</div>';
}
function renderizarAtuais(lista){const visiveis=lista.slice(0,20);$('ocorrenciasAtuais').innerHTML=visiveis.length?visiveis.map(r=>{const falta=['Falta não justificada','Falta Não Justificada'].includes(r.tipo);return `<div class="current-row ${classeTipo(r.tipo)}${falta?' occurrence-falta-row':''}"><div class="person"><span class="type-icon${falta?' occurrence-falta-alert':''}">${iconeTipo(r.tipo)}</span><div class="person-text"><strong title="${escapar(nomeCompletoRegistro(r))}">${escapar(nomeCompletoRegistro(r))}</strong><small title="${escapar(r.funcao||'Equipamento não informado')}">${escapar(r.funcao||'Equipamento não informado')}</small></div></div><div class="row-meta"><span>▣</span><b>${(r.fim&&String(r.fim).startsWith('9999-'))?`Desde ${dataBR(r.inicio)}`:(periodo(r.inicio,r.fim)||'Período não informado')}</b></div><div class="row-meta"><span>●</span><b>${escapar(areaRegistroPainel(r))}</b></div><span class="tag${falta?' occurrence-day-falta-farol':''}">${escapar(r.tipo.toUpperCase())}</span></div>`}).join(''):'<div class="empty">Nenhuma ocorrência ativa nesta data.</div>'}
function atualizarLocais(ativos){const locais=[['Mina','▲'],['Usina','▥'],['Base Externa','▦'],['Não informado','?']];$('resumoLocais').innerHTML=locais.map(([l,i])=>`<div class="location-row"><span>${i}</span><span>${l}</span><strong>${ativos.filter(x=>l==='Não informado'?!x.local:x.local===l).length}</strong></div>`).join('')}
function normalizarTexto(t){return String(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function organizarNome(nome){const limpo=String(nome||'').replace(/\s+/g,' ').trim();if(!limpo)return'';const minusculas=new Set(['da','das','de','do','dos','e']);return limpo.toLowerCase().split(' ').map((p,i,a)=>minusculas.has(p)&&i>0&&i<a.length-1?p:p.charAt(0).toUpperCase()+p.slice(1)).join(' ')}
function nomeExibicao(nome){const partes=organizarNome(nome).split(/\s+/).filter(Boolean);return partes.length<=2?partes.join(' '):`${partes[0]} ${partes[partes.length-1]}`}
function preencherSelectColaboradores(){
  const select=$('nome');if(!select)return;
  const atual=select.value;
  select.innerHTML='<option value="">Selecione o colaborador</option>'+colaboradores.filter(colaboradorAtivo).map(c=>{const completo=organizarNome(c.nome_completo||c.nome_exibicao||'');return `<option value="${escapar(completo)}" data-id="${c.id}" title="${escapar(completo)}">${escapar(completo)}</option>`}).join('');
  if(atual&&!Array.from(select.options).some(o=>o.value===atual)){const c=colaboradores.find(x=>x.nome_exibicao===atual||x.nome_completo===atual);if(c){select.value=organizarNome(c.nome_completo||c.nome_exibicao||atual);return}const op=document.createElement('option');op.value=atual;op.textContent=atual;select.appendChild(op)}
  select.value=atual;
}
function colaboradorSelecionado(){const nome=$('nome')?.value||'';const opt=$('nome')?.selectedOptions?.[0],id=opt?.dataset?.id;return colaboradores.find(c=>String(c.id)===String(id))||colaboradores.find(c=>c.nome_completo===nome||c.nome_exibicao===nome)||null}
function nomeCompletoRegistro(r){if(r?.nome_completo)return organizarNome(r.nome_completo);const c=colaboradores.find(x=>(r?.matricula&&x.matricula===r.matricula)||x.nome_completo===r?.nome||x.nome_exibicao===r?.nome);return organizarNome(c?.nome_completo||r?.nome||'Colaborador não informado')}
function areaRegistroPainel(r){const direta=String(r?.area||'').trim();if(direta)return direta;const mat=String(r?.matricula||'').trim();const nome=normalizarTexto(r?.nome_completo||r?.nome||'');const c=colaboradores.find(x=>(mat&&String(x?.matricula||'').trim()===mat)||(nome&&normalizarTexto(x?.nome_completo||x?.nome_exibicao||'')===nome));const areaColab=String(c?.area||'').trim();if(areaColab)return areaColab;return String(r?.local||'').trim()||'Não informado'}
function preencherDadosColaborador(){const c=colaboradorSelecionado();$('matricula').value=c?.matricula||'';$('funcaoColaborador').value=c?.funcao||'';$('area').value=c?.area||'';if(c?.area&&['Mina','Usina','Base Externa'].includes(c.area))$('local').value=c.area}
function cpfExibicao(cpf){return String(cpf||'').trim()||'—'}
function classeStatusEfetivo(s){const n=normalizarTexto(s).replace(/\s+/g,'-').replace('/','-');return `effective-status-${n||'ativo'}`}
function atualizarFiltrosEfetivo(){const atualizar=(id,valores,rotulo)=>{const el=$(id);if(!el)return;const atual=el.value;el.innerHTML=`<option value="">${rotulo}</option>`+[...new Set(valores.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>`<option>${escapar(v)}</option>`).join('');el.value=atual};atualizar('filtroEfetivoArea',colaboradores.map(c=>c.area),'Todas as áreas');atualizar('filtroEfetivoTurma',colaboradores.map(c=>c.turma),'Todas as turmas')}
function listaEfetivoFiltrada(){const q=normalizarTexto($('pesquisaColaborador')?.value||''),area=$('filtroEfetivoArea')?.value||'',turma=$('filtroEfetivoTurma')?.value||'',status=$('filtroEfetivoStatus')?.value||'';return colaboradores.filter(c=>(!q||normalizarTexto(`${c.area} ${c.matricula} ${c.nome_completo} ${c.funcao} ${c.cpf} ${c.turma} ${statusEfetivo(c)}`).includes(q))&&(!area||c.area===area)&&(!turma||c.turma===turma)&&(!status||statusEfetivo(c)===status)).sort((a,b)=>String(a.nome_completo).localeCompare(String(b.nome_completo),'pt-BR'))}
function renderizarColaboradores(){
  const box=$('listaColaboradores');if(!box)return;atualizarFiltrosEfetivo();const lista=listaEfetivoFiltrada();
  $('totalColaboradores').textContent=`${colaboradores.length} cadastrados`;if($('totalEfetivoAtivo'))$('totalEfetivoAtivo').textContent=`${efetivoAtual()} ativos`;
  if(!lista.length){box.innerHTML='<div class="empty">Nenhum colaborador encontrado.</div>';return}
  box.innerHTML=`<table class="effective-table effective-table-manager"><thead><tr><th>Área</th><th>Matrícula</th><th>Nome completo</th><th>Função</th><th>Data Admis</th><th>Data Nasc</th><th>CPF</th><th>Turma</th><th>Status</th><th>Ações</th></tr></thead><tbody>${lista.map(c=>`<tr><td>${escapar(c.area||'—')}</td><td>${escapar(c.matricula||'—')}</td><td class="effective-name" title="${escapar(c.nome_completo||c.nome_exibicao)}">${escapar(c.nome_completo||c.nome_exibicao)}</td><td class="effective-function" title="${escapar(c.funcao||'—')}">${escapar(c.funcao||'—')}</td><td>${dataBR(c.data_admissao)||'—'}</td><td>${dataBR(c.data_nascimento)||'—'}</td><td>${escapar(cpfExibicao(c.cpf))}</td><td>${escapar(c.turma||'—')}</td><td><span class="effective-status ${classeStatusEfetivo(statusEfetivo(c))}">${escapar(statusEfetivo(c))}</span></td><td class="effective-actions-cell"><details class="effective-action-menu"><summary>Ações <span aria-hidden="true">▾</span></summary><div class="effective-action-dropdown"><button class="secondary small-button" type="button" data-edit-colaborador="${c.id}">Editar</button><button class="secondary small-button" type="button" data-history-colaborador="${c.id}">Histórico</button></div></details></td></tr>`).join('')}</tbody></table>`
}

// v6.10.20 — preserva no Efetivo de férias quem possui programação, mesmo fora da Relação do efetivo atual.
function chavePessoaEfetivoFerias(r){
  const mat=String(r?.matricula||'').replace(/\D/g,'');
  const nome=normalizarTexto(r?.nome_completo||r?.nome||r?.nome_exibicao||'').replace(/\s+/g,' ').trim();
  return mat?`m:${mat}`:(nome?`n:${nome}`:'');
}
function efetivoFeriasForaDaRelacao(){
  const chavesEfetivo=new Set((Array.isArray(colaboradores)?colaboradores:[]).map(chavePessoaEfetivoFerias).filter(Boolean));
  const mapa=new Map();
  for(const bruto of consolidarProgramacaoFeriasCanonica(programacaoFerias)){
    const r=dadosEfetivoFerias(bruto)||normalizarProgramacaoFerias(bruto);if(!r)continue;
    const status=statusFeriasControle(r,$('dataPainel')?.value||hoje());
    if(['CANCELADO','NÃO APROVADO','REPROGRAMAR'].includes(status))continue;
    const chave=chavePessoaEfetivoFerias(r);if(!chave||chavesEfetivo.has(chave))continue;
    const atual=mapa.get(chave);
    if(!atual||String(r.inicio||'')>String(atual.inicio||''))mapa.set(chave,r);
  }
  return [...mapa.values()].sort((a,b)=>nomeCompletoRegistro(a).localeCompare(nomeCompletoRegistro(b),'pt-BR'));
}
function renderizarEfetivoFeriasFora(){
  const box=$('listaEfetivoFeriasFora'),total=$('totalEfetivoFeriasFora');if(!box)return;
  const lista=efetivoFeriasForaDaRelacao();if(total)total.textContent=`${lista.length} colaborador(es)`;
  if(!lista.length){box.innerHTML='<div class="empty">Nenhum colaborador de férias está fora da Relação do efetivo.</div>';return}
  const ref=$('dataPainel')?.value||hoje();
  box.innerHTML=`<table class="effective-table"><thead><tr><th>Área</th><th>Matrícula</th><th>Nome completo</th><th>Função</th><th>Data Admis.</th><th>Status férias</th><th>Início</th><th>Fim</th><th>Retorno</th><th>Origem</th></tr></thead><tbody>${lista.map(r=>{const st=statusFeriasControle(r,ref);return `<tr><td>${escapar(r.area||r.local||'—')}</td><td>${escapar(r.matricula||'—')}</td><td class="effective-name">${escapar(String(r.nome_completo||r.nome||'—').toUpperCase())}</td><td>${escapar(r.funcao_colaborador||r.funcao||'—')}</td><td>${dataBR(r.data_admissao)||'—'}</td><td><span class="effective-status">${escapar(st)}</span></td><td>${dataBR(r.inicio)||'—'}</td><td>${dataBR(r.fim)||'—'}</td><td>${dataBR(r.retorno)||'—'}</td><td><span class="vacation-outside-badge">Fora do efetivo ativo</span></td></tr>`}).join('')}</tbody></table>`;
}

function recuperarColaboradoresLocais(){
  const mapa=new Map();
  const adicionar=c=>{if(!c)return;const matricula=String(c.matricula||'').trim(),nome=String(c.nome_completo||c.nome_exibicao||c.nome||'').trim();if(!matricula&&!nome)return;const chave=matricula||normalizarTexto(nome);const atual=mapa.get(chave)||{};mapa.set(chave,{...atual,...c,matricula:matricula||atual.matricula||'',nome_completo:String(c.nome_completo||atual.nome_completo||nome).trim().toUpperCase(),nome_exibicao:String(c.nome_exibicao||atual.nome_exibicao||nome).trim(),funcao:c.funcao||c.funcao_colaborador||atual.funcao||'',area:c.area||c.local||atual.area||'',data_admissao:dataISOFlex(c.data_admissao||atual.data_admissao),status:c.status||atual.status||'Ativo'});};
  const principal=lerLocal(COL_KEY,[]);if(Array.isArray(principal))principal.forEach(adicionar);
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(k===COL_KEY)continue;let v;try{v=JSON.parse(localStorage.getItem(k)||'null')}catch{continue}if(Array.isArray(v)&&v.some(x=>x&&typeof x==='object'&&(x.matricula||x.nome_completo||x.nome_exibicao))){v.forEach(adicionar)}}}catch(e){console.warn('Busca de efetivo legado ignorada',e)}
  (Array.isArray(registros)?registros:[]).forEach(r=>adicionar({matricula:r.matricula,nome_completo:r.nome_completo||r.nome,funcao:r.funcao_colaborador,area:r.area,data_admissao:r.data_admissao,status:'Ativo'}));
  return [...mapa.values()];
}
async function carregarColaboradores(){const cache=recuperarColaboradoresLocais();if(!estaOnline()){colaboradores=cache;preencherSelectColaboradores();renderizarColaboradores();atualizarDashboard();return}const {data,error}=await db.from('xcmg_colaboradores').select('*').order('nome_exibicao',{ascending:true});if(error)throw error;const nuvem=Array.isArray(data)?data:[];colaboradores=nuvem.length?nuvem:cache;if(colaboradores.length)gravarLocal(COL_KEY,colaboradores);preencherSelectColaboradores();renderizarColaboradores();atualizarDashboard()}
function limparFormEfetivo(){editandoEfetivoId=null;['novoColaboradorMatricula','novoColaboradorNome','novoColaboradorFuncao','novoColaboradorArea','novoColaboradorAdmissao','novoColaboradorNascimento','novoColaboradorCpf','novoColaboradorTurma','novoColaboradorMotivo'].forEach(id=>{if($(id))$(id).value=''});$('novoColaboradorStatus').value='Ativo';$('tituloFormEfetivo').textContent='Cadastrar colaborador';$('btnAdicionarColaborador').textContent='Salvar colaborador';$('btnCancelarEdicaoEfetivo').classList.add('hidden');$('effectiveCadastroBox')?.classList.remove('effective-edit-drawer');document.body.classList.remove('effective-drawer-open')}
function dadosFormEfetivo(){const nomeCompleto=String($('novoColaboradorNome').value||'').replace(/\s+/g,' ').trim().toUpperCase();return{matricula:$('novoColaboradorMatricula').value.trim(),nome_completo:nomeCompleto,nome_exibicao:nomeExibicao(nomeCompleto),funcao:$('novoColaboradorFuncao').value.trim().toUpperCase(),area:$('novoColaboradorArea').value.trim().toUpperCase(),data_admissao:$('novoColaboradorAdmissao').value||null,data_nascimento:$('novoColaboradorNascimento').value||null,cpf:$('novoColaboradorCpf').value.trim(),turma:$('novoColaboradorTurma').value.trim().toUpperCase(),status:$('novoColaboradorStatus').value||'Ativo'} }
function painelEfetivo(tipo, abrir=true){
  const cadastro=$('effectiveCadastroBox'),importacao=$('effectiveImportBox');
  if(!cadastro||!importacao)return;
  if(tipo==='cadastro'){
    cadastro.classList.toggle('hidden',!abrir);
    if(!abrir){cadastro.classList.remove('effective-edit-drawer');document.body.classList.remove('effective-drawer-open')}
    if(abrir)importacao.classList.add('hidden');
  }else if(tipo==='importacao'){
    importacao.classList.toggle('hidden',!abrir);
    if(abrir)cadastro.classList.add('hidden');
  }
}
function alternarPainelEfetivo(tipo){
  if(tipo==='importacao'&&!exigirPermissao('colaboradores_importar')){
    painelEfetivo('importacao',false);
    return;
  }
  if(tipo==='cadastro'&&!exigirPermissao('colaboradores_cadastrar')){
    painelEfetivo('cadastro',false);
    return;
  }
  const alvo=tipo==='cadastro'?$('effectiveCadastroBox'):$('effectiveImportBox');
  if(!alvo)return;
  painelEfetivo(tipo,alvo.classList.contains('hidden'));
}
function editarColaboradorEfetivo(id){const c=colaboradores.find(x=>String(x.id)===String(id));if(!c)return;const scrollAtual=window.scrollY;painelEfetivo('cadastro',true);const box=$('effectiveCadastroBox');box?.classList.add('effective-edit-drawer');document.body.classList.add('effective-drawer-open');editandoEfetivoId=c.id;$('novoColaboradorMatricula').value=c.matricula||'';$('novoColaboradorNome').value=c.nome_completo||'';$('novoColaboradorFuncao').value=c.funcao||'';$('novoColaboradorArea').value=c.area||'';$('novoColaboradorAdmissao').value=c.data_admissao||'';$('novoColaboradorNascimento').value=c.data_nascimento||'';$('novoColaboradorCpf').value=c.cpf||'';$('novoColaboradorTurma').value=c.turma||'';$('novoColaboradorStatus').value=statusEfetivo(c);$('novoColaboradorMotivo').value='';$('tituloFormEfetivo').textContent='Editar colaborador';$('btnAdicionarColaborador').textContent='Salvar alterações';$('btnCancelarEdicaoEfetivo').classList.remove('hidden');requestAnimationFrame(()=>window.scrollTo({top:scrollAtual,behavior:'auto'}))}
async function registrarHistoricoEfetivo(colaboradorId,anterior,novo,motivo){const alteracoes=[];const labels={matricula:'Matrícula',nome_completo:'Nome',funcao:'Função',area:'Área',data_admissao:'Data de admissão',data_nascimento:'Data de nascimento',cpf:'CPF',turma:'Turma',status:'Status'};for(const [campo,label] of Object.entries(labels)){if(String(anterior?.[campo]??'')!==String(novo?.[campo]??''))alteracoes.push({colaborador_id:colaboradorId,tipo:campo==='status'?'Alteração de status':'Atualização cadastral',campo,valor_anterior:String(anterior?.[campo]??''),valor_novo:String(novo?.[campo]??''),motivo:motivo||'',descricao:`${label}: ${anterior?.[campo]||'—'} → ${novo?.[campo]||'—'}`})}if(alteracoes.length&&estaOnline()){const {error}=await db.from('xcmg_efetivo_historico').insert(alteracoes);if(error)console.warn('Não foi possível gravar o histórico do efetivo.',error)}}
async function adicionarColaborador(){const permissao=editandoColaboradorId?'colaboradores_editar':'colaboradores_cadastrar';if(!exigirPermissao(permissao))return;
  const nomeCompleto=organizarNome($('novoColaboradorNome').value);
  if(!nomeCompleto){alert('Informe o nome completo do colaborador.');$('novoColaboradorNome').focus();return}
  const dados=dadosFormEfetivo(),anterior=editandoEfetivoId?colaboradores.find(c=>String(c.id)===String(editandoEfetivoId)):null,motivo=$('novoColaboradorMotivo').value.trim();
  if(anterior&&statusEfetivo(anterior)!==dados.status&&!motivo){alert('Informe o motivo da alteração de status.');$('novoColaboradorMotivo').focus();return}
  if(dados.matricula&&colaboradores.some(c=>String(c.id)!==String(editandoEfetivoId)&&String(c.matricula||'').trim()===dados.matricula)){alert('Já existe um colaborador com esta matrícula.');return}
  if(!estaOnline()){if(anterior){alert('Para preservar o histórico, a edição do efetivo precisa ser feita com conexão.');return}const local={...dados,id:`local-col-${Date.now()}`};colaboradores.push(local);adicionarFilaOffline({entidade:'colaborador',operacao:'insert',dados:{...dados,id_local:local.id}});gravarLocal(COL_KEY,colaboradores);preencherSelectColaboradores();renderizarColaboradores();limparFormEfetivo();$('statusColaborador').textContent='Cadastro salvo offline. Será sincronizado quando a internet voltar.';return}
  const resposta=anterior?await db.from('xcmg_colaboradores').update(dados).eq('id',anterior.id):await db.from('xcmg_colaboradores').insert(dados).select('id').single(),error=resposta.error;
  if(error){alert(error.code==='23505'?'Este colaborador já está cadastrado.':'Não foi possível cadastrar o colaborador.');return}
  const idSalvo=anterior?.id||resposta.data?.id;if(anterior)await registrarHistoricoEfetivo(idSalvo,anterior,dados,motivo);else await db.from('xcmg_efetivo_historico').insert({colaborador_id:idSalvo,tipo:'Cadastro',campo:'cadastro',valor_novo:'Cadastrado',motivo:motivo||'',descricao:'Colaborador cadastrado no efetivo'});
  limparFormEfetivo();$('statusColaborador').textContent=anterior?'Colaborador atualizado e histórico registrado.':'Colaborador cadastrado e sincronizado.';await carregarColaboradores();setTimeout(()=>$('statusColaborador').textContent='',3500)
}
function extrairNomesPlanilha(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{try{
  if(!window.XLSX)throw new Error('Biblioteca de planilha não carregada. Verifique a conexão com a internet.');
  const wb=XLSX.read(fr.result,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],linhas=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});
  if(!linhas.length)throw new Error('A planilha está vazia.');
  const aliases={matricula:['matricula','matrícula','registro'],nome:['nome','nome completo','colaborador','funcionario','funcionário'],funcao:['funcao','função','cargo'],area:['area','área','local'],admissao:['data admis','data admissão','data admissao','admissão','admissao'],nascimento:['data nasc','data nascimento','nascimento'],cpf:['cpf'],turma:['turma'],status:['status','situação','situacao']};
  let linhaCab=-1,map={};
  for(let i=0;i<Math.min(linhas.length,15);i++){const row=linhas[i]||[];const found={};row.forEach((v,j)=>{const n=normalizarTexto(v);Object.entries(aliases).forEach(([k,arr])=>{if(arr.map(normalizarTexto).includes(n))found[k]=j});if(n.includes('admis'))found.admissao=j;if(n.includes('nasc'))found.nascimento=j;if(n==='nome completo'||n==='nome do colaborador')found.nome=j});if(found.nome!==undefined){linhaCab=i;map=found;break}}
  if(linhaCab<0){linhaCab=-1;map={nome:0}}
  const inicio=linhaCab+1,vistos=new Set(),lista=[];
  for(let i=inicio;i<linhas.length;i++){
    const row=linhas[i]||[],completo=String(row[map.nome]||'').replace(/\s+/g,' ').trim().toUpperCase();if(!completo)continue;
    const chave=normalizarTexto(completo);if(vistos.has(chave))continue;vistos.add(chave);
    const statusBruto=map.status!==undefined?String(row[map.status]??'').trim():'Ativo';const statusMapa={ativo:'Ativo',inss:'INSS/Afastado',afastado:'INSS/Afastado','inss-afastado':'INSS/Afastado',mudanca:'Mudança de turma','mudanca de turma':'Mudança de turma',deslig:'Desligado',desligado:'Desligado',inativo:'Inativo'};const status=statusMapa[normalizarTexto(statusBruto)]||statusBruto||'Ativo';
    lista.push({matricula:map.matricula!==undefined?String(row[map.matricula]??'').trim():'',nome_completo:completo,nome_exibicao:nomeExibicao(completo),funcao:map.funcao!==undefined?String(row[map.funcao]??'').trim().toUpperCase():'',area:map.area!==undefined?String(row[map.area]??'').trim().toUpperCase():'',data_admissao:map.admissao!==undefined?dataPlanilhaISO(row[map.admissao]):null,data_nascimento:map.nascimento!==undefined?dataPlanilhaISO(row[map.nascimento]):null,cpf:map.cpf!==undefined?String(row[map.cpf]??'').trim():'',turma:map.turma!==undefined?String(row[map.turma]??'').trim().toUpperCase():'',status});
  }
  lista.sort((a,b)=>a.nome_exibicao.localeCompare(b.nome_exibicao,'pt-BR'));if(!lista.length)throw new Error('Nenhum nome válido foi encontrado na planilha.');resolve(lista)
}catch(e){reject(e)}};fr.onerror=()=>reject(new Error('Não foi possível ler a planilha.'));fr.readAsArrayBuffer(file)})}
async function importarColaboradores(){if(!exigirPermissao('colaboradores_importar'))return;const input=$('planilhaColaboradores'),file=input.files[0];if(!file){alert('Selecione uma planilha.');return}const btn=$('btnImportarColaboradores'),status=$('statusImportacao');try{const nomes=await extrairNomesPlanilha(file),semMatricula=nomes.filter(x=>!x.matricula).length;if(semMatricula)throw new Error(`${semMatricula} linha(s) estão sem matrícula. A matrícula é obrigatória para uma importação segura.`);if(!confirm(`Foram encontrados ${nomes.length} colaboradores. Os existentes serão atualizados pela matrícula e os novos serão incluídos. Nenhum cadastro será apagado. Continuar?`))return;importandoColaboradores=true;btn.disabled=true;status.textContent=`Importando ${nomes.length} colaborador(es) sem apagar o histórico...`;const chamada=db.rpc('xcmg_importar_efetivo',{lista:nomes});const limite=new Promise((_,reject)=>setTimeout(()=>reject(new Error('A importação ultrapassou 60 segundos. Verifique a conexão e tente novamente.')),60000));const {data,error}=await Promise.race([chamada,limite]);if(error)throw error;await carregarColaboradores();atualizarTudo();input.value='';status.textContent=`Importação concluída: ${data??nomes.length} linha(s) processadas. Efetivo ativo: ${efetivoAtual()}.`;setTimeout(()=>{if(status.textContent.startsWith('Importação concluída'))status.textContent=''},7000)}catch(e){console.error('Falha ao importar efetivo:',e);status.textContent='Falha na importação. Nenhum cadastro existente foi apagado.';alert(`Não foi possível importar a planilha.

${e.message||e.details||'Erro desconhecido.'}`)}finally{importandoColaboradores=false;btn.disabled=false}}

function linhasExportacaoEfetivo(){return listaEfetivoFiltrada().map(c=>({Área:String(c.area||'').toUpperCase(),Matrícula:c.matricula||'','Nome completo':String(c.nome_completo||'').toUpperCase(),Função:String(c.funcao||'').toUpperCase(),'Data Admis':dataBR(c.data_admissao),'Data Nasc':dataBR(c.data_nascimento),CPF:c.cpf||'',Turma:String(c.turma||'').toUpperCase(),Status:statusEfetivo(c)}))}
function exportarEfetivoExcel(){if(!exigirPermissao('colaboradores_exportar'))return;if(!window.XLSX){alert('A biblioteca de planilha não foi carregada.');return}const dados=linhasExportacaoEfetivo();if(!dados.length){alert('Não há colaboradores neste filtro.');return}const ws=XLSX.utils.json_to_sheet(dados);ws['!cols']=[{wch:12},{wch:12},{wch:34},{wch:34},{wch:13},{wch:13},{wch:16},{wch:9},{wch:20}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'EFETIVO');XLSX.writeFile(wb,`XCMG_Efetivo_${hoje()}.xlsx`)}
async function copiarTabelaEfetivo(){if(!exigirPermissao('colaboradores_exportar'))return;const dados=linhasExportacaoEfetivo();if(!dados.length){alert('Não há colaboradores neste filtro.');return}const cab=Object.keys(dados[0]),texto=[cab.join('\t'),...dados.map(r=>cab.map(k=>r[k]).join('\t'))].join('\n');try{await navigator.clipboard.writeText(texto)}catch{const ta=document.createElement('textarea');ta.value=texto;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}$('statusAcoesEfetivo').textContent=`${dados.length} linha(s) copiadas. Pronto para colar no e-mail ou em uma planilha.`;setTimeout(()=>$('statusAcoesEfetivo').textContent='',4000)}
async function abrirHistoricoEfetivo(id){const c=colaboradores.find(x=>String(x.id)===String(id));if(!c)return;$('subtituloHistoricoEfetivo').textContent=`${c.nome_completo} • Matrícula ${c.matricula||'não informada'}`;$('listaHistoricoEfetivo').innerHTML='<div class="empty">Carregando histórico...</div>';$('modalHistoricoEfetivo').classList.remove('hidden');if(!estaOnline()){$('listaHistoricoEfetivo').innerHTML='<div class="empty">O histórico detalhado requer conexão.</div>';return}const {data,error}=await db.from('xcmg_efetivo_historico').select('*').eq('colaborador_id',id).order('created_at',{ascending:false});if(error){$('listaHistoricoEfetivo').innerHTML='<div class="empty">Execute a migração do módulo Efetivo para visualizar o histórico.</div>';return}$('listaHistoricoEfetivo').innerHTML=data?.length?data.map(h=>`<div class="effective-history-row"><div><strong>${escapar(h.tipo)}</strong><span>${escapar(h.descricao||`${h.valor_anterior||'—'} → ${h.valor_novo||'—'}`)}</span>${h.motivo?`<small>Motivo: ${escapar(h.motivo)}</small>`:''}</div><time>${new Date(h.created_at).toLocaleString('pt-BR')}</time></div>`).join(''):'<div class="empty">Nenhuma movimentação registrada.</div>'}

function dataPlanilhaISO(valor){
  if(valor===null||valor===undefined||valor==='')return'';
  if(valor instanceof Date&&!Number.isNaN(valor.getTime()))return `${valor.getFullYear()}-${String(valor.getMonth()+1).padStart(2,'0')}-${String(valor.getDate()).padStart(2,'0')}`;
  if(typeof valor==='number'&&window.XLSX?.SSF?.parse_date_code){const d=XLSX.SSF.parse_date_code(valor);if(d?.y)return `${String(d.y).padStart(4,'0')}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
  const s=String(valor).trim();
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);if(m){let a=m[3];if(a.length===2)a=`20${a}`;return `${a}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
  const dt=new Date(s);if(!Number.isNaN(dt.getTime()))return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  return'';
}
function extrairFeriasPlanilha(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{try{
  if(!window.XLSX)throw new Error('Biblioteca de planilha não carregada. Verifique a conexão com a internet.');
  const wb=XLSX.read(fr.result,{type:'array',cellDates:true});
  const aliases={nome:['colaborador','nome','nome completo','funcionario','funcionário'],inicio:['inicio ferias','início férias','inicio férias','início ferias','inicio','data inicio','data início'],fim:['fim','fim ferias','fim férias','data fim'],retorno:['retorno','data retorno'],dias:['dias','quantidade de dias'],abono:['abono'],decimo:['1ª parc 13º','1a parc 13o','13º','decimo terceiro','décimo terceiro'],antecipada:['prog. antecipada','prog antecipada','programação antecipada','programacao antecipada'],status_planilha:['status'],situacao_planilha:['situação','situacao'],matricula:['matricula','matrícula'],area:['area','área'],funcao:['funcao','função']};
  let escolhido=null;
  for(const nomeAba of wb.SheetNames){
    const ws=wb.Sheets[nomeAba],linhas=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});
    if(!linhas.length)continue;
    let linhaCab=-1,map={};
    for(let i=0;i<Math.min(linhas.length,20);i++){
      const row=linhas[i]||[],found={};
      row.forEach((v,j)=>{const n=normalizarTexto(v);Object.entries(aliases).forEach(([k,arr])=>{if(arr.map(normalizarTexto).includes(n))found[k]=j})});
      if(found.nome!==undefined&&found.inicio!==undefined&&found.fim!==undefined){linhaCab=i;map=found;break}
    }
    if(linhaCab>=0){escolhido={nomeAba,linhas,linhaCab,map};break}
  }
  if(!escolhido)throw new Error('Não encontrei em nenhuma aba as colunas Colaborador, Início Férias e Fim.');
  const {nomeAba,linhas,linhaCab,map}=escolhido,lista=[];
  for(let i=linhaCab+1;i<linhas.length;i++){
    const row=linhas[i]||[],nome=organizarNome(row[map.nome]);if(!nome)continue;
    const inicio=dataPlanilhaISO(row[map.inicio]),fim=dataPlanilhaISO(row[map.fim]),retorno=map.retorno!==undefined?dataPlanilhaISO(row[map.retorno]):'';
    if(!inicio||!fim){lista.push({linha:i+1,nome,inicio,fim,retorno,erro:'Data inválida',aba:nomeAba});continue}
    if(fim<inicio){lista.push({linha:i+1,nome,inicio,fim,retorno,erro:'Fim anterior ao início',aba:nomeAba});continue}
    lista.push({linha:i+1,nome,inicio,fim,retorno,aba:nomeAba,dias:map.dias!==undefined?Number(String(row[map.dias]||'').replace(/\D/g,''))||diasInclusivosISO(inicio,fim):diasInclusivosISO(inicio,fim),abono:map.abono!==undefined?String(row[map.abono]||'NÃO').trim().toUpperCase():'NÃO',decimo_terceiro:map.decimo!==undefined?String(row[map.decimo]||'NÃO').trim().toUpperCase():'NÃO',programacao_antecipada:map.antecipada!==undefined&&normalizarTexto(row[map.antecipada])==='sim'?'SIM':'NÃO',status_planilha:map.status_planilha!==undefined?String(row[map.status_planilha]||'').trim():(map.situacao_planilha!==undefined?String(row[map.situacao_planilha]||'').trim():''),matricula:map.matricula!==undefined?String(row[map.matricula]||'').trim():'',area:map.area!==undefined?String(row[map.area]||'').trim().toUpperCase():'',funcao:map.funcao!==undefined?String(row[map.funcao]||'').trim().toUpperCase():''});
  }
  if(!lista.length)throw new Error(`Nenhuma programação de férias foi encontrada na aba ${nomeAba}.`);
  resolve(lista)
}catch(e){reject(e)}};fr.onerror=()=>reject(new Error('Não foi possível ler a planilha de férias.'));fr.readAsArrayBuffer(file)})}
function localizarColaboradorFerias(nome,matricula=''){
  const mat=String(matricula||'').replace(/\D/g,''),chave=normalizarTexto(nome).replace(/\s+/g,' ').trim();
  if(mat){const porMatricula=colaboradores.find(c=>String(c.matricula||'').replace(/\D/g,'')===mat);if(porMatricula)return{colaborador:porMatricula,criterio:'MATRÍCULA',divergenciaNome:chave!==normalizarTexto(porMatricula.nome_completo||porMatricula.nome_exibicao).replace(/\s+/g,' ').trim()}}
  const porNome=colaboradores.find(c=>normalizarTexto(c.nome_completo||c.nome_exibicao).replace(/\s+/g,' ').trim()===chave)||null;
  return porNome?{colaborador:porNome,criterio:'NOME',divergenciaMatricula:!!mat&&String(porNome.matricula||'').replace(/\D/g,'')!==mat}:null
}
function registroFeriasJaExiste(c,inicio,fim){const mat=String(c?.matricula||'').trim();const nome=normalizarTexto(c?.nome_completo||'');if(!programacaoFerias.length)reconstruirProgramacaoFeriasDosRegistros();return programacaoFerias.some(r=>dataISOFlex(r.inicio)===dataISOFlex(inicio)&&dataISOFlex(r.fim)===dataISOFlex(fim)&&((mat&&String(r.matricula||'').trim()===mat)||normalizarTexto(r.nome_completo||r.nome)===nome))}
async function salvarProgramacaoFeriasREST(lista,onStatus){
  const bruto=(Array.isArray(lista)?lista:[]).map(payloadProgramacaoFerias).filter(x=>x&&x.nome_chave&&x.inicio&&x.fim);
  const unicos=new Map();for(const x of bruto)unicos.set(`${x.nome_chave}|${x.inicio}|${x.fim}`,x);
  const payload=[...unicos.values()];
  if(!payload.length)throw new Error('Nenhuma programação válida foi preparada para gravação.');
  if(!navigator.onLine)throw new Error('Sem conexão com a internet.');
  const projeto=projetoSupabaseAtual(),urlBase=`${SUPABASE_URL}/rest/v1/${FERIAS_TABLE}`;
  const headers={'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`};
  onStatus?.(`Conexão confirmada com ${projeto}. Enviando ${payload.length} programação(ões)...`);
  let gravadas=0;const lote=75;
  for(let i=0;i<payload.length;i+=lote){
    const parte=payload.slice(i,i+lote);
    const resp=await fetch(`${urlBase}?on_conflict=nome_chave%2Cinicio%2Cfim`,{method:'POST',headers:{...headers,'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify(parte),cache:'no-store'});
    const texto=await resp.text();let dados=null;if(texto){try{dados=JSON.parse(texto)}catch{dados=texto}}
    if(!resp.ok){const msg=dados?.message||dados?.details||dados?.hint||texto||`HTTP ${resp.status}`;throw new Error(`Supabase recusou o lote ${Math.floor(i/lote)+1}: ${msg}`)}
    gravadas+=Array.isArray(dados)?dados.length:parte.length;
    onStatus?.(`Gravando no Supabase... ${Math.min(i+lote,payload.length)}/${payload.length}`);
  }
  onStatus?.('Gravação enviada. Conferindo diretamente no Supabase...');
  const conf=await fetch(`${urlBase}?select=*&order=inicio.asc`,{headers:{...headers,'Prefer':'count=exact'},cache:'no-store'});
  const textoConf=await conf.text();let rows=[];if(textoConf){try{rows=JSON.parse(textoConf)}catch{}}
  if(!conf.ok)throw new Error(`Não foi possível conferir a tabela: ${textoConf||`HTTP ${conf.status}`}`);
  const presentes=new Set((Array.isArray(rows)?rows:[]).map(x=>`${x.nome_chave}|${dataISOFlex(x.inicio)}|${dataISOFlex(x.fim)}`));
  const faltantes=payload.filter(x=>!presentes.has(`${x.nome_chave}|${x.inicio}|${x.fim}`));
  if(faltantes.length)throw new Error(`A conferência encontrou ${faltantes.length} programação(ões) ausente(s) no banco após o envio.`);
  programacaoFerias=(Array.isArray(rows)?rows:[]).map(r=>normalizarProgramacaoFerias(dadosEfetivoFerias({...r,nome:r.nome_completo,funcao_colaborador:r.funcao||'',local:r.area||''}))).filter(Boolean);
  gravarLocal(FERIAS_KEY,programacaoFerias);feriasNuvemDisponivel=true;atualizarStatusFonteFerias();
  return{gravadas:payload.length,totalTabela:programacaoFerias.length,duplicadasRemovidas:bruto.length-payload.length,projeto};
}
function statusPlanilhaParaApp(valor){
  const n=normalizarTexto(valor||'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  if(!n)return'PRÉ-PROGRAMADO';
  if(n.includes('cancelado'))return'CANCELADO';
  if(n.includes('nao aprovado'))return'NÃO APROVADO';
  if(n.includes('reprogramar'))return'REPROGRAMAR';
  if(n.includes('realizado')||n.includes('concluido'))return'REALIZADO';
  if(n.includes('lancado no gl')||n.includes('enviar ao rh')||n.includes('aviso'))return'ALERTA PARA ENVIAR AO RH';
  if((n.includes('aguardando')||n.includes('pendente'))&&n.includes('rh'))return'AGUARDANDO APROVAÇÃO RH';
  if(n.includes('programado')||n.includes('aprovado pelo rh')||n==='aprovado')return'PROGRAMADO';
  if(n.includes('ferias')||n.includes('em gozo'))return'PROGRAMADO';
  if(n.includes('pre-programado')||n.includes('pre programado')||n.includes('a programar')||n.includes('em dia'))return'PRÉ-PROGRAMADO';
  return'A PROGRAMAR';
}
async function importarFerias(){
  const input=$('planilhaFerias'),file=input?.files?.[0],btn=$('btnImportarFerias'),status=$('statusImportacaoFerias');
  if(!status)return alert('Falha de interface: área de status da importação não encontrada.');
  status.textContent='BOTÃO ACIONADO • iniciando leitura da planilha...';status.classList.remove('cloud-error');
  if(!file){status.textContent='Selecione a planilha de férias antes de importar.';alert('Selecione a planilha de férias.');return}
  btn.disabled=true;
  try{
    const linhas=await extrairFeriasPlanilha(file);status.textContent=`Planilha lida • aba ${linhas[0]?.aba||'identificada'} • ${linhas.length} linha(s) encontrada(s). Validando...`;
    const validas=[],invalidas=[],vinculadas=[],naoVinculadas=[],divergencias=[];
    for(const f of linhas){
      if(f.erro){invalidas.push(f);continue}
      const vinculo=localizarColaboradorFerias(f.nome,f.matricula),c=vinculo?.colaborador;
      if(!c){naoVinculadas.push(f);continue}
      const nomeCompleto=organizarNome(c.nome_completo||c.nome_exibicao);
      const p={tipo:'Férias',categoria:'Férias',motivo:'Férias',colaborador_id:c.id,nome:nomeCompleto,nome_completo:nomeCompleto,matricula:String(c.matricula||'').trim(),funcao_colaborador:String(c.funcao||'').trim(),area:String(c.area||'').trim(),funcao:String(c.funcao||'').trim(),local:String(c.area||'').trim(),data_admissao:c.data_admissao||null,inicio:f.inicio,fim:f.fim,retorno:f.retorno||'',dias:f.dias||diasInclusivosISO(f.inicio,f.fim),abono:f.abono||'NÃO',decimo_terceiro:f.decimo_terceiro||'NÃO',status_aprovacao:statusPlanilhaParaApp(f.status_planilha),cid:'',descricao:'Férias programadas',atestado_fisico:'N/A',enviado_grupo:'N/A',observacao:[f.retorno?`Retorno previsto: ${dataBR(f.retorno)}`:'',f.programacao_antecipada==='SIM'?'Prog. Antecipada: SIM':'',f.status_planilha?`Status planilha: ${String(f.status_planilha).trim()}`:''].filter(Boolean).join(' • '),foto_url:'',foto_path:'',origem:'planilha'};
      validas.push(p);vinculadas.push(p);if(vinculo.divergenciaNome||vinculo.divergenciaMatricula)divergencias.push({linha:f.linha,nome:f.nome,matriculaPlanilha:f.matricula,matriculaEfetivo:c.matricula,criterio:vinculo.criterio})
    }
    if(!validas.length)throw new Error(`Nenhuma programação válida. ${invalidas.length} linha(s) com erro de data.`);
    if(!confirm(`Planilha lida com sucesso.\n\nVinculadas ao Efetivo: ${vinculadas.length}\nNão importadas por falta de vínculo: ${naoVinculadas.length}\nDivergências corrigidas pelo Efetivo: ${divergencias.length}\nInválidas: ${invalidas.length}\n\nSomente colaboradores reconhecidos no Efetivo serão gravados. Continuar?`)){status.textContent='Importação cancelada pelo usuário.';return}
    const resultado=await salvarProgramacaoFeriasREST(validas,msg=>status.textContent=msg);
    // A programação futura permanece somente na tabela própria de férias.
    // Ela só entra no operacional durante o período e no histórico a partir do retorno.
    input.value='';
    const ref=$('dataPainel')?.value||hoje(),prox=proximasFerias(ref)[0];
    renderizarProgramacaoFerias();renderizarProximasFerias(ref);atualizarDashboard();
    status.textContent=`✅ IMPORTAÇÃO CONFIRMADA • ${resultado.gravadas} programação(ões) atualizada(s) conforme o STATUS individual da planilha • ${vinculadas.length} vinculada(s) ao Efetivo • ${naoVinculadas.length} não importada(s) por falta de vínculo • ${divergencias.length} divergência(s) corrigida(s) com os dados oficiais do Efetivo • ${invalidas.length} inválida(s).${prox?` Próxima: ${nomeCompletoRegistro(prox)} em ${dataBR(prox.inicio)} (${prox.diasAte===1?'falta 1 dia':`faltam ${prox.diasAte} dias`}).`:''}`;
  }catch(e){console.error('IMPORTAÇÃO FÉRIAS 6.10.14:',e);status.classList.add('cloud-error');status.textContent=`❌ ERRO NA IMPORTAÇÃO: ${e.message||String(e)}`;alert(`Falha na importação de férias:\n\n${e.message||e}`)}finally{btn.disabled=false;if(estaOnline())statusNuvem('Sincronizado')}
}

function preencherSelectFerias(){const el=$('feriasColaborador');if(!el)return;const atual=el.value;el.innerHTML='<option value="">Selecione o colaborador</option>'+colaboradores.filter(colaboradorAtivo).sort((a,b)=>String(a.nome_completo).localeCompare(String(b.nome_completo),'pt-BR')).map(c=>`<option value="${c.id}">${escapar(String(c.nome_completo||'').toUpperCase())}</option>`).join('');el.value=atual}
function colaboradorFeriasSelecionado(){return colaboradores.find(c=>String(c.id)===String($('feriasColaborador')?.value))||null}
function preencherDadosFerias(){const c=colaboradorFeriasSelecionado();$('feriasMatricula').value=c?.matricula||'';$('feriasArea').value=String(c?.area||'').toUpperCase();$('feriasFuncao').value=String(c?.funcao||'').toUpperCase();$('feriasAdmissao').value=c?.data_admissao||'';validarCadastroFerias()}
function calcularDatasFerias(){const inicio=$('feriasInicio')?.value||'',dias=Number($('feriasDias')?.value||30),fim=somarDiasInclusivosISO(inicio,dias);$('feriasFim').value=fim;if(fim){const d=new Date(`${fim}T12:00:00`);d.setDate(d.getDate()+1);$('feriasRetorno').value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}else $('feriasRetorno').value='';validarCadastroFerias()}
function conflitoFeriasAtual(){const c=colaboradorFeriasSelecionado(),inicio=$('feriasInicio')?.value||'',fim=$('feriasFim')?.value||'';if(!c||!inicio||!fim)return[];const funcao=normalizarTexto(c.funcao);return programacaoFerias.filter(r=>normalizarTexto(r.funcao_colaborador||r.funcao)===funcao&&String(r.matricula||'')!==String(c.matricula||'')&&r.inicio<=fim&&r.fim>=inicio&&statusFeriasControle(r)!=='REALIZADO')}
function antecedenciaFerias(inicio){return diferencaDiasISO(hoje(),inicio)}
function statusFeriasControleLegacy(r){const base=String(r.status_aprovacao||'A PROGRAMAR').toUpperCase();if(base==='APROVADO'){if(hoje()>r.fim)return'REALIZADO';if(hoje()>=r.inicio&&hoje()<=r.fim)return'EM FÉRIAS'}return base}
function validarCadastroFerias(){const el=$('alertaCadastroFerias');if(!el)return[];const inicio=$('feriasInicio')?.value||'',avisos=[],ant=antecedenciaFerias(inicio),conflitos=conflitoFeriasAtual(),c=colaboradorFeriasSelecionado();if(inicio&&ant<60)avisos.push(`ANTECEDÊNCIA: ${ant} dia(s). O recomendado é programar com no mínimo 60 dias.`);if(conflitos.length)avisos.push(`CONFLITO DE FUNÇÃO: ${conflitos.map(x=>`${x.nome_completo} (${dataBR(x.inicio)} a ${dataBR(x.fim)})`).join('; ')}`);if(inicio&&c){const regra=validarInicioFeriasNaEscala(c,inicio);if(!regra.valido)avisos.push(regra.mensagem)}el.innerHTML=avisos.map(x=>`<div>⚠ ${escapar(x)}</div>`).join('');el.classList.toggle('hidden',!avisos.length);return avisos}
function limparFormFerias(){['feriasColaborador','feriasMatricula','feriasArea','feriasFuncao','feriasAdmissao','feriasInicio','feriasFim','feriasRetorno','feriasObservacao'].forEach(id=>{if($(id))$(id).value=''});$('feriasDias').value='30';$('feriasAbono').value='NÃO';$('feriasDecimo').value='NÃO';$('alertaCadastroFerias').classList.add('hidden')}
async function salvarFeriasManual(){if(!exigirPermissao('ferias_cadastrar'))return;const c=colaboradorFeriasSelecionado(),inicio=$('feriasInicio').value,fim=$('feriasFim').value,retorno=$('feriasRetorno').value;if(!c||!inicio||!fim){alert('Selecione o colaborador e informe a data de início.');return}const avisos=validarCadastroFerias();let justificativa='';if(avisos.length){if(!confirm(`${avisos.join('\n\n')}\n\nDeseja continuar mesmo assim?`))return;justificativa=prompt('Informe a justificativa para continuar com o alerta:')?.trim()||'';if(!justificativa){alert('A justificativa é obrigatória.');return}}const payload=payloadProgramacaoFerias({colaborador_id:c.id,nome_completo:c.nome_completo,matricula:c.matricula,funcao:c.funcao,area:c.area,data_admissao:c.data_admissao,inicio,fim,retorno,dias:$('feriasDias').value,abono:$('feriasAbono').value,decimo_terceiro:$('feriasDecimo').value,status_aprovacao:'PRÉ-PROGRAMADO',observacao:$('feriasObservacao').value.trim(),justificativa_conflito:justificativa,origem:'aplicativo'});const {data,error}=await db.from(FERIAS_TABLE).upsert(payload,{onConflict:'nome_chave,inicio,fim'}).select('*').single();if(error){alert(`Não foi possível salvar as férias. ${error.message||''}`);return}await db.from('xcmg_ferias_historico').insert({programacao_id:data.id,acao:'CADASTRO',status_novo:'PRÉ-PROGRAMADO',usuario:usuarioAtual?.nome||usuarioAtual?.login||'Usuário'});$('statusCadastroFerias').textContent='Programação salva como PRÉ-PROGRAMADO. Aguardando aprovação do RH.';limparFormFerias();await carregarProgramacaoFeriasNuvem()}
async function acaoProgramacaoFerias(id,acao){const r=programacaoFerias.find(x=>String(x.id)===String(id));if(!r)return;if(acao==='aprovar'&&!exigirPermissao('ferias_aprovar'))return;if(acao==='reprogramar'&&!exigirPermissao('ferias_editar'))return;const novo=acao==='aprovar'?'APROVADO':'REPROGRAMAR';if(acao==='aprovar'){const conflitos=programacaoFerias.filter(x=>String(x.id)!==String(id)&&normalizarTexto(x.funcao_colaborador||x.funcao)===normalizarTexto(r.funcao_colaborador||r.funcao)&&x.inicio<=r.fim&&x.fim>=r.inicio&&statusFeriasControle(x)!=='REALIZADO');if(conflitos.length&&!confirm(`ATENÇÃO: existe conflito com ${conflitos.map(x=>x.nome_completo).join(', ')}. Deseja aprovar mesmo assim?`))return}const motivo=acao==='reprogramar'?(prompt('Informe o motivo da reprogramação:')||'').trim():'';if(acao==='reprogramar'&&!motivo)return;const dados={status_aprovacao:novo,aprovado_por:acao==='aprovar'?(usuarioAtual?.nome||usuarioAtual?.login||'RH'):'',aprovado_em:acao==='aprovar'?new Date().toISOString():null,atualizado_em:new Date().toISOString()};const {error}=await db.from(FERIAS_TABLE).update(dados).eq('id',id);if(error){alert('Não foi possível atualizar a programação.');return}await db.from('xcmg_ferias_historico').insert({programacao_id:id,acao:novo,status_anterior:r.status_aprovacao||'A PROGRAMAR',status_novo:novo,usuario:usuarioAtual?.nome||usuarioAtual?.login||'Usuário',observacao:motivo});await carregarProgramacaoFeriasNuvem()}
function renderizarProgramacaoFeriasLegacyB(){const el=$('listaProgramacaoFerias'),total=$('totalProgramacaoFerias');if(!el)return;const q=normalizarTexto($('pesquisaProgramacaoFerias')?.value||''),filtro=$('filtroStatusFerias')?.value||'Todos';const lista=[...programacaoFerias].filter(r=>{const st=statusFeriasControle(r,$('dataPainel')?.value||hoje());return(!q||normalizarTexto(`${r.nome_completo} ${r.matricula} ${r.funcao}`).includes(q))&&(filtro==='Todos'||st===filtro)}).sort((a,b)=>a.inicio.localeCompare(b.inicio));if(total)total.textContent=`${lista.length} programação(ões)`;if($('resumoFeriasModulo'))$('resumoFeriasModulo').textContent=`${programacaoFerias.length} programações`;const conflitosTodos=programacaoFerias.filter((r,i,a)=>a.some((x,j)=>j!==i&&normalizarTexto(x.funcao)===normalizarTexto(r.funcao)&&x.inicio<=r.fim&&x.fim>=r.inicio&&statusFeriasControle(x)!=='REALIZADO')).length;if($('kpiFeriasAProgramar'))$('kpiFeriasAProgramar').textContent=programacaoFerias.filter(r=>statusFeriasControle(r,$('dataPainel')?.value||hoje())==='A PROGRAMAR').length;if($('kpiFeriasAprovadas'))$('kpiFeriasAprovadas').textContent=programacaoFerias.filter(r=>statusFeriasControle(r,$('dataPainel')?.value||hoje())==='APROVADO').length;if($('kpiFerias60Dias'))$('kpiFerias60Dias').textContent=programacaoFerias.filter(r=>statusFeriasControle(r,$('dataPainel')?.value||hoje())==='A PROGRAMAR'&&antecedenciaFerias(r.inicio)<=60).length;if($('kpiFeriasConflitos'))$('kpiFeriasConflitos').textContent=conflitosTodos;if(!lista.length){el.innerHTML='<div class="empty">Nenhuma programação encontrada.</div>';return}el.innerHTML=`<div class="vacation-control-table"><table><thead><tr><th>Área</th><th>Matrícula</th><th>Colaborador</th><th>Função</th><th>Início</th><th>Fim</th><th>Retorno</th><th>Dias</th><th>Status</th><th>Ações</th></tr></thead><tbody>${lista.map(r=>{const st=statusFeriasControle(r,$('dataPainel')?.value||hoje()),ant=antecedenciaFerias(r.inicio);return`<tr><td>${escapar(r.area||'—')}</td><td>${escapar(r.matricula||'—')}</td><td><strong>${escapar(r.nome_completo)}</strong>${ant<=60&&st==='A PROGRAMAR'?'<small class="vacation-deadline-alert">⚠ Prazo de 60 dias</small>':''}</td><td>${escapar(r.funcao||'—')}</td><td>${dataBR(r.inicio)}</td><td>${dataBR(r.fim)}</td><td>${dataBR(r.retorno)}</td><td>${r.dias}</td><td><span class="vacation-status-control">${escapar(st)}</span></td><td><div class="effective-row-actions">${st==='A PROGRAMAR'?`<button class="success small-button" data-approve-vacation="${r.id}">Aprovar RH</button>`:''}<button class="secondary small-button" data-reschedule-vacation="${r.id}">Reprogramar</button></div></td></tr>`}).join('')}</tbody></table></div>`}

function preencherSelectFerias(){const el=$('feriasColaborador');if(!el)return;const atual=el.value;el.innerHTML='<option value="">Selecione o colaborador</option>'+colaboradores.filter(colaboradorAtivo).sort((a,b)=>String(a.nome_completo).localeCompare(String(b.nome_completo),'pt-BR')).map(c=>`<option value="${c.id}">${escapar(String(c.nome_completo||'').toUpperCase())}</option>`).join('');el.value=atual}
function colaboradorFeriasSelecionado(){return colaboradores.find(c=>String(c.id)===String($('feriasColaborador')?.value))||null}
function preencherDadosFerias(){const c=colaboradorFeriasSelecionado();$('feriasMatricula').value=c?.matricula||'';$('feriasArea').value=String(c?.area||'').toUpperCase();$('feriasFuncao').value=String(c?.funcao||'').toUpperCase();$('feriasAdmissao').value=dataISOFlex(c?.data_admissao);const ciclo=c?.data_admissao?cicloPorReferencia(c.data_admissao):null,minimo=ciclo?.aquisitivo?somarDiasInclusivosISO(ciclo.aquisitivo,1):'';if($('feriasInicio')){if(minimo)$('feriasInicio').min=minimo;else $('feriasInicio').removeAttribute('min')}calcularDatasFerias()}
function calcularDatasFerias(){const inicio=$('feriasInicio')?.value||'',dias=Number($('feriasDias')?.value||0),fim=somarDiasInclusivosISO(inicio,dias);if($('feriasFim'))$('feriasFim').value=fim;const ret=fim?somarDiasInclusivosISO(fim,2):'';if($('feriasRetorno'))$('feriasRetorno').value=ret;mostrarAlertasFormularioFerias()}
function ehFeriasImportada(r){
  const origem=normalizarTexto(r?.origem||'');
  return origem==='planilha'||origem.includes('planilha');
}
function aprovacaoRHConfirmada(r){
  const base=String(r?.status_aprovacao||'').trim().toUpperCase();
  return ['APROVADO','PROGRAMADO','APROVADO PELO RH'].includes(base)
}
function statusFeriasControle(r,ref){
  // v6.10.14 — motor único de status usado por Férias, Dashboard, Efetivo e Registros.
  const referencia=dataISOFlex(ref||$('dataPainel')?.value||hoje())||hoje();
  const item=normalizarProgramacaoFerias(r);if(!item?.inicio)return'';
  const inicio=dataISOFlex(item.inicio),fim=dataISOFlex(item.fim)||somarDiasInclusivosISO(inicio,item.dias||30);
  const raw=String(item.status_aprovacao||'PRÉ-PROGRAMADO').trim();
  const base=statusPlanilhaParaApp(raw);

  // Estados administrativos finais nunca viram férias por causa da data.
  if(['CANCELADO','NÃO APROVADO','REPROGRAMAR'].includes(base))return base;

  // O período efetivamente programado prevalece para férias válidas.
  if(inicio&&fim&&referencia>=inicio&&referencia<=fim)return'EM FÉRIAS';
  if(fim&&referencia>fim)return'REALIZADO';

  const ante=diferencaDiasISO(referencia,inicio);
  if(ante===null)return'PRÉ-PROGRAMADO';

  // Programações importadas representam a matriz oficial já existente: preservar a situação da planilha.
  if(ehFeriasImportada(item)){
    if(base==='REALIZADO')return'REALIZADO';
    if(base==='PROGRAMADO')return'PROGRAMADO';
    if(base==='ALERTA PARA ENVIAR AO RH')return'ALERTA PARA ENVIAR AO RH';
    if(base==='AGUARDANDO APROVAÇÃO RH')return'AGUARDANDO APROVAÇÃO RH';
    if(base==='APROVAÇÃO RH PENDENTE')return'APROVAÇÃO RH PENDENTE';
    return base==='A PROGRAMAR'?'PRÉ-PROGRAMADO':base==='PRÉ-PROGRAMADO'?'PRÉ-PROGRAMADO':'PRÉ-PROGRAMADO';
  }

  // Novas programações do aplicativo seguem o fluxo automático combinado.
  const aprovado=aprovacaoRHConfirmada(item);
  // v6.10.37 — aprovação antecipada do RH é válida em qualquer antecedência.
  // Os marcos de 60/50 dias continuam como alertas de fluxo, não como trava.
  if(aprovado&&ante>=1)return'PROGRAMADO';
  if(ante>60)return'PRÉ-PROGRAMADO';
  if(ante>=51&&ante<=60)return'ALERTA PARA ENVIAR AO RH';
  if(ante>=44&&ante<=50)return aprovado?'APROVADO':'AGUARDANDO APROVAÇÃO RH';
  if(ante>=1&&ante<=43)return aprovado?'PROGRAMADO':'APROVAÇÃO RH PENDENTE';
  return aprovado?'PROGRAMADO':'PRÉ-PROGRAMADO';
}

function diasAntecedenciaFerias(inicio,ref){return diferencaDiasISO(dataISOFlex(ref||$('dataPainel')?.value||hoje())||hoje(),dataISOFlex(inicio))}
function adicionarAnosISO(data,anos){const iso=dataISOFlex(data);if(!iso)return'';const d=new Date(`${iso}T12:00:00`);if(Number.isNaN(d.getTime()))return'';d.setFullYear(d.getFullYear()+Number(anos||0));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function cicloPorReferencia(dataAdmissao,ref){
  const adm=dataISOFlex(dataAdmissao),referencia=dataISOFlex(ref||$('dataPainel')?.value||hoje())||hoje();
  if(!adm)return{periodo:'',aquisitivo:'',limite:''};
  let inicio=adm;let aquisitivo=adicionarAnosISO(inicio,1);
  // Avança o ciclo enquanto o próximo aquisitivo já ficou para trás.
  let guard=0;while(aquisitivo&&referencia>adicionarAnosISO(aquisitivo,1)&&guard++<80){inicio=aquisitivo;aquisitivo=adicionarAnosISO(inicio,1)}
  return{periodo:inicio,aquisitivo,limite:adicionarAnosISO(aquisitivo,1)};
}
function cicloAquisitivoFerias(r){return cicloPorReferencia(r?.data_admissao||dadosEfetivoFerias(r)?.data_admissao,r?.inicio||$('dataPainel')?.value||hoje())}
function conflitoFerias(r,idIgnorar){
  const funcao=normalizarTexto(r?.funcao_colaborador||r?.funcao||''),inicio=dataISOFlex(r?.inicio),fim=dataISOFlex(r?.fim);
  if(!funcao||!inicio||!fim)return[];
  return programacaoFerias.map(dadosEfetivoFerias).filter(Boolean).filter(x=>String(x.id||'')!==String(idIgnorar||'')&&normalizarTexto(x.funcao_colaborador||x.funcao||'')===funcao&&dataISOFlex(x.inicio)<=fim&&dataISOFlex(x.fim)>=inicio&&!['REALIZADO','CANCELADO'].includes(statusFeriasControle(x,$('dataPainel')?.value||hoje())));
}
function alertaLimiteConcessao(r){const ciclo=cicloAquisitivoFerias(r),dias=diferencaDiasISO($('dataPainel')?.value||hoje(),ciclo?.limite);if(dias===null)return'';if(dias<0)return`CONCESSIVO VENCIDO HÁ ${Math.abs(dias)} DIA(S)`;if(dias<=30)return`CONCESSIVO URGENTE • ${dias} DIA(S) PARA O LIMITE`;if(dias<=60)return`CONCESSIVO CRÍTICO • ${dias} DIA(S) PARA O LIMITE`;if(dias<=90)return`CONCESSIVO EM ALERTA • ${dias} DIA(S)`;if(dias<=120)return`PLANEJAR PRÓXIMO CICLO • ${dias} DIA(S)`;return''}

function fecharEditorLateralFerias(){const area=document.getElementById('vacationFormArea');area?.classList.remove('vacation-edit-drawer');document.body.classList.remove('vacation-drawer-open')}
function limparFormFerias(){editandoFeriasId=null;cicloProgramacaoSelecionado=null;['feriasColaborador','feriasMatricula','feriasArea','feriasFuncao','feriasAdmissao','feriasInicio','feriasFim','feriasRetorno','feriasObservacao'].forEach(id=>{if($(id))$(id).value=''});$('feriasDias').value='30';$('feriasAbono').value='NÃO';$('feriasDecimo').value='NÃO';$('alertaCadastroFerias').classList.add('hidden');$('alertaCadastroFerias').innerHTML='';$('tituloFormFerias').textContent='Cadastrar programação';$('btnSalvarFerias').textContent='Salvar como PRÉ-PROGRAMADO';$('btnCancelarFerias').classList.add('hidden');fecharEditorLateralFerias()}
function editarProgramacaoFerias(id){if(!exigirPermissao('ferias_editar'))return;const r=programacaoFerias.find(x=>String(x.id)===String(id));if(!r)return;if(statusFeriasControle(r,$('dataPainel')?.value||hoje())==='REALIZADO'){alert('Férias realizadas permanecem protegidas no histórico.');return}const d=dadosEfetivoFerias(r);const areaForm=document.getElementById('vacationFormArea');areaForm?.classList.remove('hidden');areaForm?.classList.add('vacation-edit-drawer');document.body.classList.add('vacation-drawer-open');editandoFeriasId=r.id;$('feriasColaborador').value=String(d.colaborador_id||'');preencherDadosFerias();$('feriasInicio').value=dataISOFlex(d.inicio);$('feriasDias').value=String(d.dias||diasInclusivosISO(d.inicio,d.fim)||30);$('feriasAbono').value=d.abono||'NÃO';$('feriasDecimo').value=d.decimo_terceiro||'NÃO';$('feriasObservacao').value=d.observacao||'';calcularDatasFerias();$('tituloFormFerias').textContent='Editar / reprogramar férias';$('btnSalvarFerias').textContent='Salvar alterações e enviar ao RH';$('btnCancelarFerias').classList.remove('hidden');setTimeout(()=>$('feriasInicio')?.focus(),50)}
function iniciarProgramacaoColaborador(id,indiceCiclo=null){
  if(!exigirPermissao('ferias_cadastrar','Usuário sem permissão para programar férias.'))return;
  // v6.10.41 — ao programar a partir de Pendências, preserva a posição atual da rolagem.
  // Só troca para a página Férias quando a chamada vier de outra página; dentro de Férias não volta ao topo.
  const scrollAtual=window.scrollY||document.documentElement.scrollTop||0;
  const paginaFerias=document.getElementById('ferias');
  const jaNaPaginaFerias=!!paginaFerias?.classList.contains('active');
  if(!jaNaPaginaFerias)abrirPagina('ferias');
  const areaForm=document.getElementById('vacationFormArea');
  areaForm?.classList.remove('hidden');
  areaForm?.classList.add('vacation-edit-drawer');
  document.body.classList.add('vacation-drawer-open');
  editandoFeriasId=null;
  $('feriasColaborador').value=String(id);
  preencherDadosFerias();
  const c=colaboradorFeriasSelecionado();
  const idx=indiceCiclo===null?null:Number(indiceCiclo);
  cicloProgramacaoSelecionado=(c&&Number.isInteger(idx))?cicloFeriasPorIndice(c.data_admissao,idx):null;
  ['feriasInicio','feriasFim','feriasRetorno','feriasObservacao'].forEach(campoId=>{if($(campoId))$(campoId).value=''});
  if($('feriasDias'))$('feriasDias').value='30';
  if($('feriasAbono'))$('feriasAbono').value='NÃO';
  if($('feriasDecimo'))$('feriasDecimo').value='NÃO';
  $('tituloFormFerias').textContent='Programar férias';
  $('btnSalvarFerias').textContent='Salvar como PRÉ-PROGRAMADO';
  $('btnCancelarFerias').classList.add('hidden');
  $('alertaCadastroFerias')?.classList.add('hidden');
  const campo=$('feriasInicio');
  if(campo){
    if(cicloProgramacaoSelecionado?.inicioConcessao)campo.min=cicloProgramacaoSelecionado.inicioConcessao;
    else campo.removeAttribute('min');
    setTimeout(()=>{try{campo.focus({preventScroll:true})}catch(_){campo.focus()}if(jaNaPaginaFerias)window.scrollTo({top:scrollAtual,left:0,behavior:'auto'})},50);
  }
}
async function registrarHistoricoFerias(programacaoId,acao,statusAnterior,statusNovo,observacao=''){
  if(!db||!estaOnline())return false;
  try{
    const payload={programacao_id:programacaoId,acao:String(acao||''),status_anterior:String(statusAnterior||''),status_novo:String(statusNovo||''),usuario:usuarioAtual?.nome||usuarioAtual?.login||'Usuário',observacao:String(observacao||'')};
    const {error}=await db.from('xcmg_ferias_historico').insert(payload);
    if(error){console.warn('Não foi possível registrar o histórico de férias.',error);return false}
    return true;
  }catch(e){console.warn('Histórico de férias indisponível.',e);return false}
}
function chaveCancelamentoFerias(r){
  const base=chaveNomeFerias(r?.nome_completo||r?.nome||'colaborador')||'colaborador';
  return `cancelado-${r?.id||Date.now()}-${base}`.slice(0,240);
}
async function salvarFeriasManual(){
  if(!exigirPermissao('ferias_cadastrar'))return;const c=colaboradorFeriasSelecionado(),inicio=$('feriasInicio').value,dias=Number($('feriasDias').value),fim=$('feriasFim').value,retorno=$('feriasRetorno').value;if(!c||!inicio||!fim){alert('Selecione o colaborador e informe a data de início.');return}const validacaoEscala=validarInicioFeriasNaEscala(c,inicio);if(!validacaoEscala.valido){alert(validacaoEscala.mensagem);$('feriasInicio')?.focus();return}const cicloPlanejado=cicloProgramacaoSelecionado||cicloPendenteFerias(c,$('dataPainel')?.value||hoje()),primeiroDiaPermitido=cicloPlanejado?.inicioConcessao||'';if(primeiroDiaPermitido&&inicio<primeiroDiaPermitido){alert(`Data inválida: o período aquisitivo termina em ${dataBR(cicloPlanejado.fim)}. Para este ciclo, as férias podem iniciar a partir de ${dataBR(primeiroDiaPermitido)}.`);$('feriasInicio')?.focus();return}
  // v6.10.42 — proteção gerencial: uma nova programação não pode ocupar um ciclo já vinculado.
  if(!editandoFeriasId&&cicloPlanejado){const existente=programacaoDoCicloFerias(c,cicloPlanejado,$('dataPainel')?.value||hoje());if(existente){const ex=existente.d||existente.r||{};alert(`Já existe uma programação de férias vinculada a este período aquisitivo (${dataBR(cicloPlanejado.inicio)} a ${dataBR(cicloPlanejado.fim)}).\n\nProgramação existente: ${dataBR(ex.inicio)} a ${dataBR(ex.fim)}.\n\nA nova programação não será salva para evitar duplicidade.`);return}}
  const conflitos=conflitoFerias({id:editandoFeriasId,funcao:c.funcao,inicio,fim},editandoFeriasId),ante=diasAntecedenciaFerias(inicio);let justificativa='';if(conflitos.length||(ante>=0&&ante<60)){const motivo=prompt(`${conflitos.length?'Existe conflito com colaborador da mesma função.\n':''}${ante>=0&&ante<60?`A antecedência é de ${ante} dia(s), abaixo de 60.\n`:''}\nInforme uma justificativa para continuar:`);if(!motivo?.trim())return;justificativa=motivo.trim()}
  const payload=payloadProgramacaoFerias({colaborador_id:c.id,nome_completo:c.nome_completo,matricula:c.matricula,funcao:c.funcao,area:c.area,data_admissao:c.data_admissao,inicio,fim,retorno,dias,abono:$('feriasAbono').value,decimo_terceiro:$('feriasDecimo').value,status_aprovacao:'PRÉ-PROGRAMADO',observacao:$('feriasObservacao').value.trim(),justificativa_conflito:justificativa,origem:'aplicativo'});
  let data,error,acao='Programação cadastrada',anterior='';if(editandoFeriasId){const atual=programacaoFerias.find(x=>String(x.id)===String(editandoFeriasId));anterior=atual?.status_aprovacao||'';({data,error}=await db.from(FERIAS_TABLE).update(payload).eq('id',editandoFeriasId).select('*').single());acao='Férias editadas / reprogramadas'}else({data,error}=await db.from(FERIAS_TABLE).insert(payload).select('*').single());
  if(error){alert(`Não foi possível salvar as férias. ${error.message||''}`);return}await registrarHistoricoFerias(data.id,acao,anterior,'PRÉ-PROGRAMADO',justificativa||payload.observacao);$('statusCadastroFerias').textContent=editandoFeriasId?'Alterações salvas. A programação voltou para aprovação do RH.':'Programação salva. Aguardando o fluxo de aprovação do RH.';limparFormFerias();await carregarProgramacaoFeriasNuvem();renderizarProgramacaoFerias();atualizarDashboard()
}
async function alterarStatusFerias(id,novo){
  const permissao=['APROVADO','PROGRAMADO','NÃO APROVADO'].includes(novo)?'ferias_aprovar':'ferias_editar';
  if(!exigirPermissao(permissao,'Usuário sem permissão para esta ação.'))return;
  const atual=programacaoFerias.find(r=>String(r.id)===String(id));if(!atual)return;
  const situacao=statusFeriasControle(atual),ante=diasAntecedenciaFerias(atual.inicio);
  if(['REALIZADO','EM FÉRIAS'].includes(situacao)){alert('Férias em andamento ou realizadas não podem ter o status alterado.');return}
  if(novo==='APROVADO'){
    if(!(ante>=1)){alert('A aprovação do RH só pode ser confirmada para férias com início futuro.');return}
    const baseEfetivo=Array.isArray(colaboradores)?colaboradores:[];
    const colaborador=baseEfetivo.find(c=>String(c.id||'')===String(atual.colaborador_id||''))||baseEfetivo.find(c=>String(c.matricula||'').trim()===String(atual.matricula||'').trim());
    if(colaborador){
      const ini=dataISOFlex(atual.inicio),adm=dataISOFlex(colaborador.data_admissao);
      let cicloDaData=null;
      // v6.10.40: a aprovação é validada pelo ciclo em que a DATA DAS FÉRIAS realmente se encaixa.
      // Não bloqueia uma programação válida só porque existe ciclo anterior sem histórico no aplicativo.
      if(ini&&adm){
        for(let i=0;i<80;i++){
          const ciclo=cicloFeriasPorIndice(adm,i);if(!ciclo)break;
          if(ini>=ciclo.inicioConcessao&&ini<=ciclo.limite){cicloDaData=ciclo;break}
          if(ini<ciclo.inicioConcessao)break;
        }
      }
      if(!cicloDaData){
        const primeiro=cicloFeriasPorIndice(adm,0);
        if(primeiro&&ini<primeiro.inicioConcessao){
          alert(`Não é possível aprovar: as férias começam antes da abertura do primeiro período válido. Para este colaborador, podem iniciar a partir de ${dataBR(primeiro.inicioConcessao)}.`);return
        }
        alert('Não foi possível identificar um período aquisitivo/concessivo válido para esta data de férias. Verifique a data de admissão e o início das férias.');return
      }
      // Se houver ciclos anteriores sem registro, apenas orienta; não impede a aprovação da data válida.
      const consumidos=ciclosConsumidosFerias(colaborador,$('dataPainel')?.value||hoje());
      const anterioresAbertos=[];
      for(let i=0;i<cicloDaData.indice;i++)if(!consumidos.has(i))anterioresAbertos.push(i);
      if(anterioresAbertos.length){
        const cicloAnt=cicloFeriasPorIndice(adm,anterioresAbertos[0]);
        if(!confirm(`A data ${dataBR(ini)} está válida para o período ${dataBR(cicloDaData.inicio)} a ${dataBR(cicloDaData.fim)}.\n\nExiste período anterior sem férias registradas no sistema (${dataBR(cicloAnt.inicio)} a ${dataBR(cicloAnt.fim)}). Isso pode indicar férias realizadas em outra turma.\n\nDeseja aprovar mesmo assim?`))return;
      }
    }
  }
  const statusPersistir=novo==='PROGRAMADO'?'APROVADO':novo;
  let observacao='';
  if(statusPersistir==='APROVADO'){
    if(!confirm(`Confirmar que o RH APROVOU as férias de ${atual.nome_completo||'este colaborador'}?`))return;
    observacao=`RH aprovado manualmente com ${ante} dia(s) de antecedência.`
  }else if(['NÃO APROVADO','CANCELADO'].includes(statusPersistir)){
    observacao=(prompt(`Informe o motivo para ${statusPersistir==='CANCELADO'?'cancelar':'não aprovar'}:`)||'').trim();if(!observacao)return
  }
  const anterior=atual.status_aprovacao||'A PROGRAMAR';
  if(statusPersistir==='CANCELADO'){
    if(!confirm(`Cancelar esta programação de férias de ${atual.nome_completo||'este colaborador'}?

A programação será retirada da lista ativa e o colaborador voltará para A PROGRAMAR. O cancelamento ficará somente no histórico.`))return;
    // Não excluímos fisicamente porque o histórico possui vínculo com a programação.
    // Em vez disso, marcamos CANCELADO e trocamos nome_chave para liberar a chave única.
    const dadosCancelamento={status_aprovacao:'CANCELADO',nome_chave:chaveCancelamentoFerias(atual),atualizado_em:new Date().toISOString(),observacao:[atual.observacao||'',`Cancelamento: ${observacao}`].filter(Boolean).join(' | ')};
    const {error}=await db.from(FERIAS_TABLE).update(dadosCancelamento).eq('id',id);
    if(error){alert(`Não foi possível cancelar as férias. ${error.message||''}`);return}
    await registrarHistoricoFerias(id,'CANCELADO',anterior,'CANCELADO',observacao);
    programacaoFerias=programacaoFerias.filter(r=>String(r.id)!==String(id));
    gravarLocal(FERIAS_KEY,programacaoFerias);
    await carregarProgramacaoFeriasNuvem();renderizarProgramacaoFerias();renderizarPendenciasFerias();atualizarDashboard();
    alert('Férias canceladas. O colaborador voltou para A PROGRAMAR e está liberado para uma nova programação.');
    return;
  }
  const dados={status_aprovacao:statusPersistir,atualizado_em:new Date().toISOString(),justificativa_conflito:observacao||atual.justificativa_conflito||'',aprovado_por:statusPersistir==='APROVADO'?(usuarioAtual?.nome||usuarioAtual?.login||'Usuário'):'',aprovado_em:statusPersistir==='APROVADO'?new Date().toISOString():null};
  const {error}=await db.from(FERIAS_TABLE).update(dados).eq('id',id);if(error){alert('Não foi possível alterar o status.');return}
  await registrarHistoricoFerias(id,statusPersistir==='APROVADO'?'APROVAÇÃO RH CONFIRMADA':statusPersistir,anterior,statusPersistir,observacao);
  await carregarProgramacaoFeriasNuvem();renderizarProgramacaoFerias();atualizarDashboard()
}
function somarDiasCalendarioISO(data,dias){
  const iso=dataISOFlex(data),qtd=Number.parseInt(dias,10);if(!iso||!Number.isInteger(qtd))return'';
  const d=new Date(`${iso}T12:00:00`);if(Number.isNaN(d.getTime()))return'';
  d.setDate(d.getDate()+qtd);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fimPeriodoAquisitivoISO(inicio){const prox=adicionarAnosISO(inicio,1);return prox?somarDiasCalendarioISO(prox,-1):''}
function cicloFeriasPorIndice(dataAdmissao,indice=0){
  const adm=dataISOFlex(dataAdmissao);if(!adm)return null;
  const inicio=adicionarAnosISO(adm,indice),fim=fimPeriodoAquisitivoISO(inicio),inicioConcessao=somarDiasCalendarioISO(fim,1),limite=fimPeriodoAquisitivoISO(inicioConcessao);
  return{indice,inicio,fim,inicioConcessao,limite};
}
// v6.10.24 — férias válidas consomem os períodos aquisitivos em ordem cronológica.
// Ex.: 1ª férias realizada consome o 1º período; a próxima programação consome o 2º período.
function programacoesValidasDoColaborador(c,refPainel){
  const matricula=String(c?.matricula||'').trim(),id=String(c?.id||'');
  return programacaoFerias.map(r=>({r,d:dadosEfetivoFerias(r)||r,status:statusFeriasControle(r,refPainel)})).filter(x=>{
    if(['CANCELADO','NÃO APROVADO','REPROGRAMAR'].includes(x.status))return false;
    const mesmo=(id&&String(x.d?.colaborador_id||'')===id)||(matricula&&String(x.d?.matricula||'').trim()===matricula);
    return mesmo&&!!dataISOFlex(x.d?.inicio);
  }).sort((a,b)=>String(dataISOFlex(a.d?.inicio)||'').localeCompare(String(dataISOFlex(b.d?.inicio)||'')));
}
function ciclosConsumidosFerias(c,refPainel){
  const adm=dataISOFlex(c?.data_admissao);if(!adm)return new Set();
  // v6.10.35: férias anteriores fora do sistema consomem os primeiros ciclos.
  // As férias registradas no XCMG Control continuam consumindo os ciclos seguintes, sem duplicidade.
  const externos=qtdFeriasForaSistema(c);
  const consumidos=new Set();for(let i=0;i<externos;i++)consumidos.add(i);let proximoIndice=externos;
  for(const item of programacoesValidasDoColaborador(c,refPainel)){
    const ini=dataISOFlex(item.d?.inicio);if(!ini)continue;
    for(let i=proximoIndice;i<80;i++){
      const ciclo=cicloFeriasPorIndice(adm,i);if(!ciclo)break;
      // Uma férias só pode consumir um ciclo já adquirido. Sempre consome o ciclo mais antigo ainda aberto.
      if(ini>=ciclo.inicioConcessao){consumidos.add(i);proximoIndice=i+1;break}
      // Se a férias for anterior ao fim do próximo ciclo ainda não adquirido, ela não pode pular para ciclos futuros.
      if(ini<ciclo.inicioConcessao)break;
    }
  }
  return consumidos;
}
function programacaoCobreCicloFerias(c,ciclo,refPainel){
  if(!ciclo)return false;
  return ciclosConsumidosFerias(c,refPainel).has(Number(ciclo.indice));
}
// v6.10.42 — vincula cada programação válida ao ciclo que ela consome,
// seguindo exatamente a mesma ordem usada no cálculo dos períodos pendentes.
function atribuicoesCiclosFerias(c,refPainel){
  const adm=dataISOFlex(c?.data_admissao);if(!adm)return [];
  const externos=qtdFeriasForaSistema(c),atribuicoes=[];let proximoIndice=externos;
  for(const item of programacoesValidasDoColaborador(c,refPainel)){
    const ini=dataISOFlex(item.d?.inicio);if(!ini)continue;
    for(let i=proximoIndice;i<80;i++){
      const ciclo=cicloFeriasPorIndice(adm,i);if(!ciclo)break;
      if(ini>=ciclo.inicioConcessao){atribuicoes.push({indice:i,ciclo,item});proximoIndice=i+1;break}
      if(ini<ciclo.inicioConcessao)break;
    }
  }
  return atribuicoes;
}
function programacaoDoCicloFerias(c,ciclo,refPainel,idIgnorar=''){
  if(!ciclo)return null;
  const achou=atribuicoesCiclosFerias(c,refPainel).find(a=>Number(a.indice)===Number(ciclo.indice)&&String(a.item?.r?.id||a.item?.d?.id||'')!==String(idIgnorar||''));
  return achou?.item||null;
}
function proximaProgramacaoFuturaFerias(c,refPainel){
  const ref=dataISOFlex(refPainel)||hoje();
  return programacoesValidasDoColaborador(c,ref).find(x=>{
    const ini=dataISOFlex(x.d?.inicio),st=statusFeriasControle(x.r||x.d,ref);
    return !!ini&&ini>=ref&&!['REALIZADO','CANCELADO','NÃO APROVADO','REPROGRAMAR'].includes(st);
  })||null;
}
function indiceMinimoManualFerias(c){
  const id=String(c?.id||'');if(!id)return null;
  const valor=ajustesCiclosFerias?.[id]?.indice;
  const n=Number(valor);return Number.isInteger(n)&&n>=0?n:null;
}
function temPrimeiroCicloRealizadoNoApp(c,refPainel){
  const adm=dataISOFlex(c?.data_admissao);if(!adm)return false;
  const ciclo0=cicloFeriasPorIndice(adm,0);if(!ciclo0)return false;
  const matricula=String(c?.matricula||'').trim(),id=String(c?.id||''),ref=dataISOFlex(refPainel)||($('dataPainel')?.value||hoje());
  return programacaoFerias.some(r=>{
    const d=dadosEfetivoFerias(r)||r;
    const mesmo=(id&&String(d?.colaborador_id||'')===id)||(matricula&&String(d?.matricula||'').trim()===matricula);
    if(!mesmo)return false;
    const ini=dataISOFlex(d?.inicio);if(!ini||ini<ciclo0.inicioConcessao)return false;
    return statusFeriasControle(r,ref)==='REALIZADO';
  });
}
function qtdFeriasForaSistema(c){
  const id=String(c?.id||'');if(!id)return 0;
  const a=ajustesCiclosFerias?.[id];
  // Ajuste manual sempre tem prioridade, inclusive quando o valor informado é zero.
  if(a&&Object.prototype.hasOwnProperty.call(a,'ferias_fora_sistema')){
    const manual=Number(a.ferias_fora_sistema);return Number.isInteger(manual)&&manual>=0?manual:0;
  }
  if(a&&Object.prototype.hasOwnProperty.call(a,'indice')){
    const legado=Number(a.indice);return Number.isInteger(legado)&&legado>=0?legado:0;
  }
  // v6.10.43: regularização inicial do efetivo admitido em 2024.
  // Considera 1 férias anterior fora do sistema somente quando o XCMG Control
  // ainda não possui uma férias REALIZADA capaz de representar o primeiro ciclo.
  const adm=dataISOFlex(c?.data_admissao);
  if(adm&&adm.startsWith('2024-')&&!temPrimeiroCicloRealizadoNoApp(c))return 1;
  return 0;
}
function cicloPendenteFeriasAutomatico(c,refPainel){
  const adm=dataISOFlex(c?.data_admissao);if(!adm)return null;
  const ref=dataISOFlex(refPainel)||hoje(),consumidos=ciclosConsumidosFerias(c,ref);
  for(let i=0;i<80;i++){
    const ciclo=cicloFeriasPorIndice(adm,i);if(!ciclo)return null;
    if(!consumidos.has(i))return ciclo;
  }
  return null;
}
function cicloPendenteFerias(c,refPainel){
  const adm=dataISOFlex(c?.data_admissao);if(!adm)return null;
  const ref=dataISOFlex(refPainel)||hoje(),consumidos=ciclosConsumidosFerias(c,ref);
  // v6.10.35: ciclos externos + férias válidas do aplicativo formam uma única sequência automática.
  for(let i=0;i<80;i++){
    const ciclo=cicloFeriasPorIndice(adm,i);if(!ciclo)return null;
    if(!consumidos.has(i))return ciclo;
  }
  return null;
}
async function carregarAjustesCiclosFerias(){
  const cache=lerLocal(FERIAS_CICLOS_KEY,{});ajustesCiclosFerias=cache&&typeof cache==='object'?cache:{};
  if(!db||!estaOnline())return ajustesCiclosFerias;
  try{
    const {data,error}=await db.from('xcmg_efetivo_historico').select('colaborador_id,valor_novo,motivo,created_at').eq('campo','ferias_ciclo_minimo').order('created_at',{ascending:true});
    if(error)throw error;
    const mapa={...ajustesCiclosFerias};
    for(const h of data||[]){
      const id=String(h.colaborador_id||'');if(!id)continue;
      if(String(h.valor_novo||'').toUpperCase()==='AUTO')delete mapa[id];
      else{const indice=Number(h.valor_novo);if(Number.isInteger(indice)&&indice>=0)mapa[id]={indice,ferias_fora_sistema:indice,motivo:h.motivo||'',atualizado_em:h.created_at||''}}
    }
    ajustesCiclosFerias=mapa;gravarLocal(FERIAS_CICLOS_KEY,mapa);
  }catch(e){console.warn('Ajustes manuais dos períodos aquisitivos carregados apenas do cache local.',e)}
  return ajustesCiclosFerias;
}
async function ajustarPeriodoAquisitivo(id){
  const c=colaboradores.find(x=>String(x.id)===String(id));if(!c)return;
  if(!exigirPermissao('ferias_cadastrar','Usuário sem permissão para ajustar o período aquisitivo.'))return;
  const atual=qtdFeriasForaSistema(c),adm=dataISOFlex(c.data_admissao);if(!adm){alert('Não foi possível calcular o período aquisitivo. Verifique a data de admissão.');return}
  const resposta=prompt(`Ajustar controle de férias de ${c.nome_completo}.\n\nInforme QUANTAS FÉRIAS ANTERIORES esta pessoa já realizou FORA DO SISTEMA (ex.: em outra turma).\n\nQuantidade atual: ${atual}\n\nUse 0 quando não houver férias anteriores fora do sistema.`);
  if(resposta===null)return;
  const qtd=Number(String(resposta).trim());if(!Number.isInteger(qtd)||qtd<0||qtd>50){alert('Informe uma quantidade válida entre 0 e 50.');return}
  if(qtd===atual){alert('A quantidade informada já está aplicada.');return}
  const motivo=qtd>0?(prompt('Informe o motivo do ajuste (ex.: férias anteriores realizadas em outra turma):')?.trim()||''):'';
  if(qtd>0&&!motivo){alert('Informe o motivo para registrar o ajuste.');return}
  const anterior=String(atual),novo=String(qtd),idc=String(c.id);
  // Em admitidos em 2024, zero precisa ficar registrado para permitir uma exceção manual
  // à regularização automática de 1 férias anterior fora do sistema.
  const adm2024=String(adm).startsWith('2024-');
  if(qtd===0&&!adm2024)delete ajustesCiclosFerias[idc];
  else ajustesCiclosFerias[idc]={indice:qtd,ferias_fora_sistema:qtd,motivo,atualizado_em:new Date().toISOString()};
  gravarLocal(FERIAS_CICLOS_KEY,ajustesCiclosFerias);
  const proximo=cicloPendenteFerias(c,$('dataPainel')?.value||hoje());
  const descricao=qtd===0?'Férias anteriores fora do sistema zeradas. O controle voltou a considerar somente o histórico do XCMG Control.':`${qtd} férias anterior(es) fora do sistema registrada(s). Próximo período calculado automaticamente: ${proximo?dataBR(proximo.inicio)+' a '+dataBR(proximo.fim):'—'}.`;
  if(db&&estaOnline()){
    const {error}=await db.from('xcmg_efetivo_historico').insert({colaborador_id:c.id,tipo:'Ajuste período aquisitivo',campo:'ferias_ciclo_minimo',valor_anterior:anterior,valor_novo:novo,motivo,descricao});
    if(error)console.warn('O ajuste foi salvo neste aparelho, mas não foi possível registrar no histórico da nuvem.',error);
  }
  renderizarPendenciasFerias();renderizarProgramacaoFerias();
  alert(descricao);
}
function acompanhamentoCicloFerias(c,refPainel){
  const ref=dataISOFlex(refPainel)||hoje();
  // Enquanto uma programação vinculada ao ciclo ainda não terminou, o painel acompanha esse ciclo.
  const ativa=atribuicoesCiclosFerias(c,ref).find(a=>{
    const st=statusFeriasControle(a.item?.r||a.item?.d,ref);
    return !['REALIZADO','CANCELADO','NÃO APROVADO','REPROGRAMAR'].includes(st);
  });
  if(ativa)return{ciclo:ativa.ciclo,programacao:ativa.item?.r||ativa.item?.d,status:statusFeriasControle(ativa.item?.r||ativa.item?.d,ref)};
  return{ciclo:cicloPendenteFerias(c,ref),programacao:null,status:''};
}
function renderizarPendenciasFerias(){
  const el=$('listaPendenciasFerias'),total=$('totalPendenciasFerias');if(!el)return;
  const refPainel=$('dataPainel')?.value||hoje(),termo=normalizarTexto($('pesquisaPendenciasFerias')?.value||''),filtro=$('filtroPendenciasFerias')?.value||'TODOS';
  const base=colaboradores.filter(colaboradorAtivo).map(c=>{
    const acompanhamento=acompanhamentoCicloFerias(c,refPainel),ciclo=acompanhamento.ciclo;if(!ciclo)return null;
    const diasLimite=diferencaDiasISO(refPainel,ciclo.limite),diasAbertura=diferencaDiasISO(refPainel,ciclo.inicioConcessao);
    let alerta='PENDENTE DE PROGRAMAÇÃO',tipo='PENDENTE',prioridade=2,ordem=diasLimite??99999;
    if(acompanhamento.programacao){
      const st=acompanhamento.status,ini=dataBR(acompanhamento.programacao.inicio),fim=dataBR(acompanhamento.programacao.fim);
      if(st==='EM FÉRIAS'){
        tipo='EMFERIAS';prioridade=3;ordem=0;alerta=`EM FÉRIAS • ${ini}${fim?' A '+fim:''}`;
      }else{
        tipo=['PROGRAMADO','APROVADO'].includes(st)?'PROGRAMADO':'PREPROGRAMADO';prioridade=tipo==='PROGRAMADO'?4:3;ordem=diferencaDiasISO(refPainel,acompanhamento.programacao.inicio)??99999;
        alerta=`${tipo==='PROGRAMADO'?'PROGRAMADO':'PRÉ-PROGRAMADO'} • ${ini}${fim?' A '+fim:''}`;
      }
    }else if(ciclo.inicioConcessao>refPainel){tipo='AGUARDANDO';prioridade=5;ordem=diasAbertura??99999;alerta=`AGUARDANDO ABERTURA • ${diasAbertura} DIA(S)`}
    else if(diasLimite!==null){if(diasLimite<0){tipo='VENCIDA';prioridade=1;ordem=diasLimite;alerta=`FÉRIAS VENCIDAS • ${Math.abs(diasLimite)} DIA(S)`}else if(diasLimite<=60)alerta=`PROGRAMAÇÃO URGENTE • ${diasLimite} DIA(S) PARA O FIM DO CONCESSIVO`;else if(diasLimite<=90)alerta=`PROGRAMAÇÃO PENDENTE • ${diasLimite} DIA(S)`}
    return{...c,ciclo,programacao:acompanhamento.programacao,alerta,tipo,prioridade,ordem};
  }).filter(Boolean).sort((a,b)=>a.prioridade-b.prioridade||a.ordem-b.ordem||String(a.nome_completo||'').localeCompare(String(b.nome_completo||''),'pt-BR'));
  const set=(id,v)=>{const n=$(id);if(n)n.textContent=String(v)};
  set('kpiPendVencidas',base.filter(x=>x.tipo==='VENCIDA').length);set('kpiPendProgramacao',base.filter(x=>x.tipo==='PENDENTE').length);set('kpiPendPreProgramado',base.filter(x=>x.tipo==='PREPROGRAMADO').length);set('kpiPendProgramado',base.filter(x=>x.tipo==='PROGRAMADO').length);set('kpiPendEmFerias',base.filter(x=>x.tipo==='EMFERIAS').length);set('kpiPendAguardando',base.filter(x=>x.tipo==='AGUARDANDO').length);
  const lista=base.filter(c=>{if(filtro!=='TODOS'&&c.tipo!==filtro)return false;if(!termo)return true;return normalizarTexto(`${c.matricula||''} ${c.nome_completo||''}`).includes(termo)});
  if(total)total.textContent=`${lista.length} de ${base.length} colaborador(es)`;
  if(!lista.length){el.innerHTML='<div class="empty">Nenhum colaborador encontrado para este filtro.</div>';return}
  el.innerHTML=`<div class="vacation-control-table vacation-pending-table"><table><thead><tr><th>Matrícula</th><th>Colaborador</th><th>Período aquisitivo</th><th>Fim do concessivo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${lista.map(c=>{const classe=c.tipo==='VENCIDA'?'danger':c.tipo==='AGUARDANDO'?'waiting':c.tipo==='EMFERIAS'?'inprogress':c.tipo==='PROGRAMADO'?'programmed':c.tipo==='PREPROGRAMADO'?'preprogrammed':'pending';const acaoPrincipal=c.programacao?`<button class="secondary small-button" data-edit-vacation="${c.programacao.id}">Ver programação</button>`:(temPermissao('ferias_cadastrar')?`<button class="primary small-button" data-start-vacation="${c.id}" data-cycle-index="${c.ciclo.indice}">Programar</button>`:'');const acaoAjuste=temPermissao('ferias_cadastrar')?`<button class="secondary small-button" data-adjust-cycle="${c.id}">Ajustar período</button>`:'';return `<tr><td>${escapar(c.matricula||'—')}</td><td><strong>${escapar(String(c.nome_completo||'').toUpperCase())}</strong><small>${escapar(String(c.area||'').toUpperCase())}${c.funcao?' • '+escapar(String(c.funcao).toUpperCase()):''}</small></td><td><strong>${dataBR(c.ciclo.inicio)} – ${dataBR(c.ciclo.fim)}</strong></td><td>${dataBR(c.ciclo.limite)||'—'}</td><td><span class="vacation-pending-status ${classe}">${escapar(c.alerta)}</span></td><td><details class="vacation-actions-menu"><summary>Ações</summary><div class="vacation-actions-popover">${acaoPrincipal}${acaoAjuste}</div></details></td></tr>`}).join('')}</tbody></table></div>`;
}
function renderizarProgramacaoFerias(){
  const el=$('listaProgramacaoFerias'),total=$('totalProgramacaoFerias');if(!el)return;
  if(!programacaoFerias.length){const legados=(Array.isArray(registros)?registros:[]).filter(ehRegistroFerias).map(normalizarProgramacaoFerias).filter(Boolean);if(legados.length)salvarProgramacaoFerias(legados)}
  const refPainel=$('dataPainel')?.value||hoje();
  const base=programacoesFeriasEfetivoAtivo();
  const situacoes=base.map(r=>statusFeriasControle(r,refPainel));
  // KPIs usam a MESMA base exibida no total. Nenhum cálculo auxiliar pode impedir estes números.
  const setKpi=(id,valor)=>{const n=$(id);if(n)n.textContent=String(valor)};
  setKpi('kpiFeriasAProgramar',situacoes.filter(x=>x==='PRÉ-PROGRAMADO').length);
  setKpi('kpiFeriasAguardandoRH',situacoes.filter(x=>['ALERTA PARA ENVIAR AO RH','AGUARDANDO APROVAÇÃO RH','APROVAÇÃO RH PENDENTE'].includes(x)).length);
  setKpi('kpiFeriasAprovadas',situacoes.filter(x=>['APROVADO','PROGRAMADO'].includes(x)).length);
  setKpi('kpiFeriasEmFerias',situacoes.filter(x=>x==='EM FÉRIAS').length);
  setKpi('kpiFeriasRealizadas',situacoes.filter(x=>x==='REALIZADO').length);
  if($('resumoFeriasModulo'))$('resumoFeriasModulo').textContent=`${base.length} programações`;
  // Programação urgente: conta somente ciclos pendentes, já abertos, sem programação e a 60 dias ou menos do fim do concessivo.
  let programacaoUrgente=0;
  try{for(const c of (Array.isArray(colaboradores)?colaboradores:[]).filter(colaboradorAtivo)){const acompanhamento=acompanhamentoCicloFerias(c,refPainel);if(acompanhamento.programacao)continue;const ciclo=acompanhamento.ciclo;if(!ciclo||ciclo.inicioConcessao>refPainel)continue;const dias=diferencaDiasISO(refPainel,ciclo.limite);if(dias!==null&&dias>=0&&dias<=60)programacaoUrgente++}}catch(e){console.warn('Indicador de programação urgente ignorado:',e)}
  setKpi('kpiFeriasProgramacaoUrgente',programacaoUrgente);
  const q=normalizarTexto($('pesquisaProgramacaoFerias')?.value||''),filtro=$('filtroStatusFerias')?.value||'Todos';
  const prioridade={'EM FÉRIAS':0,'PROGRAMADO':1,'APROVADO':2,'APROVAÇÃO RH PENDENTE':3,'AGUARDANDO APROVAÇÃO RH':4,'ALERTA PARA ENVIAR AO RH':5,'PRÉ-PROGRAMADO':6,'A PROGRAMAR':6,'REPROGRAMAR':7,'NÃO APROVADO':8,'CANCELADO':9,'REALIZADO':99};
  const lista=base.filter(r=>{const st=statusFeriasControle(r,refPainel);return(!q||normalizarTexto(`${r.nome_completo} ${r.matricula} ${r.funcao_colaborador||r.funcao}`).includes(q))&&(filtro==='Todos'||st===filtro)}).sort((a,b)=>{const sa=statusFeriasControle(a,refPainel),sb=statusFeriasControle(b,refPainel),pa=prioridade[sa]??50,pb=prioridade[sb]??50;if(pa!==pb)return pa-pb;if(sa==='REALIZADO'&&sb==='REALIZADO')return String(b.fim||b.inicio||'').localeCompare(String(a.fim||a.inicio||''));return String(a.inicio||'').localeCompare(String(b.inicio||''))||String(a.nome_completo||'').localeCompare(String(b.nome_completo||''),'pt-BR')});
  if(total)total.textContent=`${base.length} programação(ões)`;
  if(!lista.length){el.innerHTML='<div class="empty">Nenhuma programação encontrada para este filtro.</div>';try{renderizarPendenciasFerias()}catch(e){console.warn(e)}return}
  el.innerHTML=`<div class="vacation-control-table vacation-management-table"><table><thead><tr><th>Área</th><th>Matrícula</th><th>Colaborador</th><th>Função</th><th>Status</th><th>Início</th><th>Fim</th><th>Alertas</th><th>Ações</th></tr></thead><tbody>${lista.map(r=>{const st=statusFeriasControle(r,refPainel),ante=diasAntecedenciaFerias(r.inicio,refPainel),futuro=ante!==null&&ante>=1,aprovado=aprovacaoRHConfirmada(r);let conf=0;try{conf=conflitoFerias(r,r.id).length}catch{}const chips=[conf?'<span class="vacation-alert-chip conflict">⚠ Conflito</span>':'',st==='ALERTA PARA ENVIAR AO RH'?'<span class="vacation-alert-chip rh">Enviar RH</span>':st==='AGUARDANDO APROVAÇÃO RH'?'<span class="vacation-alert-chip rh">Aprovação RH</span>':st==='APROVAÇÃO RH PENDENTE'?'<span class="vacation-alert-chip conflict">RH pendente</span>':st==='APROVADO'?'<span class="vacation-alert-chip ok">RH aprovado</span>':st==='PROGRAMADO'?'<span class="vacation-alert-chip ok">Programado</span>':'',ante!==null&&ante>=0&&st!=='REALIZADO'?`<span class="vacation-alert-chip days">${ante} dia${ante===1?'':'s'}</span>`:''].filter(Boolean).join('')||'<span class="vacation-muted">—</span>';const temDataInicio=!!String(r.inicio||'').trim();const encerrado=['REALIZADO','CANCELADO','EM FÉRIAS'].includes(st);const podeAprovar=temDataInicio&&futuro&&!aprovado&&!encerrado&&!['PROGRAMADO','APROVADO'].includes(st);const podeRejeitar=temDataInicio&&futuro&&!aprovado&&!encerrado&&!['PROGRAMADO','APROVADO'].includes(st);const acoes=encerrado?'—':`<button class="secondary small-button" data-edit-vacation="${r.id}">Editar</button>${podeAprovar?`<button class="success small-button vacation-approve-compact" data-approve-vacation="${r.id}" title="Aprovado pelo RH">✓ RH</button>`:''}${podeRejeitar?`<button class="danger small-button" data-reject-vacation="${r.id}" title="Não aprovado pelo RH">Não</button>`:''}<button class="danger small-button" data-cancel-vacation="${r.id}">Cancelar</button>`;const dias=r.dias||diasInclusivosISO(r.inicio,r.fim)||'—';return`<tr class="vacation-main-row"><td>${escapar(r.area||r.local||'—')}</td><td>${escapar(r.matricula||'—')}</td><td><strong>${escapar(r.nome_completo||r.nome||'—')}</strong><button class="vacation-details-toggle" type="button" data-vacation-details="${r.id}">Detalhes</button></td><td>${escapar(r.funcao_colaborador||r.funcao||'—')}</td><td><span class="vacation-program-status ${normalizarTexto(st).replace(/\s+/g,'-')}">${st}</span></td><td>${dataBR(r.inicio)||'—'}</td><td>${dataBR(r.fim)||'—'}</td><td><div class="vacation-alert-chips">${chips}</div></td><td>${acoes==='—'?'<span class="vacation-muted">—</span>':`<details class="vacation-actions-menu"><summary>Ações</summary><div class="vacation-actions-popover">${acoes}</div></details>`}</td></tr><tr class="vacation-detail-row hidden" data-vacation-detail-row="${r.id}"><td colspan="9"><div class="vacation-detail-grid"><span><b>Admissão</b>${dataBR(r.data_admissao)||'—'}</span><span><b>Retorno</b>${dataBR(r.retorno)||'—'}</span><span><b>Dias</b>${dias}</span><span><b>Abono</b>${escapar(r.abono||'NÃO')}</span><span><b>1ª parcela 13º</b>${escapar(r.decimo_terceiro||'NÃO')}</span><span><b>Situação</b>${escapar(st)}</span></div></td></tr>`}).join('')}</tbody></table></div>`;
  try{renderizarPendenciasFerias()}catch(e){console.warn('Pendências de férias não renderizadas:',e)}
}

function exportarFeriasExcel(){if(!exigirPermissao('ferias_exportar'))return;
  if(!window.XLSX){alert('A biblioteca de planilha não foi carregada. Verifique a conexão com a internet.');return}
  const refPainel=$('dataPainel')?.value||hoje();
  const q=normalizarTexto($('pesquisaProgramacaoFerias')?.value||''),filtro=$('filtroStatusFerias')?.value||'Todos';
  const base=programacoesFeriasEfetivoAtivo();
  const lista=base.filter(r=>{const st=statusFeriasControle(r,refPainel);return(!q||normalizarTexto(`${r.nome_completo} ${r.matricula} ${r.funcao_colaborador||r.funcao}`).includes(q))&&(filtro==='Todos'||st===filtro)}).sort((a,b)=>String(a.inicio||'').localeCompare(String(b.inicio||'')));
  const dados=lista.map(r=>{
    const st=statusFeriasControle(r,refPainel),c=colaboradores.find(x=>(r.matricula&&String(x.matricula)===String(r.matricula))||normalizarTexto(x.nome_completo||x.nome_exibicao)===normalizarTexto(r.nome_completo||r.nome));
    let periodo='—';
    try{const ciclos=programacoesValidasDoColaborador(c||r,refPainel);const pos=ciclos.findIndex(x=>String(x.id)===String(r.id)||chaveProgramacaoFeriasCanonica(x)===chaveProgramacaoFeriasCanonica(r));const ciclo=cicloFeriasPorIndice(dataISOFlex(r.data_admissao||c?.data_admissao),Math.max(0,pos));if(ciclo)periodo=`${dataBR(ciclo.inicio)} a ${dataBR(ciclo.fim)}`}catch(e){}
    return {'Área':r.area||c?.area||'','Matrícula':r.matricula||c?.matricula||'','Colaborador':r.nome_completo||r.nome||c?.nome_completo||'','Função':r.funcao_colaborador||r.funcao||c?.funcao||'','Data admissão':dataBR(r.data_admissao||c?.data_admissao)||'','Período aquisitivo':periodo,'Status':st,'Início férias':dataBR(r.inicio)||'','Fim':dataBR(r.fim)||'','Retorno':dataBR(r.retorno)||'','Dias':r.dias||diasInclusivosISO(r.inicio,r.fim)||'','Abono':r.abono||'NÃO','1ª parcela 13º':r.decimo_terceiro||'NÃO','Observação':r.observacao||''};
  });

  // Segunda aba: planejamento dos colaboradores ativos que ainda possuem ciclo a controlar.
  const pendencias=colaboradores.filter(colaboradorAtivo).map(c=>{
    const ciclo=cicloPendenteFerias(c,refPainel);if(!ciclo)return null;
    const diasLimite=diferencaDiasISO(refPainel,ciclo.limite),diasAbertura=diferencaDiasISO(refPainel,ciclo.inicioConcessao);
    let tipo='PENDENTE',situacao='PENDENTE DE PROGRAMAÇÃO',dias='';
    if(ciclo.inicioConcessao>refPainel){tipo='AGUARDANDO';situacao='AGUARDANDO ABERTURA DO PERÍODO';dias=diasAbertura===null?'':diasAbertura}
    else if(diasLimite!==null&&diasLimite<0){tipo='VENCIDA';situacao='FÉRIAS VENCIDAS';dias=Math.abs(diasLimite)}
    else if(diasLimite!==null&&diasLimite<=60){situacao='PROGRAMAÇÃO URGENTE';dias=diasLimite}
    else{dias=diasLimite===null?'':diasLimite}
    return{c,ciclo,tipo,situacao,dias,manual:indiceMinimoManualFerias(c)!==null};
  }).filter(Boolean).sort((a,b)=>(({VENCIDA:1,PENDENTE:2,AGUARDANDO:3}[a.tipo]||9)-({VENCIDA:1,PENDENTE:2,AGUARDANDO:3}[b.tipo]||9))||String(a.c.nome_completo||'').localeCompare(String(b.c.nome_completo||''),'pt-BR'));

  if(!dados.length&&!pendencias.length){alert('Não há informações de férias para exportar.');return}
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(dados.length?dados:[{'Informação':'Nenhuma programação encontrada no filtro atual.'}]);
  ws['!cols']=[{wch:12},{wch:12},{wch:34},{wch:32},{wch:15},{wch:25},{wch:24},{wch:15},{wch:15},{wch:15},{wch:8},{wch:10},{wch:15},{wch:38}];
  XLSX.utils.book_append_sheet(wb,ws,'PROGRAMAÇÕES DE FÉRIAS');

  const vencidas=pendencias.filter(x=>x.tipo==='VENCIDA').length,pendentes=pendencias.filter(x=>x.tipo==='PENDENTE').length,aguardando=pendencias.filter(x=>x.tipo==='AGUARDANDO').length;
  const linhasPend=[
    ['PENDÊNCIAS E PRÓXIMOS PERÍODOS'],
    ['Data de referência',dataBR(refPainel)],
    ['Férias vencidas',vencidas,'Pendentes de programação',pendentes,'Aguardando abertura',aguardando],
    [],
    ['Área','Matrícula','Colaborador','Função','Admissão','Período aquisitivo','Fim do concessivo','Situação','Dias para abertura/fim do concessivo','Origem do período']
  ];
  pendencias.forEach(x=>linhasPend.push([x.c.area||'',x.c.matricula||'',x.c.nome_completo||'',x.c.funcao||'',dataBR(x.c.data_admissao)||'',`${dataBR(x.ciclo.inicio)} a ${dataBR(x.ciclo.fim)}`,dataBR(x.ciclo.limite)||'',x.situacao,x.dias,x.manual?'AJUSTE MANUAL':'AUTOMÁTICO']));
  const wsPend=XLSX.utils.aoa_to_sheet(linhasPend);wsPend['!cols']=[{wch:14},{wch:12},{wch:34},{wch:32},{wch:15},{wch:26},{wch:18},{wch:32},{wch:23},{wch:18}];wsPend['!freeze']={xSplit:0,ySplit:5};
  XLSX.utils.book_append_sheet(wb,wsPend,'PENDÊNCIAS E PRÓXIMOS');

  const sufixo=filtro==='Todos'?'TODAS':normalizarTexto(filtro).replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
  XLSX.writeFile(wb,`XCMG_Ferias_${sufixo}_${refPainel}.xlsx`);
}

function detalheRegistro(r){return [r.motivo,r.descricao,r.cid?`CID: ${r.cid}`:'',r.observacao].filter(Boolean).join(' • ')}
function linhaRegistro(r,acoes){const data=(r.inicio||'').split('-').reverse().join('/');const retornoRaw=r.retorno||r.fim||'';const retorno=retornoRaw?dataBR(retornoRaw):'—';const dataCurta=data&&data!=='—'?(data.slice(0,6)+data.slice(-2)):'—';const retornoCurto=retorno&&retorno!=='—'?(retorno.slice(0,6)+retorno.slice(-2)):'—';const funcao=r.funcao_colaborador||r.funcao||'';const badgeAuto=r.origem_programacao?(programacoesAtivasNaData($('dataPainel')?.value||hoje()).some(p=>chavePessoaPeriodo(p)===chavePessoaPeriodo(r))?'Automático':'Histórico'):'Histórico';const temAnexo=!!r.foto_url;return `<div class="record-row ${classeTipo(r.tipo)}${temAnexo?' has-mobile-attachment':''}" data-record-id="${r.id}"><div class="record-cell cell-type"><span class="tag${['Falta não justificada','Falta Não Justificada'].includes(r.tipo)?' tag-falta-farol':''}">${escapar(r.tipo)}</span></div><div class="record-cell cell-person"><strong>${escapar(nomeCompletoRegistro(r))}</strong><small>${[r.matricula,funcao].filter(Boolean).map(escapar).join(' • ')}</small></div><div class="record-cell cell-local">${escapar(r.local||'—')}</div><div class="record-cell cell-date" data-short-date="${escapar(dataCurta)}">${escapar(data||'—')}</div><div class="record-mobile-period"><b>${escapar(dataCurta)}</b><span>→</span><b>${escapar(retornoCurto)}</b></div><div class="record-mobile-return"><span>Retorno</span><b>${escapar(retorno)}</b></div>${temAnexo?`<a class="record-mobile-attachment" href="${escapar(r.foto_url)}" target="_blank" rel="noopener">📎 Anexo</a>`:''}<div class="record-cell cell-detail" title="${escapar(detalheRegistro(r))}">${escapar(detalheRegistro(r)||'—')}</div><div class="record-cell cell-attachment">${temAnexo?`<a class="record-attachment" href="${escapar(r.foto_url)}" target="_blank" rel="noopener">📎 Anexo</a>`:'—'}</div>${acoes?`<div class="record-cell cell-actions"><button class="secondary" data-edit="${r.id}">Editar</button><button class="danger" data-delete="${r.id}">Excluir</button></div><details class="record-mobile-menu"><summary aria-label="Ações do registro">⋮</summary><div><button class="secondary" data-edit="${r.id}">Editar</button><button class="danger" data-delete="${r.id}">Excluir</button></div></details>`:`<div class="record-cell cell-actions"><span class="history-only-badge">${badgeAuto}</span></div><span class="record-mobile-auto">${badgeAuto}</span>`}</div>`}
function tabelaRegistros(lista){return `<div class="records-table"><div class="records-table-head"><div>Tipo</div><div>Colaborador</div><div>Local</div><div>Data</div><div>Motivo / detalhe</div><div>Anexo</div><div>Ações</div></div><div class="records-table-body">${lista.map(r=>linhaRegistro(r,!r.origem_programacao)).join('')}</div></div>`}
function registrosFiltrados(){
  const q=$('pesquisa').value.toLowerCase().trim(),t=$('filtroTipo').value,l=$('filtroLocal').value,p=$('filtroPeriodo')?.value||'',mostrarTodos=$('mostrarTodosRegistros').checked,data=$('dataPainel').value;
  // Ativos: usa exatamente a mesma fonte consolidada do Dashboard, incluindo férias automáticas ativas.
  // Todos: histórico até a Data do painel + férias automáticas que ainda estão ativas. Férias futuras ficam apenas em Próximas férias/Programação.
  const base=mostrarTodos?registrosConsultaAteData(data):ativosNaData(data);
  return base.filter(r=>(!t||r.tipo===t)&&(!l||r.local===l)&&(!p||periodoFechamento(r.inicio)===p)&&(!q||[r.nome,r.nome_completo,r.matricula,r.funcao_colaborador,r.funcao,r.local,r.tipo,r.motivo,r.observacao,r.descricao,r.cid,periodoFechamento(r.inicio)].join(' ').toLowerCase().includes(q))).sort((a,b)=>(b.inicio||'').localeCompare(a.inicio||'')||(b.created_at||'').localeCompare(a.created_at||''));
}
function atualizarFiltroPeriodos(){const el=$('filtroPeriodo');if(!el)return;const atual=el.value;const base=registrosConsultaAteData($('dataPainel')?.value||hoje());const periodos=[...new Set(base.map(r=>periodoFechamento(r.inicio)).filter(Boolean))].sort((a,b)=>{const pa=a.slice(0,10).split('/').reverse().join('-'),pb=b.slice(0,10).split('/').reverse().join('-');return pb.localeCompare(pa)});el.innerHTML='<option value="">Todos os períodos</option>'+periodos.map(p=>`<option value="${escapar(p)}">${escapar(p)}</option>`).join('');if(periodos.includes(atual))el.value=atual}
function renderizarRegistros(){atualizarFiltroPeriodos();const lista=registrosFiltrados();$('totalRegistrosExibidos').textContent=`${lista.length} registro(s)`;$('listaRegistros').innerHTML=lista.length?tabelaRegistros(lista):'<div class="empty">Nenhum registro encontrado.</div>'}
function mostrarFoto(url=''){const box=$('fotoPreview'),img=$('fotoPreviewImg');if(url){img.src=url;box.classList.remove('hidden')}else{img.removeAttribute('src');box.classList.add('hidden')}}

function categoriasPadrao(){return Object.entries(MOTIVOS_POR_CATEGORIA).map(([nome,motivos],ordem)=>({id:`padrao-${ordem}`,nome,icone:ICONES_CATEGORIA[nome]||'📁',motivos:[...motivos]}))}
function carregarCategoriasLocais(){let salvo=null;try{salvo=JSON.parse(localStorage.getItem(CATEGORIAS_KEY)||'null')}catch{}categoriasRH=Array.isArray(salvo)&&salvo.length?salvo:categoriasPadrao();normalizarCategoriasRH()}
function normalizarCategoriasRH(){categoriasRH=categoriasRH.map((c,i)=>({id:c.id||`cat-${Date.now()}-${i}`,nome:String(c.nome||'').trim(),icone:String(c.icone||'📁').trim()||'📁',motivos:[...new Set((Array.isArray(c.motivos)?c.motivos:[]).map(x=>String(x||'').trim()).filter(Boolean))]})).filter(c=>c.nome)}
function salvarCategoriasLocais(){normalizarCategoriasRH();localStorage.setItem(CATEGORIAS_KEY,JSON.stringify(categoriasRH));atualizarSelectCategorias();renderizarGestaoCategorias();atualizarTudo();if(usuarioAtual?.administrador){if(!estaOnline()){adicionarFilaOffline({entidade:'categorias',operacao:'update',dados:categoriasRH});$('statusCategorias').textContent='Alteração salva offline. Será sincronizada automaticamente.'}else db.from('xcmg_config').update({categorias_rh:categoriasRH}).eq('id',1).then(({error})=>{if(error){console.error(error);adicionarFilaOffline({entidade:'categorias',operacao:'update',dados:categoriasRH});$('statusCategorias').textContent='Alteração salva neste aparelho e ficou pendente de sincronização.'}else{$('statusCategorias').textContent='Categorias sincronizadas para todos os dispositivos.'}})}}
function atualizarSelectCategorias(){const select=$('categoriaMotivo');if(!select)return;const atual=select.value;select.innerHTML='<option value="">Selecione a categoria</option>'+categoriasRH.map(c=>`<option value="${escapar(c.nome)}">${escapar(c.icone)} ${escapar(c.nome)}</option>`).join('');if(atual&&categoriasRH.some(c=>c.nome===atual))select.value=atual;atualizarListaMotivos()}
function categoriaObj(nome){return categoriasRH.find(c=>c.nome===nome)||null}
function renderizarGestaoCategorias(){const box=$('listaCategoriasAdmin');if(!box)return;if(!usuarioAtual?.administrador){box.innerHTML='';return}box.innerHTML=categoriasRH.map(c=>`<div class="category-admin-card" data-cat-id="${escapar(c.id)}"><div class="category-admin-head"><div><strong>${escapar(c.icone)} ${escapar(c.nome)}</strong><small>${c.motivos.length} motivo(s)</small></div><div class="category-admin-actions"><button class="secondary small-button" data-rename-cat="${escapar(c.id)}">Renomear</button><button class="danger small-button" data-delete-cat="${escapar(c.id)}">Excluir</button></div></div><div class="category-motive-chips">${c.motivos.map(m=>`<span>${escapar(m)}<button type="button" title="Editar" data-edit-motive="${escapar(c.id)}|${escapar(m)}">✎</button><button type="button" title="Excluir" data-delete-motive="${escapar(c.id)}|${escapar(m)}">×</button></span>`).join('')}</div><div class="category-add-motive"><input type="text" data-new-motive="${escapar(c.id)}" placeholder="Novo motivo nesta categoria"><button class="secondary" data-add-motive="${escapar(c.id)}">Adicionar motivo</button></div></div>`).join('')}
function exigirAdministrador(){if(usuarioAtual?.administrador)return true;alert('Somente o administrador pode alterar categorias e motivos.');return false}
function adicionarCategoria(){if(!exigirAdministrador())return;const nome=$('novaCategoriaNome').value.trim(),icone=$('novaCategoriaIcone').value.trim()||'📁';if(!nome){alert('Informe o nome da categoria.');return}if(categoriasRH.some(c=>normalizarTexto(c.nome)===normalizarTexto(nome))){alert('Essa categoria já existe.');return}categoriasRH.push({id:`cat-${Date.now()}`,nome,icone,motivos:[]});$('novaCategoriaNome').value='';$('novaCategoriaIcone').value='';salvarCategoriasLocais();$('statusCategorias').textContent='Categoria adicionada.'}
function acaoCategoriaAdmin(e){if(!exigirAdministrador())return;const rename=e.target.dataset.renameCat,del=e.target.dataset.deleteCat,add=e.target.dataset.addMotive,edit=e.target.dataset.editMotive,delm=e.target.dataset.deleteMotive;if(rename){const c=categoriasRH.find(x=>x.id===rename);if(!c)return;const novo=prompt('Novo nome da categoria:',c.nome);if(!novo||!novo.trim())return;if(categoriasRH.some(x=>x.id!==c.id&&normalizarTexto(x.nome)===normalizarTexto(novo))){alert('Já existe uma categoria com esse nome.');return}c.nome=novo.trim();salvarCategoriasLocais()}if(del){const c=categoriasRH.find(x=>x.id===del);if(!c)return;if(!confirm(`Excluir a categoria “${c.nome}” e seus motivos? Os registros antigos serão mantidos.`))return;categoriasRH=categoriasRH.filter(x=>x.id!==del);salvarCategoriasLocais()}if(add){const input=document.querySelector(`[data-new-motive="${CSS.escape(add)}"]`),valor=input?.value.trim(),c=categoriasRH.find(x=>x.id===add);if(!valor||!c)return;if(c.motivos.some(m=>normalizarTexto(m)===normalizarTexto(valor))){alert('Esse motivo já existe nesta categoria.');return}c.motivos.push(valor);input.value='';salvarCategoriasLocais()}if(edit){const [id,...rest]=edit.split('|'),antigo=rest.join('|'),c=categoriasRH.find(x=>x.id===id);if(!c)return;const novo=prompt('Editar motivo:',antigo);if(!novo||!novo.trim())return;const i=c.motivos.indexOf(antigo);if(i>=0)c.motivos[i]=novo.trim();salvarCategoriasLocais()}if(delm){const [id,...rest]=delm.split('|'),motivo=rest.join('|'),c=categoriasRH.find(x=>x.id===id);if(!c||!confirm(`Excluir o motivo “${motivo}”?`))return;c.motivos=c.motivos.filter(m=>m!==motivo);salvarCategoriasLocais()}}
function categoriaPorTipo(tipo){
  const t=normalizarTexto(tipo);
  if(t==='ferias'||t==='folga compensada')return 'Férias';
  if(t==='atestado'||t==='atestado medico'||t==='exame periodico')return 'Saúde';
  if(t==='falta nao justificada'||t==='falta justificada')return 'Ausências';
  return 'Outros';
}
function categoriaDoRegistro(r){
  if(r.categoria&&String(r.categoria).trim())return r.categoria;
  const peloMotivo=categoriaPorMotivo(r.motivo,true);
  if(peloMotivo)return peloMotivo;
  return categoriaPorTipo(r.tipo);
}
function atualizarResumoCategorias(ativos){const box=$('resumoCategorias');if(!box)return;const mapa=new Map(categoriasRH.map(c=>[c.nome,{icone:c.icone,total:0}]));ativos.forEach(r=>{const nome=categoriaDoRegistro(r);if(!mapa.has(nome))mapa.set(nome,{icone:'📁',total:0});mapa.get(nome).total++});box.innerHTML=[...mapa.entries()].map(([nome,d])=>`<div class="category-summary-row"><span>${escapar(d.icone)}</span><span>${escapar(nome)}</span><strong>${d.total}</strong></div>`).join('')||'<div class="empty">Nenhuma categoria cadastrada.</div>'}
function categoriaPorMotivo(motivo,semPadrao=false){
  const alvo=normalizarTexto(motivo);
  if(alvo){for(const c of categoriasRH){if(c.motivos.some(m=>normalizarTexto(m)===alvo))return c.nome}}
  return semPadrao?'':'Outros'
}
function tipoPorMotivo(motivo,categoria){const mapa={'Férias':'Férias','Atestado Médico':'Atestado','Exame Periódico':'Atestado','Falta Não Justificada':'Falta não justificada','Desligamento':'Desligamento','Folga compensada':'Folga compensada','Casamento':'Outras justificativas','Falta justificada':'Outras justificativas','Nascimento':'Outras justificativas','Óbito de familiar':'Outras justificativas','Outras justificativas':'Outras justificativas'};if(mapa[motivo])return mapa[motivo];if(categoria==='Férias')return 'Férias';if(categoria==='Saúde')return 'Atestado';if(categoria==='Ausências')return 'Outras justificativas';return 'Outras justificativas'}
function motivosRH(categoria){const c=categoriaObj(categoria);return c?[...c.motivos].sort((a,b)=>a.localeCompare(b,'pt-BR')):categoriasRH.flatMap(x=>x.motivos)}
function atualizarListaMotivos(){const lista=$('listaMotivosRH'),campo=$('motivo'),categoria=$('categoriaMotivo')?.value||'';if(!lista)return;lista.innerHTML=motivosRH(categoria).map(m=>`<option value="${escapar(m)}"></option>`).join('');if(campo)campo.placeholder=categoria?'Selecione ou digite um motivo':'Primeiro selecione a categoria'}
function salvarMotivoPersonalizado(motivo){motivo=String(motivo||'').trim();const categoria=$('categoriaMotivo')?.value||'';if(!motivo||!categoria)return;const c=categoriaObj(categoria);if(!c||c.motivos.some(x=>normalizarTexto(x)===normalizarTexto(motivo)))return;if(!usuarioAtual?.administrador){alert('Motivo não cadastrado. Somente o administrador pode criar novos motivos.');$('motivo').value='';return}c.motivos.push(motivo);salvarCategoriasLocais();atualizarListaMotivos()}
function sincronizarTipoComMotivo(){if($('tipo')&&$('motivo'))$('tipo').value=tipoPorMotivo($('motivo').value,$('categoriaMotivo')?.value)}
function limparForm(){editando=null;fotoAtual={url:'',path:''};removerFotoAtual=false;['nome','matricula','funcaoColaborador','area','funcao','inicio','dias','fim','cid','descricao','observacao'].forEach(id=>$(id).value='');$('foto').value='';$('categoriaMotivo').value='';$('motivo').value='';$('tipo').value='Outras justificativas';atualizarListaMotivos();$('local').value='';$('atestadoFisico').value='N/A';$('enviadoGrupo').value='N/A';mostrarFoto('');$('btnSalvar').textContent='Adicionar registro';$('btnCancelar').classList.add('hidden');$('formTitle').textContent='Adicionar ocorrência'}

async function carregarNuvem(silencioso=false){if(carregando)return;if(!estaOnline()){carregarCacheOffline();return}carregando=true;if(!silencioso)statusNuvem('Sincronizando...');try{const cacheRegs=lerLocal(REG_KEY,[]),cacheCols=recuperarColaboradoresLocais();const [{data:regs,error:er},{data:cfg,error:ec},{data:cols,error:ecl}]=await Promise.all([db.from('xcmg_registros').select('*').order('created_at',{ascending:true}),db.from('xcmg_config').select('*').eq('id',1).maybeSingle(),db.from('xcmg_colaboradores').select('*').order('nome_exibicao',{ascending:true})]);if(er)throw er;if(ec)throw ec;if(ecl)throw ecl;const regsNuvem=(regs||[]).map(r=>({id:r.id,tipo:r.tipo,categoria:r.categoria||'',motivo:r.motivo||'',nome:r.nome,nome_completo:r.nome_completo||'',matricula:r.matricula||'',funcao_colaborador:r.funcao_colaborador||'',area:r.area||'',funcao:r.funcao||'',local:r.local||'',inicio:r.inicio||'',fim:r.fim||'',cid:r.cid||'',descricao:r.descricao||'',atestado_fisico:r.atestado_fisico||'N/A',enviado_grupo:r.enviado_grupo||'N/A',observacao:r.observacao||'',foto_url:r.foto_url||'',foto_path:r.foto_path||'',created_at:r.created_at||''}));registros=regsNuvem.length?regsNuvem:(Array.isArray(cacheRegs)?cacheRegs:[]);const colsNuvem=Array.isArray(cols)?cols:[];colaboradores=colsNuvem.length?colsNuvem:cacheCols;config=cfg?{turma:cfg.turma,efetivoTotal:cfg.efetivo_total,nomeSistema:cfg.nome_sistema,desenvolvedor:cfg.desenvolvedor,estiloSimbolos:cfg.estilo_simbolos,periodosFechamento:Array.isArray(cfg.periodos_fechamento)?cfg.periodos_fechamento:lerLocal(CFG_KEY,{})?.periodosFechamento||[]}:{...PADRAO,...lerLocal(CFG_KEY,{})};normalizarPeriodosFechamento();if(Array.isArray(cfg?.categorias_rh)&&cfg.categorias_rh.length){categoriasRH=cfg.categorias_rh;normalizarCategoriasRH();localStorage.setItem(CATEGORIAS_KEY,JSON.stringify(categoriasRH));atualizarSelectCategorias();renderizarGestaoCategorias()}if(colaboradores.length)gravarLocal(COL_KEY,colaboradores);if(registros.length)gravarLocal(REG_KEY,registros);await carregarAjustesCiclosFerias();const feriasOk=await carregarProgramacaoFeriasNuvem();if(!feriasOk&&!programacaoFerias.length)reconstruirProgramacaoFeriasDosRegistros();await migrarDadosLocaisSeNecessario();carregarConfig();salvarCacheLocal();atualizarTudo();statusNuvem('Sincronizado')}catch(e){console.error(e);carregarCacheOffline();if(!silencioso&&estaOnline())console.warn('A nuvem não respondeu. Dados locais carregados.')}finally{carregando=false}}
function iniciarRealtime(){if(!estaOnline())return;if(canalRealtime)db.removeChannel(canalRealtime);canalRealtime=db.channel('xcmg-publico').on('postgres_changes',{event:'*',schema:'public',table:'xcmg_registros'},()=>carregarNuvem(true)).on('postgres_changes',{event:'*',schema:'public',table:'xcmg_config'},()=>carregarNuvem(true)).on('postgres_changes',{event:'*',schema:'public',table:'xcmg_colaboradores'},()=>{if(!importandoColaboradores)carregarColaboradores().catch(console.error)}).on('postgres_changes',{event:'*',schema:'public',table:FERIAS_TABLE},()=>carregarProgramacaoFeriasNuvem().then(()=>atualizarTudo()).catch(console.error)).subscribe()}

async function enviarFoto(file){if(!file)return fotoAtual;if(!file.type.startsWith('image/'))throw new Error('Selecione um arquivo de imagem.');if(file.size>5*1024*1024)throw new Error('A foto deve ter no máximo 5 MB.');const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();const path=`ocorrencias/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const {error}=await db.storage.from('xcmg-ocorrencias').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;const {data}=db.storage.from('xcmg-ocorrencias').getPublicUrl(path);return{url:data.publicUrl,path}}
async function salvarRegistro(){if(editando){if(!exigirPermissao('registros_editar'))return}else if(!exigirPermissao('ocorrencias_cadastrar'))return;const nome=$('nome').value.trim();if(!nome){alert('Selecione o colaborador.');$('nome').focus();return}const inicio=$('inicio').value,fim=$('fim').value;if(inicio&&fim&&fim<inicio){alert('A data final não pode ser anterior à data inicial.');return}const estavaEditando=Boolean(editando),arquivo=$('foto').files[0];$('btnSalvar').disabled=true;statusNuvem(arquivo?'Enviando foto...':'Salvando...');try{if(!estaOnline()&&arquivo){alert('A ocorrência será salva offline sem a foto. Anexe a foto depois que a internet voltar.')}let foto=removerFotoAtual?{url:'',path:''}:fotoAtual;if(arquivo&&estaOnline())foto=await enviarFoto(arquivo);const colaborador=colaboradorSelecionado();const categoriaInformada=$('categoriaMotivo').value;if(!categoriaInformada){alert('Selecione a categoria do motivo.');$('categoriaMotivo').focus();return}const motivoInformado=$('motivo').value.trim();if(!motivoInformado){alert('Informe o motivo para a planilha do RH.');$('motivo').focus();return}salvarMotivoPersonalizado(motivoInformado);sincronizarTipoComMotivo();const nomeCompleto=organizarNome(colaborador?.nome_completo||registros.find(r=>String(r.id)===String(editando))?.nome_completo||nome);const dados={tipo:$('tipo').value,categoria:categoriaInformada,motivo:motivoInformado,nome:nomeCompleto,nome_completo:nomeCompleto,matricula:$('matricula').value.trim(),funcao_colaborador:$('funcaoColaborador').value.trim(),area:$('area').value.trim(),funcao:$('funcao').value.trim(),local:$('local').value,inicio:inicio||null,fim:fim||null,cid:$('cid').value.trim(),descricao:$('descricao').value.trim(),atestado_fisico:$('atestadoFisico').value,enviado_grupo:$('enviadoGrupo').value,observacao:$('observacao').value.trim(),foto_url:foto.url||'',foto_path:foto.path||''};if(!estaOnline()){if(editando){const i=registros.findIndex(r=>String(r.id)===String(editando));if(i>=0)registros[i]={...registros[i],...dados};if(!String(editando).startsWith('local-'))adicionarFilaOffline({entidade:'registro',operacao:'update',id:editando,dados})}else{const idLocal=`local-reg-${Date.now()}`;registros.push({...dados,id:idLocal,created_at:new Date().toISOString()});adicionarFilaOffline({entidade:'registro',operacao:'insert',dados:{...dados,id_local:idLocal}})}salvarCacheLocal();$('statusForm').textContent=estavaEditando?'Registro atualizado offline.':'Registro salvo offline. Será sincronizado quando a internet voltar.';limparForm();atualizarTudo();return}let erro;if(editando){({error:erro}=await db.from('xcmg_registros').update(dados).eq('id',editando))}else{({error:erro}=await db.from('xcmg_registros').insert(dados))}if(erro)throw erro;if((arquivo||removerFotoAtual)&&fotoAtual.path&&fotoAtual.path!==foto.path)await db.storage.from('xcmg-ocorrencias').remove([fotoAtual.path]);if(inicio)$('dataPainel').value=inicio;else if(!$('dataPainel').value)$('dataPainel').value=hoje();$('statusForm').textContent=estavaEditando?'Registro atualizado e sincronizado.':'Registro adicionado e sincronizado.';limparForm();await carregarNuvem(true);setTimeout(()=>$('statusForm').textContent='',3000)}catch(e){console.error(e);alert(e.message||'Não foi possível salvar o registro.')}finally{$('btnSalvar').disabled=false;if(estaOnline())statusNuvem('Sincronizado')}}
function editar(id){const r=registros.find(x=>String(x.id)===String(id));if(!r)return;editando=r.id;fotoAtual={url:r.foto_url||'',path:r.foto_path||''};removerFotoAtual=false;$('categoriaMotivo').value=r.categoria||categoriaPorMotivo(r.motivo||'');atualizarListaMotivos();$('motivo').value=r.motivo||'';$('tipo').value=r.tipo||tipoPorMotivo(r.motivo||'',$('categoriaMotivo').value);$('nome').value=nomeCompletoRegistro(r)||r.nome||'';$('matricula').value=r.matricula||'';$('funcaoColaborador').value=r.funcao_colaborador||'';$('area').value=r.area||'';$('funcao').value=r.funcao||'';$('local').value=r.local||'';$('inicio').value=r.inicio||'';$('fim').value=r.fim||'';atualizarDiasPorPeriodo();$('cid').value=r.cid||'';$('descricao').value=r.descricao||'';$('atestadoFisico').value=r.atestado_fisico||'N/A';$('enviadoGrupo').value=r.enviado_grupo||'N/A';$('observacao').value=r.observacao||'';$('foto').value='';mostrarFoto(fotoAtual.url);$('btnSalvar').textContent='Salvar alteração';$('btnCancelar').classList.remove('hidden');$('formTitle').textContent='Editar ocorrência';abrirPagina('ocorrencias')}
async function excluir(id){if(!confirm('Deseja excluir este registro?'))return;const r=registros.find(x=>String(x.id)===String(id));if(!estaOnline()||String(id).startsWith('local-')){registros=registros.filter(x=>String(x.id)!==String(id));if(!String(id).startsWith('local-'))adicionarFilaOffline({entidade:'registro',operacao:'delete',id});salvarCacheLocal();atualizarTudo();return}const {error}=await db.from('xcmg_registros').delete().eq('id',id);if(error){alert('Não foi possível excluir o registro.');return}if(r&&r.foto_path)await db.storage.from('xcmg-ocorrencias').remove([r.foto_path]);await carregarNuvem(true)}
function gerarMensagem(){const data=$('dataPainel').value,ativos=ativosNaData(data);const estilo=config.estiloSimbolos||'completo';const simbolos={completo:{cab:'📋',data:'📅',item:'👤',funcao:'⚙️',periodo:'🗓️',local:'📍',obs:'📝',categorias:{'Férias':'🏖️','Atestado':'🩺','Falta não justificada':'⚠️','Desligamento':'🚪','Outras justificativas':'📄','Folga compensada':'🔄'}},simples:{cab:'■',data:'▣',item:'•',funcao:'-',periodo:'-',local:'-',obs:'-',categorias:{'Férias':'◆','Atestado':'✚','Falta não justificada':'!','Desligamento':'□','Outras justificativas':'•','Folga compensada':'↻'}},nenhum:{cab:'',data:'',item:'',funcao:'',periodo:'',local:'',obs:'',categorias:{'Férias':'','Atestado':'','Falta não justificada':'','Desligamento':'','Outras justificativas':'','Folga compensada':''}}}[estilo];const p=(icone,texto)=>icone?`${icone} ${texto}`:texto;let txt=`${p(simbolos.cab,`*Controle de Férias e Ausências – ${config.turma}*`)}\n${p(simbolos.data,`*${dataBR(data)}*`)}\n`;CATS.forEach(cat=>{const itens=ativos.filter(x=>x.tipo===cat);txt+=`\n${p(simbolos.categorias[cat],`*${cat} (${itens.length})*`)}\n`;txt+=itens.length?itens.map(r=>{const linhas=[p(simbolos.item,`*${nomeExibicao(nomeCompletoRegistro(r))||'Colaborador não informado'}*`)];if(r.funcao)linhas.push(p(simbolos.funcao,r.funcao));if(periodo(r.inicio,r.fim))linhas.push(p(simbolos.periodo,periodo(r.inicio,r.fim)));if(r.local)linhas.push(p(simbolos.local,r.local));if(r.descricao)linhas.push(p(simbolos.obs,r.descricao));else if(r.observacao)linhas.push(p(simbolos.obs,r.observacao));return linhas.join('\n')}).join('\n\n'):'Não informado';txt+='\n'});$('mensagemGerada').textContent=txt.trim();return txt.trim()}
function diasPeriodo(inicio,fim){if(!inicio)return'';const a=new Date(`${inicio}T00:00:00`),b=new Date(`${(fim||inicio)}T00:00:00`);return Math.max(1,Math.round((b-a)/86400000)+1)}
function gerarPlanilhaExcel(){if(!exigirPermissao('registros_exportar'))return;
  if(!window.XLSX){alert('A biblioteca de planilha não foi carregada. Verifique a internet.');return}
  const nomeCompletoRegistro=r=>{if(r.nome_completo)return r.nome_completo;const c=colaboradores.find(x=>(r.matricula&&x.matricula===r.matricula)||x.nome_exibicao===r.nome);return c?.nome_completo||r.nome||''};
  const funcaoRegistro=r=>{if(r.funcao_colaborador)return r.funcao_colaborador;const c=colaboradores.find(x=>(r.matricula&&x.matricula===r.matricula)||x.nome_exibicao===r.nome);return c?.funcao||''};
  const matriculaRegistro=r=>{if(r.matricula)return r.matricula;const c=colaboradores.find(x=>x.nome_exibicao===r.nome);return c?.matricula||''};
  const areaRegistro=r=>{if(r.area)return r.area;const c=colaboradores.find(x=>(r.matricula&&x.matricula===r.matricula)||x.nome_exibicao===r.nome);return c?.area||r.local||''};
  const lista=registrosFiltrados();
  if(!lista.length){alert('Não há registros no filtro atual para exportar.');return}
  const dados=lista.map(r=>({
    Tipo:r.tipo||'',
    Área:areaRegistro(r),
    Local:r.local||'',
    Matrícula:matriculaRegistro(r),
    'Nome completo':nomeCompletoRegistro(r),
    Função:funcaoRegistro(r),
    Equipamento:r.funcao||'',
    'Data início':dataBR(r.inicio),
    Dias:diasPeriodo(r.inicio,r.fim),
    'Data final':dataBR(r.fim||r.inicio),
    Período:periodoFechamento(r.inicio),
    Motivo:r.motivo||r.tipo||'',
    CID:r.cid||'N/A',
    Descrição:r.descricao||r.observacao||'',
    'Atestado físico?':r.atestado_fisico||'N/A',
    'Enviado no grupo?':r.enviado_grupo||'N/A',
    Anexo:r.foto_url||''
  }));
  const ws=XLSX.utils.json_to_sheet(dados);
  ws['!cols']=[{wch:22},{wch:12},{wch:14},{wch:14},{wch:32},{wch:30},{wch:18},{wch:13},{wch:8},{wch:13},{wch:23},{wch:28},{wch:12},{wch:40},{wch:18},{wch:18},{wch:28}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'REGISTROS');
  const dataPainel=$('dataPainel')?.value||hoje();
  XLSX.writeFile(wb,`XCMG_Registros_${dataPainel}.xlsx`)
}
function carregarConfig(){$('turma').value=config.turma||'Turma D';$('efetivoTotal').value=efetivoAtual();$('nomeSistema').value=config.nomeSistema||'XCMG Control';$('desenvolvedor').value=config.desenvolvedor||'Edson de Oliveira Alves';$('estiloSimbolos').value=config.estiloSimbolos||'completo'}
async function salvarConfig(){if(!exigirPermissao('configuracoes_alterar'))return;const nova={turma:$('turma').value.trim()||'Turma D',efetivoTotal:efetivoAtual(),nomeSistema:$('nomeSistema').value.trim()||'XCMG Control',desenvolvedor:$('desenvolvedor').value.trim()||'Edson de Oliveira Alves',estiloSimbolos:$('estiloSimbolos').value||'completo',periodosFechamento:normalizarPeriodosFechamento()};const payload={id:1,turma:nova.turma,efetivo_total:nova.efetivoTotal,nome_sistema:nova.nomeSistema,desenvolvedor:nova.desenvolvedor,estilo_simbolos:nova.estiloSimbolos,periodos_fechamento:nova.periodosFechamento};if(!estaOnline()){config=nova;gravarLocal(CFG_KEY,config);adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload});$('statusConfig').textContent='Configurações salvas offline.';atualizarTudo();return}const {error}=await db.from('xcmg_config').upsert(payload);if(error){config=nova;gravarLocal(CFG_KEY,config);adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload});$('statusConfig').textContent='Salvo neste aparelho; sincronização pendente.';atualizarTudo();return}config=nova;gravarLocal(CFG_KEY,config);$('statusConfig').textContent='Configurações salvas e sincronizadas.';atualizarTudo();setTimeout(()=>$('statusConfig').textContent='',2500)}
function exportar(){if(!exigirPermissao('backup_gerenciar'))return;const blob=new Blob([JSON.stringify({versao:'4.1',exportadoEm:new Date().toISOString(),configuracoes:config,registros},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`xcmg-control-backup-${hoje()}.json`;a.click();URL.revokeObjectURL(a.href)}
async function importar(file){if(!exigirPermissao('backup_gerenciar'))return;const fr=new FileReader();fr.onload=async()=>{try{const d=JSON.parse(fr.result);if(!Array.isArray(d.registros))throw new Error();if(!confirm('A importação substituirá todos os registros compartilhados. Continuar?'))return;await db.from('xcmg_registros').delete().neq('id',0);if(d.registros.length){const payload=d.registros.map(r=>({tipo:r.tipo,nome:r.nome,funcao:r.funcao||'',local:r.local||'',inicio:r.inicio||null,fim:r.fim||null,observacao:r.observacao||'',foto_url:r.foto_url||'',foto_path:r.foto_path||''}));const {error}=await db.from('xcmg_registros').insert(payload);if(error)throw error}if(d.configuracoes){const c=d.configuracoes;const {error}=await db.from('xcmg_config').upsert({id:1,turma:c.turma||PADRAO.turma,efetivo_total:Number(c.efetivoTotal||0),nome_sistema:c.nomeSistema||PADRAO.nomeSistema,desenvolvedor:c.desenvolvedor||PADRAO.desenvolvedor,estilo_simbolos:c.estiloSimbolos||PADRAO.estiloSimbolos,periodos_fechamento:Array.isArray(c.periodosFechamento)?c.periodosFechamento:[]});if(error)throw error}await carregarNuvem(true);$('statusConfig').textContent='Backup importado e sincronizado.'}catch(e){console.error(e);alert('Arquivo de backup inválido ou falha na importação.')}};fr.readAsText(file)}

function abrirGestaoPeriodos(){if(!exigirPermissao('configuracoes_alterar'))return;editandoPeriodoId=null;$('periodoInicio').value='';$('periodoFim').value='';$('btnSalvarPeriodo').textContent='Adicionar período';$('statusPeriodos').textContent='';renderizarGestaoPeriodos();$('modalPeriodos').classList.remove('hidden');$('modalPeriodos').setAttribute('aria-hidden','false')}
function fecharGestaoPeriodos(){$('modalPeriodos').classList.add('hidden');$('modalPeriodos').setAttribute('aria-hidden','true');editandoPeriodoId=null}
function renderizarGestaoPeriodos(){const lista=normalizarPeriodosFechamento();const box=$('listaPeriodos');if(!box)return;box.innerHTML=lista.length?lista.slice().sort((a,b)=>b.inicio.localeCompare(a.inicio)).map(p=>{const qtd=registros.filter(r=>r.inicio>=p.inicio&&r.inicio<=p.fim).length;return`<div class="period-admin-row"><div><strong>🗓️ ${dataBR(p.inicio)} a ${dataBR(p.fim)}</strong><small>${qtd} registro(s) com data de início neste período.</small></div><div class="period-admin-actions"><button class="secondary" type="button" data-edit-periodo="${escapar(p.id)}">Editar</button><button class="danger" type="button" data-delete-periodo="${escapar(p.id)}">Excluir</button></div></div>`}).join(''):'<div class="empty">Nenhum período excepcional cadastrado. O sistema está usando automaticamente o padrão do dia 10 ao dia 09.</div>'}
async function persistirPeriodosFechamento(mensagem='Períodos atualizados.'){normalizarPeriodosFechamento();gravarLocal(CFG_KEY,config);salvarCacheLocal();const payload={id:1,periodos_fechamento:config.periodosFechamento};if(!estaOnline()){adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload});$('statusPeriodos').textContent=`${mensagem} Salvo offline e pendente de sincronização.`;atualizarTudo();renderizarGestaoPeriodos();return}const {error}=await db.from('xcmg_config').update({periodos_fechamento:config.periodosFechamento}).eq('id',1);if(error){console.error(error);$('statusPeriodos').textContent=`${mensagem} Salvo neste aparelho. Para sincronizar entre dispositivos, execute a migração v6.0.13 no Supabase.`;adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload})}else{$('statusPeriodos').textContent=`${mensagem} Sincronizado para todos os dispositivos.`}atualizarTudo();renderizarGestaoPeriodos()}
async function salvarPeriodoFechamento(){if(!exigirPermissao('configuracoes_alterar'))return;const inicio=$('periodoInicio').value,fim=$('periodoFim').value;if(!inicio||!fim){$('statusPeriodos').textContent='Informe a data inicial e a data final.';return}if(fim<inicio){$('statusPeriodos').textContent='A data final não pode ser anterior à data inicial.';return}const lista=normalizarPeriodosFechamento();const conflito=lista.find(p=>p.id!==editandoPeriodoId&&inicio<=p.fim&&fim>=p.inicio);if(conflito){$('statusPeriodos').textContent=`Período sobreposto com ${dataBR(conflito.inicio)} a ${dataBR(conflito.fim)}. Ajuste as datas antes de salvar.`;return}const item={id:editandoPeriodoId||`periodo-${Date.now()}`,inicio,fim};if(editandoPeriodoId){const idx=lista.findIndex(p=>p.id===editandoPeriodoId);if(idx>=0)lista[idx]=item}else lista.push(item);config.periodosFechamento=lista;editandoPeriodoId=null;$('periodoInicio').value='';$('periodoFim').value='';$('btnSalvarPeriodo').textContent='Adicionar período';const padrao=periodoPadrao(inicio);let extra='Período salvo.';if(padrao&&fim<padrao.fim){const d=new Date(`${fim}T12:00:00`);d.setDate(d.getDate()+1);const prox=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;extra=`Período salvo. Fechamento antecipado: o próximo período pode iniciar em ${dataBR(prox)}.`}await persistirPeriodosFechamento(extra)}
function editarPeriodoFechamento(id){if(!exigirPermissao('configuracoes_alterar'))return;const p=normalizarPeriodosFechamento().find(x=>x.id===id);if(!p)return;editandoPeriodoId=id;$('periodoInicio').value=p.inicio;$('periodoFim').value=p.fim;$('btnSalvarPeriodo').textContent='Salvar alteração';$('statusPeriodos').textContent='Editando período selecionado.';$('periodoInicio').focus()}
async function excluirPeriodoFechamento(id){if(!exigirPermissao('configuracoes_alterar'))return;const p=normalizarPeriodosFechamento().find(x=>x.id===id);if(!p)return;const qtd=registros.filter(r=>r.inicio>=p.inicio&&r.inicio<=p.fim).length;if(!confirm(`Excluir o período ${dataBR(p.inicio)} a ${dataBR(p.fim)}?\n\nNenhum registro será apagado. ${qtd?`${qtd} registro(s) voltarão a usar o período automático padrão.`:'Os registros não serão alterados.'}`))return;config.periodosFechamento=config.periodosFechamento.filter(x=>x.id!==id);await persistirPeriodosFechamento('Período excluído. Nenhum registro foi apagado.')}
function cancelarEdicaoPeriodo(){editandoPeriodoId=null;$('periodoInicio').value='';$('periodoFim').value='';$('btnSalvarPeriodo').textContent='Adicionar período';$('statusPeriodos').textContent='Edição cancelada.'}



// v6.10.61 — Calendário automático de escala 3×3 compacto
const ESCALA_BASE_ISO='2026-09-02';
let escalaMesAtual=null;
let escalaDataSelecionada='';
function escalaDataUTC(iso){const [a,m,d]=String(iso||'').split('-').map(Number);return new Date(Date.UTC(a,m-1,d))}
function escalaISODate(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`}
function escalaDiffDias(iso){return Math.round((escalaDataUTC(iso)-escalaDataUTC(ESCALA_BASE_ISO))/86400000)}
function escalaGrupoDoDia(iso){const mod=((escalaDiffDias(iso)%6)+6)%6;return mod<3?'AB':'CD'}
function escalaInfoDoDia(iso){const grupo=escalaGrupoDoDia(iso);return grupo==='AB'?{servico:'A / B',folga:'C / D',classe:'schedule-ab',rotulo:'A / B'}:{servico:'C / D',folga:'A / B',classe:'schedule-cd',rotulo:'C / D'}}
function escalaTurmaTrabalha(iso,turma){const g=escalaGrupoDoDia(iso);return g==='AB'?['A','B'].includes(turma):['C','D'].includes(turma)}
// v6.10.64 — Férias integradas à escala 3×3.
// Início permitido somente no 1º ou 2º dia de trabalho da turma do colaborador.
function escalaPosicaoTrabalhoDaTurma(iso,turma){
  const t=String(turma||'').trim().toUpperCase();if(!['A','B','C','D'].includes(t))return 0;
  const mod=((escalaDiffDias(iso)%6)+6)%6;
  if(['A','B'].includes(t))return mod<=2?mod+1:0;
  return mod>=3?mod-2:0;
}
function proximosIniciosFeriasPermitidos(turma,apartir,quantidade=2){
  const t=String(turma||'').trim().toUpperCase(),base=dataISOFlex(apartir);if(!base||!['A','B','C','D'].includes(t))return[];
  const d=escalaDataUTC(base),out=[];
  for(let i=0;i<18&&out.length<quantidade;i++){
    const x=new Date(d.getTime()+i*86400000),iso=escalaISODate(x),pos=escalaPosicaoTrabalhoDaTurma(iso,t);
    if(pos===1||pos===2)out.push(iso);
  }
  return out;
}
function validarInicioFeriasNaEscala(colaborador,inicio){
  const iso=dataISOFlex(inicio),turma=String(colaborador?.turma||'').trim().toUpperCase();
  if(!iso)return{valido:false,mensagem:'Informe uma data de início válida para as férias.'};
  if(!['A','B','C','D'].includes(turma))return{valido:false,mensagem:`Não foi possível validar a escala: a turma do colaborador não está cadastrada como A, B, C ou D no Efetivo. Atualize a turma antes de programar as férias.`};
  const pos=escalaPosicaoTrabalhoDaTurma(iso,turma),horario=['A','C'].includes(turma)?'06:00 às 18:00':'18:00 às 06:00';
  if(pos===1||pos===2)return{valido:true,turma,posicao:pos,horario,mensagem:`Data válida: ${pos}º dia de trabalho da Turma ${turma}.`};
  const proximas=proximosIniciosFeriasPermitidos(turma,iso,2),sug=proximas.length?` Próximas datas permitidas: ${proximas.map(dataBR).join(' ou ')}.`:'';
  const motivo=pos===3?'o 3º dia de trabalho':'um dia de folga';
  return{valido:false,turma,posicao:pos,horario,mensagem:`Data de início não permitida para a Turma ${turma}: ${dataBR(iso)} cai em ${motivo}. As férias só podem iniciar no 1º ou 2º dia de trabalho da escala 3×3.${sug}`};
}
function escalaDataPainelOuHoje(){const v=$('dataPainel')?.value;if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))return v;const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`}
function escalaHojeISO(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`}
function escalaNomeMes(ano,mes){return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(ano,mes,1))).replace(/^./,c=>c.toUpperCase())}
function atualizarResumoEscala(iso){if(!iso)return;escalaDataSelecionada=iso;const info=escalaInfoDoDia(iso),rotuloData=dataBR(iso).slice(0,5);if($('escalaServicoLabel'))$('escalaServicoLabel').textContent=`Em serviço • ${rotuloData}`;if($('escalaFolgaLabel'))$('escalaFolgaLabel').textContent=`Em folga • ${rotuloData}`;if($('escalaTurmasServico'))$('escalaTurmasServico').textContent=info.servico;if($('escalaTurmasFolga'))$('escalaTurmasFolga').textContent=info.folga;document.querySelectorAll('.schedule-day').forEach(el=>el.classList.toggle('selected',el.dataset.date===iso))}
function renderizarEscala(){
  const cal=$('escalaCalendario');if(!cal)return;
  if(!escalaMesAtual){const base=escalaDataPainelOuHoje();const d=escalaDataUTC(base);escalaMesAtual={ano:d.getUTCFullYear(),mes:d.getUTCMonth()};escalaDataSelecionada=base}
  const {ano,mes}=escalaMesAtual;const filtro=$('filtroTurmaEscala')?.value||'TODAS';
  if($('escalaMesTitulo'))$('escalaMesTitulo').textContent=escalaNomeMes(ano,mes);
  const primeiro=new Date(Date.UTC(ano,mes,1));const ultimo=new Date(Date.UTC(ano,mes+1,0));const inicioGrade=new Date(primeiro);inicioGrade.setUTCDate(1-primeiro.getUTCDay());
  const fimGrade=new Date(ultimo);fimGrade.setUTCDate(ultimo.getUTCDate()+(6-ultimo.getUTCDay()));
  const hoje=escalaHojeISO();let html='';
  for(let d=new Date(inicioGrade);d<=fimGrade;d.setUTCDate(d.getUTCDate()+1)){
    const iso=escalaISODate(d),fora=d.getUTCMonth()!==mes,info=escalaInfoDoDia(iso),trabalha=filtro==='TODAS'?null:escalaTurmaTrabalha(iso,filtro);
    const principal=filtro==='TODAS'?info.rotulo:(trabalha?'TRABALHO':'FOLGA');
    html+=`<button type="button" class="schedule-day ${fora?'outside-month ':''}${info.classe} ${iso===hoje?'today ':''}${iso===escalaDataSelecionada?'selected ':''}" data-date="${iso}" role="gridcell" aria-label="${dataBR(iso)} - ${principal}"><span class="schedule-day-number">${d.getUTCDate()}</span><span class="schedule-day-shift">${principal}</span></button>`;
  }
  cal.innerHTML=html;atualizarResumoEscala(escalaDataSelecionada||escalaDataPainelOuHoje());
}
function moverMesEscala(delta){if(!escalaMesAtual)renderizarEscala();const d=new Date(Date.UTC(escalaMesAtual.ano,escalaMesAtual.mes+delta,1));escalaMesAtual={ano:d.getUTCFullYear(),mes:d.getUTCMonth()};renderizarEscala()}
function irHojeEscala(){const iso=escalaHojeISO(),d=escalaDataUTC(iso);escalaMesAtual={ano:d.getUTCFullYear(),mes:d.getUTCMonth()};escalaDataSelecionada=iso;renderizarEscala()}


// v6.10.85 — Homem × Frota
function hfChave(p){return `${normalizarTexto(p?.area||'')}|${normalizarTexto(p?.funcao||'')}|${normalizarTexto(p?.equipamento||'')}`}
function hfNormalizar(p={}){return {id:p.id??`local-hf-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,area:String(p.area||'').trim(),matricula:String(p.matricula||'').trim(),nome_completo:String(p.nome_completo||p.nome||'').trim(),funcao:String(p.funcao||'').trim(),equipamento:String(p.equipamento||'').trim().toUpperCase(),observacao:String(p.observacao||'').trim(),created_at:p.created_at||new Date().toISOString(),updated_at:p.updated_at||new Date().toISOString()}}
function hfColaborador(p){const m=String(p?.matricula||'').trim();const n=normalizarTexto(p?.nome_completo||'');return colaboradores.find(c=>(m&&String(c?.matricula||'').trim()===m)||(n&&normalizarTexto(c?.nome_completo||c?.nome_exibicao||'')===n))||null}
function hfNomeAtual(p){const c=hfColaborador(p);return String(c?.nome_completo||c?.nome_exibicao||p?.nome_completo||'').trim()}
function hfAusencia(p,data){
  const c=hfColaborador(p),mat=String(p?.matricula||c?.matricula||'').trim(),nome=normalizarTexto(hfNomeAtual(p));
  if(!mat&&!nome)return {status:'PENDENTE',motivo:'Sem profissional vinculado'};
  if(c&&statusEfetivo(c)!=='Ativo')return {status:'AUSENTE',motivo:statusEfetivo(c)};
  const fer=programacaoFerias.find(f=>mesmaPessoa({matricula:mat,nome_completo:hfNomeAtual(p)},f)&&dataISOFlex(f.inicio)<=data&&data<=dataISOFlex(f.fim)&&!['CANCELADO','NÃO APROVADO','NAO APROVADO'].includes(String(f.status||'').toUpperCase()));
  if(fer)return {status:'AUSENTE',motivo:'Férias'};
  const reg=registros.find(r=>!ehEspelhoProgramacaoFerias(r)&&mesmaPessoa({matricula:mat,nome_completo:hfNomeAtual(p)},r)&&dataISOFlex(r.inicio)<=data&&(!dataISOFlex(r.fim)||data<=dataISOFlex(r.fim))&&normalizarTexto(r.tipo)!=='folga compensada');
  if(reg)return {status:'AUSENTE',motivo:reg.tipo||reg.motivo||'Ocorrência ativa'};
  return {status:'DISPONIVEL',motivo:'Disponível'};
}
function hfPreencherDatalist(){const dl=$('hfMatriculasEfetivo');if(!dl)return;dl.innerHTML=colaboradores.filter(colaboradorAtivo).sort((a,b)=>String(a.nome_completo||'').localeCompare(String(b.nome_completo||''),'pt-BR')).map(c=>`<option value="${escapar(c.matricula||'')}" label="${escapar(c.nome_completo||c.nome_exibicao||'')}"></option>`).join('')}
function hfFiltros(){const el=$('hfFiltroArea');if(!el)return;const atual=el.value;const areas=[...new Set(homemFrota.map(x=>x.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));el.innerHTML='<option value="">Todas as áreas</option>'+areas.map(a=>`<option>${escapar(a)}</option>`).join('');el.value=atual}
function hfListaFiltrada(){const q=normalizarTexto($('hfPesquisa')?.value||''),area=$('hfFiltroArea')?.value||'',st=$('hfFiltroStatus')?.value||'',data=$('dataPainel')?.value||hoje();return homemFrota.filter(p=>{const a=hfAusencia(p,data);const txt=normalizarTexto(`${p.area} ${p.matricula} ${hfNomeAtual(p)} ${p.funcao} ${p.equipamento} ${a.motivo}`);return(!q||txt.includes(q))&&(!area||p.area===area)&&(!st||a.status===st)}).sort((a,b)=>String(a.area).localeCompare(String(b.area),'pt-BR')||String(a.funcao).localeCompare(String(b.funcao),'pt-BR')||String(a.equipamento).localeCompare(String(b.equipamento),'pt-BR'))}
function renderizarHomemFrota(){
  if(!$('hfLista'))return;hfPreencherDatalist();hfFiltros();const data=$('dataPainel')?.value||hoje(),lista=hfListaFiltrada();
  const estados=homemFrota.map(p=>hfAusencia(p,data)),disp=estados.filter(x=>x.status==='DISPONIVEL').length,pend=estados.length-disp,total=homemFrota.length,cob=total?Math.round(disp/total*100):0;
  $('hfKpiTotal').textContent=total;$('hfKpiDisponiveis').textContent=disp;$('hfKpiPendentes').textContent=pend;$('hfKpiCobertura').textContent=`${cob}%`;$('hfTotalExibido').textContent=`${lista.length} ${lista.length===1?'posição':'posições'}`;
  const porFuncao={};homemFrota.forEach(p=>{const f=p.funcao||'Não informado',a=hfAusencia(p,data);porFuncao[f]??={total:0,disponiveis:0,pendentes:0};porFuncao[f].total++;if(a.status==='DISPONIVEL')porFuncao[f].disponiveis++;else porFuncao[f].pendentes++});
  const deficits=Object.entries(porFuncao).filter(([,v])=>v.pendentes>0).sort((a,b)=>b[1].pendentes-a[1].pendentes||a[0].localeCompare(b[0],'pt-BR'));
  $('hfDeficitFuncoes').innerHTML=deficits.length?`<div class="hf-deficit-head"><span>Função</span><span>Cobertura</span><span>Déficit</span></div>`+deficits.map(([f,v])=>`<button type="button" class="hf-deficit-row" data-hf-deficit="${escapar(f)}" title="Mostrar posições sem cobertura desta função"><strong>${escapar(f)}</strong><small>${v.disponiveis}/${v.total}</small><span>🔴 ${v.pendentes}</span></button>`).join(''):'<div class="hf-empty-ok">✓ Todas as funções estão cobertas na data do painel.</div>';
  $('hfLista').innerHTML=lista.length?`<table class="hf-table"><thead><tr><th>Área</th><th>Matrícula</th><th>Nome completo</th><th>Função</th><th>Equipamento</th><th>Situação</th><th></th></tr></thead><tbody>${lista.map(p=>{const a=hfAusencia(p,data),nome=hfNomeAtual(p);const cls=a.status==='DISPONIVEL'?'hf-status-ok':a.status==='AUSENTE'?'hf-status-warn':'hf-status-danger';const sit=a.status==='DISPONIVEL'?'Disponível':a.status==='AUSENTE'?`Ausente • ${a.motivo}`:'Pendente • Sem profissional';return `<tr><td>${escapar(p.area)}</td><td>${escapar(p.matricula||'—')}</td><td class="hf-name">${escapar(nome||'PENDENTE')}</td><td>${escapar(p.funcao)}</td><td><strong>${escapar(p.equipamento)}</strong></td><td><span class="hf-status ${cls}">${escapar(sit)}</span></td><td><details class="row-menu"><summary>⋮</summary><div class="row-menu-pop">${p.matricula?`<button type="button" data-unlink-hf="${escapar(String(p.id))}">Desvincular profissional</button>`:`<button type="button" data-link-hf="${escapar(String(p.id))}">Vincular profissional</button>`}<button type="button" data-edit-hf="${escapar(String(p.id))}">Editar frota</button><button type="button" class="danger-text" data-delete-hf="${escapar(String(p.id))}">Excluir frota</button></div></details></td></tr>`}).join('')}</tbody></table>`:'<div class="empty-state">Nenhuma posição encontrada.</div>';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-hf-deficit]');if(!b)return;const q=$('hfPesquisa'),st=$('hfFiltroStatus');if(q)q.value=b.dataset.hfDeficit||'';if(st)st.value='';renderizarHomemFrota();$('hfLista')?.scrollIntoView({behavior:'smooth',block:'start'})})
function hfAbrirEditor(id=null){const permissao=id?'homem_frota_editar':'homem_frota_adicionar';if(!exigirPermissao(permissao))return;editandoHFId=id;const p=id?homemFrota.find(x=>String(x.id)===String(id)):null;$('hfEditorTitulo').textContent=p?'Editar frota':'Adicionar frota';$('hfArea').value=p?.area||'';$('hfFuncao').value=p?.funcao||'';$('hfEquipamento').value=p?.equipamento||'';$('hfMatricula').value=p?.matricula||'';$('hfNome').value=hfNomeAtual(p||{})||'';$('hfObservacao').value=p?.observacao||'';$('hfEditorBox').classList.remove('hidden');$('hfImportBox').classList.add('hidden');$('hfStatusEditor').textContent='';$('hfArea').focus()}
function hfFecharEditor(){editandoHFId=null;$('hfEditorBox')?.classList.add('hidden');['hfArea','hfFuncao','hfEquipamento','hfMatricula','hfNome','hfObservacao'].forEach(id=>{if($(id))$(id).value=''})}
function hfAbrirVinculo(id){if(!exigirPermissao('homem_frota_vincular'))return;const p=homemFrota.find(x=>String(x.id)===String(id));if(!p||p.matricula)return;hfVinculoId=id;const sel=$('hfVinculoProfissional');if(!sel)return;const ativos=colaboradores.filter(colaboradorAtivo).sort((a,b)=>{const am=normalizarTexto(a.funcao||'')===normalizarTexto(p.funcao||'')?0:1,bm=normalizarTexto(b.funcao||'')===normalizarTexto(p.funcao||'')?0:1;return am-bm||String(a.nome_completo||a.nome_exibicao||'').localeCompare(String(b.nome_completo||b.nome_exibicao||''),'pt-BR')});sel.innerHTML='<option value="">Selecione pelo nome ou matrícula</option>'+ativos.map(c=>`<option value="${escapar(String(c.matricula||''))}">${escapar(String(c.matricula||''))} — ${escapar(c.nome_completo||c.nome_exibicao||'')} — ${escapar(c.funcao||'Sem função')}</option>`).join('');$('hfVinculoPosicao').textContent=`${p.equipamento} • ${p.area} • ${p.funcao}`;$('hfVinculoDetalhes').textContent='';$('hfVinculoBox').classList.remove('hidden');$('hfEditorBox').classList.add('hidden');$('hfImportBox').classList.add('hidden');sel.value='';setTimeout(()=>sel.focus(),50)}
function hfFecharVinculo(){hfVinculoId=null;$('hfVinculoBox')?.classList.add('hidden');if($('hfVinculoProfissional'))$('hfVinculoProfissional').value='';if($('hfVinculoDetalhes'))$('hfVinculoDetalhes').textContent=''}
function hfAtualizarDetalhesVinculo(){const p=homemFrota.find(x=>String(x.id)===String(hfVinculoId)),m=String($('hfVinculoProfissional')?.value||'').trim(),c=colaboradores.find(x=>String(x.matricula||'').trim()===m),st=$('hfVinculoDetalhes');if(!st)return;if(!c){st.textContent='';return}const comp=normalizarTexto(c.funcao||'')===normalizarTexto(p?.funcao||'');st.textContent=`${c.nome_completo||c.nome_exibicao||''} • ${c.funcao||'Função não informada'}${comp?' • Função compatível':' • Atenção: função diferente da posição'}`}
async function hfSalvarVinculo(){if(!exigirPermissao('homem_frota_vincular'))return;const p=homemFrota.find(x=>String(x.id)===String(hfVinculoId)),m=String($('hfVinculoProfissional')?.value||'').trim(),c=colaboradores.find(x=>String(x.matricula||'').trim()===m);if(!p){hfFecharVinculo();return}if(!c){$('hfVinculoDetalhes').textContent='Selecione um profissional do Efetivo.';return}const outra=homemFrota.find(x=>String(x.matricula||'').trim()===m&&String(x.id)!==String(p.id));if(outra&&!confirm(`${c.nome_completo||c.nome_exibicao||m} já está vinculado à posição ${outra.equipamento}.

Deseja vincular também nesta posição?`))return;const comp=normalizarTexto(c.funcao||'')===normalizarTexto(p.funcao||'');if(!comp&&!confirm(`A função do profissional no Efetivo é "${c.funcao||'não informada'}", diferente da posição "${p.funcao}".

Deseja vincular mesmo assim?`))return;p.matricula=String(c.matricula||'').trim();p.nome_completo=String(c.nome_completo||c.nome_exibicao||'').trim();p.updated_at=new Date().toISOString();gravarLocal(HF_KEY,homemFrota);renderizarHomemFrota();hfFecharVinculo();await hfPersistirItem(p,p.id)}
function hfSincronizarNomePorMatricula(){const m=String($('hfMatricula')?.value||'').trim();const c=colaboradores.find(x=>String(x.matricula||'').trim()===m);if(c){if($('hfNome'))$('hfNome').value=c.nome_completo||c.nome_exibicao||'';if($('hfFuncao'))$('hfFuncao').value=String(c.funcao||'').trim().toUpperCase()}else if(m&&$('hfNome'))$('hfNome').value=''}
async function hfPersistirItem(item,originalId=null){gravarLocal(HF_KEY,homemFrota);if(!estaOnline()||!db)return;try{let error;if(originalId&&!String(originalId).startsWith('local-hf-'))({error}=await db.from(HF_TABLE).update({area:item.area,matricula:item.matricula||null,nome_completo:item.nome_completo||null,funcao:item.funcao,equipamento:item.equipamento,observacao:item.observacao||null,updated_at:new Date().toISOString()}).eq('id',originalId));else({error}=await db.from(HF_TABLE).upsert({area:item.area,matricula:item.matricula||null,nome_completo:item.nome_completo||null,funcao:item.funcao,equipamento:item.equipamento,observacao:item.observacao||null,updated_at:new Date().toISOString()},{onConflict:'area,funcao,equipamento'}));if(error)throw error;hfNuvemDisponivel=true;await carregarHomemFrotaNuvem()}catch(e){hfNuvemDisponivel=false;console.warn('Homem × Frota salvo apenas neste aparelho. Execute a migração v6.10.82 para sincronizar.',e)}}
async function hfSalvar(){const permissao=editandoHFId?'homem_frota_editar':'homem_frota_adicionar';if(!exigirPermissao(permissao))return;const matricula=String($('hfMatricula').value||'').trim(),col=matricula?colaboradores.find(x=>String(x.matricula||'').trim()===matricula):null;if(matricula&&!col){$('hfStatusEditor').textContent='Matrícula não encontrada no Efetivo. Cadastre ou corrija o colaborador no Efetivo primeiro.';return}const novo=hfNormalizar({area:$('hfArea').value,funcao:$('hfFuncao').value,equipamento:$('hfEquipamento').value,matricula,nome_completo:col?(col.nome_completo||col.nome_exibicao||''):'',observacao:$('hfObservacao').value});if(!novo.area||!novo.funcao||!novo.equipamento){$('hfStatusEditor').textContent='Preencha Área, Função e Equipamento.';return}const duplicado=homemFrota.find(x=>hfChave(x)===hfChave(novo)&&String(x.id)!==String(editandoHFId));if(duplicado){$('hfStatusEditor').textContent='Já existe uma posição com a mesma Área, Função e Equipamento.';return}const originalId=editandoHFId;if(originalId){const i=homemFrota.findIndex(x=>String(x.id)===String(originalId));if(i>=0)novo.id=homemFrota[i].id,homemFrota[i]=novo}else homemFrota.push(novo);gravarLocal(HF_KEY,homemFrota);renderizarHomemFrota();hfFecharEditor();await hfPersistirItem(novo,originalId)}
async function hfDesvincular(id){if(!exigirPermissao('homem_frota_desvincular'))return;const p=homemFrota.find(x=>String(x.id)===String(id));if(!p||!p.matricula)return;if(!confirm(`Desvincular ${hfNomeAtual(p)||p.matricula} da posição ${p.equipamento}?\n\nA Área, Função e o Equipamento serão mantidos e a posição ficará PENDENTE.`))return;p.matricula='';p.nome_completo='';p.updated_at=new Date().toISOString();gravarLocal(HF_KEY,homemFrota);renderizarHomemFrota();await hfPersistirItem(p,p.id)}
async function hfExcluir(id){if(!exigirPermissao('homem_frota_excluir'))return;const p=homemFrota.find(x=>String(x.id)===String(id));if(!p)return;if(p.matricula){alert(`Esta frota possui um profissional vinculado (${hfNomeAtual(p)||p.matricula}).\n\nDesvincule o profissional antes de excluir a frota.`);return}if(!confirm(`Excluir definitivamente a frota/posição ${p.equipamento} • ${p.funcao}?\n\nÁrea, Função e Equipamento serão removidos do Homem × Frota. Nenhum colaborador será excluído do Efetivo.`))return;homemFrota=homemFrota.filter(x=>String(x.id)!==String(id));gravarLocal(HF_KEY,homemFrota);renderizarHomemFrota();if(estaOnline()&&db&&!String(id).startsWith('local-hf-')){try{const {error}=await db.from(HF_TABLE).delete().eq('id',id);if(error)throw error}catch(e){console.warn('Não foi possível excluir Homem × Frota na nuvem.',e)}}}
async function carregarHomemFrotaNuvem(){if(!db||!estaOnline()){homemFrota=lerLocal(HF_KEY,[]);renderizarHomemFrota();return false}try{const {data,error}=await db.from(HF_TABLE).select('*').order('area',{ascending:true});if(error)throw error;hfNuvemDisponivel=true;const nuvem=(data||[]).map(hfNormalizar);const locais=lerLocal(HF_KEY,[]);homemFrota=nuvem.length?nuvem:(Array.isArray(locais)?locais:[]);gravarLocal(HF_KEY,homemFrota);renderizarHomemFrota();return true}catch(e){hfNuvemDisponivel=false;homemFrota=lerLocal(HF_KEY,[]);renderizarHomemFrota();console.warn('Tabela Homem × Frota ainda não disponível na nuvem.',e);return false}}
function hfLerPlanilha(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''});resolve(rows)}catch(err){reject(err)}};reader.onerror=reject;reader.readAsArrayBuffer(file)})}
function hfCampo(row,nomes){const entradas=Object.entries(row||{});for(const nome of nomes){const alvo=normalizarTexto(nome).replace(/[^a-z0-9]/g,'');const achou=entradas.find(([k])=>normalizarTexto(k).replace(/[^a-z0-9]/g,'')===alvo);if(achou)return achou[1]}return''}
async function hfImportar(){if(!exigirPermissao('homem_frota_importar','Você não possui permissão para importar o Homem × Frota.'))return;const file=$('planilhaHF')?.files?.[0],st=$('hfStatusImportacao');if(!file){st.textContent='Selecione uma planilha.';return}try{st.textContent='Lendo planilha...';const rows=await hfLerPlanilha(file);let novos=0,atualizados=0,ignorados=0;for(const row of rows){const p=hfNormalizar({area:hfCampo(row,['Área','Area']),matricula:hfCampo(row,['Matrícula','Matricula']),nome_completo:hfCampo(row,['Nome completo','Nome','Colaborador']),funcao:hfCampo(row,['Função','Funcao']),equipamento:hfCampo(row,['Equipamento','TAG','Tag'])});if(!p.area||!p.funcao||!p.equipamento){ignorados++;continue}if(p.matricula){const col=colaboradores.find(x=>String(x.matricula||'').trim()===String(p.matricula).trim());if(!col){ignorados++;continue}p.nome_completo=col.nome_completo||col.nome_exibicao||''}else p.nome_completo='';const i=homemFrota.findIndex(x=>hfChave(x)===hfChave(p));if(i>=0){p.id=homemFrota[i].id;p.observacao=homemFrota[i].observacao||'';homemFrota[i]=p;atualizados++}else{homemFrota.push(p);novos++}}
    gravarLocal(HF_KEY,homemFrota);renderizarHomemFrota();
    if(estaOnline()&&db){try{const payload=homemFrota.map(p=>({area:p.area,matricula:p.matricula||null,nome_completo:p.nome_completo||null,funcao:p.funcao,equipamento:p.equipamento,observacao:p.observacao||null,updated_at:new Date().toISOString()}));const {error}=await db.from(HF_TABLE).upsert(payload,{onConflict:'area,funcao,equipamento'});if(error)throw error;hfNuvemDisponivel=true;await carregarHomemFrotaNuvem()}catch(e){hfNuvemDisponivel=false;console.warn(e)}}
    st.textContent=`Importação concluída: ${novos} nova(s), ${atualizados} atualizada(s)${ignorados?` e ${ignorados} ignorada(s) por falta de Área/Função/Equipamento`:''}.`;
  }catch(e){console.error(e);st.textContent='Não foi possível importar a planilha.'}}
function hfExportar(){if(!exigirPermissao('homem_frota_exportar'))return;const data=$('dataPainel')?.value||hoje();const rows=homemFrota.map(p=>{const a=hfAusencia(p,data);return {'Área':p.area,'Matrícula':p.matricula||'','Nome completo':hfNomeAtual(p)||'','Função':p.funcao,'Equipamento':p.equipamento,'Situação':a.status==='DISPONIVEL'?'Disponível':a.status==='AUSENTE'?`Ausente - ${a.motivo}`:'Pendente - Sem profissional','Observação':p.observacao||''}});const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Homem x Frota');XLSX.writeFile(wb,`Homem_x_Frota_${data}.xlsx`)}

function atualizarTudo(){atualizarDashboard();renderizarRegistros();preencherSelectColaboradores();preencherSelectFerias();renderizarColaboradores();renderizarProgramacaoFerias();renderizarEscala();renderizarHomemFrota();gerarMensagem();if(usuarioAtual)aplicarPermissoes()}


const PERMISSOES_MATRIZ_V2='matriz_permissoes_v2';
function permissoesEfetivas(usuario=usuarioAtual){
  if(!usuario)return[];
  const base=new Set(Array.isArray(usuario.permissoes)?usuario.permissoes:[]);
  // Compatibilidade com usuários gravados antes da matriz completa de permissões.
  if(!base.has(PERMISSOES_MATRIZ_V2)){
    if(base.has('ocorrencias_editar'))base.add('registros_editar');
    if(base.has('ocorrencias_excluir'))base.add('registros_excluir');
    if(base.has('colaboradores_cadastrar'))base.add('colaboradores_editar');
    if(base.has('colaboradores_ver'))base.add('colaboradores_exportar');
    if(base.has('homem_frota_adicionar')&&base.has('homem_frota_editar'))base.add('homem_frota_importar');
    if(base.has('homem_frota_ver'))base.add('homem_frota_exportar');
    if(base.has('ferias_cadastrar'))base.add('ferias_editar');
    if(base.has('registros_exportar'))base.add('ferias_exportar');
  }
  return Array.from(base);
}
function temPermissao(codigo){return Boolean(usuarioAtual&&(usuarioAtual.administrador||permissoesEfetivas().includes(codigo)))}
function exigirPermissao(codigo,mensagem='Você não possui permissão para esta ação.'){if(temPermissao(codigo))return true;alert(mensagem);return false}
function permissoesSelecionadas(){const lista=Array.from(document.querySelectorAll('#permissoesUsuario input:checked')).map(x=>x.value);if(!lista.includes(PERMISSOES_MATRIZ_V2))lista.push(PERMISSOES_MATRIZ_V2);return lista}
const PERFIS_USUARIO={
  lideranca:['dashboard_ver','escala_ver','homem_frota_ver','homem_frota_exportar','ocorrencias_cadastrar','ocorrencias_editar','ocorrencias_fotos','registros_ver','registros_editar','whatsapp_gerar','colaboradores_ver','colaboradores_exportar','ferias_ver'],
  rh:['dashboard_ver','escala_ver','homem_frota_ver','homem_frota_exportar','ocorrencias_cadastrar','ocorrencias_editar','ocorrencias_fotos','registros_ver','registros_editar','registros_exportar','whatsapp_gerar','colaboradores_ver','colaboradores_cadastrar','colaboradores_editar','colaboradores_importar','colaboradores_exportar','ferias_ver','ferias_cadastrar','ferias_editar','ferias_importar','ferias_aprovar','ferias_exportar']
};
function abrirEditorUsuario(modo='novo'){
  const editor=$('usuarioEditor'),backdrop=$('usuarioEditorBackdrop');if(!editor)return;
  editor.classList.add('open');editor.setAttribute('aria-hidden','false');backdrop?.classList.add('open');backdrop?.setAttribute('aria-hidden','false');document.body.classList.add('user-editor-open');
  $('usuarioEditorTitulo').textContent=modo==='editar'?'Editar usuário':'Novo usuário';$('usuarioEditorSubtitulo').textContent=modo==='editar'?'Revise o perfil e as permissões deste acesso.':'Defina um perfil ou personalize o acesso.';
  setTimeout(()=>$('novoUsuarioNome')?.focus({preventScroll:true}),80)
}
function fecharEditorUsuario(){const editor=$('usuarioEditor'),backdrop=$('usuarioEditorBackdrop');editor?.classList.remove('open');editor?.setAttribute('aria-hidden','true');backdrop?.classList.remove('open');backdrop?.setAttribute('aria-hidden','true');document.body.classList.remove('user-editor-open')}
function limparFormularioUsuario(fechar=false){editandoUsuarioId=null;['novoUsuarioNome','novoUsuarioLogin','novoUsuarioSenha'].forEach(id=>$(id).value='');$('novoUsuarioAdmin').checked=false;document.querySelectorAll('#permissoesUsuario input').forEach(x=>{x.checked=false;x.disabled=false});$('perfilAcessoUsuario').value='personalizado';$('btnCriarUsuario').textContent='Criar usuário';if(fechar)fecharEditorUsuario()}
function aplicarPerfilUsuario(perfil){
  const admin=perfil==='administrador';$('novoUsuarioAdmin').checked=admin;
  const selecionadas=new Set(PERFIS_USUARIO[perfil]||[]);document.querySelectorAll('#permissoesUsuario input').forEach(x=>{if(perfil!=='personalizado')x.checked=selecionadas.has(x.value);x.disabled=admin});
}
function inferirPerfilUsuario(u){if(u.administrador)return'Administrador';const p=new Set(permissoesEfetivas(u).filter(x=>x!==PERMISSOES_MATRIZ_V2));const igual=a=>p.size===a.length&&a.every(x=>p.has(x));if(igual(PERFIS_USUARIO.rh))return'RH';if(igual(PERFIS_USUARIO.lideranca))return'Liderança';return'Personalizado'}
function siglaUsuario(nome=''){return nome.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'U'}
function aplicarPermissoes(){
  const mapaPaginas={dashboard:'dashboard_ver',ocorrencias:'ocorrencias_cadastrar',colaboradores:'colaboradores_ver',homemfrota:'homem_frota_ver',escala:'escala_ver',ferias:'ferias_ver',registros:'registros_ver',mensagem:'whatsapp_gerar',configuracoes:'configuracoes_ver',usuarios:'usuarios_gerenciar'};
  document.querySelectorAll('.nav-item').forEach(b=>{const p=mapaPaginas[b.dataset.page];b.classList.toggle('hidden',p&&!temPermissao(p))});
  const mapa={btnSalvar:'ocorrencias_cadastrar',foto:'ocorrencias_fotos',btnRemoverFoto:'ocorrencias_fotos',btnNovoColaboradorEfetivo:'colaboradores_cadastrar',btnAdicionarColaborador:'colaboradores_cadastrar',btnAbrirImportacaoEfetivo:'colaboradores_importar',btnImportarColaboradores:'colaboradores_importar',planilhaColaboradores:'colaboradores_importar',btnExportarEfetivo:'colaboradores_exportar',btnCopiarEfetivo:'colaboradores_exportar',btnSalvarFerias:'ferias_cadastrar',btnNovaProgramacaoFerias:'ferias_cadastrar',btnImportarFerias:'ferias_importar',planilhaFerias:'ferias_importar',btnExportarExcel:'registros_exportar',btnExportarExcelRegistros:'registros_exportar',btnExportarFeriasExcel:'ferias_exportar',btnLimparTudo:'registros_limpar',btnGerar:'whatsapp_gerar',btnCopiar:'whatsapp_gerar',btnWhatsApp:'whatsapp_gerar',btnSalvarConfig:'configuracoes_alterar',btnGerenciarPeriodos:'configuracoes_alterar',btnExportar:'backup_gerenciar',btnExportarRapido:'backup_gerenciar',arquivoBackup:'backup_gerenciar',btnNovaPosicaoHF:'homem_frota_adicionar'};
  Object.entries(mapa).forEach(([id,p])=>{const el=$(id);if(el)el.classList.toggle('hidden',!temPermissao(p))});
  if(!temPermissao('colaboradores_importar'))painelEfetivo('importacao',false);
  if(!temPermissao('colaboradores_cadastrar')&&!editandoEfetivoId)painelEfetivo('cadastro',false);
  const podeImportarHF=temPermissao('homem_frota_importar');
  $('btnAbrirImportacaoHF')?.classList.toggle('hidden',!podeImportarHF);$('btnImportarHF')?.classList.toggle('hidden',!podeImportarHF);$('planilhaHF')?.classList.toggle('hidden',!podeImportarHF);$('btnExportarHF')?.classList.toggle('hidden',!temPermissao('homem_frota_exportar'));
  document.querySelectorAll('[data-link-hf]').forEach(x=>x.classList.toggle('hidden',!temPermissao('homem_frota_vincular')));
  document.querySelectorAll('[data-unlink-hf]').forEach(x=>x.classList.toggle('hidden',!temPermissao('homem_frota_desvincular')));
  document.querySelectorAll('[data-edit-hf]').forEach(x=>x.classList.toggle('hidden',!temPermissao('homem_frota_editar')));
  document.querySelectorAll('[data-delete-hf]').forEach(x=>x.classList.toggle('hidden',!temPermissao('homem_frota_excluir')));
  document.querySelectorAll('[data-delete-colaborador]').forEach(x=>x.classList.toggle('hidden',!temPermissao('colaboradores_excluir')));
  document.querySelectorAll('#listaRegistros [data-edit]').forEach(x=>x.classList.toggle('hidden',!temPermissao('registros_editar')));
  document.querySelectorAll('#listaRegistros [data-delete]').forEach(x=>x.classList.toggle('hidden',!temPermissao('registros_excluir')));
  document.querySelectorAll('[data-edit-colaborador]').forEach(x=>x.classList.toggle('hidden',!temPermissao('colaboradores_editar')));
  document.querySelectorAll('[data-start-vacation],[data-adjust-cycle]').forEach(x=>x.classList.toggle('hidden',!temPermissao('ferias_cadastrar')));
  document.querySelectorAll('[data-edit-vacation],[data-reschedule-vacation],[data-cancel-vacation]').forEach(x=>x.classList.toggle('hidden',!temPermissao('ferias_editar')));
  document.querySelectorAll('[data-approve-vacation],[data-reject-vacation]').forEach(x=>x.classList.toggle('hidden',!temPermissao('ferias_aprovar')));
  $('usuarioConectado').querySelector('strong').textContent=usuarioAtual?.nome||'—';$('cloudUser').textContent='';const painelCat=$('gestaoCategoriasRH');if(painelCat)painelCat.classList.toggle('hidden',!usuarioAtual?.administrador);renderizarGestaoCategorias();
}
function alternarVisibilidadeSenha(){const input=$('loginSenha'),btn=$('btnVerSenhaLogin');const mostrar=input.type==='password';input.type=mostrar?'text':'password';btn.textContent=mostrar?'🙈':'👁';btn.setAttribute('aria-label',mostrar?'Ocultar senha':'Mostrar senha');btn.title=mostrar?'Ocultar senha':'Mostrar senha';input.focus()}
let autenticando=false;
function comTimeout(promise,ms,mensagem){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(mensagem)),ms)})]).finally(()=>clearTimeout(timer))}
async function chamarRpcRapido(funcao,parametros,timeoutMs=5000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const resposta=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcao}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`},
      body:JSON.stringify(parametros),
      signal:controller.signal,
      cache:'no-store'
    });
    let dados=null;const texto=await resposta.text();
    if(texto){try{dados=JSON.parse(texto)}catch{dados=texto}}
    if(!resposta.ok){const msg=dados?.message||dados?.error_description||dados?.hint||`Falha de acesso (${resposta.status}).`;throw new Error(msg)}
    return dados;
  }catch(e){
    if(e.name==='AbortError')throw new Error('O servidor demorou para responder. Tente novamente.');
    throw e;
  }finally{clearTimeout(timer)}
}
async function carregarDepoisDoLogin(){statusNuvem(estaOnline()?'Carregando dados...':'Modo offline');try{if(estaOnline()){iniciarRealtime();await sincronizarFilaOffline();await carregarNuvem();await carregarHomemFrotaNuvem()}else carregarCacheOffline();if(estaOnline()&&temPermissao('usuarios_gerenciar'))carregarUsuarios().catch(console.error)}catch(e){console.error(e);carregarCacheOffline()}}
async function entrar(){
  if(autenticando)return;
  const login=$('loginUsuario').value.trim(),senha=$('loginSenha').value;
  if(!login||!senha){$('loginStatus').textContent='Informe usuário e senha.';return}
  autenticando=true;$('btnEntrar').disabled=true;$('btnEntrar').textContent='Entrando...';$('loginStatus').textContent='Validando acesso...';
  try{
    if(!estaOnline())throw new Error('SEM_CONEXAO');
    const data=await chamarRpcRapido('xcmg_login',{p_login:login,p_senha:senha},5000);
    if(!data?.token)throw new Error('Usuário ou senha inválidos.');
    localStorage.setItem(LAST_LOGIN_KEY,login);await salvarCredencialOffline(login,senha,data);abrirAplicacaoComUsuario(data,'Acesso liberado.');
  }catch(e){
    console.error(e);
    const offline=await autenticarOffline(login,senha);
    if(offline){localStorage.setItem(LAST_LOGIN_KEY,login);abrirAplicacaoComUsuario(offline,'Acesso offline liberado.');}
    else if(e.message==='SEM_CONEXAO'||e instanceof TypeError||/fetch|network|internet|conexão|abort/i.test(String(e.message||'')))$('loginStatus').textContent='Sem conexão. Entre uma vez online neste aparelho para liberar o acesso offline.';
    else $('loginStatus').textContent=e.message||'Não foi possível entrar.';
  }
  finally{autenticando=false;$('btnEntrar').disabled=false;$('btnEntrar').textContent='Entrar'}
}
async function restaurarSessao(){
  const salvo=lerLocal(AUTH_KEY,null);if(!salvo?.token)return;
  if(!estaOnline()){usuarioAtual=salvo;$('loginScreen').classList.add('hidden');$('appShell').classList.remove('hidden');aplicarPermissoes();carregarCacheOffline();return}
  $('loginStatus').textContent='Verificando sessão salva...';
  try{const data=await chamarRpcRapido('xcmg_validar_sessao',{p_token:salvo.token},3500);if(!data?.token)throw new Error('Sessão expirada');abrirAplicacaoComUsuario(data,'Sessão validada.')}catch(e){
    const falhaRede=e instanceof TypeError||/fetch|network|internet|conexão|demorou|abort/i.test(String(e.message||''));
    if(falhaRede){abrirAplicacaoComUsuario(salvo,'Acesso offline com a sessão salva.');}
    else{localStorage.removeItem(AUTH_KEY);usuarioAtual=null;$('loginStatus').textContent=''}
  }
}
let saindo=false;
async function sair(){
  if(saindo)return;
  if(!confirm('Deseja realmente sair do sistema?'))return;
  saindo=true;
  const token=usuarioAtual?.token||'';
  const botao=$('btnSair');
  if(botao){botao.disabled=true;botao.textContent='Saindo...'}
  usuarioAtual=null;
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.clear();
  $('appShell').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
  $('loginSenha').value='';
  $('loginSenha').type='password';
  $('btnVerSenhaLogin').textContent='👁';
  $('loginStatus').textContent='Sessão encerrada.';
  statusNuvem('Desconectado',true);
  $('cloudUser').textContent='Aguardando login';
  if(token){Promise.race([db.rpc('xcmg_logout',{p_token:token}),new Promise(r=>setTimeout(r,1500))]).catch(()=>{});}
  setTimeout(()=>{if(botao){botao.disabled=false;botao.textContent='↪ Sair'}saindo=false;$('loginUsuario').focus()},0);
}
async function carregarUsuarios(){if(!temPermissao('usuarios_gerenciar'))return;const {data,error}=await db.rpc('xcmg_listar_usuarios',{p_token:usuarioAtual.token});if(error){$('listaUsuarios').innerHTML='<div class="empty">Não foi possível carregar os usuários.</div>';return}const lista=data||[];window.__xcmgUsuarios=lista;
  if($('usuariosResumoTotal'))$('usuariosResumoTotal').textContent=lista.length;if($('usuariosResumoAtivos'))$('usuariosResumoAtivos').textContent=lista.filter(u=>u.ativo).length;if($('usuariosResumoAdmins'))$('usuariosResumoAdmins').textContent=lista.filter(u=>u.administrador&&u.ativo).length;
  $('listaUsuarios').innerHTML=lista.length?lista.map(u=>{const perfil=inferirPerfilUsuario(u),qtd=(u.permissoes||[]).length;return `<div class="user-row user-row-v2"><div class="user-row-main"><div class="user-avatar">${escapar(siglaUsuario(u.nome))}</div><div class="user-row-info"><strong>${escapar(u.nome)}</strong><small>Login: ${escapar(u.login)}</small><div class="user-badges"><span class="user-badge profile">${escapar(perfil)}</span><span class="user-badge ${u.ativo?'active':'inactive'}">${u.ativo?'Ativo':'Inativo'}</span>${u.administrador?'':`<span class="user-badge">${qtd} permissão(ões)</span>`}</div></div></div><details class="user-actions-menu"><summary>Ações ▾</summary><div class="user-actions-dropdown"><button class="secondary" data-edit-user="${u.id}">Editar acesso</button><button class="secondary" data-reset-user="${u.id}">Redefinir senha</button><button class="${u.ativo?'danger':'success'}" data-toggle-user="${u.id}" data-active="${u.ativo}">${u.ativo?'Desativar usuário':'Ativar usuário'}</button></div></details></div>`}).join(''):'<div class="empty">Nenhum usuário cadastrado.</div>'}
async function salvarUsuario(){
  if(!exigirPermissao('usuarios_gerenciar'))return;
  const btn=$('btnCriarUsuario'),status=$('statusUsuario');
  const nome=$('novoUsuarioNome').value.trim(),login=$('novoUsuarioLogin').value.trim(),senha=$('novoUsuarioSenha').value,administrador=$('novoUsuarioAdmin').checked,permissoes=permissoesSelecionadas();
  if(!nome||!login){alert('Informe nome e login.');return}
  if(!editandoUsuarioId&&senha.length<6){alert('A senha inicial deve ter pelo menos 6 caracteres.');return}
  const eraEdicao=editandoUsuarioId!==null&&editandoUsuarioId!==undefined&&String(editandoUsuarioId)!=='';
  const textoOriginal=btn?.textContent||'';
  try{
    if(btn){btn.disabled=true;btn.textContent=eraEdicao?'Salvando...':'Criando...'}
    if(status)status.textContent='Salvando permissões...';
    const fn=eraEdicao?'xcmg_atualizar_usuario':'xcmg_criar_usuario';
    const args=eraEdicao?{p_token:usuarioAtual.token,p_id:Number(editandoUsuarioId),p_nome:nome,p_login:login,p_administrador:administrador,p_permissoes:permissoes}:{p_token:usuarioAtual.token,p_nome:nome,p_login:login,p_senha:senha,p_administrador:administrador,p_permissoes:permissoes};
    const {error}=await db.rpc(fn,args);
    if(error)throw error;
    if(status)status.textContent=eraEdicao?'Usuário e permissões atualizados com sucesso.':'Usuário criado com sucesso.';
    await carregarUsuarios();
    setTimeout(()=>{limparFormularioUsuario(true);if(status)status.textContent=''},700);
  }catch(e){
    console.error('Falha ao salvar usuário/permissões:',e);
    if(status)status.textContent='Não foi possível salvar. Verifique a mensagem exibida.';
    alert(`Não foi possível salvar as alterações.\n\n${e?.message||'Falha de conexão ou de gravação no banco de dados.'}`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=eraEdicao?'Salvar alterações':'Criar usuário'}
  }
}
function editarUsuario(id){const u=(window.__xcmgUsuarios||[]).find(x=>String(x.id)===String(id));if(!u)return;editandoUsuarioId=u.id;$('novoUsuarioNome').value=u.nome;$('novoUsuarioLogin').value=u.login;$('novoUsuarioSenha').value='';$('novoUsuarioAdmin').checked=u.administrador;const permissoesAtivas=new Set(permissoesEfetivas(u));document.querySelectorAll('#permissoesUsuario input').forEach(x=>{x.checked=permissoesAtivas.has(x.value);x.disabled=u.administrador});$('perfilAcessoUsuario').value=u.administrador?'administrador':'personalizado';$('btnCriarUsuario').textContent='Salvar alterações';abrirEditorUsuario('editar')}
async function alternarUsuario(id,ativo){const {error}=await db.rpc('xcmg_alterar_status_usuario',{p_token:usuarioAtual.token,p_id:Number(id),p_ativo:!ativo});if(error){alert(error.message);return}await carregarUsuarios()}
async function redefinirSenhaUsuario(id){const senha=prompt('Digite a nova senha (mínimo 6 caracteres):');if(!senha)return;if(senha.length<6){alert('A senha deve ter pelo menos 6 caracteres.');return}const {error}=await db.rpc('xcmg_redefinir_senha_usuario',{p_token:usuarioAtual.token,p_id:Number(id),p_nova_senha:senha});if(error){alert(error.message);return}alert('Senha atualizada com sucesso.')}



// v6.5.9 — barra-resumo mobile fixa. Em vez de prender os elementos originais
// (comportamento inconsistente no Safari/PWA), cria uma camada fixa independente.
let mobileDashboardSummary=null;
function garantirMobileDashboardSummary(){
  if(mobileDashboardSummary) return mobileDashboardSummary;
  const el=document.createElement('div');
  el.className='mobile-dashboard-summary';
  el.setAttribute('aria-hidden','true');
  el.innerHTML=`
    <div class="mds-date">—</div>
    <div class="mds-status">● ONLINE</div>
    <div class="mds-kpis">
      <div class="mds-kpi"><span>EFETIVO</span><strong data-kpi="kpiEfetivo">0</strong></div>
      <div class="mds-kpi" data-kind="disponiveis"><span>DISP.</span><strong data-kpi="kpiDisponiveis">0</strong></div>
      <div class="mds-kpi" data-kind="ferias"><span>FÉRIAS</span><strong data-kpi="kpiFerias">0</strong></div>
      <div class="mds-kpi"><span>ATEST.</span><strong data-kpi="kpiAtestados">0</strong></div>
      <div class="mds-kpi" data-kind="desligamentos"><span>DESLIG.</span><strong data-kpi="kpiDesligamentos">0</strong></div>
      <div class="mds-kpi"><span>FALTAS</span><strong data-kpi="kpiFaltas">0</strong></div>
    </div>`;
  document.body.appendChild(el);
  mobileDashboardSummary=el;
  return el;
}
function atualizarMobileDashboardSummary(){
  const el=garantirMobileDashboardSummary();
  const mobile=window.matchMedia('(max-width:720px)').matches;
  const dashboardAtivo=document.getElementById('dashboard')?.classList.contains('active');
  if(!mobile||!dashboardAtivo){el.classList.remove('is-visible');return;}
  const dataInput=document.getElementById('dataPainel');
  if(dataInput?.value){
    const [y,m,d]=dataInput.value.split('-');
    el.querySelector('.mds-date').textContent=`${d}/${m}/${y}`;
  }
  const cloud=document.getElementById('cloudStatus');
  const st=el.querySelector('.mds-status');
  if(cloud&&st){
    st.textContent=(cloud.textContent||'').replace(/\s+/g,' ').trim();
    st.className='mds-status '+(cloud.className||'');
  }
  el.querySelectorAll('[data-kpi]').forEach(n=>{
    const src=document.getElementById(n.dataset.kpi);
    if(src)n.textContent=src.textContent;
  });
  const metrics=document.querySelector('#dashboard .metrics');
  const limiar=metrics ? metrics.getBoundingClientRect().bottom : 180;
  const show=false; // v6.5.10: o bloco original fica congelado; resumo substituto desativado
  el.classList.toggle('is-visible',show);
  el.setAttribute('aria-hidden',show?'false':'true');
}
let mobileSummaryRaf=0;
function agendarMobileDashboardSummary(){
  if(mobileSummaryRaf)return;
  mobileSummaryRaf=requestAnimationFrame(()=>{mobileSummaryRaf=0;atualizarMobileDashboardSummary()});
}
window.addEventListener('scroll',agendarMobileDashboardSummary,{passive:true});
window.addEventListener('resize',agendarMobileDashboardSummary,{passive:true});

function atualizarStickyMobileDashboard(){
  const mobile=window.matchMedia('(max-width:720px)').matches;
  const dashboardAtivo=document.getElementById('dashboard')?.classList.contains('active');
  const registrosPaginaAtiva=!!document.getElementById('registros')?.classList.contains('active');
  const ativo=!!(mobile&&dashboardAtivo);

  // v6.5.52: Registros desktop sem deslocamento horizontal residual.
  // A classe existe apenas enquanto a página Registros está aberta no computador.
  const registrosDesktopAtivo=!!(!mobile&&registrosPaginaAtiva);
  document.body.classList.toggle('records-desktop-active',registrosDesktopAtivo);
  if(registrosDesktopAtivo){
    document.documentElement.scrollLeft=0;
    document.body.scrollLeft=0;
  }

  // v6.5.8: em iPhone/PWA usamos FIXED real. `position: sticky` pode falhar
  // conforme o contêiner de rolagem/browser. Aqui o topo e os KPIs ficam presos
  // ao viewport e o espaço ocupado é compensado no fluxo da página.
  document.body.classList.remove('dashboard-sticky-mobile','dashboard-sticky-compact');
  document.body.classList.toggle('dashboard-fixed-mobile',ativo);

  const registrosAtivo=!!(mobile&&registrosPaginaAtiva);
  document.body.classList.toggle('records-fixed-mobile',registrosAtivo);

  if(!ativo){
    document.body.style.removeProperty('--dashboard-fixed-topbar-h');
    document.body.style.removeProperty('--dashboard-fixed-metrics-h');
  }

  if(registrosAtivo){
    requestAnimationFrame(()=>{
      const topbar=document.querySelector('.topbar');
      if(topbar) document.body.style.setProperty('--records-fixed-topbar-h',`${Math.ceil(topbar.getBoundingClientRect().height)}px`);
    });
  }else{
    document.body.style.removeProperty('--records-fixed-topbar-h');
  }

  if(!ativo) return;

  requestAnimationFrame(()=>{
    const topbar=document.querySelector('.topbar');
    const metrics=document.querySelector('#dashboard .metrics');
    if(topbar){
      const h=Math.ceil(topbar.getBoundingClientRect().height);
      document.body.style.setProperty('--dashboard-fixed-topbar-h',`${h}px`);
    }
    if(metrics){
      const h=Math.ceil(metrics.getBoundingClientRect().height);
      document.body.style.setProperty('--dashboard-fixed-metrics-h',`${h}px`);
    }
  });
}
let stickyMobileRaf=0;
function agendarStickyMobileDashboard(){
  if(stickyMobileRaf)return;
  stickyMobileRaf=requestAnimationFrame(()=>{stickyMobileRaf=0;atualizarStickyMobileDashboard()});
}
window.addEventListener('resize',agendarStickyMobileDashboard,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(atualizarStickyMobileDashboard,120),{passive:true});
$('btnEscalaAnterior')?.addEventListener('click',()=>moverMesEscala(-1));$('btnEscalaProximo')?.addEventListener('click',()=>moverMesEscala(1));$('btnEscalaHoje')?.addEventListener('click',irHojeEscala);$('filtroTurmaEscala')?.addEventListener('change',renderizarEscala);$('escalaCalendario')?.addEventListener('click',e=>{const dia=e.target.closest('.schedule-day');if(dia)atualizarResumoEscala(dia.dataset.date)});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{abrirPagina(b.dataset.page);requestAnimationFrame(()=>{atualizarStickyMobileDashboard();atualizarMobileDashboardSummary()})}));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{abrirPagina(b.dataset.go);requestAnimationFrame(()=>{atualizarStickyMobileDashboard();atualizarMobileDashboardSummary()})}));
$('nome').addEventListener('change',preencherDadosColaborador);$('foto').addEventListener('change',()=>{const f=$('foto').files[0];removerFotoAtual=false;if(!f){mostrarFoto(fotoAtual.url);return}if(!f.type.startsWith('image/')||f.size>5*1024*1024){alert('Selecione uma imagem de até 5 MB.');$('foto').value='';mostrarFoto(fotoAtual.url);return}mostrarFoto(URL.createObjectURL(f))});$('btnRemoverFoto').addEventListener('click',()=>{removerFotoAtual=true;$('foto').value='';mostrarFoto('')});
carregarCategoriasLocais();atualizarSelectCategorias();$('categoriaMotivo').addEventListener('change',()=>{$('motivo').value='';atualizarListaMotivos();sincronizarTipoComMotivo()});$('motivo').addEventListener('input',sincronizarTipoComMotivo);$('motivo').addEventListener('change',()=>{sincronizarTipoComMotivo();salvarMotivoPersonalizado($('motivo').value)});$('btnAdicionarColaborador').addEventListener('click',adicionarColaborador);$('novoColaboradorNome').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();adicionarColaborador()}});$('btnImportarColaboradores').addEventListener('click',importarColaboradores);$('btnImportarFerias')?.addEventListener('click',importarFerias);$('btnExportarFeriasExcel')?.addEventListener('click',exportarFeriasExcel);$('planilhaFerias')?.addEventListener('change',e=>{const st=$('statusImportacaoFerias');if(st)st.textContent=e.target.files?.[0]?`Arquivo selecionado: ${e.target.files[0].name}. Clique em Importar férias.`:''});$('pesquisaProgramacaoFerias')?.addEventListener('input',renderizarProgramacaoFerias);$('filtroStatusFerias')?.addEventListener('change',renderizarProgramacaoFerias);$('pesquisaColaborador').addEventListener('input',renderizarColaboradores);$('listaColaboradores').addEventListener('click',e=>{const id=e.target.dataset.deleteColaborador;if(id&&exigirPermissao('colaboradores_excluir'))excluirColaborador(id)});$('btnVerTodos').addEventListener('click',()=>abrirPagina('registros'));$('btnExportarRapido').addEventListener('click',exportar);$('inicio').addEventListener('change',()=>{if($('dias').value)atualizarPeriodoPorDias();else if($('fim').value)atualizarDiasPorPeriodo()});$('dias').addEventListener('input',()=>{const v=Number.parseInt($('dias').value,10);if($('dias').value&&(!Number.isInteger(v)||v<1)){$('dias').value='';return}atualizarPeriodoPorDias()});$('fim').addEventListener('change',atualizarDiasPorPeriodo);$('btnSalvar').addEventListener('click',salvarRegistro);$('btnCancelar').addEventListener('click',limparForm);$('btnSalvarConfig').addEventListener('click',salvarConfig);$('btnGerenciarPeriodos').addEventListener('click',abrirGestaoPeriodos);$('btnFecharPeriodos').addEventListener('click',fecharGestaoPeriodos);$('btnSalvarPeriodo').addEventListener('click',salvarPeriodoFechamento);$('btnCancelarPeriodo').addEventListener('click',cancelarEdicaoPeriodo);$('listaPeriodos').addEventListener('click',e=>{const ed=e.target.dataset.editPeriodo,del=e.target.dataset.deletePeriodo;if(ed)editarPeriodoFechamento(ed);if(del)excluirPeriodoFechamento(del)});$('modalPeriodos').addEventListener('click',e=>{if(e.target===$('modalPeriodos'))fecharGestaoPeriodos()});$('btnGerar').addEventListener('click',gerarMensagem);$('btnCopiar').addEventListener('click',async()=>{const t=gerarMensagem();try{await navigator.clipboard.writeText(t)}catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}$('statusMensagem').textContent='Mensagem copiada com sucesso.';setTimeout(()=>$('statusMensagem').textContent='',2500)});$('btnWhatsApp').addEventListener('click',()=>window.open('https://wa.me/?text='+encodeURIComponent(gerarMensagem()),'_blank'));$('btnExportarExcel')?.addEventListener('click',gerarPlanilhaExcel);$('btnModoPrint').addEventListener('click',()=>{document.body.classList.toggle('records-print-mode');$('btnModoPrint').textContent=document.body.classList.contains('records-print-mode')?'✕ Sair do Print':'📷 Modo Print'});$('btnExportarExcelRegistros').addEventListener('click',gerarPlanilhaExcel);$('btnLimparTudo').addEventListener('click',async()=>{if(!exigirPermissao('registros_limpar'))return;if(confirm('Deseja apagar todos os registros?')){const {error}=await db.from('xcmg_registros').delete().neq('id',0);if(error)alert('Não foi possível apagar os registros.');else await carregarNuvem(true)}});document.querySelectorAll('[data-occurrence-view]').forEach(btn=>btn.addEventListener('click',()=>selecionarVisualizacaoOcorrencias(btn.dataset.occurrenceView||'dia')));$('dataPainel').addEventListener('change',()=>{atualizarTudo();agendarMobileDashboardSummary()});$('mostrarTodosRegistros').checked=localStorage.getItem(VIEW_KEY)!=='0';$('mostrarTodosRegistros').addEventListener('change',()=>{localStorage.setItem(VIEW_KEY,$('mostrarTodosRegistros').checked?'1':'0');renderizarRegistros()});$('pesquisa').addEventListener('input',renderizarRegistros);$('filtroTipo').addEventListener('change',renderizarRegistros);$('filtroLocal').addEventListener('change',renderizarRegistros);$('filtroPeriodo').addEventListener('change',renderizarRegistros);$('listaRegistros').addEventListener('click',e=>{const ed=e.target.dataset.edit,del=e.target.dataset.delete;if(ed&&exigirPermissao('registros_editar'))editar(ed);if(del&&exigirPermissao('registros_excluir'))excluir(del)});$('btnExportar').addEventListener('click',exportar);$('arquivoBackup').addEventListener('change',e=>{if(e.target.files[0])importar(e.target.files[0]);e.target.value=''});
$('btnNovoColaboradorEfetivo')?.addEventListener('click',()=>{if(editandoEfetivoId)limparFormEfetivo();alternarPainelEfetivo('cadastro');});
$('btnAbrirImportacaoEfetivo')?.addEventListener('click',()=>{if(!exigirPermissao('colaboradores_importar'))return;alternarPainelEfetivo('importacao')});
$('btnCancelarEdicaoEfetivo')?.addEventListener('click',()=>{limparFormEfetivo();painelEfetivo('cadastro',false)});
$('btnFecharCadastroEfetivo')?.addEventListener('click',()=>{if(editandoEfetivoId)limparFormEfetivo();painelEfetivo('cadastro',false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('effectiveCadastroBox')?.classList.contains('effective-edit-drawer')){limparFormEfetivo();painelEfetivo('cadastro',false)}});
['filtroEfetivoArea','filtroEfetivoTurma','filtroEfetivoStatus'].forEach(id=>$(id)?.addEventListener('change',renderizarColaboradores));
$('btnCopiarEfetivo')?.addEventListener('click',copiarTabelaEfetivo);$('btnExportarEfetivo')?.addEventListener('click',exportarEfetivoExcel);
$('listaColaboradores')?.addEventListener('click',e=>{const editarId=e.target.dataset.editColaborador,historicoId=e.target.dataset.historyColaborador;if(editarId&&exigirPermissao('colaboradores_editar'))editarColaboradorEfetivo(editarId);if(historicoId)abrirHistoricoEfetivo(historicoId);if(editarId||historicoId)e.target.closest('details')?.removeAttribute('open')});
$('btnFecharHistoricoEfetivo')?.addEventListener('click',()=>$('modalHistoricoEfetivo').classList.add('hidden'));$('modalHistoricoEfetivo')?.addEventListener('click',e=>{if(e.target===$('modalHistoricoEfetivo'))e.currentTarget.classList.add('hidden')});
$('novoColaboradorCpf')?.addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')});
$('feriasColaborador')?.addEventListener('change',preencherDadosFerias);
$('feriasInicio')?.addEventListener('change',calcularDatasFerias);$('feriasDias')?.addEventListener('change',calcularDatasFerias);
$('btnSalvarFerias')?.addEventListener('click',salvarFeriasManual);$('btnCancelarFerias')?.addEventListener('click',limparFormFerias);
$('listaProgramacaoFerias')?.addEventListener('click',e=>{const aprovar=e.target.dataset.approveVacation,rejeitar=e.target.dataset.rejectVacation,cancelar=e.target.dataset.cancelVacation,editarFerias=e.target.dataset.editVacation,detalhes=e.target.dataset.vacationDetails;const executar=(promessa)=>Promise.resolve(promessa).catch(err=>{console.error('Falha na ação de férias:',err);alert(`Não foi possível concluir a ação de férias. ${err?.message||''}`)});if(aprovar)executar(alterarStatusFerias(aprovar,'APROVADO'));if(rejeitar)executar(alterarStatusFerias(rejeitar,'NÃO APROVADO'));if(cancelar)executar(alterarStatusFerias(cancelar,'CANCELADO'));if(editarFerias)editarProgramacaoFerias(editarFerias);if(detalhes){const row=document.querySelector(`[data-vacation-detail-row="${CSS.escape(detalhes)}"]`);if(row){row.classList.toggle('hidden');e.target.textContent=row.classList.contains('hidden')?'Detalhes':'Fechar'}}});
$('listaPendenciasFerias')?.addEventListener('click',e=>{const editar=e.target.dataset.editVacation;if(editar){editarProgramacaoFerias(editar);return}const id=e.target.dataset.startVacation;if(id){iniciarProgramacaoColaborador(id,e.target.dataset.cycleIndex);return}const ajuste=e.target.dataset.adjustCycle;if(ajuste)ajustarPeriodoAquisitivo(ajuste)});
$('pesquisaPendenciasFerias')?.addEventListener('input',renderizarPendenciasFerias);
$('filtroPendenciasFerias')?.addEventListener('change',renderizarPendenciasFerias);
$('btnNovaPosicaoHF')?.addEventListener('click',()=>hfAbrirEditor());
$('btnAbrirImportacaoHF')?.addEventListener('click',()=>{if(!exigirPermissao('homem_frota_importar'))return;$('hfImportBox')?.classList.toggle('hidden');$('hfEditorBox')?.classList.add('hidden')});
$('btnFecharImportacaoHF')?.addEventListener('click',()=>$('hfImportBox')?.classList.add('hidden'));
$('btnFecharEditorHF')?.addEventListener('click',hfFecharEditor);$('btnCancelarHF')?.addEventListener('click',hfFecharEditor);$('btnSalvarHF')?.addEventListener('click',hfSalvar);
$('btnFecharVinculoHF')?.addEventListener('click',hfFecharVinculo);$('btnCancelarVinculoHF')?.addEventListener('click',hfFecharVinculo);$('btnSalvarVinculoHF')?.addEventListener('click',hfSalvarVinculo);$('hfVinculoProfissional')?.addEventListener('change',hfAtualizarDetalhesVinculo);
$('hfMatricula')?.addEventListener('change',hfSincronizarNomePorMatricula);$('hfMatricula')?.addEventListener('blur',hfSincronizarNomePorMatricula);
$('btnImportarHF')?.addEventListener('click',hfImportar);$('btnExportarHF')?.addEventListener('click',hfExportar);
$('hfPesquisa')?.addEventListener('input',renderizarHomemFrota);$('hfFiltroArea')?.addEventListener('change',renderizarHomemFrota);$('hfFiltroStatus')?.addEventListener('change',renderizarHomemFrota);
$('hfLista')?.addEventListener('click',e=>{const ed=e.target.dataset.editHf,del=e.target.dataset.deleteHf,unlink=e.target.dataset.unlinkHf,link=e.target.dataset.linkHf;if(unlink)hfDesvincular(unlink);if(link)hfAbrirVinculo(link);if(ed)hfAbrirEditor(ed);if(del)hfExcluir(del);if(ed||del||unlink||link)e.target.closest('details')?.removeAttribute('open')});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstalacao=e;$('btnInstalar').classList.remove('hidden')});$('btnInstalar').addEventListener('click',async()=>{if(!promptInstalacao)return;promptInstalacao.prompt();await promptInstalacao.userChoice;promptInstalacao=null;$('btnInstalar').classList.add('hidden')});if(location.protocol.startsWith('http')&&'serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
$('btnTema').addEventListener('click',alternarTema);aplicarTema(document.documentElement.dataset.theme||'dark');
$('btnAdicionarCategoria')?.addEventListener('click',adicionarCategoria);$('listaCategoriasAdmin')?.addEventListener('click',acaoCategoriaAdmin);$('btnEntrar').addEventListener('click',entrar);$('btnVerSenhaLogin').addEventListener('click',alternarVisibilidadeSenha);['loginUsuario','loginSenha'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')entrar()}));$('loginUsuario').value=localStorage.getItem(LAST_LOGIN_KEY)||'';if($('loginUsuario').value)$('loginSenha').focus();else $('loginUsuario').focus();$('btnSair').addEventListener('click',sair);$('btnCriarUsuario').addEventListener('click',salvarUsuario);$('btnNovoUsuario')?.addEventListener('click',()=>{limparFormularioUsuario(false);abrirEditorUsuario('novo')});$('btnFecharUsuarioEditor')?.addEventListener('click',()=>{limparFormularioUsuario(false);fecharEditorUsuario()});$('btnCancelarUsuario')?.addEventListener('click',()=>{limparFormularioUsuario(false);fecharEditorUsuario()});$('usuarioEditorBackdrop')?.addEventListener('click',()=>{limparFormularioUsuario(false);fecharEditorUsuario()});$('perfilAcessoUsuario')?.addEventListener('change',e=>aplicarPerfilUsuario(e.target.value));$('novoUsuarioAdmin').addEventListener('change',()=>{const admin=$('novoUsuarioAdmin').checked;document.querySelectorAll('#permissoesUsuario input').forEach(x=>x.disabled=admin);if(admin)$('perfilAcessoUsuario').value='administrador';else if($('perfilAcessoUsuario').value==='administrador')$('perfilAcessoUsuario').value='personalizado'});$('listaUsuarios').addEventListener('click',e=>{const ed=e.target.dataset.editUser,rs=e.target.dataset.resetUser,tg=e.target.dataset.toggleUser;if(ed)editarUsuario(ed);if(rs)redefinirSenhaUsuario(rs);if(tg)alternarUsuario(tg,e.target.dataset.active==='true');if(ed||rs||tg)e.target.closest('details')?.removeAttribute('open')});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('usuarioEditor')?.classList.contains('open')){limparFormularioUsuario(false);fecharEditorUsuario()}});$('dataPainel').value=hoje();window.addEventListener('offline',()=>{conexaoReal=false;statusNuvem(`Offline • ${filaOffline().length} alteração(ões) pendente(s)`,true)});window.addEventListener('online',async()=>{statusNuvem('Verificando conexão...');if(await verificarConexaoReal()){statusNuvem('Internet restabelecida. Sincronizando...');sincronizarFilaOffline().catch(console.error)}});setInterval(()=>verificarConexaoReal().catch(()=>{}),4000);verificarConexaoReal().catch(()=>{});restaurarSessao();atualizarStickyMobileDashboard();atualizarMobileDashboardSummary();
// Evita ciclo infinito: aplicarPermissoes altera textos e isso também gera mutações.
const observerPermissoes=new MutationObserver(()=>{
  if(!usuarioAtual)return;
  observerPermissoes.disconnect();
  aplicarPermissoes();
  observerPermissoes.observe(document.body,{subtree:true,childList:true});
});
observerPermissoes.observe(document.body,{subtree:true,childList:true});
})();

// v6.10.10 — dropdown próprio para o filtro de status das férias.
// Evita o menu nativo branco/invisível do Edge/Chrome no Windows e mantém
// o <select> original como fonte de valor para toda a lógica existente.
(function iniciarFiltroStatusFeriasCustom(){
  const select=document.getElementById('filtroStatusFerias');
  if(!select || select.dataset.customReady==='1') return;
  select.dataset.customReady='1';
  select.classList.add('vacation-native-select-hidden');

  const root=document.createElement('div');
  root.className='vacation-status-dropdown';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='vacation-status-trigger';
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');
  menu.className='vacation-status-menu';
  menu.setAttribute('role','listbox');

  const atualizar=()=>{
    const opt=select.options[select.selectedIndex] || select.options[0];
    trigger.textContent=opt?.textContent || 'Todos os status';
    [...menu.querySelectorAll('.vacation-status-option')].forEach(btn=>{
      const ativo=btn.dataset.value===select.value;
      btn.classList.toggle('is-selected',ativo);
      btn.setAttribute('aria-selected',ativo?'true':'false');
    });
  };
  const fechar=()=>{
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded','false');
  };
  const abrir=()=>{
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded','true');
    const atual=menu.querySelector('.is-selected') || menu.querySelector('.vacation-status-option');
    requestAnimationFrame(()=>atual?.focus({preventScroll:true}));
  };

  [...select.options].forEach(opt=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='vacation-status-option';
    btn.dataset.value=opt.value;
    btn.textContent=opt.textContent;
    btn.setAttribute('role','option');
    btn.addEventListener('click',()=>{
      select.value=opt.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      atualizar();
      fechar();
      trigger.focus();
    });
    menu.appendChild(btn);
  });

  trigger.addEventListener('click',()=>root.classList.contains('is-open')?fechar():abrir());
  trigger.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown' || e.key==='Enter' || e.key===' '){e.preventDefault();abrir();}
    if(e.key==='Escape'){e.preventDefault();fechar();}
  });
  menu.addEventListener('keydown',e=>{
    const itens=[...menu.querySelectorAll('.vacation-status-option')];
    const i=itens.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){e.preventDefault();(itens[Math.min(i+1,itens.length-1)]||itens[0])?.focus();}
    if(e.key==='ArrowUp'){e.preventDefault();(itens[Math.max(i-1,0)]||itens[0])?.focus();}
    if(e.key==='Escape'){e.preventDefault();fechar();trigger.focus();}
  });
  document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))fechar();});
  select.addEventListener('change',atualizar);

  select.insertAdjacentElement('afterend',root);
  root.append(trigger,menu);
  atualizar();
})();

// v6.10.27 — formulário de férias expansível: a consulta fica como foco principal da tela.
(function(){
  function configurarPainelCadastroFerias(){
    const area=document.getElementById('vacationFormArea');
    const abrir=document.getElementById('btnNovaProgramacaoFerias');
    const fechar=document.getElementById('btnFecharFormFerias');
    if(!area||!abrir||abrir.dataset.boundVacationForm==='1') return;
    abrir.dataset.boundVacationForm='1';
    const mostrar=()=>{area.classList.remove('vacation-edit-drawer');document.body.classList.remove('vacation-drawer-open');area.classList.remove('hidden'); setTimeout(()=>area.scrollIntoView({behavior:'smooth',block:'start'}),20);};
    const ocultar=()=>{area.classList.remove('vacation-edit-drawer');document.body.classList.remove('vacation-drawer-open');area.classList.add('hidden');};
    abrir.addEventListener('click',mostrar);
    fechar?.addEventListener('click',ocultar);
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-action="programar-ferias"],.btn-programar-ferias');
      if(b) mostrar();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&area.classList.contains('vacation-edit-drawer')){limparFormFerias();area.classList.add('hidden')}});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',configurarPainelCadastroFerias);
  else configurarPainelCadastroFerias();
})();


/* v6.10.97 — isola o arraste horizontal do menu mobile para não deslocar a página */
(function(){
  function instalarArrasteMenuMobile(){
    var nav=document.querySelector('.sidebar nav');
    if(!nav || nav.dataset.dragIsolado==='1') return;
    nav.dataset.dragIsolado='1';
    var startX=0,startY=0,startScroll=0,dragHorizontal=false;
    nav.addEventListener('touchstart',function(e){
      if(window.innerWidth>720 || !e.touches || !e.touches[0]) return;
      var t=e.touches[0];
      startX=t.clientX; startY=t.clientY; startScroll=nav.scrollLeft; dragHorizontal=false;
    },{passive:true});
    nav.addEventListener('touchmove',function(e){
      if(window.innerWidth>720 || !e.touches || !e.touches[0]) return;
      var t=e.touches[0], dx=t.clientX-startX, dy=t.clientY-startY;
      if(!dragHorizontal && Math.abs(dx)>6 && Math.abs(dx)>Math.abs(dy)) dragHorizontal=true;
      if(dragHorizontal){
        e.preventDefault();
        nav.scrollLeft=startScroll-dx;
      }
    },{passive:false});
    nav.addEventListener('touchend',function(){dragHorizontal=false;},{passive:true});
    nav.addEventListener('touchcancel',function(){dragHorizontal=false;},{passive:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',instalarArrasteMenuMobile);
  else instalarArrasteMenuMobile();
})();
