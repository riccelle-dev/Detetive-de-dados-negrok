// backend/setup.js
// node backend/setup.js  ← rode uma única vez para criar o banco
//
// SCHEMA GENÉRICO: cada caso define suas próprias "entidades" (tipos_entidade),
// cada entidade tem os atributos que a professora quiser (atributos_entidade),
// e cada tipo de entidade vira uma tabela real do SQLite (ent_<id>) — isso é o
// que permite que as pistas continuem sendo consultas SQL de verdade.

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, 'database.db')

function slugify(s) {
  const base = (s || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const semDigitoInicial = /^\d/.test(base) ? 'c_' + base : base
  return semDigitoInicial || 'campo'
}

async function main() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  // ── Schema ──────────────────────────────────────────────────
  db.run(`
    CREATE TABLE casos (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo              TEXT NOT NULL,
      descricao           TEXT NOT NULL,
      cidade              TEXT,
      estado              TEXT,
      culpado_row_id      INTEGER,
      esconderijo_row_id  INTEGER,
      ativo               INTEGER DEFAULT 1
    );
    CREATE TABLE tipos_entidade (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id        INTEGER NOT NULL,
      nome           TEXT NOT NULL,
      nome_singular  TEXT NOT NULL,
      alias          TEXT NOT NULL,
      tabela         TEXT NOT NULL,
      papel          TEXT,
      icone          TEXT DEFAULT '📁',
      ordem          INTEGER DEFAULT 0
    );
    CREATE TABLE atributos_entidade (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_entidade_id  INTEGER NOT NULL,
      coluna            TEXT NOT NULL,
      label             TEXT NOT NULL,
      tipo_dado         TEXT NOT NULL DEFAULT 'texto',
      principal         INTEGER DEFAULT 0,
      ordem             INTEGER DEFAULT 0
    );
    CREATE TABLE pistas (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id       INTEGER NOT NULL,
      numero        INTEGER NOT NULL,
      titulo        TEXT NOT NULL,
      enunciado     TEXT NOT NULL,
      acao_detetive TEXT,
      conceito_bd   TEXT,
      tabela_alvo   TEXT,
      query_sql     TEXT NOT NULL
    );
    CREATE TABLE logs_acao (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id    INTEGER NOT NULL,
      sessao_id  TEXT NOT NULL,
      pista_id   INTEGER,
      acao       TEXT NOT NULL,
      acerto     INTEGER,
      criado_em  TEXT DEFAULT (datetime('now'))
    );
  `)

  // ── Helpers ─────────────────────────────────────────────────
  function lastId() { return db.exec('SELECT last_insert_rowid()')[0].values[0][0] }
  function get(sql, params = []) {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    return row
  }

  function criarCaso(titulo, descricao, cidade, estado) {
    db.run('INSERT INTO casos (titulo,descricao,cidade,estado) VALUES (?,?,?,?)', [titulo, descricao, cidade, estado])
    return lastId()
  }

  // atributosDefs: [{ coluna, label, tipo: 'texto'|'numero', principal? }]
  function criarTipo(casoId, nome, nomeSingular, papel, atributosDefs) {
    db.run('INSERT INTO tipos_entidade (caso_id,nome,nome_singular,alias,tabela,papel,icone,ordem) VALUES (?,?,?,?,?,?,?,?)',
      [casoId, nome, nomeSingular, slugify(nome), 'PENDING', papel || null, papel === 'culpado' ? '🕵️' : papel === 'esconderijo' ? '📍' : '📁', 0])
    const tipoId = lastId()
    const tabela = 'ent_' + tipoId
    db.run('UPDATE tipos_entidade SET tabela = ? WHERE id = ?', [tabela, tipoId])

    const colsSQL = atributosDefs.map(a => `${a.coluna} ${a.tipo === 'numero' ? 'REAL' : 'TEXT'}`).join(', ')
    db.run(`CREATE TABLE ${tabela} (id INTEGER PRIMARY KEY AUTOINCREMENT, caso_id INTEGER NOT NULL, imagem TEXT${colsSQL ? ', ' + colsSQL : ''})`)

    atributosDefs.forEach((a, i) => {
      db.run('INSERT INTO atributos_entidade (tipo_entidade_id,coluna,label,tipo_dado,principal,ordem) VALUES (?,?,?,?,?,?)',
        [tipoId, a.coluna, a.label, a.tipo, a.principal ? 1 : 0, i])
    })
    return { tipoId, tabela }
  }

  function inserirRegistro(tabela, casoId, valores) {
    const cols = Object.keys(valores)
    const placeholders = cols.map(() => '?').join(',')
    db.run(`INSERT INTO ${tabela} (caso_id, ${cols.join(',')}) VALUES (?, ${placeholders})`, [casoId, ...cols.map(c => valores[c])])
    return lastId()
  }

  function fecharCaso(casoId, tabelaSuspeitos, idSuspeitoNarrativo, tabelaLocais, idLocalNarrativo) {
    const s = get(`SELECT id FROM ${tabelaSuspeitos} WHERE id_suspeito = ?`, [idSuspeitoNarrativo])
    const l = get(`SELECT id FROM ${tabelaLocais} WHERE id_local = ?`, [idLocalNarrativo])
    db.run('UPDATE casos SET culpado_row_id = ?, esconderijo_row_id = ? WHERE id = ?', [s.id, l.id, casoId])
  }

  function pista(caso_id, ...args) {
    db.run(`INSERT INTO pistas (caso_id,numero,titulo,enunciado,acao_detetive,conceito_bd,tabela_alvo,query_sql) VALUES (?,?,?,?,?,?,?,?)`, [caso_id, ...args])
  }

  // ── Definições padrão de atributos (iguais ao schema antigo) ──
  const SUSPEITO_ATTRS = [
    { coluna: 'id_suspeito', label: 'ID narrativo', tipo: 'numero' },
    { coluna: 'nome', label: 'Nome', tipo: 'texto', principal: true },
    { coluna: 'idade', label: 'Idade', tipo: 'numero' },
    { coluna: 'altura_m', label: 'Altura (m)', tipo: 'numero' },
    { coluna: 'peso_kg', label: 'Peso (kg)', tipo: 'numero' },
    { coluna: 'cor_olhos', label: 'Cor dos olhos', tipo: 'texto' },
    { coluna: 'nacionalidade', label: 'Nacionalidade', tipo: 'texto' },
    { coluna: 'naturalidade_cidade', label: 'Cidade natal', tipo: 'texto' },
    { coluna: 'naturalidade_estado', label: 'Estado natal (UF)', tipo: 'texto' },
    { coluna: 'historico', label: 'Histórico', tipo: 'texto' },
    { coluna: 'habilidades', label: 'Habilidades', tipo: 'texto' },
    { coluna: 'motivo_suspeita', label: 'Motivo da suspeita', tipo: 'texto' },
  ]
  const LOCAL_ATTRS = [
    { coluna: 'id_local', label: 'ID narrativo', tipo: 'numero' },
    { coluna: 'nome_comodo', label: 'Nome do cômodo', tipo: 'texto', principal: true },
    { coluna: 'andar', label: 'Andar', tipo: 'texto' },
    { coluna: 'setor', label: 'Setor', tipo: 'texto' },
    { coluna: 'nivel_acesso', label: 'Nível de acesso', tipo: 'texto' },
    { coluna: 'caracteristica_marcante', label: 'Característica marcante', tipo: 'texto' },
    { coluna: 'descricao', label: 'Descrição', tipo: 'texto' },
  ]

  function suspeito(tabela, casoId, id_suspeito, nome, idade, altura_m, peso_kg, cor_olhos, nacionalidade, naturalidade_cidade, naturalidade_estado, historico, habilidades, motivo_suspeita) {
    return inserirRegistro(tabela, casoId, { id_suspeito, nome, idade, altura_m, peso_kg, cor_olhos, nacionalidade, naturalidade_cidade, naturalidade_estado, historico, habilidades, motivo_suspeita })
  }
  function local(tabela, casoId, id_local, nome_comodo, andar, setor, nivel_acesso, caracteristica_marcante, descricao) {
    return inserirRegistro(tabela, casoId, { id_local, nome_comodo, andar, setor, nivel_acesso, caracteristica_marcante, descricao })
  }

  // ── CASO 1: O Manuscrito Perdido ────────────────────────────
  const c1 = criarCaso('O Manuscrito Perdido',
    'Um pergaminho histórico do século XVI foi roubado da Biblioteca Real de Vila Velha durante uma manutenção elétrica. O item estava em uma redoma de vidro blindado que foi aberta com uma chave mestra.',
    'Olinda', 'PE')
  const { tabela: s1 } = criarTipo(c1, 'Suspeitos', 'Suspeito', 'culpado', SUSPEITO_ATTRS)
  const { tabela: l1 } = criarTipo(c1, 'Locais', 'Local', 'esconderijo', LOCAL_ATTRS)

  suspeito(s1, c1, 33210, 'Dr. Arnaldo Peixoto', 59, 1.72, 80.00, 'Castanhos', 'Brasileiro', 'Rio de Janeiro', 'RJ', 'Curador de obras raras há 25 anos, possui as chaves de todas as redomas.', 'Erudição, organização metódica e conhecimento técnico de restauro.', 'Desativou o protocolo de sensores de movimento para "testar a fiação".')
  suspeito(s1, c1, 44922, 'Jonas Silva', 28, 1.78, 74.00, 'Pretos', 'Brasileiro', 'Duque de Caxias', 'RJ', 'Eletricista terceirizado que presta serviços à biblioteca há dois anos.', 'Rapidez física, perícia em sistemas elétricos e escalada.', 'Flagrado por câmera de segurança em setor proibido antes do apagão.')
  suspeito(s1, c1, 55109, 'Mariana Ferraz', 31, 1.64, 55.00, 'Verdes', 'Brasileira', 'Belo Horizonte', 'MG', 'Pesquisa a vida dos jesuítas no Brasil para seu pós-doutorado.', 'Análise paleográfica e paciência investigativa extrema.', 'Tentou entrar na biblioteca com mochila maior do que o permitido.')

  local(l1, c1, 101, 'Hall de Entrada', 'Térreo', null, 'Público', 'Piso em xadrez desgastado', 'Balcão de jacarandá e quadros da fundação de Olinda.')
  local(l1, c1, 102, 'Salão Principal de Leitura', 'Térreo', null, 'Público', 'Estantes labirínticas e vitrais', 'Coração da biblioteca com grandes mesas de leitura coletivas.')
  local(l1, c1, 103, 'Pátio Interno (Jardim dos Freis)', 'Térreo', null, 'Público', 'Fonte de pedra e árvores frutíferas', 'Claustro a céu aberto, ideal para reuniões secretas ou escalada.')
  local(l1, c1, 104, 'Sala de Restauro', 'Térreo', null, 'Restrito', 'Cheiro de produtos químicos e cola', 'Ferramentas afiadas, prensas e lupas espalhadas pelas mesas.')
  local(l1, c1, 105, 'Recepção', 'Térreo', null, 'Público', 'Balcão de jacarandá', 'Local onde fica o funcionário e o livro de registo de visitantes.')
  local(l1, c1, 201, 'Gabinete do Bibliotecário-Mor', 'Primeiro Andar', null, 'Restrito', 'Cofre escondido atrás de quadro', 'Sala luxuosa com tapetes grossos e mesa entulhada de documentos.')
  local(l1, c1, 202, 'Ala de Genealogia', 'Primeiro Andar', null, 'Restrito', 'Registros de famílias nobres', 'Arquivos de nascimentos, terras e posses de Pernambuco.')

  pista(c1, 1, 'O Perímetro de Segurança', 'Um relatório indica que os locais da série 200 (Primeiro Andar) foram lacrados às 14:00 e nenhum sensor foi disparado lá durante o apagão.', 'Descubra quais locais não ficam no Primeiro Andar ou possuem ID menor que 200.', 'WHERE numérico', 'locais', `SELECT id_local, nome_comodo, andar FROM locais WHERE caso_id = ${c1} AND id_local < 200`)
  pista(c1, 2, 'O Registro de Naturalidade', 'Uma testemunha viu um suspeito consultando um mapa rodoviário de Minas Gerais momentos antes do crime.', 'Investigue qual suspeito tem MG como estado de naturalidade.', 'WHERE texto', 'suspeitos', `SELECT id_suspeito, nome, naturalidade_cidade, naturalidade_estado FROM suspeitos WHERE caso_id = ${c1} AND naturalidade_estado = 'MG'`)
  pista(c1, 3, 'O Mistério da Chave Mestra', 'Apenas perfis com habilidade de Análise Paleográfica ou Curadoria poderiam abrir o fecho sem disparar o alarme.', 'Procure por suspeitos que tenham a palavra Paleog ou restauro em suas habilidades.', 'LIKE / OR', 'suspeitos', `SELECT id_suspeito, nome, habilidades FROM suspeitos WHERE caso_id = ${c1} AND (habilidades LIKE '%Paleog%' OR habilidades LIKE '%restauro%')`)
  pista(c1, 4, 'O Log de Movimento', 'O sensor registrou apenas a entrada do ID_SUSPEITO 33210 na Sala de Restauro durante a tarde.', 'Procure pelo suspeito que possui o ID_SUSPEITO 33210 para confirmar seu álibi.', 'WHERE numérico', 'suspeitos', `SELECT id_suspeito, nome FROM suspeitos WHERE caso_id = ${c1} AND id_suspeito = 33210`)
  pista(c1, 5, 'A Evidência Biométrica', 'Próximo ao horário do crime havia uma presença no térreo com menos de 1,70 m de altura.', 'Encontre quem é o suspeito com altura menor que 1.70 metros.', 'WHERE comparação', 'suspeitos', `SELECT id_suspeito, nome, altura_m FROM suspeitos WHERE caso_id = ${c1} AND altura_m < 1.70`)
  pista(c1, 6, 'O Cheiro do Esconderijo', 'Um cão farejador latiu ao sentir cheiro de frutas cítricas e terra úmida.', 'Procure por locais que tenham a palavra frutífera em sua característica ou descrição.', 'LIKE', 'locais', `SELECT id_local, nome_comodo, caracteristica_marcante FROM locais WHERE caso_id = ${c1} AND (caracteristica_marcante LIKE '%frutífera%' OR descricao LIKE '%frutífera%')`)
  pista(c1, 7, 'O Objeto Esquecido', 'Uma mochila com crachá de pesquisadora visitante foi encontrada atrás de um banco de alvenaria.', 'Procure qual suspeito tentou entrar no prédio com uma mochila.', 'Chave estrangeira narrativa', 'suspeitos', `SELECT id_suspeito, nome, motivo_suspeita FROM suspeitos WHERE caso_id = ${c1} AND id_suspeito = 55109`)
  pista(c1, 8, 'O Relatório Final', 'Um vulto foi visto indo para o Pátio (103) às 15:12. O ID_SUSPEITO 55109 não saiu pelo Hall após o apagão.', 'Cruze os dados para confirmar quem é o culpado e onde a peça foi escondida.', 'JOIN', 'suspeitos', `SELECT s.id_suspeito, s.nome, s.altura_m, l.nome_comodo FROM suspeitos s JOIN locais l ON l.caso_id = s.caso_id WHERE s.caso_id = ${c1} AND s.id_suspeito = 55109 AND l.id_local = 103`)

  fecharCaso(c1, s1, 55109, l1, 103)

  // ── CASO 2: O Chip Arara-Azul ───────────────────────────────
  const c2 = criarCaso('O Chip Arara-Azul',
    'Um protótipo de processamento quântico foi subtraído do Laboratório Tecnológico Nexus. O laboratório possui acesso biométrico e o sistema foi invadido digitalmente no momento do furto.',
    'São José dos Campos', 'SP')
  const { tabela: s2 } = criarTipo(c2, 'Suspeitos', 'Suspeito', 'culpado', SUSPEITO_ATTRS)
  const { tabela: l2 } = criarTipo(c2, 'Locais', 'Local', 'esconderijo', LOCAL_ATTRS)

  suspeito(s2, c2, 11043, 'Dr. Marcos Pontes Jr.', 45, 1.80, 85.00, 'Castanhos', 'Brasileiro', 'Campinas', 'SP', 'Um dos criadores da arquitetura do chip Arara-Azul.', 'Engenharia reversa e programação de baixo nível.', 'Teve o acesso negado ao bônus anual da empresa dias antes do incidente.')
  suspeito(s2, c2, 22087, 'Lúcia Cavalcanti', 40, 1.75, 68.00, 'Castanhos', 'Brasileira', 'Recife', 'PE', 'Ex-capitã da PM, gerencia a segurança do laboratório há 5 anos.', 'Estratégia de defesa, tiro e monitoramento de sistemas.', 'O log de segurança mostra que sua senha pessoal foi usada para abrir a porta.')
  suspeito(s2, c2, 33076, 'Thiago Oliveira', 22, 1.70, 63.00, 'Pretos', 'Brasileiro', 'Brasília', 'DF', 'Aluno de Engenharia da Computação, estagiário há 6 meses.', 'Invasão de redes, bypass de firewall e agilidade digital.', 'Instalou um dispositivo USB desconhecido no servidor central na tarde do crime.')

  local(l2, c2, 101, 'Área de Robótica e IA', null, 'Engenharia', 'Padrão', null, 'Espaço com braços mecânicos industriais para automação de testes.')
  local(l2, c2, 102, 'Sala de Análise de Material', null, 'Qualidade', 'Padrão', null, 'Contém espectrômetros e simuladores de estresse térmico.')
  local(l2, c2, 103, 'Sala de Manufatura de Protótipos', null, 'Engenharia', 'Restrito', null, 'Sala limpa (cleanroom) onde os chips são impressos.')
  local(l2, c2, 201, 'Sala de P&D', null, 'Pesquisa', 'Restrito', null, 'Ambiente isolado focado na arquitetura de chips quânticos. Possui cofres de dados locais.')
  local(l2, c2, 202, 'Centro de Comando', null, 'Administração', 'Super Restrito', null, 'Nervo central do laboratório, com acesso direto aos logs e painéis de energia.')
  local(l2, c2, 203, 'Sala de Segurança', null, 'Segurança', 'Super Restrito', null, 'Base de operações da equipe de defesa digital e monitoramento do firewall.')

  pista(c2, 1, 'O Log de Climatização', 'O pico de energia queimou os compressores do setor de Engenharia. O chip derrete sem refrigeração por mais de 10 minutos.', 'Filtre os locais para remover todos que pertencem ao setor de Engenharia.', 'WHERE texto', 'locais', `SELECT id_local, nome_comodo, setor FROM locais WHERE caso_id = ${c2} AND setor != 'Engenharia'`)
  pista(c2, 2, 'O Rastreio de Frequência', 'Salas Super Restrito são Gaiolas de Faraday — bloqueiam 100% dos sinais. O chip está emitindo sinal.', 'Procure os locais cujo nível de acesso não seja Super Restrito.', 'WHERE texto', 'locais', `SELECT id_local, nome_comodo, nivel_acesso FROM locais WHERE caso_id = ${c2} AND nivel_acesso != 'Super Restrito' AND setor != 'Engenharia'`)
  pista(c2, 3, 'A Cancela do Estacionamento', 'O veículo do crachá ID 33076 saiu dois minutos antes do apagão começar.', 'Procure o suspeito com ID_SUSPEITO 33076 para inocentá-lo.', 'WHERE numérico', 'suspeitos', `SELECT id_suspeito, nome FROM suspeitos WHERE caso_id = ${c2} AND id_suspeito = 33076`)
  pista(c2, 4, 'A Tensão na Catraca', 'Uma pessoa de 68 kg ficou presa no fosso da escada durante todo o apagão. A senha de Lúcia foi usada remotamente.', 'Encontre o suspeito que pesa exatamente 68 kg.', 'WHERE comparação', 'suspeitos', `SELECT id_suspeito, nome, peso_kg FROM suspeitos WHERE caso_id = ${c2} AND peso_kg = 68.0`)
  pista(c2, 5, 'O Rastro de Código', 'O invasor desmontou o código base do sistema peça por peça — não foi invasão comum.', 'Investigue qual suspeito possui engenharia reversa em suas habilidades.', 'LIKE', 'suspeitos', `SELECT id_suspeito, nome, habilidades FROM suspeitos WHERE caso_id = ${c2} AND habilidades LIKE '%engenharia reversa%'`)
  pista(c2, 6, 'O Inventário Local', 'Os dados foram redirecionados via cabo para um cômodo com "cofres de dados locais" na descrição.', 'Procure por locais que tenham "cofres de dados locais" em sua descrição.', 'LIKE', 'locais', `SELECT id_local, nome_comodo, descricao FROM locais WHERE caso_id = ${c2} AND descricao LIKE '%cofres de dados locais%'`)
  pista(c2, 7, 'O Bug do Ano Bissexto', 'O perfil que forçou o acesso tinha data de nascimento há mais de 40 anos.', 'Procure os suspeitos que tenham idade maior que 40 anos.', 'WHERE comparação', 'suspeitos', `SELECT id_suspeito, nome, idade FROM suspeitos WHERE caso_id = ${c2} AND idade > 40`)
  pista(c2, 8, 'O Metadado do Documento', 'O IP do e-mail de chantagem pertence ao estado de SP. O texto reclama de bônus negado.', 'Busque o suspeito natural de SP e cruze as informações para encerrar o caso.', 'JOIN', 'suspeitos', `SELECT s.id_suspeito, s.nome, s.naturalidade_estado, l.nome_comodo FROM suspeitos s JOIN locais l ON l.caso_id = s.caso_id WHERE s.caso_id = ${c2} AND s.naturalidade_estado = 'SP' AND l.id_local = 201`)

  fecharCaso(c2, s2, 11043, l2, 201)

  // ── CASO 3: A Moeda Imperial ────────────────────────────────
  const c3 = criarCaso('A Moeda Imperial',
    'Uma raríssima moeda da coroação desapareceu do Museu do Patrimônio durante a troca de turno dos seguranças. A peça foi trocada por uma réplica de latão.',
    'Petrópolis', 'RJ')
  const { tabela: s3 } = criarTipo(c3, 'Suspeitos', 'Suspeito', 'culpado', SUSPEITO_ATTRS)
  const { tabela: l3 } = criarTipo(c3, 'Locais', 'Local', 'esconderijo', LOCAL_ATTRS)

  suspeito(s3, c3, 66041, 'Sr. Wilson Nonato', 62, 1.65, 70.00, 'Cinzas', 'Brasileiro', 'Ouro Preto', 'MG', 'Especialista em numismática e metais preciosos do museu.', 'Forja artística, ourivesaria e perícia em autenticação.', 'Possuía os moldes e ferramentas para criar a réplica encontrada.')
  suspeito(s3, c3, 77052, 'Dra. Helena Valente', 48, 1.67, 60.00, 'Azuis', 'Brasileira', 'Curitiba', 'PR', 'Nomeada diretora há 3 anos para modernizar o museu.', 'Gestão pública, contatos internacionais e acesso às chaves de segurança.', 'Estava com dificuldades financeiras e foi vista com um colecionador.')
  suspeito(s3, c3, 88063, 'Aparecido Bento', 55, 1.74, 88.00, 'Castanhos', 'Brasileiro', 'Três Rios', 'RJ', 'Funcionário concursado, trabalha no prédio há 20 anos.', 'Conhecimento de passagens antigas e manutenção estrutural.', 'Encontrado em um duto de ventilação que dá acesso à sala das moedas.')

  local(l3, c3, 101, 'Salão da Coroação', null, 'Exposição', 'Público', null, 'Onde as joias reais e a moeda original ficavam guardadas sob vidro.')
  local(l3, c3, 102, 'Sala de Exibições Temporárias', null, 'Exposição', 'Público', null, 'Espaço amplo de trânsito variável, ideal para encontros discretos.')
  local(l3, c3, 201, 'Oficina de Restauro', null, 'Técnico', 'Restrito', null, 'Repleta de ferramentas de precisão, forjas de bancada e metais diversos.')
  local(l3, c3, 202, 'Arquivo Histórico', null, 'Administrativo', 'Restrito', null, 'Guarda plantas antigas do prédio e registros originais das peças.')
  local(l3, c3, 203, 'Sala de Segurança', null, 'Segurança', 'Super Restrito', null, 'Ponto crítico de monitoramento; ficou vulnerável durante a troca de turno.')

  pista(c3, 1, 'O Log de Carga', 'A tábua do assoalho suporta no máximo 80 kg. A rota de fuga não quebrou a tábua.', 'Procure por suspeitos cujo peso seja menor ou igual a 80 kg.', 'WHERE comparação', 'suspeitos', `SELECT id_suspeito, nome, peso_kg FROM suspeitos WHERE caso_id = ${c3} AND peso_kg <= 80`)
  pista(c3, 2, 'O Protocolo de Lockdown', 'Nenhum funcionário conseguiu entrar em locais dos setores Administrativo ou Segurança durante o crime.', 'Descarte os locais que sejam dos setores Administrativo ou Segurança.', 'WHERE / NOT IN', 'locais', `SELECT id_local, nome_comodo, setor FROM locais WHERE caso_id = ${c3} AND setor NOT IN ('Administrativo', 'Segurança')`)
  pista(c3, 3, 'A Varredura de Retina', 'O algoritmo marcou: pigmento dos olhos do ladrão != Azuis.', 'Investigue os suspeitos e remova quem tem a cor dos olhos Azuis.', 'WHERE / NOT', 'suspeitos', `SELECT id_suspeito, nome, cor_olhos FROM suspeitos WHERE caso_id = ${c3} AND cor_olhos != 'Azuis'`)
  pista(c3, 4, 'O Lockdown de Locais Públicos', 'Todas as salas Público foram trancadas 5 minutos antes do crime.', 'Filtre os locais para mostrar apenas aqueles que não são de acesso Público.', 'WHERE texto', 'locais', `SELECT id_local, nome_comodo, nivel_acesso FROM locais WHERE caso_id = ${c3} AND nivel_acesso != 'Público'`)
  pista(c3, 5, 'O Detector Térmico', 'Pico de 900°C detectado em sala com a palavra "forjas" na descrição.', 'Procure pelo local que menciona forja em sua descrição.', 'LIKE', 'locais', `SELECT id_local, nome_comodo, descricao FROM locais WHERE caso_id = ${c3} AND descricao LIKE '%forja%'`)
  pista(c3, 6, 'O Despiste do Zelador', 'Objeto de 1,74 m entalado no duto durante toda a madrugada.', 'Encontre o suspeito que tenha exatamente 1.74 de altura.', 'WHERE comparação', 'suspeitos', `SELECT id_suspeito, nome, altura_m FROM suspeitos WHERE caso_id = ${c3} AND altura_m = 1.74`)
  pista(c3, 7, 'A Conexão Final', 'A perícia localizou o ouro em um cômodo Restrito do setor Técnico.', 'Procure o local que seja do setor Técnico e tenha acesso Restrito ao mesmo tempo.', 'AND', 'locais', `SELECT id_local, nome_comodo, setor, nivel_acesso FROM locais WHERE caso_id = ${c3} AND nivel_acesso = 'Restrito' AND setor = 'Técnico'`)

  fecharCaso(c3, s3, 66041, l3, 201)

  // ── CASO 4: A Essência de Lótus ─────────────────────────────
  const c4 = criarCaso('A Essência de Lótus',
    'A fórmula secreta de um perfume de luxo foi roubada do cofre do Ateliê Aroma Real. O cofre exige combinação numérica e leitura de impressão digital.',
    'Curitiba', 'PR')
  const { tabela: s4 } = criarTipo(c4, 'Suspeitos', 'Suspeito', 'culpado', SUSPEITO_ATTRS)
  const { tabela: l4 } = criarTipo(c4, 'Locais', 'Local', 'esconderijo', LOCAL_ATTRS)

  suspeito(s4, c4, 12099, 'Gabriel Valeriano', 27, 1.79, 70.00, 'Mel', 'Brasileiro', 'Grasse', 'BR', 'Braço direito do mestre perfumista da marca.', 'Memória olfativa, química fina e precisão laboratorial.', 'Tentou patentear uma fórmula similar em seu próprio nome recentemente.')
  suspeito(s4, c4, 23088, 'Sandra Regina', 52, 1.62, 64.00, 'Pretos', 'Brasileira', 'Florianópolis', 'SC', 'Trabalha na administração da empresa desde a fundação.', 'Organização de dados sigilosos e leitura labial.', 'Foi a única pessoa, além do dono, a entrar na sala do cofre no dia do crime.')
  suspeito(s4, c4, 34077, 'Roberto Franco', 46, 1.85, 92.00, 'Castanhos', 'Brasileiro', 'Porto Alegre', 'RS', 'Ex-sócio da empresa, hoje dono de uma marca concorrente.', 'Negociação agressiva, espionagem industrial e carisma.', 'Estava no prédio para uma "conversa amigável" na hora do roubo.')

  local(l4, c4, 101, 'Recepção', null, 'Comercial', 'Público', null, 'Entrada luxuosa com balcão de mármore e poltronas de veludo.')
  local(l4, c4, 102, 'Sala de Reuniões', null, 'Administrativo', 'Padrão', null, 'Mesa de vidro e paredes de vidro fosco para apresentações de negócios.')
  local(l4, c4, 201, 'Escritório do Diretor', null, 'Administrativo', 'Restrito', null, 'Ambiente com mobília clássica e uma entrada oculta para o cofre.')
  local(l4, c4, 202, 'Sala da Secretária', null, 'Administrativo', 'Padrão', null, 'Posto de trabalho com acesso direto ao gabinete do diretor.')
  local(l4, c4, 301, 'Sala do Cofre', null, 'Segurança', 'Super Restrito', null, 'Câmara blindada com leitor biométrico e teclado numérico de alta precisão.')
  local(l4, c4, 302, 'Laboratório de Perfumaria', null, 'Técnico', 'Restrito', null, 'Bancadas de inox com balanças de precisão e centenas de frascos de teste.')
  local(l4, c4, 303, 'Armazenamento de Essências', null, 'Técnico', 'Restrito', null, 'Ambiente climatizado e escuro para preservar as matérias-primas.')
  local(l4, c4, 304, 'Sala de Segurança', null, 'Segurança', 'Super Restrito', null, 'Central de controle com telas de alta definição e servidores de log.')

  pista(c4, 1, 'O Registro Biométrico', 'O sistema registrou que apenas uma pessoa entrou na Sala do Cofre além do dono — alguém com acesso ao gabinete do diretor.', 'Descubra qual é o nível de acesso da Sala do Cofre.', 'WHERE texto', 'locais', `SELECT id_local, nome_comodo, nivel_acesso FROM locais WHERE caso_id = ${c4} AND nivel_acesso = 'Super Restrito'`)
  pista(c4, 2, 'O Protocolo de Emergência', 'Salas Super Restrito foram lacradas no lockdown — nenhum item pode ter sido escondido lá.', 'Elimine da sua busca todos os locais com acesso Super Restrito.', 'WHERE texto', 'locais', `SELECT id_local, nome_comodo, nivel_acesso FROM locais WHERE caso_id = ${c4} AND nivel_acesso != 'Super Restrito'`)
  pista(c4, 3, 'O Sensor de Vibração', 'O assoalho suportou no máximo 75 kg durante o crime. Acima disso o alarme dispararia.', 'Procure por suspeitos que pesem 75 kg ou menos.', 'WHERE comparação', 'suspeitos', `SELECT id_suspeito, nome, peso_kg FROM suspeitos WHERE caso_id = ${c4} AND peso_kg <= 75`)
  pista(c4, 4, 'O Log de Reunião', 'Roberto Franco estava em reunião gravada durante todo o período do roubo.', 'Procure o suspeito com ID_SUSPEITO 34077 para confirmar seu álibi.', 'WHERE numérico', 'suspeitos', `SELECT id_suspeito, nome, motivo_suspeita FROM suspeitos WHERE caso_id = ${c4} AND id_suspeito = 34077`)
  pista(c4, 5, 'A Rota do Perfume', 'O sensor olfativo detectou a fórmula em um cômodo do setor Administrativo com nivel_acesso Restrito.', 'Encontre a sala que fica no setor Administrativo e possui acesso Restrito.', 'AND', 'locais', `SELECT id_local, nome_comodo, setor, nivel_acesso FROM locais WHERE caso_id = ${c4} AND setor = 'Administrativo' AND nivel_acesso = 'Restrito'`)
  pista(c4, 6, 'A Descrição do Cômodo', 'Vestígios da fórmula foram encontrados próximos a uma "entrada oculta para o cofre".', 'Procure o local que tenha as palavras entrada oculta em sua descrição.', 'LIKE', 'locais', `SELECT id_local, nome_comodo, descricao FROM locais WHERE caso_id = ${c4} AND descricao LIKE '%entrada oculta%'`)
  pista(c4, 7, 'O Perfil da Suspeita', 'O log confirma que apenas uma suspeita esteve no Escritório do Diretor. Ela tem acesso a dados sigilosos.', 'Investigue qual suspeita possui dados sigilosos em suas habilidades.', 'LIKE', 'suspeitos', `SELECT id_suspeito, nome, habilidades FROM suspeitos WHERE caso_id = ${c4} AND habilidades LIKE '%dados sigilosos%'`)
  pista(c4, 8, 'A Conexão Final', 'O IP do sistema biométrico pertence ao estado de SC. A última pessoa a sair do Escritório é de lá.', 'Encontre a pessoa que é natural de SC e a conecte ao local encontrado.', 'JOIN', 'suspeitos', `SELECT s.id_suspeito, s.nome, s.naturalidade_estado, l.nome_comodo FROM suspeitos s JOIN locais l ON l.caso_id = s.caso_id WHERE s.caso_id = ${c4} AND s.naturalidade_estado = 'SC' AND l.id_local = 201`)

  fecharCaso(c4, s4, 23088, l4, 201)

  // ── Salva o arquivo .db ─────────────────────────────────────
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
  db.close()
  console.log('✅ Banco criado com sucesso: backend/database.db')
  console.log('   4 casos inseridos com o novo modelo genérico de entidades — pode rodar: node backend/server.js')
}

main().catch(e => { console.error(e); process.exit(1) })
