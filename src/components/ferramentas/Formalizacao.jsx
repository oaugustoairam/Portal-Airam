import { useEffect, useMemo, useState } from 'react'
import { api, MODO_DEMO } from '../../lib/api.js'
import { montarFormalizacao, faltasFormalizacao, itensPendentes, separarEmails, LIMITE_ANEXOS } from '../../lib/formalizacao.js'
import { foneBR, dataHoraBR } from '../../lib/comercial.js'
import { Janela, Confirmar } from '../comercial/comum.jsx'

const VAZIO = { lead_id: '', cliente: '', codigo: '', tipo_id: '', previsao: '', codigo_origem: '', nome_origem: '', marcados: [], anexos: {}, titulo: '', texto: '', para: [], cc: [], cco: [] }
const mb = (b) => `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
const SITUACAO = { enviado: 'Enviado', falhou: 'Falhou', pendente: 'Não enviado', simulado: 'Simulado (demonstração)' }

// Ferramentas > Formalização: e-mail para a fábrica/equipe pela caixa do próprio vendedor
export default function Formalizacao({ perfil, irParaPerfil }) {
  const [aba, setAba] = useState('nova')
  const [tipos, setTipos] = useState(null)
  const [leads, setLeads] = useState([])
  const [emails, setEmails] = useState([])
  const [caixa, setCaixa] = useState(undefined)
  const [lista, setLista] = useState([])
  const [erro, setErro] = useState('')
  const [rascunho, setRascunho] = useState(null)
  const [chave, setChave] = useState(0)
  const carregar = async () => {
    const [t, d, e, c, l] = await Promise.all([api.tiposFormalizacao(), api.comercialDados(), api.emailsUsados(), api.minhaCaixa(), api.formalizacoes()])
    setTipos(t.filter((x) => x.ativo))
    setLeads(d.leads)
    setEmails(e)
    setCaixa(c)
    setLista(l)
  }
  useEffect(() => {
    carregar().catch((e) => setErro(e.message))
  }, [])
  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!tipos) return <div className="carregando">Carregando…</div>

  function duplicar(f) {
    setRascunho({
      ...VAZIO, lead_id: f.lead_id, cliente: f.cliente_nome, codigo: f.codigo, tipo_id: f.tipo_id, previsao: f.dados?.previsao || '',
      codigo_origem: f.dados?.codigo_origem || '', nome_origem: f.dados?.nome_origem || '', marcados: f.dados?.marcados || [],
      para: f.para, cc: f.cc, cco: f.cco, titulo: f.titulo, texto: f.texto, editado: true,
      anexos: (f.formalizacao_anexos || []).reduce((m, a) => ({ ...m, [a.anexo_id]: [...(m[a.anexo_id] || []), { herdado: true, nome: a.nome, caminho: a.caminho, mime: a.mime, tamanho: Number(a.tamanho) }] }), {}),
    })
    setChave((n) => n + 1)
    setAba('nova')
  }

  return (
    <section className="gestao formalizacao">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Ferramentas</span>
          <h1 className="titulo-grande">Formalização</h1>
        </div>
        <nav className="segmentado" role="tablist" aria-label="Formalização">
          {[['nova', 'Nova formalização'], ['enviadas', `Formalizações enviadas (${lista.length})`]].map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? 'ativo' : ''} onClick={() => setAba(k)}>{t}</button>
          ))}
        </nav>
      </div>
      {aba === 'nova' && (
        <NovaFormalizacao key={chave} tipos={tipos} leads={leads} emails={emails} caixa={caixa} inicial={rascunho} irParaPerfil={irParaPerfil}
          onEnviado={async () => { setRascunho(null); setChave((n) => n + 1); await carregar(); setAba('enviadas') }} onFalhou={carregar} />
      )}
      {aba === 'enviadas' && <ListaFormalizacoes lista={lista} onMudou={carregar} onDuplicar={duplicar} />}
    </section>
  )
}

// campo com vários e-mails (chips) e sugestão dos já usados
export function CampoEmails({ id, rotulo, valor, onChange, sugestoes }) {
  const [texto, setTexto] = useState('')
  const adicionar = (t = texto) => {
    const novos = separarEmails(t).filter((e) => !valor.includes(e))
    if (novos.length) onChange([...valor, ...novos])
    setTexto('')
  }
  return (
    <div className="campo campo-emails">
      <label htmlFor={id}>{rotulo}</label>
      <div className="chips-emails">
        {valor.map((e) => (
          <span key={e} className={`chip-email ${/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? '' : 'invalido'}`}>
            {e}<button type="button" aria-label={`Tirar ${e}`} onClick={() => onChange(valor.filter((x) => x !== e))}>×</button>
          </span>
        ))}
        <input id={id} list={`${id}-sug`} type="email" value={texto} placeholder={valor.length ? '' : 'nome@empresa.com'} autoComplete="off"
          onChange={(e) => (/[,;\s]$/.test(e.target.value) ? adicionar(e.target.value) : setTexto(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } if (e.key === 'Backspace' && !texto && valor.length) onChange(valor.slice(0, -1)) }}
          onBlur={() => texto && adicionar()} />
        <datalist id={`${id}-sug`}>{sugestoes.filter((s) => !valor.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
      </div>
    </div>
  )
}

function NovaFormalizacao({ tipos, leads, emails, caixa, inicial, onEnviado, onFalhou, irParaPerfil }) {
  const [f, setF] = useState(() => inicial || VAZIO)
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const tipo = tipos.find((t) => t.id === f.tipo_id)
  const lead = leads.find((l) => l.id === f.lead_id)
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }))
  // título e texto seguem o modelo até a pessoa editar
  const gerado = tipo ? montarFormalizacao(tipo, f) : { titulo: '', texto: '' }
  const titulo = f.editado ? f.titulo : gerado.titulo
  const texto = f.editado ? f.texto : gerado.texto
  const final = { ...f, titulo, texto }
  const faltas = faltasFormalizacao(tipo, final)
  const pendentes = tipo ? itensPendentes(tipo, f.marcados) : []
  const totalAnexos = Object.values(f.anexos).flat().reduce((s, a) => s + (a.size || a.tamanho || 0), 0)
  const caixaOk = MODO_DEMO ? !!caixa : !!caixa?.teste_ok
  const t = busca.trim().toLowerCase()
  const n = busca.replace(/\D/g, '')
  const opcoes = leads.filter((l) => !t || l.nome.toLowerCase().includes(t) || (n.length >= 3 && l.telefone.replace(/\D/g, '').includes(n))).slice(0, 40)
  // pedidos de origem: vendas do mesmo cliente (telefone) com código
  const origens = useMemo(() => (lead ? leads.filter((l) => l.id !== lead.id && l.codigo_pedido && l.telefone.replace(/\D/g, '') === lead.telefone.replace(/\D/g, '')) : []), [lead, leads])

  function escolherLead(id) {
    const l = leads.find((x) => x.id === id)
    setF((x) => ({ ...x, lead_id: id, cliente: l?.nome || '', codigo: x.codigo && x.lead_id === id ? x.codigo : l?.codigo_pedido || '' }))
  }
  function anexar(anexo, arquivos) {
    setF((x) => ({ ...x, anexos: { ...x.anexos, [anexo.id]: anexo.multiplo ? [...(x.anexos[anexo.id] || []), ...arquivos] : arquivos.slice(0, 1) } }))
  }
  async function enviar() {
    setErro('')
    setOk('')
    if (faltas.length) return setErro(faltas[0])
    setOcupado(true)
    try {
      await api.enviarFormalizacao(final, tipo)
      setOk(`Formalização enviada para ${final.para.join(', ')}`)
      setTimeout(onEnviado, 1200)
    } catch (e) {
      setErro(e.message)
      onFalhou()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="form-formalizacao">
      {!caixaOk && (
        <div className="aviso-config">
          {caixa ? `Sua caixa de e-mail falhou no último teste: ${caixa.erro || ''}` : 'Para enviar, cadastre sua caixa de e-mail da Hostinger em Meu perfil.'}
          {irParaPerfil && <button type="button" className="btn btn-leve" onClick={irParaPerfil}>Abrir Meu perfil</button>}
        </div>
      )}
      <div className="grade grade-2">
        <fieldset className="grupo">
          <legend>1. Cliente e pedido</legend>
          <div className="campo">
            <label htmlFor="fz-busca">Cliente</label>
            {lead ? (
              <div className="cliente-escolhido"><strong>{lead.nome}</strong> · {foneBR(lead.telefone)} <button type="button" className="btn btn-leve" onClick={() => setF((x) => ({ ...x, lead_id: '', cliente: '' }))}>Trocar</button></div>
            ) : (
              <>
                <input id="fz-busca" type="search" placeholder="Buscar nos seus clientes do CRM" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <select aria-label="Escolher cliente" size={Math.min(6, Math.max(2, opcoes.length + 1))} value="" onChange={(e) => escolherLead(e.target.value)}>
                  <option value="" disabled>{leads.length ? 'Escolha…' : 'Nenhum cliente no seu CRM'}</option>
                  {opcoes.map((l) => <option key={l.id} value={l.id}>{l.nome} · {foneBR(l.telefone)}{l.codigo_pedido ? ` · ${l.codigo_pedido}` : ''}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="campo">
            <label htmlFor="fz-codigo">Código do pedido</label>
            <input id="fz-codigo" maxLength={40} value={f.codigo} onChange={(e) => muda('codigo', e.target.value)} />
            {lead?.codigo_pedido && <span className="ajuda">Vindo do cartão do cliente.</span>}
          </div>
          <div className="campo">
            <label htmlFor="fz-tipo">Tipo de formalização</label>
            <select id="fz-tipo" value={f.tipo_id} onChange={(e) => setF((x) => ({ ...x, tipo_id: e.target.value, marcados: [], anexos: {}, editado: false }))}>
              <option value="">Escolha…</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        </fieldset>

        {tipo && (
          <fieldset className="grupo">
            <legend>2. Dados do tipo</legend>
            {tipo.campos.includes('previsao') && (
              <div className="campo"><label htmlFor="fz-prev">Previsão do imóvel</label>
                <input id="fz-prev" placeholder="Ex.: março de 2027 ou 15/03/2027" value={f.previsao} onChange={(e) => muda('previsao', e.target.value)} /></div>
            )}
            {tipo.campos.includes('origem') && (
              <>
                {origens.length > 0 && (
                  <div className="campo"><label htmlFor="fz-orig-sel">Pedidos vendidos deste cliente</label>
                    <select id="fz-orig-sel" value="" onChange={(e) => { const o = origens.find((x) => x.id === e.target.value); if (o) setF((x) => ({ ...x, codigo_origem: o.codigo_pedido, nome_origem: o.nome })) }}>
                      <option value="">Escolher…</option>
                      {origens.map((o) => <option key={o.id} value={o.id}>{o.codigo_pedido} - {o.nome}</option>)}
                    </select></div>
                )}
                <div className="grade grade-2">
                  <div className="campo"><label htmlFor="fz-corig">Código do pedido de origem</label><input id="fz-corig" value={f.codigo_origem} onChange={(e) => muda('codigo_origem', e.target.value)} /></div>
                  <div className="campo"><label htmlFor="fz-norig">Nome do pedido de origem</label><input id="fz-norig" value={f.nome_origem} onChange={(e) => muda('nome_origem', e.target.value)} /></div>
                </div>
              </>
            )}
            {tipo.checklist.length > 0 && (
              <div className="campo">
                <span className="rotulo-campo">Checklist de medição</span>
                {tipo.checklist.map((c, i) => (
                  <label key={i} className="check"><input type="checkbox" checked={!!f.marcados[i]} onChange={(e) => { const m = [...f.marcados]; m[i] = e.target.checked; muda('marcados', m) }} /> {c.pergunta}</label>
                ))}
                {pendentes.length > 0 && <p className="aviso-config">"{tipo.bloco_checklist || 'Checklist'}" só entra no texto com todos marcados. Falta: {pendentes.map((c) => c.texto).join(', ')}.</p>}
              </div>
            )}
            {tipo.anexos.map((a) => (
              <div key={a.id} className="campo">
                <span className="rotulo-campo">{a.nome}{a.obrigatorio ? ' *' : ''}</span>
                <label className="btn btn-contorno">+ {a.multiplo ? 'Adicionar arquivos' : 'Escolher arquivo'}
                  <input type="file" hidden multiple={a.multiplo} aria-label={a.nome} onChange={(e) => { anexar(a, [...e.target.files]); e.target.value = '' }} /></label>
                <ul className="arquivos-escolhidos">
                  {(f.anexos[a.id] || []).map((x, i) => (
                    <li key={i}><span>{x.name || x.nome}</span><small>{mb(x.size || x.tamanho || 0)}</small>
                      <button type="button" className="btn btn-leve" onClick={() => muda('anexos', { ...f.anexos, [a.id]: f.anexos[a.id].filter((_, j) => j !== i) })}>Tirar</button></li>
                  ))}
                </ul>
              </div>
            ))}
            {tipo.anexos.length > 0 && <p className={`ajuda ${totalAnexos > LIMITE_ANEXOS ? 'texto-atraso' : ''}`}>Anexos: {mb(totalAnexos)} de {mb(LIMITE_ANEXOS)}.</p>}
          </fieldset>
        )}
      </div>

      {tipo && (
        <fieldset className="grupo">
          <legend>3. E-mail</legend>
          <div className="grade grade-3">
            <CampoEmails id="fz-para" rotulo="Para *" valor={f.para} onChange={(v) => muda('para', v)} sugestoes={emails} />
            <CampoEmails id="fz-cc" rotulo="Cc" valor={f.cc} onChange={(v) => muda('cc', v)} sugestoes={emails} />
            <CampoEmails id="fz-cco" rotulo="Cco" valor={f.cco} onChange={(v) => muda('cco', v)} sugestoes={emails} />
          </div>
          <div className="campo"><label htmlFor="fz-titulo">Título</label>
            <input id="fz-titulo" value={titulo} onChange={(e) => setF((x) => ({ ...x, editado: true, titulo: e.target.value, texto }))} /></div>
          <div className="campo"><label htmlFor="fz-texto">Texto (pode editar)</label>
            <textarea id="fz-texto" rows={10} value={texto} onChange={(e) => setF((x) => ({ ...x, editado: true, texto: e.target.value, titulo }))} /></div>
          {f.editado && <button type="button" className="btn btn-leve" onClick={() => setF((x) => ({ ...x, editado: false }))}>Refazer título e texto pelo modelo</button>}
          {faltas.length > 0 && <ul className="faltas">{faltas.map((x) => <li key={x}>{x}</li>)}</ul>}
          {erro && <p className="erro" role="alert">{erro}</p>}
          {ok && <p className="ok-texto" role="status">{ok}</p>}
          <div className="acoes">
            <button type="button" className="btn btn-principal" onClick={enviar} disabled={ocupado || faltas.length > 0 || !caixaOk}>{ocupado ? 'Enviando…' : 'Enviar e-mail'}</button>
            <span className="ajuda">Sai pela sua caixa {caixa?.email || ''}. Uma cópia fica em "Enviados" no webmail.</span>
          </div>
        </fieldset>
      )}
    </div>
  )
}

export function ListaFormalizacoes({ lista, onMudou, onDuplicar, compacta }) {
  const [busca, setBusca] = useState('')
  const [ver, setVer] = useState(null)
  const [reenviar, setReenviar] = useState(null)
  const [msg, setMsg] = useState('')
  const t = busca.trim().toLowerCase()
  const filtradas = lista.filter((f) => !t || `${f.cliente_nome} ${f.codigo} ${f.tipo_nome} ${f.para.join(' ')}`.toLowerCase().includes(t))
  const avisar = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }
  return (
    <div className="lista-formalizacoes">
      {!compacta && <input type="search" placeholder="Buscar por cliente, código, tipo ou destinatário" aria-label="Buscar formalizações" value={busca} onChange={(e) => setBusca(e.target.value)} />}
      {msg && <span className="toast" role="status">{msg}</span>}
      {filtradas.length === 0 ? <p className="vazio-mini">Nenhuma formalização.</p> : (
        <ul className="lista-lembretes">
          {filtradas.map((f) => (
            <li key={f.id}>
              <span className="lb-info">
                <span><strong>{f.codigo} - {f.cliente_nome}</strong> <small className={`sit-aviso sit-${f.situacao === 'simulado' ? 'enviado' : f.situacao}`}>{SITUACAO[f.situacao]}</small></span>
                <span className="celula-sub">{f.tipo_nome} · {dataHoraBR(f.enviado_em || f.criado_em)} · para {f.para.join(', ')}{f.cc.length ? ` · cc ${f.cc.join(', ')}` : ''}</span>
                {f.erro && <span className="celula-sub texto-atraso">{f.erro}</span>}
              </span>
              <span className="acoes-linha">
                <button type="button" className="btn btn-leve" onClick={() => setVer(f)}>Ver</button>
                <button type="button" className="btn btn-leve" onClick={() => setReenviar(f)}>Reenviar</button>
                {onDuplicar && <button type="button" className="btn btn-leve" onClick={() => onDuplicar(f)}>Duplicar</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {ver && <VerFormalizacao f={ver} onFechar={() => setVer(null)} />}
      {reenviar && <Confirmar titulo="Reenviar esta formalização?" botao="Reenviar" texto={`${reenviar.titulo} · para ${reenviar.para.join(', ')}. Sai de novo pela sua caixa de e-mail.`}
        onCancelar={() => setReenviar(null)} onConfirmar={async () => { await api.reenviarFormalizacao(reenviar.id); setReenviar(null); await onMudou(); avisar('Formalização reenviada') }} />}
    </div>
  )
}

function VerFormalizacao({ f, onFechar }) {
  const [erro, setErro] = useState('')
  async function abrir(a, baixar) {
    try {
      const url = await api.urlAnexoFormalizacao(a, baixar)
      if (baixar) {
        const x = document.createElement('a')
        x.href = url
        x.download = a.nome
        document.body.appendChild(x)
        x.click()
        x.remove()
      } else window.open(url, '_blank', 'noopener')
    } catch (e) {
      setErro(e.message)
    }
  }
  return (
    <Janela titulo={f.titulo} rotulo={`${f.tipo_nome} · ${SITUACAO[f.situacao]}`} largura="grande" onFechar={onFechar}>
      <dl className="cartao-dados">
        <div><dt>Para</dt><dd>{f.para.join(', ')}</dd></div>
        {f.cc.length > 0 && <div><dt>Cc</dt><dd>{f.cc.join(', ')}</dd></div>}
        {f.cco.length > 0 && <div><dt>Cco</dt><dd>{f.cco.join(', ')}</dd></div>}
        <div><dt>{f.enviado_em ? 'Enviado em' : 'Criado em'}</dt><dd>{dataHoraBR(f.enviado_em || f.criado_em)}</dd></div>
        {f.copia_enviados && <div><dt>Cópia em Enviados</dt><dd>{f.copia_enviados}</dd></div>}
      </dl>
      {f.erro && <p className="erro">{f.erro}</p>}
      <pre className="conversa-texto">{f.texto}</pre>
      <h3>Anexos</h3>
      <ul className="lista-anexos">
        {(f.formalizacao_anexos || []).map((a) => (
          <li key={a.id}><span>{a.nome}<small>{mb(Number(a.tamanho || 0))}</small></span>
            <span className="acoes-linha"><button type="button" className="btn btn-leve" onClick={() => abrir(a, false)}>Visualizar</button>
              <button type="button" className="btn btn-leve" onClick={() => abrir(a, true)}>Baixar</button></span></li>
        ))}
      </ul>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </Janela>
  )
}
