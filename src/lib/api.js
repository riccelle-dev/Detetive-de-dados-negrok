const BASE = 'http://localhost:3001'

export function getSessaoId() {
  let id = sessionStorage.getItem('ddd_sessao')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('ddd_sessao', id)
  }
  return id
}

async function get(path) {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function patch(path, body) {
  const r = await fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return r.json()
}

export const getCasos          = ()           => get('/casos')
export const getCaso           = (id)         => get(`/casos/${id}`)
export const getDadosCaso      = (id)         => get(`/casos/${id}/dados`)
export const getTiposEntidade  = (id)         => get(`/casos/${id}/tipos-entidade`)
export const getEntidades      = (casoId, tipoId) => get(`/casos/${casoId}/entidades/${tipoId}`)
export const getPistas         = (id)         => get(`/casos/${id}/pistas`)
export const consultarPista    = (pistaId, sessaoId, casoId) =>
  post(`/pistas/${pistaId}/consultar`, { sessao_id: sessaoId, caso_id: casoId })
export const acusar            = (casoId, sessaoId, principal_id, secundario_id) =>
  post(`/casos/${casoId}/acusar`, { sessao_id: sessaoId, principal_id, secundario_id })
export const registrarLog      = (caso_id, sessao_id, acao) =>
  post('/logs', { caso_id, sessao_id, acao })
export const getLogs           = (casoId)     => get(`/admin/logs/${casoId}`)

// Admin
export const criarCaso         = (body) => post('/admin/casos', body)
export const toggleCaso        = (id, ativo) => patch(`/admin/casos/${id}`, { ativo })
export const criarTipoEntidade = (body) => post('/admin/tipos-entidade', body)
export const criarAtributo     = (tipoId, body) => post(`/admin/tipos-entidade/${tipoId}/atributos`, body)
export const criarRegistro     = (tipoId, body) => post(`/admin/entidades/${tipoId}`, body)
export const marcarResposta    = (tipoId, rowId) => patch(`/admin/entidades/${tipoId}/${rowId}/marcar`, {})
export const criarPista        = (body) => post('/admin/pistas', body)
export const executarSQL = (querySql, sessaoId, casoId) =>
  post(`/casos/${casoId}/executar-sql`, { query: querySql, sessao_id: sessaoId })