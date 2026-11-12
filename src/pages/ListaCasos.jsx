import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCasos } from '../lib/api'

export default function ListaCasos() {
  const [casos, setCasos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getCasos()
      .then(d => { setCasos(d); setLoading(false) })
      .catch(() => {
        setErro('Não foi possível conectar ao servidor. Rode: node backend/server.js')
        setLoading(false)
      })
  }, [])

  return (
    <div>
      {/* ── HEADER / BANNER ESTILO "COLA BORA" ── */}
      <div style={{
        position: 'relative',
        backgroundColor: '#050505',
        overflow: 'hidden',
        padding: '5rem 0 4rem 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)'
      }}>

        {/* Formas Geométricas Decorativas (Background) */}
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '220px', height: '220px', backgroundColor: '#FF2A9D', borderRadius: '50%', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', bottom: '-100px', left: '-80px', width: '300px', height: '300px', backgroundColor: '#EFEA9D', borderRadius: '50%', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', bottom: '60px', left: '160px', width: '60px', height: '60px', backgroundColor: '#C882FF', borderRadius: '50%', zIndex: 0 }}></div>

        {/* Pontinhos (Dot Pattern) */}
        <div style={{
          position: 'absolute', top: '40px', right: '150px', width: '100px', height: '100px', zIndex: 0, opacity: 0.5,
          backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)', backgroundSize: '15px 15px'
        }}></div>
        <div style={{
          position: 'absolute', bottom: '20px', right: '50px', width: '150px', height: '80px', zIndex: 0, opacity: 0.3,
          backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)', backgroundSize: '15px 15px'
        }}></div>

        {/* Conteúdo Central do Header */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center' }}>

          {/* Logo em Texto (Você pode trocar por uma tag <img> se preferir usar a sua imagem PNG original) */}
          <div style={{
            fontFamily: "'Montserrat', 'Inter', sans-serif",
            fontSize: 'clamp(4.5rem, 12vw, 8rem)',
            fontWeight: 900,
            color: '#C882FF',
            lineHeight: 0.85,
            letterSpacing: '-2px',
            marginBottom: '2rem',
            textTransform: 'uppercase'
          }}>
            COLA<br/>
            B<span style={{ color: '#EFEA9D' }}>O</span>RA!
          </div>

          {/* Faixa DETETIVE DE DADOS */}
          <div style={{
            backgroundColor: '#C882FF',
            width: '100%',
            padding: '0.8rem 1rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 15px rgba(200, 130, 255, 0.2)'
          }}>
            <h2 style={{
              color: '#000000',
              fontSize: 'clamp(1.2rem, 4vw, 2rem)',
              fontWeight: 800,
              margin: 0,
              letterSpacing: '1px'
            }}>
              DETETIVE DE DADOS
            </h2>
          </div>

          {/* Subtítulo */}
          <p style={{
            color: '#FFFFFF',
            fontSize: '1rem',
            fontWeight: 500,
            maxWidth: '600px',
            margin: '0 auto',
            padding: '0 1rem',
            lineHeight: 1.6
          }}>
            Resolva o crime consultando o banco de dados. Cada pista é uma consulta SQL real.
          </p>
        </div>
      </div>

      {/* ── ÁREA DOS CASOS (LISTAGEM) ── */}
      <div className="container" style={{ marginTop: '3rem', maxWidth: '900px' }}>

        {loading && <p className="text-muted" style={{ textAlign: 'center' }}>Carregando investigações...</p>}

        {erro && (
          <div style={{ background: '#200a0a', border: '1px solid var(--red)', borderRadius: '10px', padding: '1.25rem', marginBottom: '2rem' }}>
            <p style={{ color: 'var(--red)', fontWeight: 600, marginBottom: '.25rem' }}>Servidor offline</p>
            <p className="text-sm text-muted">{erro}</p>
            <code style={{ display: 'block', marginTop: '.75rem', fontSize: '13px', color: 'var(--amber)', background: '#1a1000', padding: '.5rem .75rem', borderRadius: '6px' }}>
              node backend/server.js
            </code>
          </div>
        )}

        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {casos.map((caso, i) => (
            <div key={caso.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s', borderLeft: '4px solid #C882FF' }}
              onClick={() => navigate(`/caso/${caso.id}`)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <div className="flex items-c justify-b mb-1">
                <span className="badge badge-purple" style={{ backgroundColor: 'rgba(200, 130, 255, 0.2)', color: '#C882FF' }}>Caso {i + 1}</span>
                <span className="text-muted text-sm">{caso.cidade}, {caso.estado}</span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '.5rem', color: '#ffffff' }}>
                {caso.titulo}
              </h2>
              <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>{caso.descricao}</p>
              <div className="mt-1">
                <button className="btn btn-primary" style={{ backgroundColor: '#C882FF', color: '#000', fontWeight: 700 }}>
                  Iniciar Investigação ▶
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 text-sm text-muted" style={{ textAlign: 'center', marginTop: '4rem', paddingBottom: '2rem' }}>
          <a href="/admin" style={{ color: 'var(--muted)', textDecoration: 'none', opacity: 0.7 }}>
            Painel de administração
          </a>
        </div>
      </div>
    </div>
  )
}