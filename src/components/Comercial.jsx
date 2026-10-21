import { useEffect, useRef, useState } from 'react'
import { api, MODO_DEMO } from '../lib/api.js'
import { LISTAS_CONFIG, TIPOS_COLUNA, acoesComercial } from '../lib/comercial.js'
import { ComercialCtx, Confirmar } from './comercial/comum.jsx'
import Captacao from './comercial/Captacao.jsx'
import Crm from './comercial/Crm.jsx'
import Calendario from './comercial/Calendario.jsx'
import MeusLembretes from './comercial/Lembretes.jsx'
import Metricas from './comercial/Metricas.jsx'
import CartaoLead from './comercial/CartaoLead.jsx'
import Usuarios from './Usuarios.jsx'

// Aba COMERCIAL: carrega listas, pessoas e dados uma vez e entrega para as telas.
// Tudo que é salvo recarrega os dados do banco na hora (sem recarregar a página).
export default function Comercial({ aba, perfil }) {
  const [base, setBase] = useState(null)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState(null)
  const [cartao, setCartao] = useState(null)
  const relogio = useRef(null)
  const contador = useRef(0)

  const carregarBase = async () => {
    const [listas, pessoas, vendedores, lojas] = await Promise.all([api.comercialListas(), api.nomesEquipe(), api.vendedoresComercial(), api.lojas()])
    setBase({ listas, pessoas, vendedores, lojas })
  }
  const recarregar = async () => {
    try {
      setDados(await api.comercialDados())
    } catch (e) {
      avisar(e.message, true)
    }
  }
  useEffect(() => {
    Promise.all([carregarBase(), api.comercialDados().then(setDados)]).catch((e) => setErro(e.message))
  }, [])
  function avisar(msg, ehErro = false) {
    clearTimeout(relogio.current)
    setToast({ msg, erro: ehErro, n: ++contador.current })
    relogio.current = setTimeout(() => setToast(null), ehErro ? 7000 : 3500)
  }

  if (aba === 'config') return <ConfigComercial perfil={perfil} />
  if (erro) return <p className="erro" role="alert">Não foi possível carregar o Comercial: {erro}</p>
  if (!base || !dados) return <div className="carregando">Carregando…</div>

  const ctx = { ...base, dados, setDados, perfil, acoes: acoesComercial(perfil), recarregar, avisar, abrirCartao: setCartao, recarregarBase: carregarBase }
  return (
    <ComercialCtx.Provider value={ctx}>
      {aba === 'captacao' && <Captacao />}
      {aba === 'crm' && <Crm />}
      {aba === 'lembretes' && <MeusLembretes />}
      {aba === 'calendario' && <Calendario />}
      {aba === 'metricas' && <Metricas />}
      {cartao && <CartaoLead id={cartao} onFechar={() => setCartao(null)} />}
      {toast && <div key={toast.n} data-n={toast.n} className={`toast-fixo ${toast.erro ? 'erro' : ''}`} role={toast.erro ? 'alert' : 'status'}>{toast.msg}</div>}
    </ComercialCtx.Provider>
  )
}

// Configurações do Comercial (master, ou quem tiver a permissão)
function ConfigComercial({ perfil }) {
  const [parte, setParte] = useState('listas')
  const partes = [['listas', 'Listas'], ['lojas', 'Lojas'], ...(perfil.papel === 'admin' ? [['usuarios', 'Usuários'], ['integracoes', 'WhatsApp e e-mail']] : [])]
  return (
    <section className="gestao config-comercial">
      <div className="titulo-processo">
        <span className="rotulo">Comercial</span>
        <h1 className="titulo-grande">Configurações</h1>
      </div>
      <nav className="segmentado" role="tablist" aria-label="Configurações">
        {partes.map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={parte === k} className={parte === k ? 'ativo' : ''} onClick={() => setParte(k)}>{t}</button>)}
      </nav>
      {parte === 'listas' && <ListasConfig />}
      {parte === 'lojas' && <LojasConfig />}
      {parte === 'usuarios' && <Usuarios perfil={perfil} embutido />}
      {parte === 'integracoes' && <Integracoes perfil={perfil} />}
    </section>
  )
}

function useMensagem() {
  const [msg, setMsg] = useState('')
  const t = useRef(null)
  const mostrar = (m) => {
    clearTimeout(t.current)
    setMsg(m)
    t.current = setTimeout(() => setMsg(''), 2500)
  }
  return [msg, mostrar]
}

function ListasConfig() {
  const [listas, setListas] = useState(null)
  const [erro, setErro] = useState('')
  const [msg, mostrar] = useMensagem()
  const carregar = () => api.comercialListas().then(setListas).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])
  async function salvar(tabela, item) {
    setErro('')
    try {
      await api.salvarItemLista(tabela, item)
      await carregar()
      mostrar('Salvo')
    } catch (e) {
      setErro(e.message)
    }
  }
  if (!listas) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  return (
    <>
      <p className="dica">Itens desativados somem das listas novas, mas continuam nos registros antigos e nos relatórios.</p>
      {msg && <span className="toast" role="status">{msg}</span>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="config-grade">
        {Object.entries(LISTAS_CONFIG).map(([tabela, cfg]) => (
          <ListaConfig key={tabela} tabela={tabela} cfg={cfg} itens={listas[tabela]} onSalvar={(item) => salvar(tabela, item)} />
        ))}
      </div>
    </>
  )
}

export const idDoNome = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)

function ListaConfig({ tabela, cfg, itens, onSalvar }) {
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState(null) // { id, nome }
  const [remover, setRemover] = useState(null)
  const colunas = tabela === 'crm_colunas'
  const proximaOrdem = (itens.filter((x) => x.ordem < 90).reduce((m, x) => Math.max(m, x.ordem), 0) || 0) + 10

  function adicionar(e) {
    e.preventDefault()
    const nome = novo.trim()
    if (nome.length < 2) return
    const item = { nome, ordem: proximaOrdem }
    if (colunas) Object.assign(item, { id: idDoNome(nome), tipo: 'normal' }) // novas colunas são intermediárias
    if (tabela === 'motivos_perda') item.pede_texto = false
    onSalvar(item)
    setNovo('')
  }
  const mover = (item, d) => {
    const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem)
    const i = ordenados.findIndex((x) => x.id === item.id)
    const outro = ordenados[i + d]
    if (!outro) return
    onSalvar({ ...item, ordem: outro.ordem })
    onSalvar({ ...outro, ordem: item.ordem })
  }
  const fixo = (x) => colunas && x.tipo !== 'normal'
  return (
    <fieldset className="grupo lista-config">
      <legend>{cfg.titulo}</legend>
      <p className="dica">{cfg.ajuda}</p>
      <ul>
        {[...itens].sort((a, b) => a.ordem - b.ordem).map((x, i, arr) => (
          <li key={x.id} className={x.ativa ? '' : 'inativo'}>
            {editando?.id === x.id ? (
              <form className="lista-config-editar" onSubmit={(e) => { e.preventDefault(); if (editando.nome.trim().length >= 2) { onSalvar({ ...x, nome: editando.nome.trim() }); setEditando(null) } }}>
                <input value={editando.nome} maxLength={60} aria-label={`Novo nome de ${x.nome}`} autoFocus onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
                <button className="btn btn-contorno">Salvar</button>
                <button type="button" className="btn btn-leve" onClick={() => setEditando(null)}>Cancelar</button>
              </form>
            ) : (
              <span className="lista-config-nome">
                {x.nome}
                {colunas && <small>{TIPOS_COLUNA.find(([k]) => k === x.tipo)?.[1]}</small>}
              </span>
            )}
            {tabela === 'motivos_perda' && (
              <label className="check"><input type="checkbox" checked={!!x.pede_texto} onChange={(e) => onSalvar({ ...x, pede_texto: e.target.checked })} /> Pede texto</label>
            )}
            {colunas && (
              <span className="lista-config-ordem">
                <button type="button" className="btn btn-leve" aria-label={`Subir ${x.nome}`} disabled={i === 0} onClick={() => mover(x, -1)}>↑</button>
                <button type="button" className="btn btn-leve" aria-label={`Descer ${x.nome}`} disabled={i === arr.length - 1} onClick={() => mover(x, 1)}>↓</button>
              </span>
            )}
            {editando?.id !== x.id && <button type="button" className="btn btn-leve" onClick={() => setEditando({ id: x.id, nome: x.nome })}>Editar</button>}
            {x.ativa
              ? !fixo(x) && <button type="button" className="btn btn-leve texto-atraso" onClick={() => setRemover(x)}>Remover</button>
              : <button type="button" className="btn btn-leve" onClick={() => onSalvar({ ...x, ativa: true })}>Reativar</button>}
          </li>
        ))}
      </ul>
      <form className="lista-config-novo" onSubmit={adicionar}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={colunas ? 'Nova coluna (ex.: Em negociação)' : 'Novo item'} aria-label={`Novo item em ${cfg.titulo}`} maxLength={60} />
        <button className="btn btn-contorno" disabled={novo.trim().length < 2}>Adicionar</button>
      </form>
      {remover && (
        <Confirmar titulo={`Remover “${remover.nome}”?`} botao="Remover"
          texto="Sai das listas novas. Leads antigos continuam mostrando este item e os relatórios não mudam (dá para reativar depois)."
          onCancelar={() => setRemover(null)} onConfirmar={async () => { await onSalvar({ ...remover, ativa: false }); setRemover(null) }} />
      )}
    </fieldset>
  )
}

function LojasConfig() {
  const [lojas, setLojas] = useState(null)
  const [erro, setErro] = useState('')
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState(null)
  const [remover, setRemover] = useState(null)
  const [msg, mostrar] = useMensagem()
  const carregar = () => api.todasLojas().then(setLojas).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])
  async function salvar(loja, texto = 'Salvo') {
    setErro('')
    try {
      await api.salvarLoja(loja)
      await carregar()
      mostrar(texto)
      return true
    } catch (e) {
      setErro(e.message)
      return false
    }
  }
  if (!lojas) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  const ordem = lojas.reduce((m, l) => Math.max(m, l.ordem), 0) + 1
  return (
    <fieldset className="grupo lista-config">
      <legend>Lojas</legend>
      <p className="dica">Usadas no agendamento, no filtro do calendário e em Loja x Online. “Online” é o atendimento à distância.</p>
      {msg && <span className="toast" role="status">{msg}</span>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <ul>
        {lojas.map((l) => (
          <li key={l.id} className={l.ativa ? '' : 'inativo'}>
            {editando?.id === l.id ? (
              <form className="lista-config-editar" onSubmit={async (e) => { e.preventDefault(); if (await salvar({ ...l, nome: editando.nome.trim() })) setEditando(null) }}>
                <input value={editando.nome} maxLength={60} aria-label={`Novo nome de ${l.nome}`} autoFocus onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
                <button className="btn btn-contorno" disabled={editando.nome.trim().length < 2}>Salvar</button>
                <button type="button" className="btn btn-leve" onClick={() => setEditando(null)}>Cancelar</button>
              </form>
            ) : <span className="lista-config-nome">{l.nome}</span>}
            {editando?.id !== l.id && <button type="button" className="btn btn-leve" onClick={() => setEditando({ id: l.id, nome: l.nome })}>Editar</button>}
            {l.id !== 'online' && (l.ativa
              ? <button type="button" className="btn btn-leve texto-atraso" onClick={() => setRemover(l)}>Remover</button>
              : <button type="button" className="btn btn-leve" onClick={() => salvar({ ...l, ativa: true }, 'Loja reativada')}>Reativar</button>)}
          </li>
        ))}
      </ul>
      <form className="lista-config-novo" onSubmit={async (e) => {
        e.preventDefault()
        const nome = novo.trim()
        if (nome.length < 2) return
        if (await salvar({ id: idDoNome(nome), nome, ordem, ativa: true }, 'Loja adicionada')) setNovo('')
      }}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nova loja (ex.: Loja Tatuapé)" aria-label="Nova loja" maxLength={60} />
        <button className="btn btn-contorno" disabled={novo.trim().length < 2}>Adicionar</button>
      </form>
      {remover && (
        <Confirmar titulo={`Remover ${remover.nome}?`} botao="Remover" texto="A loja sai das opções de agendamento. Agendamentos e contratos antigos continuam com ela."
          onCancelar={() => setRemover(null)} onConfirmar={async () => { await api.salvarLoja({ ...remover, ativa: false }); setRemover(null); await carregar(); mostrar('Loja removida') }} />
      )}
    </fieldset>
  )
}

const CAMPOS_INTEGRACAO = [
  ['whatsapp_token', 'Token de acesso (Meta)', true, 'Token permanente do usuário do sistema no Meta Business.'],
  ['whatsapp_phone_number_id', 'ID do número de telefone (Meta)', false, 'Em WhatsApp > Configuração da API.'],
  ['whatsapp_template_lead', 'Modelo de mensagem: novo lead', false, '5 variáveis: vendedor, cliente, contato, agendamento, link.'],
  ['whatsapp_template_lembrete', 'Modelo de mensagem: lembrete', false, '5 variáveis: vendedor, cliente, o que fazer, quando, link.'],
  ['resend_api_key', 'Chave da API da Resend (e-mail)', true, 'resend.com > API Keys.'],
  ['email_remetente', 'Remetente do e-mail', false, 'Ex.: Airam <portal@airam.arq.br> (domínio verificado na Resend).'],
]
const ORIGEM = { portal: 'cadastrado aqui', segredo: 'nos segredos do servidor', padrao: 'valor padrão' }

// Credenciais: vão direto para o servidor. A tela nunca recebe os segredos de volta (só os 4 últimos caracteres).
function Integracoes({ perfil }) {
  const [estado, setEstado] = useState(null)
  const [valores, setValores] = useState({})
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [msg, mostrar] = useMensagem()
  const [teste, setTeste] = useState({ whatsapp: perfil.whatsapp || '', email: perfil.email || '' })
  const [resultado, setResultado] = useState({})
  const carregar = () => api.integracoes().then(setEstado).catch((e) => setErro(e.message))
  useEffect(() => {
    if (!MODO_DEMO) carregar()
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setOcupado('salvar')
    try {
      await api.salvarIntegracoes(valores)
      setValores({})
      await carregar()
      mostrar('Credenciais salvas no servidor')
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado('')
    }
  }
  async function testar(canal) {
    setOcupado(canal)
    setResultado((r) => ({ ...r, [canal]: null }))
    try {
      await api.testarIntegracao(canal, teste[canal])
      setResultado((r) => ({ ...r, [canal]: { ok: true, texto: canal === 'whatsapp' ? 'Enviado. Confira o WhatsApp.' : 'Enviado. Confira a caixa de entrada.' } }))
      carregar()
    } catch (err) {
      setResultado((r) => ({ ...r, [canal]: { ok: false, texto: err.message } }))
    } finally {
      setOcupado('')
    }
  }

  if (MODO_DEMO) return <div className="aviso-config">Na demonstração não há servidor: as credenciais do WhatsApp e do e-mail só podem ser cadastradas e testadas no portal real.</div>
  if (!estado) return erro ? <p className="erro" role="alert">{erro}</p> : <div className="carregando">Carregando…</div>
  return (
    <div className="integracoes">
      <form className="grupo" onSubmit={salvar}>
        <p className="dica">As chaves ficam guardadas só no servidor. Deixe em branco para manter o valor atual.</p>
        <div className="grade grade-2">
          {CAMPOS_INTEGRACAO.map(([k, rotulo, secreto, ajuda]) => {
            const atual = estado.campos[k]
            return (
              <div key={k} className="campo">
                <label htmlFor={`int-${k}`}>{rotulo}</label>
                <input id={`int-${k}`} type={secreto ? 'password' : 'text'} autoComplete="off" value={valores[k] ?? ''}
                  placeholder={atual?.valor ? `Atual: ${atual.valor}` : 'Não configurado'} onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))} />
                <span className="ajuda">{ajuda} {atual?.origem ? `· ${ORIGEM[atual.origem]}` : '· não configurado'}</span>
              </div>
            )
          })}
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          {msg && <span className="toast" role="status">{msg}</span>}
          <button className="btn btn-principal" disabled={ocupado === 'salvar' || !Object.values(valores).some((v) => String(v).trim())}>{ocupado === 'salvar' ? 'Salvando…' : 'Salvar credenciais'}</button>
        </div>
      </form>

      <div className="grade grade-2">
        {[['whatsapp', 'Testar WhatsApp', 'tel', 'WhatsApp com DDD', 'Envia o modelo “hello_world” da Meta.'], ['email', 'Testar e-mail', 'email', 'E-mail', 'Envia um e-mail de teste pela Resend.']].map(([canal, titulo, tipo, rot, ajuda]) => (
          <fieldset key={canal} className="grupo">
            <legend>{titulo}</legend>
            <label htmlFor={`teste-${canal}`} className="rotulo-campo">{rot}</label>
            <input id={`teste-${canal}`} type={tipo} value={teste[canal]} onChange={(e) => setTeste((t) => ({ ...t, [canal]: e.target.value }))} />
            <span className="ajuda">{ajuda}</span>
            <button type="button" className="btn btn-contorno" onClick={() => testar(canal)} disabled={!!ocupado || !teste[canal].trim()}>{ocupado === canal ? 'Enviando…' : 'Enviar teste'}</button>
            {resultado[canal] && <p className={resultado[canal].ok ? 'ok-texto' : 'erro'} role="status">{resultado[canal].texto}</p>}
          </fieldset>
        ))}
      </div>

      {estado.ultimos?.length > 0 && (
        <fieldset className="grupo">
          <legend>Últimos avisos da equipe</legend>
          <ul className="lista-avisos">
            {estado.ultimos.map((a, i) => (
              <li key={i}><span>{a.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · {new Date(a.criado_em).toLocaleString('pt-BR')}
                <small className={`sit-aviso sit-${a.situacao}`}>{{ enviado: 'Enviado', falhou: 'Falhou', pendente: 'Na fila' }[a.situacao]}</small></span>
                {a.erro && <small className="celula-sub">{a.erro}</small>}</li>
            ))}
          </ul>
        </fieldset>
      )}
    </div>
  )
}
