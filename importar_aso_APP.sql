-- Execute após a migração do módulo ASO. Importação APP.xlsx (51 nomes).
-- Datas de exame inferidas pela periodicidade anual; não sobrescreve ASO existente.
BEGIN;
CREATE TEMP TABLE aso_origem (nome text, vencimento date) ON COMMIT DROP;
INSERT INTO aso_origem VALUES
('NEXVALDO DO CARMO COSTEIRA', DATE '2027-06-19'),
('MICHELE RODRIGUES SILVA', DATE '2027-06-25'),
('GILMARLYS FERREIRA LIMA', DATE '2027-01-12'),
('DORIEL FERREIRA DA SILVA', DATE '2027-03-16'),
('JOSÉ RENATO PEREIRA DA SILVA', DATE '2027-03-16'),
('JOZELINO NEVES PEREIRA', DATE '2027-03-16'),
('KEMUEL AQUINO SILVA', DATE '2027-03-16'),
('WELLINGTON REIS SILVA JUNIOR', DATE '2027-03-16'),
('CARLOS CESAR QUARESMA VIEIRA', DATE '2027-03-16'),
('GENILSON MARTINS SOARES', DATE '2027-03-16'),
('ISAIAS DE SOUZA DA SILVA', DATE '2027-03-16'),
('LETICIA BARROS DA SILVA', DATE '2027-03-16'),
('LUIS PASTORA LIMA FILHO', DATE '2027-03-16'),
('MARCONE ALMEIDA DA SILVA', DATE '2027-03-16'),
('ANTONIO CARVALHO LOPES', DATE '2027-03-16'),
('EDSON DE OLIVEIRA ALVES', DATE '2027-03-19'),
('EDSON DOS SANTOS NETO', DATE '2027-03-20'),
('ELISSON LISBOA ALBUQUERQUE', DATE '2027-03-21'),
('LAUDENIR DA SILVA MONTEIRO', DATE '2027-03-21'),
('JOSE ONIAS MARQUES DA SILVA', DATE '2027-03-23'),
('PAULO FERNANDES RIBEIRO', DATE '2027-03-23'),
('WELLINGTON RIBEIRO ALVES', DATE '2027-03-23'),
('FRANCISCO J DOS SANTOS AMORIM', DATE '2027-03-26'),
('OZIEL DE SOUSA LEITE', DATE '2027-03-27'),
('WELLITON ABIDON BRITO DA SILVA', DATE '2027-03-27'),
('VAGNE TEIXEIRA DE MATOS', DATE '2027-03-27'),
('WARLEI GONCALVES VIEIRA', DATE '2027-03-28'),
('FRANCISCO ALDO DE SOUZA', DATE '2027-04-02'),
('JONAS CUTRIM PINHEIRO', DATE '2027-04-02'),
('MARLEY DA SILVA DIAS', DATE '2027-04-02'),
('WILLY ALMEIDA BARBOSA', DATE '2027-04-02'),
('ROMULO DA COSTA SILVA FONSECA', DATE '2027-04-08'),
('JOSEIRIS COSTA DA SILVA', DATE '2027-04-08'),
('SILVIO DE JESUS PAZ DOS REIS', DATE '2027-04-08'),
('VANILSON DA COSTA LIMA', DATE '2027-04-08'),
('VENILSON CARDOSO DA SILVA', DATE '2027-04-14'),
('WANNDERSON AMORIM ANDRADE', DATE '2027-04-14'),
('JOAO BATISTA DOS REIS SANTOS', DATE '2027-04-17'),
('MARCOS JUNIOR SILVEIRA GOULART', DATE '2027-04-18'),
('CASSIO RODRIGUES DA CONCEICAO', DATE '2027-04-20'),
('SILVE GUEDES DA SILVA', DATE '2027-04-20'),
('LUCAS DA COSTA FERREIRA', DATE '2027-04-20'),
('DENILSON PEREIRA DE OLIVEIRA', DATE '2027-04-28'),
('FABIO LIMA BRITO', DATE '2027-05-02'),
('ARTHUR MAUTA RESENDE', DATE '2027-05-08'),
('JORDANEI PEREIRA AMORIM', DATE '2027-05-14'),
('FRANCISCO MARCIO DE SOUSA LIMA', DATE '2027-05-14'),
('JAILSON VIEIRA PINHEIRO', DATE '2027-05-14'),
('FABIO DA SILVA MARTINS', DATE '2027-05-20'),
('JOSE ILSERLEY DE PAULA ANDRADE', DATE '2027-05-20'),
('EDNALDO SENA FURTADO', DATE '2027-06-01');
CREATE TEMP TABLE aso_conferencia ON COMMIT DROP AS
WITH origem AS (SELECT *, regexp_replace(translate(upper(trim(nome)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'), '[[:space:]]+', ' ', 'g') chave FROM aso_origem),
efetivo AS (SELECT id, status, regexp_replace(translate(upper(trim(nome_completo)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'), '[[:space:]]+', ' ', 'g') chave FROM public.xcmg_colaboradores)
SELECT o.nome,o.vencimento,(o.vencimento-interval '1 year')::date data_exame, count(e.id) total, count(e.id) FILTER (WHERE lower(trim(e.status))='ativo') ativos, min(e.id) FILTER (WHERE lower(trim(e.status))='ativo') colaborador_id
FROM origem o LEFT JOIN efetivo e USING(chave) GROUP BY o.nome,o.vencimento;
CREATE TEMP TABLE aso_importados ON COMMIT DROP AS
WITH inseridos AS (
INSERT INTO public.xcmg_aso (colaborador_id,data_exame,vencimento_excepcional,status)
SELECT colaborador_id,data_exame, CASE WHEN (data_exame+interval '1 year')::date<>vencimento THEN vencimento END,'Não programado'
FROM aso_conferencia WHERE total=1 AND ativos=1 AND data_exame <= (now() at time zone 'America/Belem')::date
ON CONFLICT (colaborador_id) DO NOTHING RETURNING colaborador_id)
SELECT * FROM inseridos;
SELECT c.nome,c.data_exame,c.vencimento,CASE WHEN i.colaborador_id IS NOT NULL THEN 'Importado' WHEN c.total=0 THEN 'Nome não localizado' WHEN c.total>1 THEN 'Nome duplicado' WHEN c.ativos=0 THEN 'Não ativo' WHEN c.data_exame>(now() at time zone 'America/Belem')::date THEN 'Data futura: revisar' ELSE 'ASO existente preservado' END resultado FROM aso_conferencia c LEFT JOIN aso_importados i USING(colaborador_id) ORDER BY resultado,nome;
COMMIT;
