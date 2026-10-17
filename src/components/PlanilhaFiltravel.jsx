import { useEffect, useMemo, useRef, useState } from 'react'
import { COLUNAS, filtroAtivo, passaFiltro, textoCelula, opcoesDaColuna, ordenar } from '../lib/gestao.js'
import { moeda } from '../lib/vendas.js'

// Planilha da gestão: filtro e ordenação em cada coluna, como no Excel.
// No computador mostra a tabela inteira; no celular vira uma lista de cartões.
export default function PlanilhaFiltravel({ linhas, colunas, visiveis, filtros, setFiltros, ordem, setOrdem, onAbrir, celula, rotuloVazio }) {
  const [aberto, setAberto] = useState(null) // coluna com o filtro aberto
  const [painel, setPainel] = useState(false) // celular: painel com todos os filtros
  const [todas, setTodas] = useState(false)
  const cols = (todas || !visiveis ? colunas : colunas.slice(0, visiveis)).map((k) => [k, COLUNAS[k]])

  const filtradas = useMemo(() => {
    const ativos = Object.entries(filtros).filter(([k, f]) => COLUNAS[k] && filtroAtivo(f))
    return ordenar(linhas.filter((l) => ativos.every(([k, f]) => passaFiltro(l[k], COLUNAS[k], f))), ordem)
  }, [linhas, filtros, ordem])
  const nFiltros = Object.entries(filtros).filter(([k, f]) => colunas.includes(k) && filtroAtivo(f)).length

  const mudar = (k, f) => setFiltros((x) => ({ ...x, [k]: f }))
  const limpar = () => setFiltros({})
  const ordenarPor = (k) => setOrdem((o) => (o?.k === k ? (o.dir === 'asc' ? { k, dir: 'desc' } : null) : { k, dir: 'asc' }))

  const ver = (l, k, col) => (celula?.(l, k) ?? textoCelula(l[k], col))

  return (
    <div className="planilha">
      <div className="planilha-barra">
        <span className="num planilha-conta">{filtradas.length} de {linhas.length}</span>
        <button type="button" className={`btn btn-leve planilha-filtros-btn ${nFiltros ? 'filtro-ativo' : ''}`} onClick={() => setPainel(true)}>
          Filtrar e ordenar{nFiltros ? ` · ${nFiltros}` : ''}
        </button>
        {nFiltros > 0 && <button type="button" className="btn btn-leve" onClick={limpar}>Limpar filtros</button>}
        {visiveis && colunas.length > visiveis && (
          <button type="button" className="btn btn-leve planilha-todas" onClick={() => setTodas((t) => !t)}>
            {todas ? 'Menos colunas' : `Todas as colunas (${colunas.length})`}
          </button>
        )}
      </div>

      {/* computador: tabela com filtro no cabeçalho */}
      <div className="planilha-tabela-wrap">
        <table className="planilha-tabela">
          <thead>
            <tr>
              {cols.map(([k, col]) => (
                <th key={k} className={`${col.fixa ? 'fixa' : ''} ${col.larga ? 'larga' : ''} tipo-${col.tipo}`} aria-sort={ordem?.k === k ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <span className="planilha-th">
                    <button type="button" className="planilha-ordenar" onClick={() => ordenarPor(k)} title="Ordenar">
                      {col.t}
                      <span className="planilha-seta" aria-hidden="true">{ordem?.k === k ? (ordem.dir === 'asc' ? '↑' : '↓') : ''}</span>
                    </button>
                    <button type="button" className={`planilha-funil ${filtroAtivo(filtros[k]) ? 'ativo' : ''}`} aria-label={`Filtrar ${col.t}`}
                      aria-expanded={aberto?.k === k} onClick={(e) => setAberto(aberto?.k === k ? null : { k, r: e.currentTarget.getBoundingClientRect() })}>
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.2V8.5z" /></svg>
                    </button>
                  </span>
                  {aberto?.k === k && (
                    <Popover onFechar={() => setAberto(null)} r={aberto.r}>
                      <FiltroColuna k={k} col={col} linhas={linhas} f={filtros[k]} onChange={(f) => mudar(k, f)}
                        ordem={ordem} onOrdem={(dir) => setOrdem(dir ? { k, dir } : null)} />
                    </Popover>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.id} tabIndex={0} onClick={() => onAbrir(l)} onKeyDown={(e) => e.key === 'Enter' && onAbrir(l)}>
                {cols.map(([k, col]) => (
                  <td key={k} className={`${col.fixa ? 'fixa' : ''} ${col.larga ? 'larga' : ''} tipo-${col.tipo}`}>{ver(l, k, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {filtradas.length > 0 && cols.some(([, c]) => c.soma) && (
            <tfoot>
              <tr>
                {cols.map(([k, col], i) => (
                  <td key={k} className={`${col.fixa ? 'fixa' : ''} tipo-${col.tipo}`}>
                    {col.soma ? moeda(filtradas.reduce((t, l) => t + (l[k] || 0), 0)) : i === 0 ? 'Total' : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* celular: cartões */}
      <ul className="planilha-cartoes">
        {filtradas.map((l) => (
          <li key={l.id}>
            <button type="button" className="planilha-cartao" onClick={() => onAbrir(l)}>
              <span className="planilha-cartao-topo">
                <strong>{l.cliente_nome}</strong>
                <span className="num">{l.codigo}</span>
              </span>
              <dl>
                {cols.filter(([k, c]) => !c.fixa && k !== 'observacao' && l[k] !== null && l[k] !== undefined && l[k] !== '').slice(0, 6).map(([k, col]) => (
                  <div key={k}><dt>{col.t}</dt><dd>{ver(l, k, col)}</dd></div>
                ))}
              </dl>
              {l.observacao && <span className="celula-sub">{l.observacao}</span>}
            </button>
          </li>
        ))}
      </ul>

      {!filtradas.length && <p className="vazio">{linhas.length ? 'Nenhum cliente com esses filtros.' : rotuloVazio || 'Nenhum cliente aqui.'}</p>}

      {painel && (
        <div className="planilha-painel" role="dialog" aria-modal="true" aria-label="Filtrar e ordenar">
          <div className="planilha-painel-caixa">
            <div className="planilha-painel-cab">
              <strong>Filtrar e ordenar</strong>
              <button type="button" className="btn btn-leve" onClick={() => setPainel(false)}>Pronto</button>
            </div>
            <div className="planilha-painel-corpo">
              {colunas.map((k) => (
                <details key={k} className="planilha-painel-item" open={filtroAtivo(filtros[k])}>
                  <summary>{COLUNAS[k].t}{filtroAtivo(filtros[k]) && <span className="planilha-ponto" aria-label="filtro ativo" />}</summary>
                  <FiltroColuna k={k} col={COLUNAS[k]} linhas={linhas} f={filtros[k]} onChange={(f) => mudar(k, f)}
                    ordem={ordem} onOrdem={(dir) => setOrdem(dir ? { k, dir } : null)} />
                </details>
              ))}
            </div>
            <div className="planilha-painel-pe">
              <button type="button" className="btn btn-leve" onClick={limpar} disabled={!nFiltros}>Limpar tudo</button>
              <button type="button" className="btn btn-principal" onClick={() => setPainel(false)}>Ver {filtradas.length} clientes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Popover({ onFechar, r, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const fora = (e) => ref.current && !ref.current.contains(e.target) && !e.target.closest?.('.planilha-funil') && onFechar()
    const esc = (e) => e.key === 'Escape' && onFechar()
    const rolou = (e) => !ref.current?.contains(e.target) && onFechar()
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', rolou, true)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', rolou, true)
    }
  }, [])
  // fixo na tela, logo abaixo do botão do filtro (a tabela tem rolagem própria)
  const left = Math.max(8, Math.min(r.left - 220, window.innerWidth - 336))
  const top = Math.min(r.bottom + 6, window.innerHeight - 200)
  return <div ref={ref} className="planilha-popover" style={{ left, top }} onClick={(e) => e.stopPropagation()}>{children}</div>
}

// Editor do filtro de uma coluna, conforme o tipo
function FiltroColuna({ k, col, linhas, f = {}, onChange, ordem, onOrdem }) {
  const set = (x) => onChange({ ...f, ...x })
  const opcoes = col.tipo === 'opcao' ? opcoesDaColuna(k, col, linhas) : []
  const marcadas = f.opcoes || []
  const crescente = col.tipo === 'data' ? 'Mais antigo primeiro' : col.tipo === 'texto' || col.tipo === 'opcao' ? 'A → Z' : 'Menor primeiro'
  const decrescente = col.tipo === 'data' ? 'Mais recente primeiro' : col.tipo === 'texto' || col.tipo === 'opcao' ? 'Z → A' : 'Maior primeiro'
  return (
    <div className="filtro-coluna">
      <div className="segmentado segmentado-mini" role="group" aria-label="Ordenar">
        <button type="button" className={ordem?.k === k && ordem.dir === 'asc' ? 'ativo' : ''} onClick={() => onOrdem(ordem?.k === k && ordem.dir === 'asc' ? null : 'asc')}>{crescente}</button>
        <button type="button" className={ordem?.k === k && ordem.dir === 'desc' ? 'ativo' : ''} onClick={() => onOrdem(ordem?.k === k && ordem.dir === 'desc' ? null : 'desc')}>{decrescente}</button>
      </div>
      {col.tipo === 'texto' && (
        <input type="search" placeholder="Contém…" value={f.texto || ''} onChange={(e) => set({ texto: e.target.value })} aria-label={`Filtrar ${col.t}`} autoFocus />
      )}
      {col.tipo === 'opcao' && (
        <div className="filtro-opcoes">
          <div className="filtro-opcoes-acoes">
            <button type="button" className="link" onClick={() => set({ opcoes: opcoes.map((o) => o.v) })}>Marcar todas</button>
            <button type="button" className="link" onClick={() => set({ opcoes: [] })}>Limpar</button>
          </div>
          {opcoes.map((o) => (
            <label key={o.v} className="filtro-opcao">
              <input type="checkbox" checked={marcadas.includes(o.v)}
                onChange={(e) => set({ opcoes: e.target.checked ? [...marcadas, o.v] : marcadas.filter((x) => x !== o.v) })} />
              <span>{col.fmt && o.v ? col.fmt(o.v) || o.t : o.t}</span>
            </label>
          ))}
          {!opcoes.length && <span className="celula-sub">Sem valores nesta aba.</span>}
        </div>
      )}
      {['data', 'moeda', 'numero', 'pct'].includes(col.tipo) && (
        <div className="filtro-faixa">
          <label>
            <span>{col.tipo === 'data' ? 'De' : 'Mínimo'}</span>
            <input type={col.tipo === 'data' ? 'date' : 'number'} inputMode="decimal" value={f.min || ''} onChange={(e) => set({ min: e.target.value })} />
          </label>
          <label>
            <span>{col.tipo === 'data' ? 'Até' : 'Máximo'}</span>
            <input type={col.tipo === 'data' ? 'date' : 'number'} inputMode="decimal" value={f.max || ''} onChange={(e) => set({ max: e.target.value })} />
          </label>
        </div>
      )}
      {filtroAtivo(f) && <button type="button" className="link filtro-limpar" onClick={() => onChange({})}>Tirar filtro de {col.t}</button>}
    </div>
  )
}
