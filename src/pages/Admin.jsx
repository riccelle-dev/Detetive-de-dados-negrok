import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCasos, getLogs, criarCaso, toggleCaso,
  getTiposEntidade, criarTipoEntidade, criarAtributo,
  getEntidades, criarRegistro, marcarResposta,
  criarPista,
} from '../lib/api'

const ABAS = ['Casos', 'Entidades', 'Registros', 'Pistas', 'Logs']

export default function Admin() {
  const [aba, setAba] = useState('Casos')
  const navigate = useNavigate()

  // ── ESTADOS DA SENHA ──
  const [autenticado, setAutenticado] = useState(false)
  const [senha, setSenha] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  function handleLogin(e) {
    e.preventDefault()
    if (senha === 'riccelle') {
      setAutenticado(true)
      setErroSenha('')
    } else {
      setErroSenha('Senha incorreta. Acesso negado.')
      setSenha('')
    }
  }

  if (!autenticado) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <h2 style={{ fontSize: '1.6rem', color: 'var(--purple-l)', marginBottom: '1rem', fontWeight: 800 }}>
            Acesso Restrito
          </h2>
          <p className="text-sm text-muted" style={{ marginBottom: '2rem' }}>
            Área exclusiva para professoras e administradoras do ColaBora.
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              placeholder="Digite a senha secreta..."
              value={senha}
              onChange={e => setSenha(e.target.value)}
              style={{
                width: '100%', padding: '1rem', background: '#050505',
                border: erroSenha ? '1px solid var(--red)' : '1px solid var(--border)',
                borderRadius: '8px', color: '#fff', fontSize: '16px', textAlign: 'center'
              }}
            />
            {erroSenha && <p style={{ color: 'var(--red)', fontSize: '14px', margin: 0, fontWeight: 600 }}>{erroSenha}</p>}
            <button type="submit" className="btn btn-primary" style={{ padding: '1rem', fontSize: '16px', fontWeight: 700 }}>
              Entrar no Painel
            </button>
          </form>
          <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ width: '100%', marginTop: '1.5rem' }}>
            ← Voltar ao jogo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
          ← Voltar ao jogo
        </button>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--purple-l)' }}>
          Painel de Administração
        </h1>
        <p className="text-sm text-muted">Cadastre e gerencie os casos do jogo.</p>
      </div>

      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)} className="btn btn-ghost"
            style={{
              borderBottom: aba === a ? '2px solid var(--purple)' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: aba === a ? 'var(--purple-l)' : 'var(--muted)'
            }}>
            {a}
          </button>
        ))}
      </div>

      {aba === 'Casos'     && <GerenciarCasos />}
      {aba === 'Entidades' && <GerenciarEntidades />}
      {aba === 'Registros' && <GerenciarRegistros />}
      {aba === 'Pistas'    && <GerenciarPistas />}
      {aba === 'Logs'      && <VerLogs />}
    </div>
  )
}

function SeletorCaso({ casos, value, onChange, label = 'Caso' }) {
  return (
    <div>
      <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>{label}</label>
      <select className="acusacao-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Selecione...</option>
        {casos.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
      </select>
    </div>
  )
}

function GerenciarCasos() {
  const [casos, setCasos] = useState([])
  const [form, setForm] = useState({ titulo: '', descricao: '', cidade: '', estado: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { getCasos().then(setCasos) }, [])

  async function salvar() {
    await criarCaso(form)
    setMsg('Caso criado! Agora vá em "Entidades" para definir suspeitos, locais ou qualquer outra coisa que esse caso precisa.')
    setForm({ titulo: '', descricao: '', cidade: '', estado: '' })
    getCasos().then(setCasos)
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>Casos cadastrados</h2>
      <div style={{ display: 'grid', gap: '.75rem', marginBottom: '2rem' }}>
        {casos.map(c => (
          <div key={c.id} className="card">
            <div className="flex items-c justify-b">
              <div>
                <span className="badge badge-purple" style={{ marginRight: '.5rem' }}>#{c.id}</span>
                <strong>{c.titulo}</strong>
                <span className="text-muted text-sm" style={{ marginLeft: '.75rem' }}>{c.cidade}, {c.estado}</span>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: '12px' }}
                onClick={() => toggleCaso(c.id, !c.ativo).then(() => getCasos().then(setCasos))}>
                {c.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>Novo caso</h2>
      <div style={{ display: 'grid', gap: '.75rem', maxWidth: '600px' }}>
        <Inp label="Título" value={form.titulo} onChange={v => setForm(f => ({ ...f, titulo: v }))} />
        <Inp label="Descrição" value={form.descricao} onChange={v => setForm(f => ({ ...f, descricao: v }))} textarea />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <Inp label="Cidade" value={form.cidade} onChange={v => setForm(f => ({ ...f, cidade: v }))} />
          <Inp label="Estado (UF)" value={form.estado} onChange={v => setForm(f => ({ ...f, estado: v }))} />
        </div>
        {msg && <p style={{ color: 'var(--teal)', fontSize: '13px' }}>{msg}</p>}
        <button className="btn btn-primary" onClick={salvar} disabled={!form.titulo}>+ Criar caso</button>
      </div>
    </div>
  )
}

// ── ENTIDADES: a professora define livremente quais "tabelas" o caso terá ──
function GerenciarEntidades() {
  const [casos, setCasos] = useState([])
  const [casoId, setCasoId] = useState('')
  const [tipos, setTipos] = useState([])
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({ nome: '', nome_singular: '', papel: '', icone: '📁' })

  useEffect(() => { getCasos().then(setCasos) }, [])
  useEffect(() => { recarregarTipos() }, [casoId])

  function recarregarTipos() {
    if (!casoId) { setTipos([]); return }
    getTiposEntidade(casoId).then(setTipos)
  }

  async function salvarTipo() {
    try {
      await criarTipoEntidade({ caso_id: casoId, ...form })
      setForm({ nome: '', nome_singular: '', papel: '', icone: '📁' })
      setMsg('Entidade criada! Agora adicione os atributos que ela deve ter.')
      recarregarTipos()
    } catch (e) {
      setMsg('Erro: ' + e.message)
    }
  }

  const temCulpado = tipos.some(t => t.papel === 'culpado')
  const temEsconderijo = tipos.some(t => t.papel === 'esconderijo')

  return (
    <div>
      <p className="text-sm text-muted mb-1" style={{ maxWidth: '650px' }}>
        Cada caso é composto por "entidades" — não precisa ser só Suspeitos e Locais.
        Você pode criar Veículos, Testemunhas, Armas, Documentos... o que a narrativa pedir.
        Cada entidade vira uma tabela real do banco, com as colunas (atributos) que você definir.
      </p>

      <div style={{ maxWidth: '300px', marginBottom: '1.5rem' }}>
        <SeletorCaso casos={casos} value={casoId} onChange={setCasoId} />
      </div>

      {casoId && (
        <>
          <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>Entidades deste caso</h2>
          {tipos.length === 0 && <p className="text-sm text-muted mb-2">Nenhuma entidade criada ainda para este caso.</p>}
          <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
            {tipos.map(t => <TipoEntidadeCard key={t.id} tipo={t} onAtributoCriado={recarregarTipos} />)}
          </div>

          <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>Nova entidade</h2>
          <div style={{ display: 'grid', gap: '.75rem', maxWidth: '600px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '.75rem' }}>
              <Inp label="Nome (plural)" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} placeholder="Ex: Veículos" />
              <Inp label="Nome (singular)" value={form.nome_singular} onChange={v => setForm(f => ({ ...f, nome_singular: v }))} placeholder="Ex: Veículo" />
              <Inp label="Ícone" value={form.icone} onChange={v => setForm(f => ({ ...f, icone: v }))} />
            </div>
            <div>
              <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>
                Papel na acusação final (opcional)
              </label>
              <select className="acusacao-select" value={form.papel} onChange={e => setForm(f => ({ ...f, papel: e.target.value }))}>
                <option value="">Nenhum — só para consulta</option>
                <option value="culpado" disabled={temCulpado}>É o "quem" (culpado) — {temCulpado ? 'já existe uma' : 'uma por caso'}</option>
                <option value="esconderijo" disabled={temEsconderijo}>É o "onde" (esconderijo) — {temEsconderijo ? 'já existe uma' : 'uma por caso'}</option>
              </select>
              <p className="text-sm text-muted" style={{ marginTop: '.4rem' }}>
                Se o caso tiver uma entidade "culpado" e outra "esconderijo", a aba Acusar aparece automaticamente para as alunas.
              </p>
            </div>
            {msg && <p style={{ color: 'var(--teal)', fontSize: '13px' }}>{msg}</p>}
            <button className="btn btn-primary" onClick={salvarTipo} disabled={!form.nome || !form.nome_singular}>
              + Criar entidade
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function TipoEntidadeCard({ tipo, onAtributoCriado }) {
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState({ label: '', tipo_dado: 'texto', principal: false })
  const [msg, setMsg] = useState('')

  async function salvar() {
    try {
      await criarAtributo(tipo.id, form)
      setForm({ label: '', tipo_dado: 'texto', principal: false })
      setMsg('Atributo adicionado!')
      onAtributoCriado()
    } catch (e) {
      setMsg('Erro: ' + e.message)
    }
  }

  return (
    <div className="card">
      <div className="flex items-c justify-b mb-1">
        <div>
          <span style={{ marginRight: '.5rem' }}>{tipo.icone}</span>
          <strong>{tipo.nome}</strong>
          <span className="text-muted text-sm" style={{ marginLeft: '.5rem' }}>({tipo.nome_singular})</span>
          {tipo.papel && <span className="badge badge-amber" style={{ marginLeft: '.5rem' }}>{tipo.papel === 'culpado' ? 'papel: culpado' : 'papel: esconderijo'}</span>}
        </div>
        <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={() => setAberto(!aberto)}>
          {aberto ? 'Fechar' : '+ Atributo'}
        </button>
      </div>

      {tipo.atributos.length > 0 ? (
        <div className="text-sm text-muted">
          {tipo.atributos.map(a => (
            <span key={a.id} style={{ marginRight: '.75rem' }}>
              {a.principal ? '★ ' : ''}{a.label} <em>({a.tipo_dado})</em>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhum atributo ainda — essa entidade não tem colunas além da imagem.</p>
      )}

      {aberto && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'grid', gap: '.6rem', maxWidth: '450px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '.6rem' }}>
            <Inp label="Nome do atributo" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Ex: Placa" />
            <div>
              <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>Tipo</label>
              <select className="acusacao-select" value={form.tipo_dado} onChange={e => setForm(f => ({ ...f, tipo_dado: e.target.value }))}>
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
              </select>
            </div>
          </div>
          <label className="text-sm text-muted flex items-c gap-1" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.checked }))} />
            Usar como título do card (nome principal da entidade)
          </label>
          {msg && <p style={{ color: 'var(--teal)', fontSize: '13px' }}>{msg}</p>}
          <button className="btn btn-primary" onClick={salvar} disabled={!form.label} style={{ width: 'fit-content' }}>
            + Adicionar atributo
          </button>
        </div>
      )}
    </div>
  )
}

// ── REGISTROS: instâncias de cada entidade (com imagem) ──
function GerenciarRegistros() {
  const [casos, setCasos] = useState([])
  const [casoId, setCasoId] = useState('')
  const [tipos, setTipos] = useState([])
  const [tipoId, setTipoId] = useState('')
  const [registros, setRegistros] = useState([])
  const [valores, setValores] = useState({})
  const [imagem, setImagem] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { getCasos().then(setCasos) }, [])
  useEffect(() => {
    setTipoId(''); setTipos([])
    if (casoId) getTiposEntidade(casoId).then(setTipos)
  }, [casoId])
  useEffect(() => { recarregarRegistros() }, [tipoId])

  function recarregarRegistros() {
    setValores({})
    setImagem(null)
    if (casoId && tipoId) getEntidades(casoId, tipoId).then(setRegistros)
    else setRegistros([])
  }

  const tipo = tipos.find(t => String(t.id) === String(tipoId))

  function onArquivo(e) {
    const file = e.target.files[0]
    if (!file) { setImagem(null); return }
    const reader = new FileReader()
    reader.onload = () => setImagem(reader.result)
    reader.readAsDataURL(file)
  }

  async function salvar() {
    await criarRegistro(tipoId, { caso_id: casoId, imagem, valores })
    setMsg('Registro adicionado!')
    recarregarRegistros()
  }

  async function marcar(rowId) {
    await marcarResposta(tipoId, rowId)
    setMsg('Marcado como resposta correta deste caso.')
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', maxWidth: '600px', marginBottom: '1.5rem' }}>
        <SeletorCaso casos={casos} value={casoId} onChange={setCasoId} />
        <div>
          <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>Entidade</label>
          <select className="acusacao-select" value={tipoId} onChange={e => setTipoId(e.target.value)} disabled={!casoId}>
            <option value="">Selecione...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      </div>

      {casoId && tipos.length === 0 && (
        <p className="text-sm text-muted">Este caso ainda não tem entidades. Crie uma na aba "Entidades" primeiro.</p>
      )}

      {tipo && (
        <>
          <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>{tipo.nome} cadastrados</h2>
          <div style={{ display: 'grid', gap: '.6rem', marginBottom: '2rem' }}>
            {registros.length === 0 && <p className="text-sm text-muted">Nenhum registro ainda.</p>}
            {registros.map(r => {
              const principal = tipo.atributos.find(a => a.principal)
              return (
                <div key={r.id} className="card">
                  <div className="flex items-c gap-1" style={{ flexWrap: 'wrap' }}>
                    {r.imagem && <img src={r.imagem} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />}
                    <span className="badge badge-purple">#{r.id}</span>
                    <strong>{principal ? r[principal.coluna] : `Registro ${r.id}`}</strong>
                    {tipo.papel && (
                      <button className="btn btn-ghost" style={{ fontSize: '12px', marginLeft: 'auto' }} onClick={() => marcar(r.id)}>
                        ★ Marcar como resposta
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>Adicionar {tipo.nome_singular.toLowerCase()}</h2>
          <div style={{ display: 'grid', gap: '.75rem', maxWidth: '600px' }}>
            <div>
              <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>Imagem (opcional)</label>
              <input type="file" accept="image/*" onChange={onArquivo} />
              {imagem && <img src={imagem} alt="" style={{ marginTop: '.5rem', width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />}
            </div>

            {tipo.atributos.length === 0 && (
              <p className="text-sm text-muted">Esta entidade ainda não tem atributos — adicione-os na aba "Entidades".</p>
            )}
            {tipo.atributos.map(a => (
              <Inp
                key={a.coluna}
                label={a.label}
                value={valores[a.coluna] || ''}
                onChange={v => setValores(vs => ({ ...vs, [a.coluna]: v }))}
                type={a.tipo_dado === 'numero' ? 'number' : 'text'}
              />
            ))}
            {msg && <p style={{ color: 'var(--teal)', fontSize: '13px' }}>{msg}</p>}
            <button className="btn btn-primary" onClick={salvar} style={{ width: 'fit-content' }}>
              + Adicionar {tipo.nome_singular.toLowerCase()}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function GerenciarPistas() {
  const [casos, setCasos] = useState([])
  const [tipos, setTipos] = useState([])
  const [form, setForm] = useState({ caso_id: '', numero: '', titulo: '', enunciado: '', acao_detetive: '', conceito_bd: 'WHERE texto', tabela_alvo: '', query_sql: '' })
  const [msg, setMsg] = useState('')
  const CONCEITOS = ['WHERE texto', 'WHERE numérico', 'WHERE comparação', 'AND', 'OR', 'LIKE', 'JOIN', 'Chave estrangeira narrativa']

  useEffect(() => { getCasos().then(setCasos) }, [])
  useEffect(() => {
    if (form.caso_id) getTiposEntidade(form.caso_id).then(ts => {
      setTipos(ts)
      setForm(f => ({ ...f, tabela_alvo: ts[0]?.alias || '' }))
    })
    else setTipos([])
  }, [form.caso_id])

  async function salvar() {
    await criarPista(form)
    setMsg('Pista criada!')
    setForm(f => ({ ...f, numero: '', titulo: '', enunciado: '', acao_detetive: '', query_sql: '' }))
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>Adicionar pista</h2>
      <div style={{ display: 'grid', gap: '.75rem', maxWidth: '650px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '.75rem' }}>
          <SeletorCaso casos={casos} value={form.caso_id} onChange={v => setForm(f => ({ ...f, caso_id: v }))} />
          <Inp label="Número" value={form.numero} onChange={v => setForm(f => ({ ...f, numero: v }))} />
        </div>
        <Inp label="Título" value={form.titulo} onChange={v => setForm(f => ({ ...f, titulo: v }))} />
        <Inp label="Enunciado (texto para a jogadora)" value={form.enunciado} onChange={v => setForm(f => ({ ...f, enunciado: v }))} textarea />
        <Inp label="O que o detetive deve concluir" value={form.acao_detetive} onChange={v => setForm(f => ({ ...f, acao_detetive: v }))} textarea />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <div>
            <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>Conceito de BD</label>
            <select className="acusacao-select" value={form.conceito_bd} onChange={e => setForm(f => ({ ...f, conceito_bd: e.target.value }))}>
              {CONCEITOS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>Tabela alvo</label>
            <select className="acusacao-select" value={form.tabela_alvo} onChange={e => setForm(f => ({ ...f, tabela_alvo: e.target.value }))} disabled={!form.caso_id}>
              {tipos.length === 0 && <option value="">Selecione um caso primeiro</option>}
              {tipos.map(t => <option key={t.id} value={t.alias}>{t.alias}</option>)}
            </select>
          </div>
        </div>
        <p className="text-sm text-muted">
          Escreva a query usando os nomes das entidades do caso como se fossem tabelas
          {tipos.length > 0 && <>: {tipos.map((t, i) => <span key={t.id}><strong>{t.alias}</strong>{i < tipos.length - 1 ? ', ' : '.'}</span>)}</>}
        </p>
        <Inp label="Query SQL" value={form.query_sql} onChange={v => setForm(f => ({ ...f, query_sql: v }))} textarea mono />
        {msg && <p style={{ color: 'var(--teal)', fontSize: '13px' }}>{msg}</p>}
        <button className="btn btn-primary" onClick={salvar} disabled={!form.titulo || !form.query_sql || !form.caso_id}>+ Criar pista</button>
      </div>
    </div>
  )
}

function VerLogs() {
  const [casos, setCasos] = useState([])
  const [casoSel, setCasoSel] = useState('')
  const [dados, setDados] = useState(null)

  useEffect(() => { getCasos().then(setCasos) }, [])
  useEffect(() => {
    if (!casoSel) return
    getLogs(casoSel).then(setDados)
  }, [casoSel])

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', maxWidth: '300px' }}>
        <SeletorCaso casos={casos} value={casoSel} onChange={setCasoSel} label="Selecionar caso" />
      </div>

      {dados?.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Sessões únicas', valor: dados.stats.sessoes, color: 'var(--purple-l)' },
            { label: 'Acusações feitas', valor: dados.stats.acusacoes, color: 'var(--amber)' },
            { label: 'Acusações corretas', valor: dados.stats.acertos, color: 'var(--teal)' },
            { label: 'Taxa de acerto', valor: dados.stats.acusacoes ? `${Math.round(dados.stats.acertos / dados.stats.acusacoes * 100)}%` : '—', color: 'var(--teal)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: s.color }}>{s.valor}</div>
              <div className="text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {dados?.stats?.porPista && Object.keys(dados.stats.porPista).length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '.75rem', fontWeight: 600 }}>Pistas mais consultadas</h3>
          {Object.entries(dados.stats.porPista).sort((a, b) => b[1] - a[1]).map(([pista, count]) => (
            <div key={pista} className="card" style={{ padding: '.75rem 1rem', marginBottom: '.5rem' }}>
              <div className="flex items-c justify-b">
                <span className="text-sm">{pista}</span>
                <span className="badge badge-purple">{count}x</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {dados?.logs?.slice(0, 50).map(l => (
        <div key={l.id} className="card" style={{ padding: '.75rem 1rem', marginBottom: '.4rem' }}>
          <div className="flex items-c gap-1" style={{ flexWrap: 'wrap' }}>
            <span className={`badge ${l.acao === 'acusar' ? (l.acerto ? 'badge-teal' : 'badge-amber') : 'badge-purple'}`}>{l.acao}</span>
            <span className="text-sm text-muted">sessão {l.sessao_id?.slice(0, 8)}...</span>
            {l.pista_titulo && <span className="text-sm">→ {l.pista_titulo}</span>}
            {l.acao === 'acusar' && <span className="text-sm" style={{ color: l.acerto ? 'var(--teal)' : 'var(--red)' }}>{l.acerto ? '✓ correto' : '✗ errado'}</span>}
            <span className="text-sm text-muted" style={{ marginLeft: 'auto' }}>{new Date(l.criado_em).toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Inp({ label, value, onChange, textarea, mono, type = 'text', placeholder }) {
  const style = {
    width: '100%', padding: '.7rem 1rem',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)', fontSize: '14px',
    fontFamily: mono ? "'Fira Code',monospace" : 'inherit',
    resize: textarea ? 'vertical' : undefined,
  }
  return (
    <div>
      <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>{label}</label>
      {textarea
        ? <textarea style={style} rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={style} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  )
}
