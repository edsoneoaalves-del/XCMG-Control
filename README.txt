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
