(function(){
'use strict';
const $=id=>document.getElementById(id);
const SUPABASE_URL='https://exsvzguzgfwuclincgov.supabase.co';
const SUPABASE_KEY='sb_publishable_UhqP2AmVQ2zg7wfllbJSvg_xmiD5sFM';
const REG_KEY='xcmg_registros_v2',CFG_KEY='xcmg_config_v2',COL_KEY='xcmg_colaboradores_cache_v1',FERIAS_KEY='xcmg_programacao_ferias_v1',FERIAS_TABLE='xcmg_programacao_ferias',QUEUE_KEY='xcmg_fila_offline_v1',MIG_KEY='xcmg_supabase_migrado_v41',VIEW_KEY='xcmg_mostrar_todos_registros',MOTIVOS_KEY='xcmg_motivos_rh_v2',CATEGORIAS_KEY='xcmg_categorias_rh_v3';
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
let registros=[],colaboradores=[],programacaoFerias=[],feriasNuvemDisponivel=false,config={...PADRAO},editando=null,promptInstalacao=null,canalRealtime=null,carregando=false,importandoColaboradores=false,fotoAtual={url:'',path:''},removerFotoAtual=false,editandoPeriodoId=null;
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
function salvarCacheLocal(){gravarLocal(REG_KEY,registros);gravarLocal(CFG_KEY,config);gravarLocal(COL_KEY,colaboradores)}
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
function carregarCacheOffline(){registros=lerLocal(REG_KEY,[]);config={...PADRAO,...lerLocal(CFG_KEY,{})};colaboradores=lerLocal(COL_KEY,[]);carregarProgramacaoFeriasLocal();reconstruirProgramacaoFeriasDosRegistros();carregarConfig();atualizarTudo();statusNuvem(`Offline • ${filaOffline().length} alteração(ões) pendente(s)`,true)}
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
function programacoesAtivasNaData(data){
  const ref=dataISOFlex(data);if(!ref)return[];
  return programacaoFerias.map(programacaoComoRegistro).filter(Boolean).filter(r=>{
    const i=dataISOFlex(r.inicio),f=dataISOFlex(r.fim)||i;
    return i&&ref>=i&&ref<=f;
  });
}
function historicoProgramacaoFeriasAte(data){
  const ref=dataISOFlex(data);if(!ref)return[];
  return programacaoFerias.map(programacaoComoRegistro).filter(Boolean).filter(r=>{
    const retorno=dataISOFlex(r.retorno),fim=dataISOFlex(r.fim);
    const marco=retorno|| (fim?dataISOFlex(new Date(new Date(`${fim}T12:00:00`).getTime()+86400000)):'');
    return marco&&ref>=marco;
  });
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
function abrirPagina(nome){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===nome));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===nome));const tit={dashboard:'Dashboard',ocorrencias:editando?'Editar ocorrência':'Ocorrências',colaboradores:'Colaboradores',registros:'Registros',mensagem:'WhatsApp',configuracoes:'Configurações',usuarios:'Usuários'};const sub={dashboard:`Controle de ausências, férias e disponibilidade da ${config.turma||'Turma D'}.`,ocorrencias:'Cadastro e atualização de ocorrências.',colaboradores:'Cadastro e importação da lista de colaboradores.',registros:'Consulta e manutenção dos registros.',mensagem:'Geração de relatório para WhatsApp.',configuracoes:'Preferências e backup do aplicativo.',usuarios:'Cadastro de usuários e permissões individuais.'};$('pageTitle').textContent=tit[nome]||'XCMG Control';$('pageSubtitle').textContent=sub[nome]||'';window.scrollTo({top:0,behavior:'smooth'});setTimeout(atualizarStickyMobileDashboard,80)}
function contar(lista,tipo){return lista.filter(x=>x.tipo===tipo).length}
function diferencaDiasISO(inicio,fim){if(!inicio||!fim)return null;const a=new Date(`${inicio}T12:00:00`),b=new Date(`${fim}T12:00:00`);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return null;return Math.round((b-a)/86400000)}
function diasInclusivosISO(inicio,fim){const d=diferencaDiasISO(inicio,fim);return d===null||d<0?'':d+1}
function somarDiasInclusivosISO(inicio,dias){const qtd=Number.parseInt(dias,10);if(!inicio||!Number.isInteger(qtd)||qtd<1)return'';const d=new Date(`${inicio}T12:00:00`);if(Number.isNaN(d.getTime()))return'';d.setDate(d.getDate()+qtd-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function atualizarPeriodoPorDias(){const inicio=$('inicio')?.value||'',dias=$('dias')?.value||'';if(!inicio||!dias)return;const fim=somarDiasInclusivosISO(inicio,dias);if(fim)$('fim').value=fim}
function atualizarDiasPorPeriodo(){const inicio=$('inicio')?.value||'',fim=$('fim')?.value||'';if(!inicio||!fim){if($('dias'))$('dias').value='';return}const qtd=diasInclusivosISO(inicio,fim);if($('dias'))$('dias').value=qtd||''}
function ehRegistroFerias(r){const campos=[r?.tipo,r?.categoria,r?.motivo,r?.descricao].map(normalizarTexto);return campos.some(v=>v==='ferias'||v.includes('ferias programad'))}
function dataISOFlex(v){if(!v)return'';if(v instanceof Date&&!Number.isNaN(v.getTime())){const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,'0'),d=String(v.getDate()).padStart(2,'0');return `${y}-${m}-${d}`};const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=s.match(/^(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{2,4})$/);if(m){let a=m[3];if(a.length===2)a=`20${a}`;return `${a}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`};return''}
function normalizarProgramacaoFerias(r){if(!r)return null;const inicio=dataISOFlex(r.inicio||r.inicio_ferias||r.data_inicio),fim=dataISOFlex(r.fim||r.fim_ferias||r.data_fim),retorno=dataISOFlex(r.retorno||r.data_retorno);if(!inicio)return null;return{...r,tipo:'Férias',categoria:'Férias',motivo:r.motivo||'Férias',descricao:r.descricao||'Férias programadas',nome_completo:organizarNome(r.nome_completo||r.nome||''),nome:organizarNome(r.nome_completo||r.nome||''),inicio,fim,retorno}}
function chaveProgramacaoFerias(r){const mat=String(r?.matricula||'').trim(),nome=normalizarTexto(r?.nome_completo||r?.nome||'');return `${mat||nome}|${dataISOFlex(r?.inicio)}|${dataISOFlex(r?.fim)}`}
function carregarProgramacaoFeriasLocal(){const lista=lerLocal(FERIAS_KEY,[]);programacaoFerias=(Array.isArray(lista)?lista:[]).map(normalizarProgramacaoFerias).filter(Boolean);return programacaoFerias}
function salvarProgramacaoFerias(lista){const map=new Map();for(const r of [...carregarProgramacaoFeriasLocal(),...(Array.isArray(lista)?lista:[])]){const item=normalizarProgramacaoFerias(r);if(!item)continue;map.set(chaveProgramacaoFerias(item),item)}programacaoFerias=[...map.values()].sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio))||nomeCompletoRegistro(a).localeCompare(nomeCompletoRegistro(b),'pt-BR'));gravarLocal(FERIAS_KEY,programacaoFerias);return programacaoFerias}

function chaveNomeFerias(nome){return normalizarTexto(nome).replace(/\s+/g,' ').trim()}
function payloadProgramacaoFerias(r){const item=normalizarProgramacaoFerias(r);if(!item)return null;return{nome_chave:chaveNomeFerias(item.nome_completo||item.nome||''),nome_completo:organizarNome(item.nome_completo||item.nome||''),matricula:String(item.matricula||'').trim(),funcao:String(item.funcao_colaborador||item.funcao||'').trim(),area:String(item.area||item.local||'').trim(),inicio:item.inicio,fim:item.fim||item.inicio,retorno:item.retorno||null,origem:'planilha',atualizado_em:new Date().toISOString()}}
async function carregarProgramacaoFeriasNuvem(){if(!db||!estaOnline())return false;try{const {data,error}=await db.from(FERIAS_TABLE).select('*').order('inicio',{ascending:true});if(error)throw error;const lista=(data||[]).map(r=>normalizarProgramacaoFerias({id:r.id,nome_completo:r.nome_completo,nome:r.nome_completo,matricula:r.matricula||'',funcao_colaborador:r.funcao||'',funcao:r.funcao||'',area:r.area||'',local:r.area||'',inicio:r.inicio,fim:r.fim,retorno:r.retorno||''})).filter(Boolean);programacaoFerias=lista;gravarLocal(FERIAS_KEY,programacaoFerias);feriasNuvemDisponivel=true;atualizarStatusFonteFerias();const ref=$('dataPainel')?.value||hoje();renderizarProximasFerias(ref);return true}catch(e){feriasNuvemDisponivel=false;console.warn('Tabela de programação de férias indisponível; usando cache/local.',e);carregarProgramacaoFeriasLocal();atualizarStatusFonteFerias(e);const ref=$('dataPainel')?.value||hoje();renderizarProximasFerias(ref);return false}}
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
function proximasFerias(data){const ref=dataISOFlex(data);if(!ref)return[];if(!programacaoFerias.length)reconstruirProgramacaoFeriasDosRegistros();const map=new Map();for(const r of programacaoFerias){const item=normalizarProgramacaoFerias(r);if(!item?.inicio)continue;map.set(chaveProgramacaoFerias(item),item)}return [...map.values()].map(r=>({...r,diasAte:diferencaDiasISO(ref,r.inicio)})).filter(r=>r.diasAte!==null&&r.diasAte>=1).sort((a,b)=>a.diasAte-b.diasAte||String(a.inicio).localeCompare(String(b.inicio))||nomeCompletoRegistro(a).localeCompare(nomeCompletoRegistro(b),'pt-BR'))}
function statusProgramacaoFerias(r,ref){const hojeRef=dataISOFlex(ref)||hoje(),inicio=dataISOFlex(r.inicio),fim=dataISOFlex(r.fim),retorno=dataISOFlex(r.retorno);if(retorno&&hojeRef>=retorno)return'Concluída';if(inicio&&fim&&hojeRef>=inicio&&hojeRef<=fim)return'Em férias';if(inicio&&hojeRef<inicio)return'Programada';return'Concluída'}
function renderizarProgramacaoFerias(){const el=$('listaProgramacaoFerias'),total=$('totalProgramacaoFerias');if(!el)return;if(!programacaoFerias.length)reconstruirProgramacaoFeriasDosRegistros();const ref=$('dataPainel')?.value||hoje();const q=normalizarTexto($('pesquisaProgramacaoFerias')?.value||'');const filtro=$('filtroStatusFerias')?.value||'Todos';const base=[...programacaoFerias].sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio)));const lista=base.filter(r=>{const st=statusProgramacaoFerias(r,ref);const nome=normalizarTexto(nomeCompletoRegistro(r));const dados=normalizarTexto([r.matricula,r.funcao_colaborador||r.funcao].filter(Boolean).join(' '));return(!q||nome.includes(q)||dados.includes(q))&&(filtro==='Todos'||st===filtro)});if(total)total.textContent=`${base.length} programação(ões)`;if(!lista.length){el.innerHTML='<div class="vacation-program-empty">Nenhuma programação encontrada para este filtro.</div>';return}el.innerHTML=`<div class="vacation-program-table"><div class="vacation-program-head"><span>Colaborador</span><span>Início</span><span>Fim</span><span>Retorno</span><span>Status</span></div>${lista.map(r=>{const st=statusProgramacaoFerias(r,ref);return`<div class="vacation-program-row"><span><strong>${escapar(nomeCompletoRegistro(r))}</strong><small>${escapar([r.matricula,r.funcao_colaborador||r.funcao].filter(Boolean).join(' • '))}</small></span><span>${dataBR(r.inicio)||'—'}</span><span>${dataBR(r.fim)||'—'}</span><span>${dataBR(r.retorno)||'—'}</span><span><b class="vacation-program-status ${st.toLowerCase().replace(' ','-').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}">${st}</b></span></div>`}).join('')}</div>`}
function renderizarProximasFerias(data){const painel=$('painelProximasFerias'),lista=$('listaProximasFerias'),total=$('totalProximasFerias');if(!painel||!lista)return;const itens=proximasFerias(data);painel.hidden=false;if(total)total.textContent=itens.length;if(!itens.length){lista.innerHTML='<div class="vacation-alert-empty">Nenhuma férias futura programada.</div>';return}const visiveis=itens.slice(0,5);lista.innerHTML=visiveis.map(r=>{const d=r.diasAte;const faixa=d<=2?'urgent':d<=6?'attention':d<=10?'notice':'future';const texto=d===1?'Falta 1 dia':`Faltam ${d} dias`;return `<div class="vacation-alert-row ${faixa}"><div class="vacation-alert-person"><strong title="${escapar(nomeCompletoRegistro(r))}">${escapar(nomeCompletoRegistro(r))}</strong><small>${escapar(r.funcao_colaborador||r.funcao||'Função não informada')}</small></div><div class="vacation-alert-period"><span>${dataBR(r.inicio)}${r.fim?` → ${dataBR(r.fim)}`:''}</span><b>${texto}</b></div></div>`}).join('')+(itens.length>5?`<div class="vacation-alert-more">+${itens.length-5} férias futura(s) programada(s)</div>`:'')}
function efetivoAtual(){
  const vistos=new Set();
  for(const c of colaboradores){
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
function atualizarDashboard(){const dataPainelAtual=$('dataPainel').value;const ativos=ativosNaData(dataPainelAtual);const efetivo=sincronizarEfetivoVisual();const ausentes=contarPessoasUnicas(ativos.filter(x=>x.tipo!=='Desligamento'));const disponiveis=Math.max(efetivo-ausentes,0);const disponibilidadePct=efetivo>0?Math.round((disponiveis/efetivo)*1000)/10:0;$('kpiEfetivo').textContent=efetivo;$('kpiDisponiveis').textContent=disponiveis;if($('kpiDisponibilidadePct'))$('kpiDisponibilidadePct').textContent=`${String(disponibilidadePct).replace('.',',')}%`;if($('kpiDisponibilidadeTexto'))$('kpiDisponibilidadeTexto').textContent=`${disponiveis} de ${efetivo} disponíveis`;if($('kpiDisponibilidadeBar'))$('kpiDisponibilidadeBar').style.width=`${Math.max(0,Math.min(disponibilidadePct,100))}%`;$('kpiFerias').textContent=contarPessoasUnicas(ativos.filter(x=>x.tipo==='Férias'));$('kpiAtestados').textContent=contarPessoasUnicas(ativos.filter(x=>x.tipo==='Atestado'||x.tipo==='Atestado Médico'));$('kpiDesligamentos').textContent=contarPessoasUnicas(ativos.filter(x=>x.tipo==='Desligamento'));$('kpiFaltas').textContent=contarPessoasUnicas(ativos.filter(x=>x.tipo==='Falta não justificada'||x.tipo==='Falta Não Justificada'));renderizarOcorrenciasPainel(ativos,dataPainelAtual);renderizarProximasFerias(dataPainelAtual);atualizarLocais(ativos);atualizarResumoCategorias(ativos);$('ultimaAtualizacao').textContent=dataHoraBR();$('teamBadge').textContent=config.turma||'Turma D';$('developerSidebar').textContent=(config.desenvolvedor||'Edson Alves').replace(' de Oliveira','')}
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
  const lista=visualizacaoOcorrenciasDashboard==='dia'?ocorrenciasDoDia(data):ativos;
  if(visualizacaoOcorrenciasDashboard==='dia')renderizarOcorrenciasDia(lista);else renderizarAtuais(lista);
  document.querySelectorAll('[data-occurrence-view]').forEach(b=>b.classList.toggle('active',b.dataset.occurrenceView===visualizacaoOcorrenciasDashboard));
  const sub=$('ocorrenciasPainelSubtitulo');
  if(sub){sub.textContent=visualizacaoOcorrenciasDashboard==='dia'?'':'Registros ativos na data selecionada.';sub.style.display=visualizacaoOcorrenciasDashboard==='dia'?'none':'';}
  const total=$('totalOcorrenciasAtuais');
  if(total){const n=lista.length;total.textContent=visualizacaoOcorrenciasDashboard==='dia'?`${n} ocorrência${n===1?'':'s'} no dia selecionado.`:(window.innerWidth<=720?`${n} ocorrência${n===1?' ativa':'s ativas'}`:`${n} ocorrência(s) ativa(s) na data selecionada.`)}
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
  select.innerHTML='<option value="">Selecione o colaborador</option>'+colaboradores.map(c=>{const completo=organizarNome(c.nome_completo||c.nome_exibicao||'');return `<option value="${escapar(completo)}" data-id="${c.id}" title="${escapar(completo)}">${escapar(completo)}</option>`}).join('');
  if(atual&&!Array.from(select.options).some(o=>o.value===atual)){const c=colaboradores.find(x=>x.nome_exibicao===atual||x.nome_completo===atual);if(c){select.value=organizarNome(c.nome_completo||c.nome_exibicao||atual);return}const op=document.createElement('option');op.value=atual;op.textContent=atual;select.appendChild(op)}
  select.value=atual;
}
function colaboradorSelecionado(){const nome=$('nome')?.value||'';const opt=$('nome')?.selectedOptions?.[0],id=opt?.dataset?.id;return colaboradores.find(c=>String(c.id)===String(id))||colaboradores.find(c=>c.nome_completo===nome||c.nome_exibicao===nome)||null}
function nomeCompletoRegistro(r){if(r?.nome_completo)return organizarNome(r.nome_completo);const c=colaboradores.find(x=>(r?.matricula&&x.matricula===r.matricula)||x.nome_completo===r?.nome||x.nome_exibicao===r?.nome);return organizarNome(c?.nome_completo||r?.nome||'Colaborador não informado')}
function areaRegistroPainel(r){const direta=String(r?.area||'').trim();if(direta)return direta;const mat=String(r?.matricula||'').trim();const nome=normalizarTexto(r?.nome_completo||r?.nome||'');const c=colaboradores.find(x=>(mat&&String(x?.matricula||'').trim()===mat)||(nome&&normalizarTexto(x?.nome_completo||x?.nome_exibicao||'')===nome));const areaColab=String(c?.area||'').trim();if(areaColab)return areaColab;return String(r?.local||'').trim()||'Não informado'}
function preencherDadosColaborador(){const c=colaboradorSelecionado();$('matricula').value=c?.matricula||'';$('funcaoColaborador').value=c?.funcao||'';$('area').value=c?.area||'';if(c?.area&&['Mina','Usina','Base Externa'].includes(c.area))$('local').value=c.area}
function renderizarColaboradores(){
  const box=$('listaColaboradores');if(!box)return;
  const q=normalizarTexto($('pesquisaColaborador')?.value||'');
  const lista=colaboradores.filter(c=>!q||normalizarTexto(`${c.matricula} ${c.nome_completo} ${c.nome_exibicao} ${c.funcao} ${c.area}`).includes(q));
  $('totalColaboradores').textContent=`${colaboradores.length} colaborador(es)`;
  box.innerHTML=lista.length?lista.map(c=>`<div class="collaborator-row"><div><strong>${escapar(c.nome_exibicao)}</strong><small>${escapar(c.nome_completo)}</small><small>${c.matricula?`Matrícula: ${escapar(c.matricula)} • `:''}${c.funcao?escapar(c.funcao):''}${c.area?` • ${escapar(c.area)}`:''}</small></div><button class="danger small-button" data-delete-colaborador="${c.id}">Excluir</button></div>`).join(''):'<div class="empty">Nenhum colaborador cadastrado.</div>'
}
async function carregarColaboradores(){if(!estaOnline()){colaboradores=lerLocal(COL_KEY,[]);preencherSelectColaboradores();renderizarColaboradores();atualizarDashboard();return}const {data,error}=await db.from('xcmg_colaboradores').select('*').order('nome_exibicao',{ascending:true});if(error)throw error;colaboradores=data||[];gravarLocal(COL_KEY,colaboradores);preencherSelectColaboradores();renderizarColaboradores();atualizarDashboard()}
async function adicionarColaborador(){
  const nomeCompleto=organizarNome($('novoColaboradorNome').value);
  if(!nomeCompleto){alert('Informe o nome completo do colaborador.');$('novoColaboradorNome').focus();return}
  const dados={matricula:$('novoColaboradorMatricula').value.trim(),nome_completo:nomeCompleto,nome_exibicao:nomeExibicao(nomeCompleto),funcao:$('novoColaboradorFuncao').value.trim(),area:$('novoColaboradorArea').value.trim()};
  if(!estaOnline()){const local={...dados,id:`local-col-${Date.now()}`};colaboradores.push(local);gravarLocal(COL_KEY,colaboradores);adicionarFilaOffline({entidade:'colaborador',operacao:'insert',dados:{...dados,id_local:local.id}});preencherSelectColaboradores();renderizarColaboradores();['novoColaboradorMatricula','novoColaboradorNome','novoColaboradorFuncao','novoColaboradorArea'].forEach(id=>$(id).value='');$('statusColaborador').textContent='Colaborador salvo offline. Será sincronizado quando a internet voltar.';return}
  const {error}=await db.from('xcmg_colaboradores').insert(dados);
  if(error){alert(error.code==='23505'?'Este colaborador já está cadastrado.':'Não foi possível cadastrar o colaborador.');return}
  ['novoColaboradorMatricula','novoColaboradorNome','novoColaboradorFuncao','novoColaboradorArea'].forEach(id=>$(id).value='');
  $('statusColaborador').textContent='Colaborador cadastrado e sincronizado.';await carregarColaboradores();setTimeout(()=>$('statusColaborador').textContent='',2500)
}
async function excluirColaborador(id){if(!confirm('Deseja excluir este colaborador do cadastro? Os registros antigos não serão apagados.'))return;if(!estaOnline()||String(id).startsWith('local-')){colaboradores=colaboradores.filter(x=>String(x.id)!==String(id));gravarLocal(COL_KEY,colaboradores);if(!String(id).startsWith('local-'))adicionarFilaOffline({entidade:'colaborador',operacao:'delete',id});preencherSelectColaboradores();renderizarColaboradores();return}const {error}=await db.from('xcmg_colaboradores').delete().eq('id',id);if(error){alert('Não foi possível excluir o colaborador.');return}await carregarColaboradores()}
function extrairNomesPlanilha(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{try{
  if(!window.XLSX)throw new Error('Biblioteca de planilha não carregada. Verifique a conexão com a internet.');
  const wb=XLSX.read(fr.result,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],linhas=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  if(!linhas.length)throw new Error('A planilha está vazia.');
  const aliases={matricula:['matricula','matrícula','registro'],nome:['nome','nome completo','colaborador','funcionario','funcionário'],funcao:['funcao','função','cargo'],area:['area','área','local']};
  let linhaCab=-1,map={};
  for(let i=0;i<Math.min(linhas.length,15);i++){const row=linhas[i]||[];const found={};row.forEach((v,j)=>{const n=normalizarTexto(v);Object.entries(aliases).forEach(([k,arr])=>{if(arr.map(normalizarTexto).includes(n))found[k]=j})});if(found.nome!==undefined){linhaCab=i;map=found;break}}
  if(linhaCab<0){linhaCab=-1;map={nome:0}}
  const inicio=linhaCab+1,vistos=new Set(),lista=[];
  for(let i=inicio;i<linhas.length;i++){
    const row=linhas[i]||[],completo=organizarNome(row[map.nome]);if(!completo)continue;
    const chave=normalizarTexto(completo);if(vistos.has(chave))continue;vistos.add(chave);
    lista.push({matricula:map.matricula!==undefined?String(row[map.matricula]??'').trim():'',nome_completo:completo,nome_exibicao:nomeExibicao(completo),funcao:map.funcao!==undefined?String(row[map.funcao]??'').trim():'',area:map.area!==undefined?organizarNome(row[map.area]):''});
  }
  lista.sort((a,b)=>a.nome_exibicao.localeCompare(b.nome_exibicao,'pt-BR'));if(!lista.length)throw new Error('Nenhum nome válido foi encontrado na planilha.');resolve(lista)
}catch(e){reject(e)}};fr.onerror=()=>reject(new Error('Não foi possível ler a planilha.'));fr.readAsArrayBuffer(file)})}
async function importarColaboradores(){const input=$('planilhaColaboradores'),file=input.files[0];if(!file){alert('Selecione uma planilha.');return}const btn=$('btnImportarColaboradores'),status=$('statusImportacao');try{const nomes=await extrairNomesPlanilha(file);if(!confirm(`Foram encontrados ${nomes.length} colaboradores. A lista atual será totalmente substituída. Continuar?`))return;importandoColaboradores=true;btn.disabled=true;status.textContent=`Enviando ${nomes.length} colaborador(es) para o Supabase...`;const chamada=db.rpc('xcmg_substituir_colaboradores',{lista:nomes});const limite=new Promise((_,reject)=>setTimeout(()=>reject(new Error('A importação ultrapassou 60 segundos. Verifique a conexão e tente novamente.')),60000));const {data,error}=await Promise.race([chamada,limite]);if(error)throw error;status.textContent='Atualizando a lista na tela...';await carregarColaboradores();atualizarTudo();input.value='';status.textContent=`Importação concluída: ${data??nomes.length} colaborador(es). Efetivo atualizado automaticamente para ${efetivoAtual()}.`;setTimeout(()=>{if(status.textContent.startsWith('Importação concluída'))status.textContent=''},6000)}catch(e){console.error('Falha ao importar colaboradores:',e);status.textContent='Falha na importação. A planilha continua selecionada para nova tentativa.';alert(`Não foi possível importar a planilha.

${e.message||e.details||'Erro desconhecido.'}`)}finally{importandoColaboradores=false;btn.disabled=false}}

function dataPlanilhaISO(valor){
  if(valor===null||valor===undefined||valor==='')return'';
  if(valor instanceof Date&&!Number.isNaN(valor.getTime()))return `${valor.getFullYear()}-${String(valor.getMonth()+1).padStart(2,'0')}-${String(valor.getDate()).padStart(2,'0')}`;
  if(typeof valor==='number'&&window.XLSX?.SSF?.parse_date_code){const d=XLSX.SSF.parse_date_code(valor);if(d?.y)return `${String(d.y).padStart(4,'0')}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
  const s=String(valor).trim();
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);if(m){let a=m[3];if(a.length===2)a=`20${a}`;return `${a}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
  return'';
}
function extrairFeriasPlanilha(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{try{
  if(!window.XLSX)throw new Error('Biblioteca de planilha não carregada. Verifique a conexão com a internet.');
  const wb=XLSX.read(fr.result,{type:'array',cellDates:true});
  const aliases={nome:['colaborador','nome','nome completo','funcionario','funcionário'],inicio:['inicio ferias','início férias','inicio férias','início ferias','inicio','data inicio','data início'],fim:['fim','fim ferias','fim férias','data fim'],retorno:['retorno','data retorno']};
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
    lista.push({linha:i+1,nome,inicio,fim,retorno,aba:nomeAba});
  }
  if(!lista.length)throw new Error(`Nenhuma programação de férias foi encontrada na aba ${nomeAba}.`);
  resolve(lista)
}catch(e){reject(e)}};fr.onerror=()=>reject(new Error('Não foi possível ler a planilha de férias.'));fr.readAsArrayBuffer(file)})}
function localizarColaboradorFerias(nome){const chave=normalizarTexto(nome);return colaboradores.find(c=>normalizarTexto(c.nome_completo)===chave)||colaboradores.find(c=>normalizarTexto(c.nome_exibicao)===chave)||null}
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
  const conf=await fetch(`${urlBase}?select=id,nome_chave,nome_completo,matricula,funcao,area,inicio,fim,retorno&order=inicio.asc`,{headers:{...headers,'Prefer':'count=exact'},cache:'no-store'});
  const textoConf=await conf.text();let rows=[];if(textoConf){try{rows=JSON.parse(textoConf)}catch{}}
  if(!conf.ok)throw new Error(`Não foi possível conferir a tabela: ${textoConf||`HTTP ${conf.status}`}`);
  const presentes=new Set((Array.isArray(rows)?rows:[]).map(x=>`${x.nome_chave}|${dataISOFlex(x.inicio)}|${dataISOFlex(x.fim)}`));
  const faltantes=payload.filter(x=>!presentes.has(`${x.nome_chave}|${x.inicio}|${x.fim}`));
  if(faltantes.length)throw new Error(`A conferência encontrou ${faltantes.length} programação(ões) ausente(s) no banco após o envio.`);
  programacaoFerias=(Array.isArray(rows)?rows:[]).map(r=>normalizarProgramacaoFerias({id:r.id,nome_completo:r.nome_completo,nome:r.nome_completo,matricula:r.matricula||'',funcao_colaborador:r.funcao||'',funcao:r.funcao||'',area:r.area||'',local:r.area||'',inicio:r.inicio,fim:r.fim,retorno:r.retorno||''})).filter(Boolean);
  gravarLocal(FERIAS_KEY,programacaoFerias);feriasNuvemDisponivel=true;atualizarStatusFonteFerias();
  return{gravadas:payload.length,totalTabela:programacaoFerias.length,duplicadasRemovidas:bruto.length-payload.length,projeto};
}
async function importarFerias(){
  const input=$('planilhaFerias'),file=input?.files?.[0],btn=$('btnImportarFerias'),status=$('statusImportacaoFerias');
  if(!status)return alert('Falha de interface: área de status da importação não encontrada.');
  status.textContent='BOTÃO ACIONADO • iniciando leitura da planilha...';status.classList.remove('cloud-error');
  if(!file){status.textContent='Selecione a planilha de férias antes de importar.';alert('Selecione a planilha de férias.');return}
  btn.disabled=true;
  try{
    const linhas=await extrairFeriasPlanilha(file);status.textContent=`Planilha lida • aba ${linhas[0]?.aba||'identificada'} • ${linhas.length} linha(s) encontrada(s). Validando...`;
    const validas=[],invalidas=[],vinculadas=[],naoVinculadas=[];
    for(const f of linhas){
      if(f.erro){invalidas.push(f);continue}
      const c=localizarColaboradorFerias(f.nome),nomeCompleto=organizarNome(c?.nome_completo||f.nome);
      const p={tipo:'Férias',categoria:'Férias',motivo:'Férias',nome:nomeCompleto,nome_completo:nomeCompleto,matricula:String(c?.matricula||'').trim(),funcao_colaborador:String(c?.funcao||'').trim(),area:String(c?.area||'').trim(),funcao:String(c?.funcao||'').trim(),local:String(c?.area||'').trim(),inicio:f.inicio,fim:f.fim,retorno:f.retorno||'',cid:'',descricao:'Férias programadas',atestado_fisico:'N/A',enviado_grupo:'N/A',observacao:f.retorno?`Retorno previsto: ${dataBR(f.retorno)}`:'',foto_url:'',foto_path:''};
      validas.push(p);if(c)vinculadas.push(p);else naoVinculadas.push(p)
    }
    if(!validas.length)throw new Error(`Nenhuma programação válida. ${invalidas.length} linha(s) com erro de data.`);
    if(!confirm(`Planilha lida com sucesso.\n\nVálidas: ${validas.length}\nVinculadas ao Efetivo: ${vinculadas.length}\nSem vínculo: ${naoVinculadas.length}\nInválidas: ${invalidas.length}\n\nGravar agora no Supabase?`)){status.textContent='Importação cancelada pelo usuário.';return}
    const resultado=await salvarProgramacaoFeriasREST(validas,msg=>status.textContent=msg);
    // A programação futura permanece somente na tabela própria de férias.
    // Ela só entra no operacional durante o período e no histórico a partir do retorno.
    input.value='';
    const ref=$('dataPainel')?.value||hoje(),prox=proximasFerias(ref)[0];
    renderizarProgramacaoFerias();renderizarProximasFerias(ref);atualizarDashboard();
    status.textContent=`✅ IMPORTAÇÃO CONFIRMADA NO SUPABASE • ${resultado.gravadas} programação(ões) desta planilha confirmada(s) • total da tabela: ${resultado.totalTabela} • projeto ${resultado.projeto} • ${vinculadas.length} vinculada(s) ao Efetivo • ${naoVinculadas.length} sem vínculo • ${invalidas.length} inválida(s).${prox?` Próxima: ${nomeCompletoRegistro(prox)} em ${dataBR(prox.inicio)} (${prox.diasAte===1?'falta 1 dia':`faltam ${prox.diasAte} dias`}).`:''}`;
  }catch(e){console.error('IMPORTAÇÃO FÉRIAS 6.4.7:',e);status.classList.add('cloud-error');status.textContent=`❌ ERRO NA IMPORTAÇÃO: ${e.message||String(e)}`;alert(`Falha na importação de férias:\n\n${e.message||e}`)}finally{btn.disabled=false;if(estaOnline())statusNuvem('Sincronizado')}
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

async function carregarNuvem(silencioso=false){if(carregando)return;if(!estaOnline()){carregarCacheOffline();return}carregando=true;if(!silencioso)statusNuvem('Sincronizando...');try{const [{data:regs,error:er},{data:cfg,error:ec},{data:cols,error:ecl}]=await Promise.all([db.from('xcmg_registros').select('*').order('created_at',{ascending:true}),db.from('xcmg_config').select('*').eq('id',1).maybeSingle(),db.from('xcmg_colaboradores').select('*').order('nome_exibicao',{ascending:true})]);if(er)throw er;if(ec)throw ec;if(ecl)throw ecl;registros=(regs||[]).map(r=>({id:r.id,tipo:r.tipo,categoria:r.categoria||'',motivo:r.motivo||'',nome:r.nome,nome_completo:r.nome_completo||'',matricula:r.matricula||'',funcao_colaborador:r.funcao_colaborador||'',area:r.area||'',funcao:r.funcao||'',local:r.local||'',inicio:r.inicio||'',fim:r.fim||'',cid:r.cid||'',descricao:r.descricao||'',atestado_fisico:r.atestado_fisico||'N/A',enviado_grupo:r.enviado_grupo||'N/A',observacao:r.observacao||'',foto_url:r.foto_url||'',foto_path:r.foto_path||'',created_at:r.created_at||''}));colaboradores=cols||[];config=cfg?{turma:cfg.turma,efetivoTotal:cfg.efetivo_total,nomeSistema:cfg.nome_sistema,desenvolvedor:cfg.desenvolvedor,estiloSimbolos:cfg.estilo_simbolos,periodosFechamento:Array.isArray(cfg.periodos_fechamento)?cfg.periodos_fechamento:lerLocal(CFG_KEY,{})?.periodosFechamento||[]}:{...PADRAO,...lerLocal(CFG_KEY,{})};normalizarPeriodosFechamento();if(Array.isArray(cfg?.categorias_rh)&&cfg.categorias_rh.length){categoriasRH=cfg.categorias_rh;normalizarCategoriasRH();localStorage.setItem(CATEGORIAS_KEY,JSON.stringify(categoriasRH));atualizarSelectCategorias();renderizarGestaoCategorias()}const feriasOk=await carregarProgramacaoFeriasNuvem();if(!feriasOk&&!programacaoFerias.length)reconstruirProgramacaoFeriasDosRegistros();await migrarDadosLocaisSeNecessario();carregarConfig();salvarCacheLocal();atualizarTudo();statusNuvem('Sincronizado')}catch(e){console.error(e);carregarCacheOffline();if(!silencioso&&estaOnline())console.warn('A nuvem não respondeu. Dados locais carregados.')}finally{carregando=false}}
async function migrarDadosLocaisSeNecessario(){if(localStorage.getItem(MIG_KEY)==='1')return;const locais=lerLocal(REG_KEY,[]),cfgLocal=lerLocal(CFG_KEY,null);if(registros.length===0&&Array.isArray(locais)&&locais.length){const payload=locais.map(r=>({tipo:r.tipo,categoria:r.categoria||'',motivo:r.motivo||'',nome:r.nome,nome_completo:r.nome_completo||r.nome||'',matricula:r.matricula||'',funcao_colaborador:r.funcao_colaborador||'',area:r.area||'',funcao:r.funcao||'',local:r.local||'',inicio:r.inicio||null,fim:r.fim||null,cid:r.cid||'',descricao:r.descricao||'',atestado_fisico:r.atestado_fisico||'N/A',enviado_grupo:r.enviado_grupo||'N/A',observacao:r.observacao||'',foto_url:r.foto_url||'',foto_path:r.foto_path||''}));const {error}=await db.from('xcmg_registros').insert(payload);if(error)throw error}if(cfgLocal){const {error}=await db.from('xcmg_config').upsert({id:1,turma:cfgLocal.turma||PADRAO.turma,efetivo_total:Number(cfgLocal.efetivoTotal||0),nome_sistema:cfgLocal.nomeSistema||PADRAO.nomeSistema,desenvolvedor:cfgLocal.desenvolvedor||PADRAO.desenvolvedor,estilo_simbolos:cfgLocal.estiloSimbolos||PADRAO.estiloSimbolos});if(error)throw error}localStorage.setItem(MIG_KEY,'1');if((locais&&locais.length)||cfgLocal){const {data:regs}=await db.from('xcmg_registros').select('*').order('created_at',{ascending:true});const {data:cfg}=await db.from('xcmg_config').select('*').eq('id',1).maybeSingle();registros=(regs||[]).map(r=>({id:r.id,tipo:r.tipo,categoria:r.categoria||'',motivo:r.motivo||'',nome:r.nome,nome_completo:r.nome_completo||'',matricula:r.matricula||'',funcao_colaborador:r.funcao_colaborador||'',area:r.area||'',funcao:r.funcao||'',local:r.local||'',inicio:r.inicio||'',fim:r.fim||'',cid:r.cid||'',descricao:r.descricao||'',atestado_fisico:r.atestado_fisico||'N/A',enviado_grupo:r.enviado_grupo||'N/A',observacao:r.observacao||'',foto_url:r.foto_url||'',foto_path:r.foto_path||'',created_at:r.created_at||''}));if(cfg)config={turma:cfg.turma,efetivoTotal:cfg.efetivo_total,nomeSistema:cfg.nome_sistema,desenvolvedor:cfg.desenvolvedor,estiloSimbolos:cfg.estilo_simbolos}}}
function iniciarRealtime(){if(!estaOnline())return;if(canalRealtime)db.removeChannel(canalRealtime);canalRealtime=db.channel('xcmg-publico').on('postgres_changes',{event:'*',schema:'public',table:'xcmg_registros'},()=>carregarNuvem(true)).on('postgres_changes',{event:'*',schema:'public',table:'xcmg_config'},()=>carregarNuvem(true)).on('postgres_changes',{event:'*',schema:'public',table:'xcmg_colaboradores'},()=>{if(!importandoColaboradores)carregarColaboradores().catch(console.error)}).on('postgres_changes',{event:'*',schema:'public',table:FERIAS_TABLE},()=>carregarProgramacaoFeriasNuvem().then(()=>atualizarTudo()).catch(console.error)).subscribe()}

async function enviarFoto(file){if(!file)return fotoAtual;if(!file.type.startsWith('image/'))throw new Error('Selecione um arquivo de imagem.');if(file.size>5*1024*1024)throw new Error('A foto deve ter no máximo 5 MB.');const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();const path=`ocorrencias/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const {error}=await db.storage.from('xcmg-ocorrencias').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;const {data}=db.storage.from('xcmg-ocorrencias').getPublicUrl(path);return{url:data.publicUrl,path}}
async function salvarRegistro(){const nome=$('nome').value.trim();if(!nome){alert('Selecione o colaborador.');$('nome').focus();return}const inicio=$('inicio').value,fim=$('fim').value;if(inicio&&fim&&fim<inicio){alert('A data final não pode ser anterior à data inicial.');return}const estavaEditando=Boolean(editando),arquivo=$('foto').files[0];$('btnSalvar').disabled=true;statusNuvem(arquivo?'Enviando foto...':'Salvando...');try{if(!estaOnline()&&arquivo){alert('A ocorrência será salva offline sem a foto. Anexe a foto depois que a internet voltar.')}let foto=removerFotoAtual?{url:'',path:''}:fotoAtual;if(arquivo&&estaOnline())foto=await enviarFoto(arquivo);const colaborador=colaboradorSelecionado();const categoriaInformada=$('categoriaMotivo').value;if(!categoriaInformada){alert('Selecione a categoria do motivo.');$('categoriaMotivo').focus();return}const motivoInformado=$('motivo').value.trim();if(!motivoInformado){alert('Informe o motivo para a planilha do RH.');$('motivo').focus();return}salvarMotivoPersonalizado(motivoInformado);sincronizarTipoComMotivo();const nomeCompleto=organizarNome(colaborador?.nome_completo||registros.find(r=>String(r.id)===String(editando))?.nome_completo||nome);const dados={tipo:$('tipo').value,categoria:categoriaInformada,motivo:motivoInformado,nome:nomeCompleto,nome_completo:nomeCompleto,matricula:$('matricula').value.trim(),funcao_colaborador:$('funcaoColaborador').value.trim(),area:$('area').value.trim(),funcao:$('funcao').value.trim(),local:$('local').value,inicio:inicio||null,fim:fim||null,cid:$('cid').value.trim(),descricao:$('descricao').value.trim(),atestado_fisico:$('atestadoFisico').value,enviado_grupo:$('enviadoGrupo').value,observacao:$('observacao').value.trim(),foto_url:foto.url||'',foto_path:foto.path||''};if(!estaOnline()){if(editando){const i=registros.findIndex(r=>String(r.id)===String(editando));if(i>=0)registros[i]={...registros[i],...dados};if(!String(editando).startsWith('local-'))adicionarFilaOffline({entidade:'registro',operacao:'update',id:editando,dados})}else{const idLocal=`local-reg-${Date.now()}`;registros.push({...dados,id:idLocal,created_at:new Date().toISOString()});adicionarFilaOffline({entidade:'registro',operacao:'insert',dados:{...dados,id_local:idLocal}})}salvarCacheLocal();$('statusForm').textContent=estavaEditando?'Registro atualizado offline.':'Registro salvo offline. Será sincronizado quando a internet voltar.';limparForm();atualizarTudo();return}let erro;if(editando){({error:erro}=await db.from('xcmg_registros').update(dados).eq('id',editando))}else{({error:erro}=await db.from('xcmg_registros').insert(dados))}if(erro)throw erro;if((arquivo||removerFotoAtual)&&fotoAtual.path&&fotoAtual.path!==foto.path)await db.storage.from('xcmg-ocorrencias').remove([fotoAtual.path]);if(inicio)$('dataPainel').value=inicio;else if(!$('dataPainel').value)$('dataPainel').value=hoje();$('statusForm').textContent=estavaEditando?'Registro atualizado e sincronizado.':'Registro adicionado e sincronizado.';limparForm();await carregarNuvem(true);setTimeout(()=>$('statusForm').textContent='',3000)}catch(e){console.error(e);alert(e.message||'Não foi possível salvar o registro.')}finally{$('btnSalvar').disabled=false;if(estaOnline())statusNuvem('Sincronizado')}}
function editar(id){const r=registros.find(x=>String(x.id)===String(id));if(!r)return;editando=r.id;fotoAtual={url:r.foto_url||'',path:r.foto_path||''};removerFotoAtual=false;$('categoriaMotivo').value=r.categoria||categoriaPorMotivo(r.motivo||'');atualizarListaMotivos();$('motivo').value=r.motivo||'';$('tipo').value=r.tipo||tipoPorMotivo(r.motivo||'',$('categoriaMotivo').value);$('nome').value=nomeCompletoRegistro(r)||r.nome||'';$('matricula').value=r.matricula||'';$('funcaoColaborador').value=r.funcao_colaborador||'';$('area').value=r.area||'';$('funcao').value=r.funcao||'';$('local').value=r.local||'';$('inicio').value=r.inicio||'';$('fim').value=r.fim||'';atualizarDiasPorPeriodo();$('cid').value=r.cid||'';$('descricao').value=r.descricao||'';$('atestadoFisico').value=r.atestado_fisico||'N/A';$('enviadoGrupo').value=r.enviado_grupo||'N/A';$('observacao').value=r.observacao||'';$('foto').value='';mostrarFoto(fotoAtual.url);$('btnSalvar').textContent='Salvar alteração';$('btnCancelar').classList.remove('hidden');$('formTitle').textContent='Editar ocorrência';abrirPagina('ocorrencias')}
async function excluir(id){if(!confirm('Deseja excluir este registro?'))return;const r=registros.find(x=>String(x.id)===String(id));if(!estaOnline()||String(id).startsWith('local-')){registros=registros.filter(x=>String(x.id)!==String(id));if(!String(id).startsWith('local-'))adicionarFilaOffline({entidade:'registro',operacao:'delete',id});salvarCacheLocal();atualizarTudo();return}const {error}=await db.from('xcmg_registros').delete().eq('id',id);if(error){alert('Não foi possível excluir o registro.');return}if(r&&r.foto_path)await db.storage.from('xcmg-ocorrencias').remove([r.foto_path]);await carregarNuvem(true)}
function gerarMensagem(){const data=$('dataPainel').value,ativos=ativosNaData(data);const estilo=config.estiloSimbolos||'completo';const simbolos={completo:{cab:'📋',data:'📅',item:'👤',funcao:'⚙️',periodo:'🗓️',local:'📍',obs:'📝',categorias:{'Férias':'🏖️','Atestado':'🩺','Falta não justificada':'⚠️','Desligamento':'🚪','Outras justificativas':'📄','Folga compensada':'🔄'}},simples:{cab:'■',data:'▣',item:'•',funcao:'-',periodo:'-',local:'-',obs:'-',categorias:{'Férias':'◆','Atestado':'✚','Falta não justificada':'!','Desligamento':'□','Outras justificativas':'•','Folga compensada':'↻'}},nenhum:{cab:'',data:'',item:'',funcao:'',periodo:'',local:'',obs:'',categorias:{'Férias':'','Atestado':'','Falta não justificada':'','Desligamento':'','Outras justificativas':'','Folga compensada':''}}}[estilo];const p=(icone,texto)=>icone?`${icone} ${texto}`:texto;let txt=`${p(simbolos.cab,`*Controle de Férias e Ausências – ${config.turma}*`)}\n${p(simbolos.data,`*${dataBR(data)}*`)}\n`;CATS.forEach(cat=>{const itens=ativos.filter(x=>x.tipo===cat);txt+=`\n${p(simbolos.categorias[cat],`*${cat} (${itens.length})*`)}\n`;txt+=itens.length?itens.map(r=>{const linhas=[p(simbolos.item,`*${nomeExibicao(nomeCompletoRegistro(r))||'Colaborador não informado'}*`)];if(r.funcao)linhas.push(p(simbolos.funcao,r.funcao));if(periodo(r.inicio,r.fim))linhas.push(p(simbolos.periodo,periodo(r.inicio,r.fim)));if(r.local)linhas.push(p(simbolos.local,r.local));if(r.descricao)linhas.push(p(simbolos.obs,r.descricao));else if(r.observacao)linhas.push(p(simbolos.obs,r.observacao));return linhas.join('\n')}).join('\n\n'):'Não informado';txt+='\n'});$('mensagemGerada').textContent=txt.trim();return txt.trim()}
function diasPeriodo(inicio,fim){if(!inicio)return'';const a=new Date(`${inicio}T00:00:00`),b=new Date(`${(fim||inicio)}T00:00:00`);return Math.max(1,Math.round((b-a)/86400000)+1)}
function gerarPlanilhaExcel(){if(!window.XLSX){alert('A biblioteca de planilha não foi carregada. Verifique a internet.');return}const nomeCompletoRegistro=r=>{if(r.nome_completo)return r.nome_completo;const c=colaboradores.find(x=>(r.matricula&&x.matricula===r.matricula)||x.nome_exibicao===r.nome);return c?.nome_completo||r.nome||''};const funcaoRegistro=r=>{if(r.funcao_colaborador)return r.funcao_colaborador;const c=colaboradores.find(x=>(r.matricula&&x.matricula===r.matricula)||x.nome_exibicao===r.nome);return c?.funcao||''};const matriculaRegistro=r=>{if(r.matricula)return r.matricula;const c=colaboradores.find(x=>x.nome_exibicao===r.nome);return c?.matricula||''};const areaRegistro=r=>{if(r.area)return r.area;const c=colaboradores.find(x=>(r.matricula&&x.matricula===r.matricula)||x.nome_exibicao===r.nome);return c?.area||r.local||''};const lista=historicoAteData($('dataPainel')?.value||hoje()).sort((a,b)=>(a.inicio||'').localeCompare(b.inicio||''));if(!lista.length){alert('Não há registros para exportar.');return}const dados=lista.map(r=>({Área:areaRegistro(r),Matrícula:matriculaRegistro(r),'Nome completo':nomeCompletoRegistro(r),Função:funcaoRegistro(r),Equipamento:r.funcao||'','Data início':dataBR(r.inicio),'Dias':diasPeriodo(r.inicio,r.fim),'Data final':dataBR(r.fim||r.inicio),'Período':periodoFechamento(r.inicio),Motivo:r.motivo||r.tipo||'',CID:r.cid||'N/A',Descrição:r.descricao||r.observacao||'','Atestado físico?':r.atestado_fisico||'N/A','Enviado no grupo?':r.enviado_grupo||'N/A'}));const ws=XLSX.utils.json_to_sheet(dados);ws['!cols']=[{wch:12},{wch:14},{wch:32},{wch:30},{wch:18},{wch:13},{wch:8},{wch:13},{wch:23},{wch:24},{wch:12},{wch:40},{wch:18},{wch:18}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Ausências');XLSX.writeFile(wb,`XCMG_Ausencias_${hoje()}.xlsx`)}
function carregarConfig(){$('turma').value=config.turma||'Turma D';$('efetivoTotal').value=efetivoAtual();$('nomeSistema').value=config.nomeSistema||'XCMG Control';$('desenvolvedor').value=config.desenvolvedor||'Edson de Oliveira Alves';$('estiloSimbolos').value=config.estiloSimbolos||'completo'}
async function salvarConfig(){const nova={turma:$('turma').value.trim()||'Turma D',efetivoTotal:efetivoAtual(),nomeSistema:$('nomeSistema').value.trim()||'XCMG Control',desenvolvedor:$('desenvolvedor').value.trim()||'Edson de Oliveira Alves',estiloSimbolos:$('estiloSimbolos').value||'completo',periodosFechamento:normalizarPeriodosFechamento()};const payload={id:1,turma:nova.turma,efetivo_total:nova.efetivoTotal,nome_sistema:nova.nomeSistema,desenvolvedor:nova.desenvolvedor,estilo_simbolos:nova.estiloSimbolos,periodos_fechamento:nova.periodosFechamento};if(!estaOnline()){config=nova;gravarLocal(CFG_KEY,config);adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload});$('statusConfig').textContent='Configurações salvas offline.';atualizarTudo();return}const {error}=await db.from('xcmg_config').upsert(payload);if(error){config=nova;gravarLocal(CFG_KEY,config);adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload});$('statusConfig').textContent='Salvo neste aparelho; sincronização pendente.';atualizarTudo();return}config=nova;gravarLocal(CFG_KEY,config);$('statusConfig').textContent='Configurações salvas e sincronizadas.';atualizarTudo();setTimeout(()=>$('statusConfig').textContent='',2500)}
function exportar(){const blob=new Blob([JSON.stringify({versao:'4.1',exportadoEm:new Date().toISOString(),configuracoes:config,registros},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`xcmg-control-backup-${hoje()}.json`;a.click();URL.revokeObjectURL(a.href)}
async function importar(file){const fr=new FileReader();fr.onload=async()=>{try{const d=JSON.parse(fr.result);if(!Array.isArray(d.registros))throw new Error();if(!confirm('A importação substituirá todos os registros compartilhados. Continuar?'))return;await db.from('xcmg_registros').delete().neq('id',0);if(d.registros.length){const payload=d.registros.map(r=>({tipo:r.tipo,nome:r.nome,funcao:r.funcao||'',local:r.local||'',inicio:r.inicio||null,fim:r.fim||null,observacao:r.observacao||'',foto_url:r.foto_url||'',foto_path:r.foto_path||''}));const {error}=await db.from('xcmg_registros').insert(payload);if(error)throw error}if(d.configuracoes){const c=d.configuracoes;const {error}=await db.from('xcmg_config').upsert({id:1,turma:c.turma||PADRAO.turma,efetivo_total:Number(c.efetivoTotal||0),nome_sistema:c.nomeSistema||PADRAO.nomeSistema,desenvolvedor:c.desenvolvedor||PADRAO.desenvolvedor,estilo_simbolos:c.estiloSimbolos||PADRAO.estiloSimbolos,periodos_fechamento:Array.isArray(c.periodosFechamento)?c.periodosFechamento:[]});if(error)throw error}await carregarNuvem(true);$('statusConfig').textContent='Backup importado e sincronizado.'}catch(e){console.error(e);alert('Arquivo de backup inválido ou falha na importação.')}};fr.readAsText(file)}

function abrirGestaoPeriodos(){if(!exigirPermissao('configuracoes_alterar'))return;editandoPeriodoId=null;$('periodoInicio').value='';$('periodoFim').value='';$('btnSalvarPeriodo').textContent='Adicionar período';$('statusPeriodos').textContent='';renderizarGestaoPeriodos();$('modalPeriodos').classList.remove('hidden');$('modalPeriodos').setAttribute('aria-hidden','false')}
function fecharGestaoPeriodos(){$('modalPeriodos').classList.add('hidden');$('modalPeriodos').setAttribute('aria-hidden','true');editandoPeriodoId=null}
function renderizarGestaoPeriodos(){const lista=normalizarPeriodosFechamento();const box=$('listaPeriodos');if(!box)return;box.innerHTML=lista.length?lista.slice().sort((a,b)=>b.inicio.localeCompare(a.inicio)).map(p=>{const qtd=registros.filter(r=>r.inicio>=p.inicio&&r.inicio<=p.fim).length;return`<div class="period-admin-row"><div><strong>🗓️ ${dataBR(p.inicio)} a ${dataBR(p.fim)}</strong><small>${qtd} registro(s) com data de início neste período.</small></div><div class="period-admin-actions"><button class="secondary" type="button" data-edit-periodo="${escapar(p.id)}">Editar</button><button class="danger" type="button" data-delete-periodo="${escapar(p.id)}">Excluir</button></div></div>`}).join(''):'<div class="empty">Nenhum período excepcional cadastrado. O sistema está usando automaticamente o padrão do dia 10 ao dia 09.</div>'}
async function persistirPeriodosFechamento(mensagem='Períodos atualizados.'){normalizarPeriodosFechamento();gravarLocal(CFG_KEY,config);salvarCacheLocal();const payload={id:1,periodos_fechamento:config.periodosFechamento};if(!estaOnline()){adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload});$('statusPeriodos').textContent=`${mensagem} Salvo offline e pendente de sincronização.`;atualizarTudo();renderizarGestaoPeriodos();return}const {error}=await db.from('xcmg_config').update({periodos_fechamento:config.periodosFechamento}).eq('id',1);if(error){console.error(error);$('statusPeriodos').textContent=`${mensagem} Salvo neste aparelho. Para sincronizar entre dispositivos, execute a migração v6.0.13 no Supabase.`;adicionarFilaOffline({entidade:'config',operacao:'upsert',dados:payload})}else{$('statusPeriodos').textContent=`${mensagem} Sincronizado para todos os dispositivos.`}atualizarTudo();renderizarGestaoPeriodos()}
async function salvarPeriodoFechamento(){if(!exigirPermissao('configuracoes_alterar'))return;const inicio=$('periodoInicio').value,fim=$('periodoFim').value;if(!inicio||!fim){$('statusPeriodos').textContent='Informe a data inicial e a data final.';return}if(fim<inicio){$('statusPeriodos').textContent='A data final não pode ser anterior à data inicial.';return}const lista=normalizarPeriodosFechamento();const conflito=lista.find(p=>p.id!==editandoPeriodoId&&inicio<=p.fim&&fim>=p.inicio);if(conflito){$('statusPeriodos').textContent=`Período sobreposto com ${dataBR(conflito.inicio)} a ${dataBR(conflito.fim)}. Ajuste as datas antes de salvar.`;return}const item={id:editandoPeriodoId||`periodo-${Date.now()}`,inicio,fim};if(editandoPeriodoId){const idx=lista.findIndex(p=>p.id===editandoPeriodoId);if(idx>=0)lista[idx]=item}else lista.push(item);config.periodosFechamento=lista;editandoPeriodoId=null;$('periodoInicio').value='';$('periodoFim').value='';$('btnSalvarPeriodo').textContent='Adicionar período';const padrao=periodoPadrao(inicio);let extra='Período salvo.';if(padrao&&fim<padrao.fim){const d=new Date(`${fim}T12:00:00`);d.setDate(d.getDate()+1);const prox=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;extra=`Período salvo. Fechamento antecipado: o próximo período pode iniciar em ${dataBR(prox)}.`}await persistirPeriodosFechamento(extra)}
function editarPeriodoFechamento(id){if(!exigirPermissao('configuracoes_alterar'))return;const p=normalizarPeriodosFechamento().find(x=>x.id===id);if(!p)return;editandoPeriodoId=id;$('periodoInicio').value=p.inicio;$('periodoFim').value=p.fim;$('btnSalvarPeriodo').textContent='Salvar alteração';$('statusPeriodos').textContent='Editando período selecionado.';$('periodoInicio').focus()}
async function excluirPeriodoFechamento(id){if(!exigirPermissao('configuracoes_alterar'))return;const p=normalizarPeriodosFechamento().find(x=>x.id===id);if(!p)return;const qtd=registros.filter(r=>r.inicio>=p.inicio&&r.inicio<=p.fim).length;if(!confirm(`Excluir o período ${dataBR(p.inicio)} a ${dataBR(p.fim)}?\n\nNenhum registro será apagado. ${qtd?`${qtd} registro(s) voltarão a usar o período automático padrão.`:'Os registros não serão alterados.'}`))return;config.periodosFechamento=config.periodosFechamento.filter(x=>x.id!==id);await persistirPeriodosFechamento('Período excluído. Nenhum registro foi apagado.')}
function cancelarEdicaoPeriodo(){editandoPeriodoId=null;$('periodoInicio').value='';$('periodoFim').value='';$('btnSalvarPeriodo').textContent='Adicionar período';$('statusPeriodos').textContent='Edição cancelada.'}

function atualizarTudo(){atualizarDashboard();renderizarRegistros();preencherSelectColaboradores();renderizarColaboradores();renderizarProgramacaoFerias();gerarMensagem()}


function temPermissao(codigo){return Boolean(usuarioAtual&&(usuarioAtual.administrador||usuarioAtual.permissoes?.includes(codigo)))}
function exigirPermissao(codigo,mensagem='Você não possui permissão para esta ação.'){if(temPermissao(codigo))return true;alert(mensagem);return false}
function permissoesSelecionadas(){return Array.from(document.querySelectorAll('#permissoesUsuario input:checked')).map(x=>x.value)}
function limparFormularioUsuario(){editandoUsuarioId=null;['novoUsuarioNome','novoUsuarioLogin','novoUsuarioSenha'].forEach(id=>$(id).value='');$('novoUsuarioAdmin').checked=false;document.querySelectorAll('#permissoesUsuario input').forEach(x=>x.checked=false);$('btnCriarUsuario').textContent='Criar usuário'}
function aplicarPermissoes(){
  const mapaPaginas={dashboard:'dashboard_ver',ocorrencias:'ocorrencias_cadastrar',colaboradores:'colaboradores_ver',registros:'registros_ver',mensagem:'whatsapp_gerar',configuracoes:'configuracoes_ver',usuarios:'usuarios_gerenciar'};
  document.querySelectorAll('.nav-item').forEach(b=>{const p=mapaPaginas[b.dataset.page];b.classList.toggle('hidden',p&&!temPermissao(p))});
  const mapa={btnSalvar:'ocorrencias_cadastrar',foto:'ocorrencias_fotos',btnRemoverFoto:'ocorrencias_fotos',btnAdicionarColaborador:'colaboradores_cadastrar',btnImportarColaboradores:'colaboradores_importar',planilhaColaboradores:'colaboradores_importar',btnImportarFerias:'colaboradores_importar',planilhaFerias:'colaboradores_importar',btnExportarExcel:'registros_exportar',btnExportarExcelRegistros:'registros_exportar',btnLimparTudo:'registros_limpar',btnGerar:'whatsapp_gerar',btnCopiar:'whatsapp_gerar',btnWhatsApp:'whatsapp_gerar',btnSalvarConfig:'configuracoes_alterar',btnGerenciarPeriodos:'configuracoes_alterar',btnExportar:'backup_gerenciar',arquivoBackup:'backup_gerenciar'};
  Object.entries(mapa).forEach(([id,p])=>{const el=$(id);if(el)el.classList.toggle('hidden',!temPermissao(p))});
  document.querySelectorAll('[data-delete-colaborador]').forEach(x=>x.classList.toggle('hidden',!temPermissao('colaboradores_excluir')));
  document.querySelectorAll('[data-edit]').forEach(x=>x.classList.toggle('hidden',!temPermissao('ocorrencias_editar')));
  document.querySelectorAll('[data-delete]').forEach(x=>x.classList.toggle('hidden',!temPermissao('ocorrencias_excluir')));
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
async function carregarDepoisDoLogin(){statusNuvem(estaOnline()?'Carregando dados...':'Modo offline');try{if(estaOnline()){iniciarRealtime();await sincronizarFilaOffline();await carregarNuvem()}else carregarCacheOffline();if(estaOnline()&&temPermissao('usuarios_gerenciar'))carregarUsuarios().catch(console.error)}catch(e){console.error(e);carregarCacheOffline()}}
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
async function carregarUsuarios(){if(!temPermissao('usuarios_gerenciar'))return;const {data,error}=await db.rpc('xcmg_listar_usuarios',{p_token:usuarioAtual.token});if(error){$('listaUsuarios').innerHTML='<div class="empty">Não foi possível carregar os usuários.</div>';return}const lista=data||[];$('listaUsuarios').innerHTML=lista.length?lista.map(u=>`<div class="user-row"><div><strong>${escapar(u.nome)}</strong><small>Login: ${escapar(u.login)} • ${u.administrador?'Administrador geral':`${(u.permissoes||[]).length} permissão(ões)`} • ${u.ativo?'Ativo':'Inativo'}</small></div><div class="user-row-actions"><button class="secondary" data-edit-user="${u.id}">Editar</button><button class="secondary" data-reset-user="${u.id}">Senha</button><button class="${u.ativo?'danger':'success'}" data-toggle-user="${u.id}" data-active="${u.ativo}">${u.ativo?'Desativar':'Ativar'}</button></div></div>`).join(''):'<div class="empty">Nenhum usuário cadastrado.</div>';window.__xcmgUsuarios=lista}
async function salvarUsuario(){if(!exigirPermissao('usuarios_gerenciar'))return;const nome=$('novoUsuarioNome').value.trim(),login=$('novoUsuarioLogin').value.trim(),senha=$('novoUsuarioSenha').value,administrador=$('novoUsuarioAdmin').checked,permissoes=permissoesSelecionadas();if(!nome||!login){alert('Informe nome e login.');return}if(!editandoUsuarioId&&senha.length<6){alert('A senha inicial deve ter pelo menos 6 caracteres.');return}const fn=editandoUsuarioId?'xcmg_atualizar_usuario':'xcmg_criar_usuario';const args=editandoUsuarioId?{p_token:usuarioAtual.token,p_id:editandoUsuarioId,p_nome:nome,p_login:login,p_administrador:administrador,p_permissoes:permissoes}:{p_token:usuarioAtual.token,p_nome:nome,p_login:login,p_senha:senha,p_administrador:administrador,p_permissoes:permissoes};const {error}=await db.rpc(fn,args);if(error){alert(error.message||'Não foi possível salvar o usuário.');return}$('statusUsuario').textContent=editandoUsuarioId?'Usuário atualizado.':'Usuário criado.';limparFormularioUsuario();await carregarUsuarios();setTimeout(()=>$('statusUsuario').textContent='',2500)}
function editarUsuario(id){const u=(window.__xcmgUsuarios||[]).find(x=>String(x.id)===String(id));if(!u)return;editandoUsuarioId=u.id;$('novoUsuarioNome').value=u.nome;$('novoUsuarioLogin').value=u.login;$('novoUsuarioSenha').value='';$('novoUsuarioAdmin').checked=u.administrador;document.querySelectorAll('#permissoesUsuario input').forEach(x=>x.checked=(u.permissoes||[]).includes(x.value));$('btnCriarUsuario').textContent='Salvar alterações';window.scrollTo({top:0,behavior:'smooth'})}
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
  const ativo=!!(mobile&&dashboardAtivo);

  // v6.5.8: em iPhone/PWA usamos FIXED real. `position: sticky` pode falhar
  // conforme o contêiner de rolagem/browser. Aqui o topo e os KPIs ficam presos
  // ao viewport e o espaço ocupado é compensado no fluxo da página.
  document.body.classList.remove('dashboard-sticky-mobile','dashboard-sticky-compact');
  document.body.classList.toggle('dashboard-fixed-mobile',ativo);

  const registrosAtivo=!!(mobile&&document.getElementById('registros')?.classList.contains('active'));
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
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{abrirPagina(b.dataset.page);requestAnimationFrame(()=>{atualizarStickyMobileDashboard();atualizarMobileDashboardSummary()})}));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{abrirPagina(b.dataset.go);requestAnimationFrame(()=>{atualizarStickyMobileDashboard();atualizarMobileDashboardSummary()})}));
$('nome').addEventListener('change',preencherDadosColaborador);$('foto').addEventListener('change',()=>{const f=$('foto').files[0];removerFotoAtual=false;if(!f){mostrarFoto(fotoAtual.url);return}if(!f.type.startsWith('image/')||f.size>5*1024*1024){alert('Selecione uma imagem de até 5 MB.');$('foto').value='';mostrarFoto(fotoAtual.url);return}mostrarFoto(URL.createObjectURL(f))});$('btnRemoverFoto').addEventListener('click',()=>{removerFotoAtual=true;$('foto').value='';mostrarFoto('')});
carregarCategoriasLocais();atualizarSelectCategorias();$('categoriaMotivo').addEventListener('change',()=>{$('motivo').value='';atualizarListaMotivos();sincronizarTipoComMotivo()});$('motivo').addEventListener('input',sincronizarTipoComMotivo);$('motivo').addEventListener('change',()=>{sincronizarTipoComMotivo();salvarMotivoPersonalizado($('motivo').value)});$('btnAdicionarColaborador').addEventListener('click',adicionarColaborador);$('novoColaboradorNome').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();adicionarColaborador()}});$('btnImportarColaboradores').addEventListener('click',importarColaboradores);$('btnImportarFerias')?.addEventListener('click',importarFerias);$('planilhaFerias')?.addEventListener('change',e=>{const st=$('statusImportacaoFerias');if(st)st.textContent=e.target.files?.[0]?`Arquivo selecionado: ${e.target.files[0].name}. Clique em Importar férias.`:''});$('pesquisaProgramacaoFerias')?.addEventListener('input',renderizarProgramacaoFerias);$('filtroStatusFerias')?.addEventListener('change',renderizarProgramacaoFerias);$('pesquisaColaborador').addEventListener('input',renderizarColaboradores);$('listaColaboradores').addEventListener('click',e=>{const id=e.target.dataset.deleteColaborador;if(id&&exigirPermissao('colaboradores_excluir'))excluirColaborador(id)});$('btnVerTodos').addEventListener('click',()=>abrirPagina('registros'));$('btnExportarRapido').addEventListener('click',exportar);$('inicio').addEventListener('change',()=>{if($('dias').value)atualizarPeriodoPorDias();else if($('fim').value)atualizarDiasPorPeriodo()});$('dias').addEventListener('input',()=>{const v=Number.parseInt($('dias').value,10);if($('dias').value&&(!Number.isInteger(v)||v<1)){$('dias').value='';return}atualizarPeriodoPorDias()});$('fim').addEventListener('change',atualizarDiasPorPeriodo);$('btnSalvar').addEventListener('click',salvarRegistro);$('btnCancelar').addEventListener('click',limparForm);$('btnSalvarConfig').addEventListener('click',salvarConfig);$('btnGerenciarPeriodos').addEventListener('click',abrirGestaoPeriodos);$('btnFecharPeriodos').addEventListener('click',fecharGestaoPeriodos);$('btnSalvarPeriodo').addEventListener('click',salvarPeriodoFechamento);$('btnCancelarPeriodo').addEventListener('click',cancelarEdicaoPeriodo);$('listaPeriodos').addEventListener('click',e=>{const ed=e.target.dataset.editPeriodo,del=e.target.dataset.deletePeriodo;if(ed)editarPeriodoFechamento(ed);if(del)excluirPeriodoFechamento(del)});$('modalPeriodos').addEventListener('click',e=>{if(e.target===$('modalPeriodos'))fecharGestaoPeriodos()});$('btnGerar').addEventListener('click',gerarMensagem);$('btnCopiar').addEventListener('click',async()=>{const t=gerarMensagem();try{await navigator.clipboard.writeText(t)}catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}$('statusMensagem').textContent='Mensagem copiada com sucesso.';setTimeout(()=>$('statusMensagem').textContent='',2500)});$('btnWhatsApp').addEventListener('click',()=>window.open('https://wa.me/?text='+encodeURIComponent(gerarMensagem()),'_blank'));$('btnExportarExcel').addEventListener('click',gerarPlanilhaExcel);$('btnModoPrint').addEventListener('click',()=>{document.body.classList.toggle('records-print-mode');$('btnModoPrint').textContent=document.body.classList.contains('records-print-mode')?'✕ Sair do Print':'📷 Modo Print'});$('btnExportarExcelRegistros').addEventListener('click',gerarPlanilhaExcel);$('btnLimparTudo').addEventListener('click',async()=>{if(confirm('Deseja apagar todos os registros?')){const {error}=await db.from('xcmg_registros').delete().neq('id',0);if(error)alert('Não foi possível apagar os registros.');else await carregarNuvem(true)}});document.querySelectorAll('[data-occurrence-view]').forEach(btn=>btn.addEventListener('click',()=>selecionarVisualizacaoOcorrencias(btn.dataset.occurrenceView||'dia')));$('dataPainel').addEventListener('change',()=>{atualizarTudo();agendarMobileDashboardSummary()});$('mostrarTodosRegistros').checked=localStorage.getItem(VIEW_KEY)!=='0';$('mostrarTodosRegistros').addEventListener('change',()=>{localStorage.setItem(VIEW_KEY,$('mostrarTodosRegistros').checked?'1':'0');renderizarRegistros()});$('pesquisa').addEventListener('input',renderizarRegistros);$('filtroTipo').addEventListener('change',renderizarRegistros);$('filtroLocal').addEventListener('change',renderizarRegistros);$('filtroPeriodo').addEventListener('change',renderizarRegistros);$('listaRegistros').addEventListener('click',e=>{const ed=e.target.dataset.edit,del=e.target.dataset.delete;if(ed&&exigirPermissao('ocorrencias_editar'))editar(ed);if(del&&exigirPermissao('ocorrencias_excluir'))excluir(del)});$('btnExportar').addEventListener('click',exportar);$('arquivoBackup').addEventListener('change',e=>{if(e.target.files[0])importar(e.target.files[0]);e.target.value=''});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstalacao=e;$('btnInstalar').classList.remove('hidden')});$('btnInstalar').addEventListener('click',async()=>{if(!promptInstalacao)return;promptInstalacao.prompt();await promptInstalacao.userChoice;promptInstalacao=null;$('btnInstalar').classList.add('hidden')});if(location.protocol.startsWith('http')&&'serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
$('btnTema').addEventListener('click',alternarTema);aplicarTema(document.documentElement.dataset.theme||'dark');
$('btnAdicionarCategoria')?.addEventListener('click',adicionarCategoria);$('listaCategoriasAdmin')?.addEventListener('click',acaoCategoriaAdmin);$('btnEntrar').addEventListener('click',entrar);$('btnVerSenhaLogin').addEventListener('click',alternarVisibilidadeSenha);['loginUsuario','loginSenha'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')entrar()}));$('loginUsuario').value=localStorage.getItem(LAST_LOGIN_KEY)||'';if($('loginUsuario').value)$('loginSenha').focus();else $('loginUsuario').focus();$('btnSair').addEventListener('click',sair);$('btnCriarUsuario').addEventListener('click',salvarUsuario);$('novoUsuarioAdmin').addEventListener('change',()=>document.querySelectorAll('#permissoesUsuario input').forEach(x=>x.disabled=$('novoUsuarioAdmin').checked));$('listaUsuarios').addEventListener('click',e=>{const ed=e.target.dataset.editUser,rs=e.target.dataset.resetUser,tg=e.target.dataset.toggleUser;if(ed)editarUsuario(ed);if(rs)redefinirSenhaUsuario(rs);if(tg)alternarUsuario(tg,e.target.dataset.active==='true')});$('dataPainel').value=hoje();window.addEventListener('offline',()=>{conexaoReal=false;statusNuvem(`Offline • ${filaOffline().length} alteração(ões) pendente(s)`,true)});window.addEventListener('online',async()=>{statusNuvem('Verificando conexão...');if(await verificarConexaoReal()){statusNuvem('Internet restabelecida. Sincronizando...');sincronizarFilaOffline().catch(console.error)}});setInterval(()=>verificarConexaoReal().catch(()=>{}),4000);verificarConexaoReal().catch(()=>{});restaurarSessao();atualizarStickyMobileDashboard();atualizarMobileDashboardSummary();
// Evita ciclo infinito: aplicarPermissoes altera textos e isso também gera mutações.
const observerPermissoes=new MutationObserver(()=>{
  if(!usuarioAtual)return;
  observerPermissoes.disconnect();
  aplicarPermissoes();
  observerPermissoes.observe(document.body,{subtree:true,childList:true});
});
observerPermissoes.observe(document.body,{subtree:true,childList:true});
})();
