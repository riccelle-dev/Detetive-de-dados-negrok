import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCaso, getDadosCaso, getPistas, acusar, registrarLog, getSessaoId, executarSQL } from '../lib/api'

export default function Caso() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sessaoId = getSessaoId()

  const [caso, setCaso]     = useState(null)
  const [tipos, setTipos]   = useState([])
  const [registros, setRegistros] = useState({})
  const [pistas, setPistas] = useState([])
  const [aba, setAba]       = useState(null)

  const [pistaAberta, setPistaAberta] = useState(null)

  // Terminal SQL
  const [querySql, setQuerySql]         = useState('')
  const [resultadoSql, setResultadoSql] = useState(null)
  const [erroSql, setErroSql]           = useState(null)
  const [loadingSql, setLoadingSql]     = useState(false)

  // Acusação
  const [principalAcus, setPrincipalAcus]   = useState('')
  const [secundarioAcus, setSecundarioAcus] = useState('')
  const [resultado, setResultado]           = useState(null)

  const tipoCulpado     = tipos.find(t => t.papel === 'culpado')
  const tipoEsconderijo = tipos.find(t => t.papel === 'esconderijo')
  const podeAcusar      = !!tipoCulpado && !!tipoEsconderijo

  const ABAS = [...tipos.map(t => t.nome), 'Terminal SQL', ...(podeAcusar ? ['Acusar'] : [])]

  useEffect(() => {
    const casoId = parseInt(id)
    Promise.all([getCaso(casoId), getDadosCaso(casoId), getPistas(casoId)])
      .then(([c, dados, p]) => {
        setCaso(c)
        setTipos(dados.tipos)
        setRegistros(dados.registros)
        setPistas(p)
        setAba(dados.tipos[0]?.nome || 'Terminal SQL')
      })
    registrarLog(casoId, sessaoId, 'iniciar_caso')
  }, [id])

  async function handleExecutarSql() {
    if (!querySql.trim()) return
    setLoadingSql(true)
    setErroSql(null)
    setResultadoSql(null)
    try {
      const data = await executarSQL(querySql, sessaoId, parseInt(id))
      setResultadoSql(data)
    } catch (e) {
      setErroSql(e.message || 'Erro de sintaxe SQL ou tabela inexistente.')
    }
    setLoadingSql(false)
  }

  async function handleAcusar() {
    if (!principalAcus || !secundarioAcus) return
    const res = await acusar(parseInt(id), sessaoId, principalAcus, secundarioAcus)
    setResultado(res)
  }

  if (!caso || !aba) return <div className="container text-muted" style={{ paddingTop: '3rem' }}>Carregando caso...</div>

  const tipoAtivo = tipos.find(t => t.nome === aba)

  return (
    <div className="container" style={{ maxWidth: '1280px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
          ← Voltar
        </button>
        <div className="flex items-c gap-1 mb-1">
          <span className="badge badge-purple">Caso ativo</span>
          <span className="text-muted text-sm">{caso.cidade}, {caso.estado}</span>
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--purple-l)', marginBottom: '.5rem' }}>
          {caso.titulo}
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)', maxWidth: '620px', lineHeight: 1.7 }}>
          {caso.descricao}
        </p>
      </div>

      {/* Grid Principal de 2 Colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(400px, 1.4fr)', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── PAINEL DA ESQUERDA: PISTAS ── */}
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '.5rem', color: 'var(--purple-l)' }}>
            Pistas da Investigação
          </h2>
          <p className="text-sm text-muted mb-1">
            Leia os depoimentos e descubra quais dados você precisa filtrar no Terminal SQL.
          </p>

          {pistas.map(p => (
            <div key={p.id} className="pista-card">
              <div
                className="pista-header"
                onClick={() => setPistaAberta(pistaAberta === p.id ? null : p.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="pista-num">{p.numero}</div>
                <div className="pista-titulo">{p.titulo}</div>
                {pistaAberta === p.id ? '▲' : '▼'}
              </div>

              {pistaAberta === p.id && (
                <div className="pista-body">
                  <div className="pista-enunciado">{p.enunciado}</div>
                  <div style={{ marginTop: '1rem', padding: '.75rem', background: '#0e1a16', borderRadius: '8px', borderLeft: '3px solid var(--teal)' }}>
                    <p className="text-sm" style={{ color: 'var(--teal)', fontWeight: 600, marginBottom: '.25rem' }}>
                      Dica de detetive:
                    </p>
                    <p className="text-sm">{p.acao_detetive}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── PAINEL DA DIREITA: ABAS E NAVEGAÇÃO ── */}
        <div>
          {/* Navegação por Abas */}
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

          {/* ── ABAS DE ENTIDADES (dinâmicas) ── */}
          {tipoAtivo && (
            <div>
              <p className="text-sm text-muted mb-1">
                Cada card é uma tupla da tabela <strong>{tipoAtivo.alias}</strong>.
              </p>
              <EntidadeGrid tipo={tipoAtivo} registros={registros[tipoAtivo.id] || []} />
            </div>
          )}

          {/* ── ABA: TERMINAL SQL ── */}
          {aba === 'Terminal SQL' && (
            <div>
              <p className="text-sm text-muted mb-1">
                Escreva sua consulta SQL para cruzar as pistas e encontrar os resultados.
                <br />Tabelas disponíveis: {tipos.map((t, i) => (
                  <span key={t.id}><strong>{t.alias}</strong>{i < tipos.length - 1 ? ', ' : '.'}</span>
                ))}
              </p>

              <textarea
                value={querySql}
                onChange={(e) => setQuerySql(e.target.value)}
                placeholder={`SELECT * FROM ${tipos[0]?.alias || 'tabela'} WHERE...`}
                style={{
                  width: '100%', padding: '1rem', background: '#0e1a26',
                  border: '1px solid var(--border)', borderRadius: '8px',
                  color: '#6ab0f5', fontFamily: "'Fira Code', monospace",
                  fontSize: '14px', minHeight: '120px', marginBottom: '1rem',
                  resize: 'vertical'
                }}
              />

              <button
                className="btn btn-primary"
                onClick={handleExecutarSql}
                disabled={loadingSql || !querySql.trim()}
              >
                {loadingSql ? 'Executando...' : 'Executar Consulta ▶'}
              </button>

              {erroSql && (
                <div style={{ marginTop: '1.5rem', background: '#200a0a', border: '1px solid var(--red)', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--red)', fontWeight: 600, marginBottom: '.25rem' }}>Erro na consulta:</p>
                  <code style={{ fontSize: '13px', color: 'var(--red)' }}>{erroSql}</code>
                </div>
              )}

              {resultadoSql && !erroSql && (
                <div style={{ marginTop: '1.5rem' }}>
                  <p className="text-sm text-muted" style={{ marginBottom: '.5rem' }}>
                    Resultado retornado ({resultadoSql.rows?.length || 0} linhas):
                  </p>
                  <TabelaResultado dados={resultadoSql.rows} colunas={resultadoSql.columns} />
                </div>
              )}
            </div>
          )}

          {/* ── ABA: ACUSAR ── */}
          {aba === 'Acusar' && podeAcusar && (
            <div style={{ maxWidth: '500px' }}>
              <h2 style={{ marginBottom: '.5rem', fontWeight: 700 }}>Fazer acusação</h2>
              <p className="text-sm text-muted" style={{ marginBottom: '1.5rem' }}>
                Escolha {artigoSingular(tipoCulpado.nome_singular)} e {artigoSingular(tipoEsconderijo.nome_singular)} correspondentes.
              </p>

              {!resultado ? (
                <>
                  <div className="acusacao-grid">
                    <div>
                      <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>
                        {tipoCulpado.nome_singular}
                      </label>
                      <select className="acusacao-select" value={principalAcus}
                        onChange={e => setPrincipalAcus(e.target.value)}>
                        <option value="">Selecione...</option>
                        {(registros[tipoCulpado.id] || []).map(r => (
                          <option key={r.id} value={r.id}>{labelRegistro(tipoCulpado, r)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '.4rem' }}>
                        {tipoEsconderijo.nome_singular}
                      </label>
                      <select className="acusacao-select" value={secundarioAcus}
                        onChange={e => setSecundarioAcus(e.target.value)}>
                        <option value="">Selecione...</option>
                        {(registros[tipoEsconderijo.id] || []).map(r => (
                          <option key={r.id} value={r.id}>{labelRegistro(tipoEsconderijo, r)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={handleAcusar}
                    disabled={!principalAcus || !secundarioAcus}>
                    Fazer acusação
                  </button>
                </>
              ) : (
                <div className={resultado.acerto ? 'resultado-acerto' : 'resultado-erro'}>
                  <div className="resultado-emoji">{resultado.acerto ? '🎉' : '❌'}</div>
                  <div className="resultado-titulo">
                    {resultado.acerto ? 'Caso resolvido!' : 'Acusação incorreta'}
                  </div>
                  <p className="text-sm" style={{ marginTop: '.5rem', opacity: .8 }}>
                    {resultado.acerto
                      ? 'Parabéns! Você identificou a resposta certa usando as consultas do banco de dados.'
                      : `${!resultado.acertouPrincipal ? tipoCulpado.nome_singular + ' errado(a). ' : ''}${!resultado.acertouSecundario ? tipoEsconderijo.nome_singular + ' errado(a).' : ''} Consulte mais pistas e tente novamente.`
                    }
                  </p>
                  {!resultado.acerto && (
                    <button className="btn btn-ghost mt-1" onClick={() => setResultado(null)}>
                      Tentar novamente
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function artigoSingular(nome) {
  return nome || 'o item'
}

function labelRegistro(tipo, registro) {
  const principal = tipo.atributos.find(a => a.principal)
  if (principal && registro[principal.coluna]) return registro[principal.coluna]
  const primeiroTexto = tipo.atributos.find(a => a.tipo_dado === 'texto' && registro[a.coluna])
  if (primeiroTexto) return registro[primeiroTexto.coluna]
  return `#${registro.id}`
}

// ── Grade genérica de cards de entidade (imagem + atributos definidos pelo admin) ──
function EntidadeGrid({ tipo, registros }) {
  if (registros.length === 0) {
    return <div className="text-sm text-muted" style={{ padding: '1rem', background: 'var(--surface)', borderRadius: '8px' }}>Nenhum registro cadastrado ainda para {tipo.nome}.</div>
  }
  const principal = tipo.atributos.find(a => a.principal)
  const outros = tipo.atributos.filter(a => !a.principal)

  return (
    <div className="fichas-grid">
      {registros.map(r => (
        <div key={r.id} className="ficha">
          {r.imagem ? (
            <img className="ficha-img" src={r.imagem} alt={principal ? r[principal.coluna] : tipo.nome_singular} />
          ) : (
            <div className="ficha-img-placeholder">{tipo.icone || '📁'}</div>
          )}
          {principal && <div className="ficha-nome">{r[principal.coluna] ?? '—'}</div>}
          {outros.map(a => (
            <div key={a.coluna} className="ficha-attr">{a.label}: <span>{r[a.coluna] ?? '—'}</span></div>
          ))}
        </div>
      ))}
    </div>
  )
}

function TabelaResultado({ dados, colunas }) {
  if (!dados || dados.length === 0) {
    return <div className="text-sm text-muted" style={{ padding: '1rem', background: 'var(--surface)', borderRadius: '8px' }}>Nenhum dado encontrado com essa consulta.</div>
  }
  const colunasExibicao = colunas && colunas.length > 0 ? colunas : Object.keys(dados[0] || {})

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
      <table className="sql-table" style={{ margin: 0, width: '100%' }}>
        <thead>
          <tr>
            {colunasExibicao.map(col => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {dados.map((linha, index) => (
            <tr key={linha.id ?? index}>
              {colunasExibicao.map(col => (
                <td key={col}>{linha[col] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
