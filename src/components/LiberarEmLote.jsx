import { useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { linkWhatsApp } from '../lib/contato.js'
import { telefoneWhatsApp } from '../lib/avisos.js'

// Libera o portal para vários clientes de uma vez. Quem já recebeu acesso não entra na lista
// (liberar de novo trocaria a senha). Para cada um: senha provisória, e-mail (se configurado) e WhatsApp pronto.
export default function LiberarEmLote({ linhas, onFechar }) {
  const candidatos = useMemo(() => {
    const vistos = new Set()
    return linhas
      .filter((l) => !l.cancelado && l.g.cliente_email && !l.g.acesso_liberado_em)
      .filter((l) => {
        const e = l.g.cliente_email.toLowerCase()
        if (vistos.has(e)) return false // um acesso por e-mail, mesmo com vários contratos
        vistos.add(e)
        return true
      })
  }, [linhas])
  const semEmail = linhas.filter((l) => !l.cancelado && !l.g.cliente_email).length
  const [marcados, setMarcados] = useState(() => new Set(candidatos.map((l) => l.id)))
  const [resultados, setResultados] = useState({})
  const [andamento, setAndamento] = useState(null)
  const parar = useRef(false)

  const portal = `${window.location.origin}${window.location.pathname}`
  const mensagem = (g, senha) =>
    `Olá, ${g.cliente_nome.split(' ')[0]}! Seu acesso ao Portal Airam está liberado.\n` +
    `Endereço: ${portal}\nLogin: seu e-mail ou CPF\nSenha provisória: ${senha}\n` +
    `No primeiro acesso você cria uma senha só sua.`

  async function liberar() {
    parar.current = false
    const fila = candidatos.filter((l) => marcados.has(l.id) && !resultados[l.id]?.senha)
    for (const [i, l] of fila.entries()) {
      if (parar.current) break
      setAndamento({ feitos: i, total: fila.length })
      try {
        const r = await api.liberarAcesso(l.id)
        setResultados((x) => ({ ...x, [l.id]: r }))
      } catch (e) {
        setResultados((x) => ({ ...x, [l.id]: { erro: e.message } }))
      }
    }
    setAndamento(null)
  }

  const feitos = Object.values(resultados).filter((r) => r.senha).length
  const alternar = (id) => setMarcados((x) => {
    const n = new Set(x)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  return (
    <div className="modal" role="presentation">
      <div className="confirmar-exclusao lote-acesso" role="dialog" aria-modal="true" aria-labelledby="lote-t">
        <div className="cab-linha">
          <div>
            <span className="rotulo">Portal do cliente</span>
            <h2 id="lote-t">Liberar acessos em lote</h2>
          </div>
          <button type="button" className="btn btn-leve" onClick={() => { parar.current = true; onFechar(feitos > 0) }} disabled={!!andamento}>Fechar</button>
        </div>
        <p>
          {candidatos.length} {candidatos.length === 1 ? 'cliente ainda não recebeu' : 'clientes ainda não receberam'} acesso.
          {semEmail > 0 && ` ${semEmail} sem e-mail ficaram de fora (cadastre o e-mail na ficha).`}
          {' '}As senhas aparecem só agora: envie pelo WhatsApp antes de fechar.
        </p>
        {!candidatos.length ? <p className="vazio">Todos os clientes com e-mail já têm acesso.</p> : (
          <>
            <div className="acoes">
              <button type="button" className="link" onClick={() => setMarcados(new Set(candidatos.map((l) => l.id)))}>Marcar todos</button>
              <button type="button" className="link" onClick={() => setMarcados(new Set())}>Desmarcar</button>
              <span className="celula-sub">{marcados.size} marcados · {feitos} liberados</span>
            </div>
            <ul className="lote-lista">
              {candidatos.map((l) => {
                const r = resultados[l.id]
                const wa = r?.senha && linkWhatsApp(telefoneWhatsApp(l.g.cliente_telefone), mensagem(l.g, r.senha))
                return (
                  <li key={l.id} className={r?.senha ? 'ok' : r?.erro ? 'falhou' : ''}>
                    <label className="check">
                      <input type="checkbox" checked={marcados.has(l.id)} disabled={!!r?.senha || !!andamento} onChange={() => alternar(l.id)} />
                      <span><strong>{l.cliente_nome}</strong><span className="celula-sub">{l.g.cliente_email}{l.g.cliente_telefone ? ` · ${l.g.cliente_telefone}` : ' · sem telefone'}</span></span>
                    </label>
                    <span className="lote-resultado">
                      {r?.senha && <span className="num">Senha {r.senha}{r.emailEnviado ? ' · e-mail enviado' : ''}</span>}
                      {wa && <a className="btn btn-principal" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                      {r?.senha && !wa && <button type="button" className="btn btn-leve" onClick={() => navigator.clipboard?.writeText(mensagem(l.g, r.senha))}>Copiar mensagem</button>}
                      {r?.erro && <span className="texto-atraso">{r.erro}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="acoes">
              {andamento
                ? <><span className="carregando-linha">Liberando {andamento.feitos + 1} de {andamento.total}…</span><button type="button" className="btn btn-leve" onClick={() => (parar.current = true)}>Parar</button></>
                : <button type="button" className="btn btn-principal" onClick={liberar} disabled={!marcados.size || [...marcados].every((id) => resultados[id]?.senha)}>Liberar {[...marcados].filter((id) => !resultados[id]?.senha).length} acessos</button>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
