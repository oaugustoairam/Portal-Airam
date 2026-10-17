import { useMemo } from 'react'
import { linhasDaPasta, resumoDaPasta } from '../lib/pastas.js'

const CHIP = { ok: 'chip-sit-ok', atraso: 'chip-sit-atraso', andamento: 'chip-sit-andamento', neutro: 'chip-sit-neutro' }

// Uma pasta de processos (Financeiro, Medição, Conferência…): só os processos daquela fase,
// dos mais urgentes para os menos.
export default function PastaProcessos({ pasta, processos, controles, selecionados, onAlternar, onAbrir }) {
  const linhas = useMemo(() => linhasDaPasta(pasta, processos, controles), [pasta, processos, controles])
  const resumo = resumoDaPasta(linhas)

  return (
    <section className="pasta">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Processos</span>
          <h1 className="titulo-grande">{pasta.nome}</h1>
        </div>
      </div>
      <p className="dica pasta-descricao">{pasta.descricao}</p>

      <div className="pasta-numeros">
        {[['Em aberto', resumo.total], ['Com atraso', resumo.atrasados, resumo.atrasados > 0], ['Vencem em 7 dias', resumo.em7dias]].map(([t, v, alerta]) => (
          <div key={t} className={`pasta-numero ${alerta ? 'pasta-numero-alerta' : ''}`}>
            <span className="indicador-valor num">{v}</span>
            <span className="rotulo">{t}</span>
          </div>
        ))}
      </div>

      {!linhas.length ? (
        <p className="vazio">Nenhum processo nesta fase agora.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th className="col-sel"><span className="sr-only">Selecionar</span></th>
                <th>Código</th>
                <th>Cliente</th>
                {pasta.colunas.map(([t]) => <th key={t}>{t}</th>)}
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ r, prazo, situacao }) => (
                <tr key={r.p.id} onClick={() => onAbrir(r.p.id)} tabIndex={0} className={selecionados.has(r.p.id) ? 'linha-selecionada' : ''}
                  onKeyDown={(e) => e.key === 'Enter' && onAbrir(r.p.id)}>
                  <td className="col-sel" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Selecionar ${r.p.codigo} ${r.p.cliente_nome}`} checked={selecionados.has(r.p.id)} onChange={() => onAlternar(r.p.id)} />
                  </td>
                  <td className="num"><strong>{r.p.codigo}</strong></td>
                  <td>{r.p.cliente_nome}<span className="celula-sub">{r.p.ambientes}</span></td>
                  {pasta.colunas.map(([t, valor]) => <td key={t} className="num">{valor(r, prazo)}</td>)}
                  <td><span className={`chip chip-mini ${CHIP[situacao.tipo]}`}>{situacao.texto}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Resumo de todas as pastas, no topo da visão geral
export function ResumoPastas({ pastas, processos, controles, onPasta }) {
  return (
    <div className="resumo-pastas">
      {pastas.map((pasta) => {
        const r = resumoDaPasta(linhasDaPasta(pasta, processos, controles))
        return (
          <button key={pasta.id} type="button" className="resumo-pasta" onClick={() => onPasta(pasta.id)}>
            <span className="resumo-pasta-nome">{pasta.nome}</span>
            <span className="resumo-pasta-total num">{r.total}</span>
            <span className={`resumo-pasta-sub ${r.atrasados ? 'texto-atraso' : ''}`}>
              {r.atrasados ? `${r.atrasados} com atraso` : r.total ? 'Em dia' : 'Nada pendente'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
