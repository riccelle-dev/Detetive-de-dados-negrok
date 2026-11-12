// backend/server.js
// node backend/server.js

const express   = require('express')
const cors      = require('cors')
const initSqlJs = require('sql.js')
const fs        = require('fs')
const path      = require('path')

const DB_PATH = path.join(__dirname, 'database.db')
const app = express()
app.use(cors())
// limite maior por causa das imagens em base64
app.use(express.json({ limit: '25mb' }))

// ── Carrega o banco ──────────────────────────────────────────
let db
async function loadDb() {
  const SQL = await initSqlJs()
  const buf = fs.readFileSync(DB_PATH)
  db = new SQL.Database(buf)
  console.log('✅ Banco carregado:', DB_PATH)
}

function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function get(sql, params = []) {
  return all(sql, params)[0] || null
}

// IMPORTANTE: db.export() (chamado dentro de save()) reseta o estado interno
// do sql.js usado por last_insert_rowid(). Por isso capturamos o id do último
// INSERT ANTES de salvar, e não depois.
let _lastInsertId = null
function run(sql, params = []) {
  db.run(sql, params)
  try {
    _lastInsertId = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  } catch (e) {
    _lastInsertId = null
  }
  save()
}

function lastId() {
  return _lastInsertId
}

// ── Helpers de identificadores dinâmicos ───────────────────────
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

function aliasUnico(casoId, base) {
  let alias = slugify(base)
  let i = 2
  while (get('SELECT id FROM tipos_entidade WHERE caso_id = ? AND alias = ?', [casoId, alias])) {
    alias = slugify(base) + '_' + i
    i++
  }
  return alias
}

function colunaUnica(tipoId, base) {
  let coluna = slugify(base)
  if (['id', 'caso_id', 'imagem'].includes(coluna)) coluna = coluna + '_attr'
  let i = 2
  while (get('SELECT id FROM atributos_entidade WHERE tipo_entidade_id = ? AND coluna = ?', [tipoId, coluna])) {
    coluna = slugify(base) + '_' + i
    i++
  }
  return coluna
}

// Monta o WITH que expõe cada tipo_entidade do caso pelo seu alias amigável,
// permitindo que as pistas e o Terminal SQL usem nomes como "suspeitos" ou
// "veiculos" mesmo a tabela física sendo genérica (ent_<id>).
function withClauseFor(casoId) {
  const tipos = all('SELECT * FROM tipos_entidade WHERE caso_id = ?', [casoId])
  if (tipos.length === 0) return ''
  const ctes = tipos.map(t => `${t.alias} AS (SELECT * FROM ${t.tabela} WHERE caso_id = ${casoId})`)
  return 'WITH ' + ctes.join(',\n') + '\n'
}

// ── Rotas de jogo ────────────────────────────────────────────

app.get('/casos', (req, res) => {
  res.json(all('SELECT id, titulo, descricao, cidade, estado FROM casos WHERE ativo = 1 ORDER BY id'))
})

app.get('/casos/:id', (req, res) => {
  const r = get('SELECT id, titulo, descricao, cidade, estado, ativo FROM casos WHERE id = ?', [req.params.id])
  if (!r) return res.status(404).json({ error: 'Caso não encontrado' })
  res.json(r)
})

// Retorna os tipos de entidade do caso (com seus atributos) e os registros de cada um.
app.get('/casos/:id/dados', (req, res) => {
  const casoId = req.params.id
  const tipos = all('SELECT * FROM tipos_entidade WHERE caso_id = ? ORDER BY ordem, id', [casoId])
  if (tipos.length === 0) return res.json({ tipos: [], registros: {} })

  const atributos = all(
    `SELECT * FROM atributos_entidade WHERE tipo_entidade_id IN (${tipos.map(() => '?').join(',')}) ORDER BY ordem, id`,
    tipos.map(t => t.id)
  )
  const registros = {}
  tipos.forEach(t => { registros[t.id] = all(`SELECT * FROM ${t.tabela} WHERE caso_id = ? ORDER BY id`, [casoId]) })

  const tiposComAtributos = tipos.map(t => ({ ...t, atributos: atributos.filter(a => a.tipo_entidade_id === t.id) }))
  res.json({ tipos: tiposComAtributos, registros })
})

app.get('/casos/:id/tipos-entidade', (req, res) => {
  const tipos = all('SELECT * FROM tipos_entidade WHERE caso_id = ? ORDER BY ordem, id', [req.params.id])
  if (tipos.length === 0) return res.json([])
  const atributos = all(
    `SELECT * FROM atributos_entidade WHERE tipo_entidade_id IN (${tipos.map(() => '?').join(',')}) ORDER BY ordem, id`,
    tipos.map(t => t.id)
  )
  res.json(tipos.map(t => ({ ...t, atributos: atributos.filter(a => a.tipo_entidade_id === t.id) })))
})

app.get('/casos/:id/entidades/:tipoId', (req, res) => {
  const tipo = get('SELECT * FROM tipos_entidade WHERE id = ? AND caso_id = ?', [req.params.tipoId, req.params.id])
  if (!tipo) return res.status(404).json({ error: 'Tipo de entidade não encontrado' })
  res.json(all(`SELECT * FROM ${tipo.tabela} WHERE caso_id = ? ORDER BY id`, [req.params.id]))
})

app.get('/casos/:id/pistas', (req, res) => {
  res.json(all(
    'SELECT id, caso_id, numero, titulo, enunciado, acao_detetive, conceito_bd, tabela_alvo FROM pistas WHERE caso_id = ? ORDER BY numero',
    [req.params.id]
  ))
})

app.post('/pistas/:id/consultar', (req, res) => {
  const { sessao_id, caso_id } = req.body
  if (!sessao_id || !caso_id) return res.status(400).json({ error: 'sessao_id e caso_id obrigatórios' })

  const pista = get('SELECT * FROM pistas WHERE id = ?', [req.params.id])
  if (!pista) return res.status(404).json({ error: 'Pista não encontrada' })
  if (pista.caso_id !== parseInt(caso_id)) return res.status(403).json({ error: 'Pista não pertence a este caso' })

  const sql = pista.query_sql.trim()
  if (!sql.toUpperCase().startsWith('SELECT')) return res.status(403).json({ error: 'Apenas SELECT é permitido' })

  try {
    const rows = all(withClauseFor(parseInt(caso_id)) + sql)
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []
    run('INSERT INTO logs_acao (caso_id, sessao_id, pista_id, acao) VALUES (?, ?, ?, ?)',
      [caso_id, sessao_id, pista.id, 'consultar_pista'])
    res.json({ rows, columns, conceito_bd: pista.conceito_bd })
  } catch (e) {
    res.status(500).json({ error: 'Erro na consulta: ' + e.message })
  }
})

app.post('/casos/:id/acusar', (req, res) => {
  const { sessao_id, principal_id, secundario_id } = req.body
  const caso = get('SELECT * FROM casos WHERE id = ?', [req.params.id])
  if (!caso) return res.status(404).json({ error: 'Caso não encontrado' })

  const acertouPrincipal  = caso.culpado_row_id != null && parseInt(principal_id) === caso.culpado_row_id
  const acertouSecundario = caso.esconderijo_row_id != null && parseInt(secundario_id) === caso.esconderijo_row_id
  const acerto = acertouPrincipal && acertouSecundario

  run('INSERT INTO logs_acao (caso_id, sessao_id, acao, acerto) VALUES (?, ?, ?, ?)',
    [caso.id, sessao_id, 'acusar', acerto ? 1 : 0])

  res.json({ acerto, acertouPrincipal, acertouSecundario })
})

app.post('/logs', (req, res) => {
  const { caso_id, sessao_id, acao } = req.body
  run('INSERT INTO logs_acao (caso_id, sessao_id, acao) VALUES (?, ?, ?)', [caso_id, sessao_id, acao])
  res.json({ ok: true })
})

app.get('/admin/logs/:caso_id', (req, res) => {
  const logs = all(`
    SELECT l.*, p.titulo as pista_titulo, p.conceito_bd
    FROM logs_acao l
    LEFT JOIN pistas p ON p.id = l.pista_id
    WHERE l.caso_id = ?
    ORDER BY l.criado_em DESC LIMIT 200
  `, [req.params.caso_id])

  const sessoes   = new Set(logs.map(l => l.sessao_id)).size
  const acusacoes = logs.filter(l => l.acao === 'acusar')
  const acertos   = acusacoes.filter(l => l.acerto === 1).length
  const porPista  = {}
  logs.filter(l => l.pista_id).forEach(l => {
    const k = l.pista_titulo || l.pista_id
    porPista[k] = (porPista[k] || 0) + 1
  })

  res.json({ logs, stats: { sessoes, acusacoes: acusacoes.length, acertos, porPista } })
})

// ── Admin: Casos ─────────────────────────────────────────────
app.post('/admin/casos', (req, res) => {
  const { titulo, descricao, cidade, estado } = req.body
  run('INSERT INTO casos (titulo,descricao,cidade,estado) VALUES (?,?,?,?)', [titulo, descricao, cidade, estado])
  res.json({ id: lastId() })
})

app.patch('/admin/casos/:id', (req, res) => {
  run('UPDATE casos SET ativo = ? WHERE id = ?', [req.body.ativo ? 1 : 0, req.params.id])
  res.json({ ok: true })
})

// ── Admin: Tipos de entidade (as "entidades" que a professora cria) ──
app.post('/admin/tipos-entidade', (req, res) => {
  const { caso_id, nome, nome_singular, papel, icone } = req.body
  if (!caso_id || !nome) return res.status(400).json({ error: 'caso_id e nome são obrigatórios' })
  if (papel === 'culpado' || papel === 'esconderijo') {
    const existente = get('SELECT id FROM tipos_entidade WHERE caso_id = ? AND papel = ?', [caso_id, papel])
    if (existente) return res.status(400).json({ error: `Este caso já tem uma entidade com o papel "${papel}".` })
  }

  const alias = aliasUnico(caso_id, nome)
  const ordemRow = get('SELECT COALESCE(MAX(ordem),-1)+1 as prox FROM tipos_entidade WHERE caso_id = ?', [caso_id])

  run('INSERT INTO tipos_entidade (caso_id,nome,nome_singular,alias,tabela,papel,icone,ordem) VALUES (?,?,?,?,?,?,?,?)',
    [caso_id, nome, nome_singular || nome, alias, 'PENDING', papel || null, icone || '📁', ordemRow.prox])
  const tipoId = lastId()
  const tabela = 'ent_' + tipoId
  run('UPDATE tipos_entidade SET tabela = ? WHERE id = ?', [tabela, tipoId])
  run(`CREATE TABLE ${tabela} (id INTEGER PRIMARY KEY AUTOINCREMENT, caso_id INTEGER NOT NULL, imagem TEXT)`)

  res.json({ id: tipoId, alias, tabela })
})

app.post('/admin/tipos-entidade/:id/atributos', (req, res) => {
  const tipo = get('SELECT * FROM tipos_entidade WHERE id = ?', [req.params.id])
  if (!tipo) return res.status(404).json({ error: 'Tipo de entidade não encontrado' })

  const { label, tipo_dado, principal } = req.body
  if (!label) return res.status(400).json({ error: 'label é obrigatório' })

  const coluna = colunaUnica(tipo.id, label)
  const tipoSQL = tipo_dado === 'numero' ? 'REAL' : 'TEXT'

  try {
    run(`ALTER TABLE ${tipo.tabela} ADD COLUMN ${coluna} ${tipoSQL}`)
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao criar atributo: ' + e.message })
  }

  if (principal) run('UPDATE atributos_entidade SET principal = 0 WHERE tipo_entidade_id = ?', [tipo.id])

  const ordemRow = get('SELECT COALESCE(MAX(ordem),-1)+1 as prox FROM atributos_entidade WHERE tipo_entidade_id = ?', [tipo.id])
  run('INSERT INTO atributos_entidade (tipo_entidade_id,coluna,label,tipo_dado,principal,ordem) VALUES (?,?,?,?,?,?)',
    [tipo.id, coluna, label, tipo_dado || 'texto', principal ? 1 : 0, ordemRow.prox])

  res.json({ id: lastId(), coluna })
})

// ── Admin: Registros (instâncias de cada entidade, com imagem) ──
app.post('/admin/entidades/:tipoId', (req, res) => {
  const tipo = get('SELECT * FROM tipos_entidade WHERE id = ?', [req.params.tipoId])
  if (!tipo) return res.status(404).json({ error: 'Tipo de entidade não encontrado' })

  const atributos = all('SELECT * FROM atributos_entidade WHERE tipo_entidade_id = ?', [tipo.id])
  const { caso_id, imagem, valores } = req.body
  if (!caso_id) return res.status(400).json({ error: 'caso_id é obrigatório' })

  const cols = ['caso_id', 'imagem']
  const vals = [caso_id, imagem || null]
  atributos.forEach(a => {
    cols.push(a.coluna)
    let v = valores ? valores[a.coluna] : undefined
    if (a.tipo_dado === 'numero') v = (v === '' || v === undefined || v === null) ? null : Number(v)
    else v = (v === undefined) ? null : v
    vals.push(v)
  })

  const placeholders = cols.map(() => '?').join(',')
  run(`INSERT INTO ${tipo.tabela} (${cols.join(',')}) VALUES (${placeholders})`, vals)
  res.json({ id: lastId() })
})

// Marca um registro como a resposta correta (culpado ou esconderijo) do caso.
app.patch('/admin/entidades/:tipoId/:rowId/marcar', (req, res) => {
  const tipo = get('SELECT * FROM tipos_entidade WHERE id = ?', [req.params.tipoId])
  if (!tipo) return res.status(404).json({ error: 'Tipo de entidade não encontrado' })
  if (tipo.papel !== 'culpado' && tipo.papel !== 'esconderijo') {
    return res.status(400).json({ error: 'Esta entidade não tem papel de resposta (culpado/esconderijo).' })
  }
  const campo = tipo.papel === 'culpado' ? 'culpado_row_id' : 'esconderijo_row_id'
  run(`UPDATE casos SET ${campo} = ? WHERE id = ?`, [req.params.rowId, tipo.caso_id])
  res.json({ ok: true })
})

// ── Admin: Pistas ────────────────────────────────────────────
app.post('/admin/pistas', (req, res) => {
  const f = req.body
  run(`INSERT INTO pistas (caso_id,numero,titulo,enunciado,acao_detetive,conceito_bd,tabela_alvo,query_sql) VALUES (?,?,?,?,?,?,?,?)`,
    [f.caso_id, f.numero, f.titulo, f.enunciado, f.acao_detetive, f.conceito_bd, f.tabela_alvo, f.query_sql])
  res.json({ id: lastId() })
})

// ── Rota: Execução Livre de SQL (Terminal SQL - COM ISOLAMENTO INVISÍVEL) ──
app.post('/casos/:id/executar-sql', (req, res) => {
  const { sessao_id, query } = req.body;
  const caso_id = parseInt(req.params.id);

  if (!query) {
    return res.status(400).json({ message: 'A query SQL não pode estar vazia.' });
  }

  const queryMaiuscula = query.toUpperCase();

  // 1. Proteção Básica: Evitar comandos destrutivos
  const palavrasProibidas = ['DELETE', 'DROP', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
  for (const palavra of palavrasProibidas) {
    const regex = new RegExp(`\\b${palavra}\\b`, 'i');
    if (regex.test(queryMaiuscula)) {
      return res.status(403).json({ message: `Comando bloqueado: O uso de '${palavra}' não é permitido na investigação.` });
    }
  }

  // 2. Proteção Adicional: Obrigar a começar apenas com SELECT
  if (!queryMaiuscula.trim().startsWith('SELECT')) {
      return res.status(403).json({ message: 'Detetive, todas as suas consultas devem começar com a palavra SELECT.' });
  }

  // 3. A MÁGICA: cada tipo de entidade do caso entra como uma CTE nomeada
  // pelo seu alias amigável (ex.: "suspeitos", "veiculos"), isolando o caso.
  const queryIsolada = withClauseFor(caso_id) + query;

  try {
    const rows = all(queryIsolada);

    // Escondemos a coluna 'caso_id' do resultado para não poluir a tela
    const rowsLimpas = rows.map(row => {
        const { caso_id, ...resto } = row;
        return resto;
    });

    const columns = rowsLimpas.length > 0 ? Object.keys(rowsLimpas[0]) : [];

    run('INSERT INTO logs_acao (caso_id, sessao_id, acao) VALUES (?, ?, ?)',
      [caso_id, sessao_id, 'terminal_sql_sucesso']);

    res.json({ rows: rowsLimpas, columns });

  } catch (error) {
    console.error("Erro de Sintaxe da Aluna:", error.message);

    run('INSERT INTO logs_acao (caso_id, sessao_id, acao) VALUES (?, ?, ?)',
      [caso_id, sessao_id, 'terminal_sql_erro']);

    res.status(400).json({ message: error.message });
  }
});

// ── Start ────────────────────────────────────────────────────
loadDb().then(() => {
  app.listen(3001, () => {
    console.log('Servidor rodando em http://localhost:3001')
  })
}).catch(e => {
  console.error('Erro ao carregar banco:', e.message)
  console.error('Rode primeiro: node backend/setup.js')
  process.exit(1)
})
