XCMG Control v6.10.85
Novo módulo Homem × Frota.

- Novo menu Homem × Frota logo abaixo de Efetivo.
- Área + Função + Equipamento formam a posição operacional e permanecem no controle mesmo sem nome/matrícula.
- Nome e matrícula são editáveis e podem ficar pendentes.
- Painel automático com total de posições, disponíveis, pendentes, cobertura e déficit por função.
- Ausências temporárias são identificadas pela data do painel usando Férias, Ocorrências e status do Efetivo.
- Importação de Excel/CSV pela combinação Área + Função + Equipamento, sem apagar posições ausentes da planilha.
- Exportação Excel com situação atual de cada posição.
- Modelo de importação incluso: modelo_homem_frota.csv.
- Preservado o menu mobile da v6.10.80 e os módulos já existentes.

IMPORTANTE PARA SINCRONIZAR HOMEM × FROTA ENTRE APARELHOS:
1. No Supabase, abra o SQL Editor.
2. Execute o arquivo supabase_migracao_v6.10.82_homem_frota.sql uma única vez.
3. Depois publique esta versão normalmente no mesmo projeto.
4. Sem essa migração, o novo módulo continua funcionando localmente no aparelho, mas não sincroniza sua base entre dispositivos.

XCMG Control v6.10.17
Cancelamento de férias corrigido.

- CANCELAR não mantém mais uma programação ativa com status CANCELADO.
- Ao cancelar, o registro ativo é excluído da tabela de programação e o colaborador volta automaticamente para A PROGRAMAR.
- O motivo do cancelamento permanece registrado no Histórico de Férias.
- Programações CANCELADAS antigas são removidas da base ativa ao sincronizar, liberando uma nova programação para o mesmo período.
- O filtro CANCELADO foi removido da lista ativa porque cancelamento passa a existir somente no histórico.
- Mantidas as correções de aprovação do RH, rolagem e status gerais.

XCMG Control v6.10.16
Aprovação manual do RH corrigida.

- Botão verde "✓ APROVADO PELO RH" aparece quando a programação estiver aguardando decisão do RH.
- Aprovação pode ser confirmada de 50 dias até 1 dia antes do início das férias, inclusive em casos atrasados.
- Ao aprovar, o registro é salvo como aprovado e, quando estiver entre 43 e 1 dia antes, o status visual passa imediatamente para PROGRAMADO.
- O alerta "RH AINDA NÃO APROVOU" desaparece após a confirmação.
- Mantidas as correções de rolagem e toda a lógica existente do módulo Férias.

XCMG Control v6.10.15
Correção geral do módulo Férias.

- Motor único de status para Férias, Dashboard, Efetivo e Registros.
- Planilha importada preserva o Status individual de cada linha; a coluna Status tem prioridade sobre Situação.
- Período real prevalece: durante o período = EM FÉRIAS; após o fim = REALIZADO.
- CANCELADO, NÃO APROVADO e REPROGRAMAR não entram no efetivo de férias nem no histórico automático.
- Supabase passa a prevalecer sobre cache antigo para o mesmo colaborador/período.
- Cache legado só é usado quando a base oficial local estiver vazia.
- Rolagem desktop corrigida: cabeçalho e menu ficam fixos; somente o conteúdo da página rola.
- Tabelas de Efetivo e Férias mantêm rolagem horizontal própria sem prender a página.

XCMG Control v6.10.10
Reconstrução estrutural do módulo Férias: uma única base para total, status e KPIs; correção de funções ausentes que interrompiam os contadores.

Versão visual: v6.5.23
XCMG CONTROL v6.3.2 - PROGRAMAÇÃO AUTOMÁTICA DE FÉRIAS

NOVO:
- Campo em Colaboradores para importar planilha de férias.
- Colunas esperadas: Colaborador, Início Férias, Fim e Retorno.
- O nome é validado contra a base do Efetivo; matrícula, função e área são preenchidas automaticamente.
- A importação cria registros futuros de Férias. Eles só ficam ativos no Dashboard quando a Data do painel estiver entre Início e Fim.
- Na data de Retorno, deixam de aparecer em Ocorrências atuais e permanecem em Registros/Histórico.
- Reimportações idênticas são ignoradas para evitar duplicidade.
- Se houver nome não encontrado ou data inválida, a importação é bloqueada para correção.

XCMG Control v6.0.6

Correção: o Resumo por categoria agora reconhece registros antigos sem categoria gravada, classificando Férias, Folga compensada, Atestados e Faltas pelo tipo da ocorrência.

XCMG Control v5.0.1

Melhorias:
- Botão para mostrar/ocultar a senha no login.
- Entrada mais rápida: a tela principal abre logo após validar o usuário.
- Dados carregados em segundo plano.
- Tecla Enter funciona nos campos usuário e senha.
- Último usuário fica preenchido automaticamente.
- Timeout e mensagens claras para conexão lenta.

XCMG CONTROL 4.2.1 - ACESSO DIRETO, SEM LOGIN

IMPORTANTE: antes de publicar a nova versão, atualize o banco:

1. No Supabase, abra SQL Editor > Novo.
2. Copie todo o conteúdo do arquivo supabase_setup.sql.
3. Cole no editor e clique em Executar/Run.
4. Aguarde a mensagem de execução concluída.
5. Publique esta pasta no MESMO projeto do Vercel.
6. Abra o aplicativo. Ele entrará diretamente no painel, sem e-mail e senha.

O script preserva os registros existentes, atualiza as categorias e cria o armazenamento público das fotos opcionais.

ACESSO PÚBLICO
- Qualquer pessoa que tiver o endereço do aplicativo poderá visualizar e alterar os dados.
- A chave incluída no aplicativo é a chave publicável do Supabase.
- Nunca coloque uma chave secreta/service_role no aplicativo.

ATUALIZAÇÃO NO VERCEL
- Publique no mesmo projeto para manter o endereço atual.
- Caso apareça a versão antiga, feche e abra o aplicativo novamente ou limpe o cache do navegador.

BUILD
- Versão 4.2.0 sem autenticação.
- Código JavaScript verificado sem erros de sintaxe.

NOVIDADES 4.2
- Novos tipos: Outras justificativas e Folga compensada.
- Padronização para Atestado e Falta não justificada.
- Foto ou comprovante opcional, com limite de 5 MB.
- Execute novamente o supabase_setup.sql antes de publicar.


NOVIDADE 4.2.1
- Opção na tela Registros para alternar entre todo o histórico e somente registros ativos na data do painel.
- A escolha de exibição fica salva no navegador.


VERSÃO 4.2.6 - CADASTRO DE COLABORADORES
1. Execute o supabase_setup.sql atualizado no Supabase.
2. Abra Colaboradores para cadastrar manualmente ou importar XLSX/XLS/CSV.
3. A importação substitui completamente a lista anterior.
4. O sistema organiza, remove duplicados, ordena alfabeticamente e exibe primeiro nome + último sobrenome nas ocorrências.


ATUALIZAÇÃO 4.2.6
1. Execute o arquivo supabase_migracao_v4.2.6.sql no SQL Editor do Supabase.
2. Depois abra/publice esta versão.
3. A importação de colaboradores aceita: Matrícula, Nome completo, Função e Área.
4. A mensagem de WhatsApp foi mantida e o novo botão gera planilha Excel para o RH.


ATUALIZAÇÃO 4.2.6
- Novo campo Motivo no cadastro de ocorrências.
- Opções: Atestado Médico, Casamento, Exame Periódico, Falta justificada, Falta Não Justificada, Nascimento e Óbito de familiar.
- O relatório Excel usa o Motivo selecionado.
- A mensagem de WhatsApp permanece inalterada.
- Execute supabase_migracao_v4.2.6.sql uma única vez.


XCMG CONTROL v5.0 - USUÁRIOS E PERMISSÕES
1. Execute supabase_migracao_v5.0_usuarios.sql no SQL Editor.
2. Abra o sistema e entre com: usuário admin / senha Admin@123.
3. Vá em Usuários, altere a senha do administrador e crie os demais usuários.
4. Marque somente as permissões que cada usuário deverá possuir.
5. Esta versão não inclui auditoria, conforme solicitado.


VERSÃO 5.0.2
- Login via requisição direta com timeout de 5 segundos.
- Evita travamento permanente em Validando acesso.
- Sessão salva é validada com timeout de 3,5 segundos.
- Botão de visualizar senha mantido.
- Não exige novo SQL.


VERSÃO 5.0.4
- Botão Sair movido para o canto superior direito.
- Encerramento de sessão corrigido e imediato.
- Confirmação antes de sair.
- Usuário conectado visível no cabeçalho.
- Não requer novo SQL.

ATUALIZAÇÃO 6.0.1 — INTERFACE EXECUTIVA
- Nova identidade visual clara e corporativa, diferente do XCMG Report.
- Área principal em cinza-claro, cartões brancos e menu lateral executivo.
- Dashboard com KPIs compactos, bordas suaves e melhor hierarquia visual.
- Cabeçalho fixo, mais leve e organizado.
- Formulários, registros, usuários e login adaptados à nova identidade.
- Layout responsivo preservado para computador, tablet e celular.
- Nenhuma regra de negócio ou sincronização foi removida.


ATUALIZAÇÃO 6.0.5 — CADASTRO SIMPLIFICADO
- Removido o campo visível “Tipo da ocorrência”.
- O tipo passa a ser definido automaticamente pelo motivo escolhido.
- Mantidos apenas “Motivo para a planilha do RH” e “Informação da mensagem”.
- A informação da mensagem agora é usada no texto do WhatsApp.


NOVIDADE DA VERSÃO 6.0.5
- O campo “Motivo para a planilha do RH” agora permite selecionar uma sugestão ou digitar livremente um novo motivo.
- Motivos personalizados ficam salvos no navegador e aparecem automaticamente nas próximas utilizações.


VERSÃO 6.0.5
- Resumo por categoria no Dashboard.
- Cadastro de categorias e motivos em Configurações.
- Somente o Administrador geral pode criar, renomear ou excluir categorias e motivos.
- Execute supabase_migracao_v6.0.5_categorias.sql no SQL Editor para preservar a categoria em cada ocorrência.


VERSÃO 6.0.7 — FUNCIONAMENTO OFFLINE
- Abra uma vez com internet para armazenar o aplicativo e os dados no aparelho.
- Ocorrências, edições, exclusões, colaboradores, configurações e categorias podem ser salvos sem internet.
- As alterações ficam em fila e são enviadas automaticamente quando a conexão voltar.
- O login offline usa a última sessão válida salva no aparelho.
- Fotos novas precisam de internet; salve a ocorrência offline e anexe a foto depois.
- Publique em HTTPS e instale como PWA. O modo offline não funciona corretamente ao abrir o index.html diretamente por file://.


VERSÃO 6.0.8 - CORREÇÃO DO LOGIN OFFLINE
- Faça pelo menos um login com internet em cada aparelho.
- Depois disso, o mesmo usuário e senha poderão ser usados sem internet.
- Se houver uma sessão salva e o servidor estiver indisponível, o sistema abre pelo cache local.
- Ao publicar uma nova versão, abra o sistema uma vez online para atualizar o cache.

VERSÃO 6.0.9 - INTERFACE MÓVEL COMPACTA
- Menu do celular movido para a parte inferior da tela.
- Barra inferior fixa com suporte à área segura do iPhone.
- Cabeçalho, data, status e controles reduzidos.
- Cartões do dashboard menores e com melhor aproveitamento do espaço.
- Rodapé ocultado no celular.
- Campo de formulário mantém 16 px para impedir zoom automático no iPhone.
- Computador e tablet mantêm o layout tradicional.

VERSÃO 6.0.13 - GERENCIAMENTO DE PERÍODOS DE FECHAMENTO
- Mantido o cálculo automático padrão do dia 10 ao dia 09.
- Adicionado botão "Gerenciar períodos" na tela de Registros.
- Permite cadastrar, editar e excluir períodos excepcionais quando o RH antecipar ou alterar o fechamento.
- O sistema impede sobreposição entre períodos excepcionais.
- Alterar ou excluir um período NÃO apaga registros; apenas muda a classificação do período conforme a data.
- A planilha Excel mantém todas as colunas existentes e a coluna "Período".
- Para sincronizar períodos excepcionais entre todos os dispositivos, execute uma única vez o arquivo supabase_migracao_v6.0.13_periodos.sql no SQL Editor do Supabase.


Versão 6.3.1
- Efetivo do Dashboard agora é calculado automaticamente pela base de colaboradores importada.
- Contagem usa matrícula como chave principal e nome como fallback, evitando duplicidades.
- Importação e sincronização de colaboradores atualizam o Dashboard imediatamente.
- Campo Efetivo total em Configurações ficou somente leitura para evitar divergência.


VERSÃO 6.3.3 — ALERTA DE FÉRIAS
- Dashboard mostra automaticamente colaboradores que iniciam férias nos próximos 10 dias.
- Contagem regressiva baseada na Data do painel.
- Faixas de atenção: 10–7 dias, 6–3 dias e 2–1 dia.
- No dia do início, o colaborador deixa o alerta e passa a constar como Em férias nas ocorrências atuais.


Versão 6.3.7
- Programação de Férias passa a ser a fonte oficial do painel Próximas férias.
- Importação grava a programação antes da sincronização dos registros.
- Dashboard lê diretamente a programação, sem depender do filtro de ocorrências.
- Nova tabela Férias importadas permite conferir o que foi gravado.

============================================================
XCMG CONTROL v6.4.0 — PROGRAMAÇÃO DE FÉRIAS NO SUPABASE
============================================================

1. No Supabase, abra SQL Editor.
2. Execute o arquivo: supabase_migracao_v6.4.0_ferias.sql
3. Publique/abra novamente o aplicativo.
4. Em Colaboradores > Importar programação de férias, importe a planilha.
5. O status abaixo do botão deve mostrar:
   "Fonte: Supabase • programação sincronizada entre dispositivos".

A importação agora salva TODAS as linhas válidas da planilha de férias,
mesmo quando algum nome ainda não estiver presente no Efetivo. Quando o
nome existir no Efetivo, matrícula, função e área são completados.

Se a migração ainda não tiver sido executada, o aplicativo mantém uma
cópia local e informa claramente que a fonte em nuvem não está disponível.

XCMG CONTROL v6.4.1 — IMPORTAÇÃO DE FÉRIAS CONFIRMADA
- Remove duplicidades da planilha antes do upsert.
- Grava em lotes no Supabase.
- Falha de gravação agora interrompe a importação e mostra o erro real.
- Confere no Supabase cada programação após o envio.
- Informa o projeto Supabase usado pelo aplicativo e o total confirmado.


VERSÃO 6.4.4
- Programação futura de férias aparece somente em Próximas férias/Programação.
- Durante o período entra no Dashboard/Ocorrências e reduz Disponíveis.
- A partir do retorno entra em Registros/Histórico.
- Registros espelho antigos de férias programadas são ignorados nas telas operacionais para evitar duplicidade.


VERSÃO 6.4.6
- Registros consolidados: férias automáticas ativas aparecem na tela Registros mesmo sem lançamento manual.
- Férias futuras continuam exclusivas da Programação/Próximas férias.
- Férias concluídas permanecem no histórico.
- Programação oficial tem prioridade sobre registro manual equivalente.


v6.5.43: Corrigida a exibição da Área (Mina/Usina) nos cards de Ocorrências no mobile, preservando o layout compacto de até 10 nomes. A área agora usa o campo do registro e, se necessário, o cadastro do colaborador como fallback.


v6.5.55 — Ocorrências atuais no desktop padronizadas com Ocorrências do dia (Nome/Função | Área | Data | Tipo).

v6.5.55 — Ocorrências atuais e Ocorrências do dia usam 100% o mesmo renderizador visual; muda somente a lista de dados da aba.


v6.5.56 — Corrigida a lógica das abas do Dashboard: Ocorrências do dia usa a data selecionada; Ocorrências atuais usa sempre a data de hoje. Layout permanece 100% igual.

v6.6.0 — NOVO MÓDULO EFETIVO
- A antiga área Colaboradores foi transformada em Efetivo, base central das informações de RH.
- Campos: Área, Matrícula, Nome completo, Função, Data de admissão, Data de nascimento, CPF, Turma e Status.
- Somente colaboradores com status Ativo entram na contagem do efetivo do Dashboard e na seleção de novas ocorrências.
- Status disponíveis: Ativo, INSS/Afastado, Mudança de turma, Desligado e Inativo.
- Colaboradores não ativos permanecem cadastrados e consultáveis.
- Alterações cadastrais e mudanças de status geram histórico; mudança de status exige motivo.
- A importação passou a incluir ou atualizar pela matrícula, sem apagar colaboradores e históricos anteriores.
- Filtros por área, turma e status, pesquisa, cópia da tabela e exportação exclusiva do efetivo em Excel.
- CPF protegido na tela e completo somente na cópia/exportação autorizada.
- A exportação do efetivo é independente da exportação das pendências/ocorrências.

ATIVAÇÃO DO MÓDULO
1. No Supabase, abra o SQL Editor.
2. Execute todo o arquivo supabase_migracao_v6.6.0_efetivo.sql uma única vez.
3. Atualize/republique os arquivos do aplicativo.
4. Abra Efetivo e faça a importação inicial da planilha.
XCMG CONTROL v6.6.3 — MÓDULO EFETIVO RH

- Corrigida a leitura da Data de admissão em células de data, texto ou número do Excel.
- Reconhecimento ampliado para cabeçalhos que contenham “Admis”.
- Área, nome completo, função e turma exibidos e exportados em letras maiúsculas.

- Corrigido o erro “duplicate key value violates unique constraint”.
- A importação agora identifica o colaborador pela matrícula ou pelo nome completo antes de incluir um novo cadastro.
- Execute uma vez: supabase_migracao_v6.6.2_corrigir_importacao_efetivo.sql.

- Relação completa do efetivo posicionada imediatamente abaixo do cadastro e da importação inicial.
- Todas as informações são exibidas integralmente na tabela, inclusive o CPF.

- A antiga área Colaboradores passou a se chamar Efetivo.
- O efetivo ativo agora considera somente colaboradores com status Ativo.
- Cadastro completo: Área, Matrícula, Nome, Função, Admissão, Nascimento, CPF, Turma e Status.
- Edição com motivo obrigatório quando houver alteração de status.
- Status disponíveis: Ativo, INSS/Afastado, Mudança de turma, Desligado e Inativo.
- Colaboradores inativos permanecem no cadastro e no histórico, sem entrar no efetivo ativo.
- Importação atualiza pela matrícula e não apaga a lista nem o histórico.
- Filtros por área, turma e status, além da pesquisa geral.
- Cópia da tabela para e-mail e exportação própria do efetivo em Excel.
- A exportação do efetivo é independente da exportação de pendências/ocorrências.
- CPF completo na tela, na cópia e na exportação.
- Migração obrigatória: supabase_migracao_v6.6.0_efetivo.sql.
XCMG CONTROL v6.7.0 — MÓDULO INDEPENDENTE DE FÉRIAS

- Férias agora possui página própria no menu, logo abaixo de Efetivo.
- Programação de férias retirada da página Efetivo.
- Cadastro manual ligado ao cadastro central do Efetivo.
- Matrícula, área, função e admissão preenchidas automaticamente.
- Fim e retorno calculados automaticamente pela data inicial e quantidade de dias.
- Toda nova programação entra como A PROGRAMAR até aprovação do RH.
- Aprovação exige permissão específica e registra usuário, data e hora.
- Alerta antes de salvar/aprovar quando houver conflito de mesma função entre Mina e Usina.
- Alerta quando a programação tiver menos de 60 dias de antecedência.
- Importação ampliada para a matriz anual com dias, abono e 1ª parcela do 13º.
- Histórico de programação e aprovação.
- Migração obrigatória: supabase_migracao_v6.7.0_modulo_ferias.sql.

XCMG CONTROL v6.7.1 — FÉRIAS VINCULADAS AO EFETIVO

- Matrícula é o primeiro critério de vínculo; nome completo é usado como alternativa.
- Dados oficiais de Área, Matrícula, Nome, Função e Admissão sempre vêm do Efetivo.
- Linhas sem vínculo com o Efetivo não são importadas.
- Férias passadas são REALIZADAS e férias em andamento são EM FÉRIAS, independentemente da aprovação antiga.
- Alertas de 60 dias nunca mostram números negativos.
- Conflitos incluem todas as funções do grupo OPERADOR DE GUINDASTE e consideram Mina e Usina.
- Relação ampliada com período aquisitivo, limite de concessão, situação, abono e 13º.

XCMG CONTROL v6.8.0 — CONTROLE TOTAL DE FÉRIAS

- Aprovação do RH separada da situação automática das férias.
- Aprovação permitida antecipadamente, mesmo antes do aviso preventivo.
- Ações: Editar, Aprovar, Não aprovar e Cancelar.
- Ao editar ou antecipar a data, a programação volta para análise do RH e mantém histórico.
- Situações automáticas: A PROGRAMAR, AVISO DE ENVIO PARA RH, AGUARDANDO RH, PROGRAMADO, EM FÉRIAS e REALIZADO.
- Depois do retorno, o colaborador reaparece nas Pendências do Efetivo quando não possui nova programação.
- Alertas do limite de concessão: 120, 90, 60 e 30 dias, além de FÉRIAS VENCIDAS.
- Alerta de 60 dias para aprovação é separado do alerta do limite de concessão.

XCMG CONTROL v6.8.1 — SITUAÇÕES AUTOMÁTICAS CORRIGIDAS

- A PROGRAMAR: mais de 60 dias para o início.
- AVISO DE ENVIO PARA RH: entre 51 e 60 dias.
- AGUARDANDO RH: de 0 a 50 dias, quando ainda não aprovado.
- PROGRAMADO: aprovado pelo RH, mesmo quando aprovado antecipadamente.
- EM FÉRIAS: data atual entre o início e o fim.
- REALIZADO: data atual posterior ao fim.
- NÃO APROVADO, REPROGRAMAR e CANCELADO permanecem conforme a ação registrada.
- A ordem das regras impede que férias atuais ou passadas apareçam como avisos futuros.


XCMG CONTROL v6.8.2 — PLANILHA COMO BASE OFICIAL DE FÉRIAS
- Programações importadas da planilha passam a ser consideradas programações já existentes.
- Registros importados legados que estavam como A PROGRAMAR são reconhecidos como APROVADO.
- Situação automática prioriza as datas: EM FÉRIAS durante o período e REALIZADO após o fim.
- Programações futuras da planilha aparecem como PROGRAMADO, sem exigir nova aprovação do RH.
- Novas programações cadastradas diretamente no aplicativo continuam seguindo o fluxo A PROGRAMAR / AVISO / AGUARDANDO RH / PROGRAMADO.


VERSÃO 6.9.2 — CONTROLE CONTÍNUO DE FÉRIAS
- Aplicativo passa a ser a fonte principal do planejamento; importação de férias fica como recurso excepcional.
- KPIs: A programar, Aguardando RH, Programados, Em férias, Concessivo em alerta e Concessivo crítico.
- Período aquisitivo e limite concessivo permanecem no controle e geram alertas automáticos para os ciclos anuais.
- Alertas concessivos independentes do fluxo operacional de aprovação do RH.
- Programações importadas continuam preservadas como programação oficial preexistente.


VERSÃO 6.9.2
- Coluna “Aprovação RH” renomeada para “Status”.
- Removida a exibição “CONFORME PLANILHA”.
- Aprovações passam a ser exibidas como “APROVADO”.
- Registros importados permanecem reconhecidos como programação oficial, sem exibir a origem na tabela.


VERSÃO 6.9.4 — STATUS DE FÉRIAS ALINHADO À PLANILHA OFICIAL
- Regra de Status reproduz a fórmula oficial: REALIZADO > EM FÉRIAS > Prog. Antecipada > até 50 dias PROGRAMADO > 51 a 60 dias LANÇADO NO GL > acima de 60 dias A PROGRAMAR.
- Gleidson e demais programações distantes deixam de ser marcados automaticamente como PROGRAMADO.
- Importação excepcional passa a ler a coluna Prog. Antecipada.
- Nome, matrícula, função, área e admissão exibidos no módulo de férias são sempre atualizados pelo Efetivo Padrão.
- Removida a duplicidade visual Situação/Status: a tabela usa um único Status operacional.
- Registros antigos importados como APROVADO deixam de forçar PROGRAMADO; para preservar Prog. Antecipada de linhas antigas, faça uma única reimportação da planilha-base após esta atualização.


VERSÃO 6.9.7 — ORDEM OPERACIONAL DAS PROGRAMAÇÕES DE FÉRIAS
- Programações de férias passam a ser exibidas por prioridade operacional.
- EM FÉRIAS aparece primeiro.
- PROGRAMADO aparece em seguida.
- LANÇADO NO GL e A PROGRAMAR vêm depois.
- REALIZADO fica por último; dentro dos realizados, os mais recentes aparecem primeiro.

VERSÃO 6.10.0 — FLUXO AUTOMÁTICO DE FÉRIAS E APROVAÇÃO RH
- Mais de 60 dias: A PROGRAMAR.
- De 60 a 51 dias: ALERTA PARA ENVIAR AO RH.
- De 50 a 46 dias: AGUARDANDO APROVAÇÃO RH; confirmação manual "APROVOU? SIM" disponível.
- De 45 a 1 dia: PROGRAMADO somente se o RH já tiver sido confirmado; caso contrário, APROVAÇÃO RH PENDENTE.
- Durante o período: FÉRIAS.
- Na data de retorno ou depois: REALIZADO.
- Mantidos alertas de período aquisitivo, limite concessivo e conflitos de função.
- Programações continuam ordenadas com férias/programados no topo e realizados por último.


VERSÃO 6.10.3 — CORREÇÃO EFETIVO DE FÉRIAS
- KPI Férias passa a ser calculado diretamente pelas datas de início/fim da programação oficial e registros manuais.
- O cálculo não depende mais do texto do Status/RH (FÉRIAS, EM FÉRIAS etc.).
- Deduplicação por colaborador evita contagem dupla.


VERSÃO 6.10.6
- Corrigido erro "dadosEfetivoFerias is not defined".
- Importação excepcional de férias volta a funcionar.
- Programações da nuvem/cache são normalizadas e vinculadas ao Efetivo por ID, matrícula ou nome.
- Tela de Férias deixa de zerar por falha JavaScript durante carregamento.

Correções v6.10.10: rolagem do Efetivo restaurada; filtros/selects corrigidos no modo escuro; módulo Férias preservado.


=== v6.10.23 — PERÍODOS AQUISITIVOS E PENDÊNCIAS CORRIGIDOS ===
- Corrigido cálculo do fim do período aquisitivo (1 dia antes do aniversário de admissão).
- Corrigido início do período concessivo (dia seguinte ao fim do aquisitivo).
- Corrigido limite para férias (fim do período concessivo).
- Pendência é removida apenas quando há programação válida para aquele ciclo.
- Mantida a regra: somente efetivo ativo participa da relação atual de férias.


=== v6.10.25 — CICLOS DE FÉRIAS E PERÍODOS AQUISITIVOS ===
- Cada férias válida passa a consumir o período aquisitivo mais antigo ainda não atendido.
- Férias REALIZADAS, PROGRAMADAS ou EM FÉRIAS são consideradas na sequência cronológica.
- CANCELADO, NÃO APROVADO e REPROGRAMAR não consomem período aquisitivo.
- Depois da 1ª férias, o controle avança automaticamente para o 2º período; depois da 2ª, para o 3º, e assim por diante.
- Evita marcar como vencido um período antigo que já foi gozado, como nos exemplos de Paulo e Laudenir.


VERSÃO 6.10.26
- Período aquisitivo continua automático por padrão.
- Novo botão Ajustar período nas Pendências e próximos períodos.
- Permite avançar manualmente o ciclo quando houver férias anteriores realizadas em outra turma e sem histórico no aplicativo.
- Ajuste exige motivo e é registrado no histórico do Efetivo quando online.
- Opção de voltar ao cálculo automático.
- Após o ajuste, os ciclos seguintes continuam avançando automaticamente.

VERSÃO 6.10.27
- Férias reorganizada como tela de gestão em zoom 100%.
- 7 KPIs compactos em uma faixa no desktop.
- Programações e Pendências passam a aparecer antes do formulário.
- Cadastro fica recolhido e abre por + Nova programação.
- Formulário horizontal compacto; importação excepcional recolhível.
- Tabelas e filtros compactados sem remover informações ou regras de negócio.


VERSÃO 6.10.35
- Ajuste de período aquisitivo simplificado por quantidade de férias anteriores realizadas fora do sistema.
- Ciclos externos consomem os primeiros períodos aquisitivos.
- Férias válidas registradas no XCMG Control consomem automaticamente os ciclos seguintes, sem contagem duplicada.
- Quantidade externa pode ser alterada ou zerada; o próximo período é recalculado automaticamente pela admissão.


VERSÃO 6.10.37
- Edição de férias abre em painel lateral fixo à esquerda, mantendo a posição da lista.
- Formulário de edição não rola mais para o final da página.
- Painel tem rolagem própria, cabeçalho e ações fixas, e fecha com Fechar/Cancelar edição/Esc.


v6.10.83 — Integração Homem × Frota / Efetivo
- Ao informar uma matrícula existente no Efetivo, Nome completo e Função são preenchidos automaticamente.
- Sem matrícula, a Função continua editável e obrigatória para permitir posição pendente.
- Ajustado cache do service worker para evitar referência a arquivo de migração inexistente.


v6.10.85 — Vincular profissional no Homem × Frota
- Posições pendentes agora exibem a ação “Vincular profissional”.
- A lista de profissionais é carregada diretamente do Efetivo.
- Matrícula, nome e função são exibidos na seleção.
- Profissionais com função compatível aparecem primeiro.
- O sistema alerta quando a função é diferente da posição ou quando o profissional já está vinculado a outra frota.
- Área, função e equipamento da posição permanecem intactos durante o vínculo.
