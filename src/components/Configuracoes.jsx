import { useEffect, useRef, useState } from 'react'
import { api, MODO_DEMO } from '../lib/api.js'
import { LISTAS_CONFIG, TIPOS_COLUNA } from '../lib/comercial.js'
import { Confirmar } from './comercial/comum.jsx'
import Usuarios from './Usuarios.jsx'
import FeriadosConfig from './ferramentas/FeriadosConfig.jsx'
import TiposFormalizacaoConfig from './ferramentas/TiposFormalizacaoConfig.jsx'
import ReguaConfig from './gestaomensal/ReguaConfig.jsx'
import DiretrizesMarca from './marketing/DiretrizesMarca.jsx'

// Configurações (somente o master): usuários, listas do Comercial, lojas e credenciais das integrações
export const PASTAS_CONFIG = [['usuarios', 'Usuários'], ['listas', 'Listas'], ['lojas', 'Lojas'], ['feriados', 'Feriados e recessos'], ['formalizacao', 'Formalização'], ['comissao', 'Régua de comissão'], ['marca', 'Marca (conteúdo)'], ['integracoes', 'Integrações']]

export default function Configuracoes({ aba, perfil }) {
  const titulo = PASTAS_CONFIG.find(([k]) => k === aba)?.[1] || 'Configurações'
  if (aba === 'usuarios') return <Usuarios perfil={perfil} />
  return (
    <section className="gestao config-comercial">
      <div className="titulo-processo">
        <span className="rotulo">Configurações</span>
        <h1 className="titulo-grande">{titulo}</h1>
      </div>
      {aba === 'listas' && <ListasConfig />}
      {aba === 'lojas' && <LojasConfig />}
      {aba === 'feriados' && <FeriadosConfig />}
      {aba === 'formalizacao' && <TiposFormalizacaoConfig />}
      {aba === 'comissao' && <ReguaConfig />}
      {aba === 'marca' && <DiretrizesMarca />}
      {aba === 'integracoes' && <Integracoes perfil={perfil} />}
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
  ['anthropic_api_key', 'Chave da API de IA (Anthropic)', true, 'console.anthropic.com > API Keys. Usada no Criador de conteúdo e na leitura de RG/CNH.'],
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
      if (canal === 'ia') {
        const r = await api.testarIA()
        setResultado((x) => ({ ...x, ia: { ok: !!r.ok, texto: r.ok ? 'A IA respondeu. Criador de conteúdo pronto.' : 'A IA não respondeu ao teste.' } }))
        return
      }
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
        <p className="dica">WhatsApp (Meta), e-mail de avisos (Resend) e IA (Anthropic). As chaves ficam guardadas só no servidor. Deixe em branco para manter o valor atual.</p>
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
        <fieldset className="grupo">
          <legend>Testar IA</legend>
          <span className="ajuda">Faz uma pergunta curta à Anthropic com a chave cadastrada.</span>
          <button type="button" className="btn btn-contorno" onClick={() => testar('ia')} disabled={!!ocupado}>{ocupado === 'ia' ? 'Testando…' : 'Enviar teste'}</button>
          {resultado.ia && <p className={resultado.ia.ok ? 'ok-texto' : 'erro'} role="status">{resultado.ia.texto}</p>}
        </fieldset>
        {[['whatsapp', 'Testar WhatsApp', 'tel', 'WhatsApp com DDD', 'Envia o modelo “hello_world” da Meta.'], ['email', 'Testar e-mail', 'email', 'E-mail', 'Envia um e-mail de teste pela Resend.']].map(([canal, titulo, tipo, rot, ajuda]) => (
          <fieldset key={canal} className="grupo">
            <legend>{titulo}</legend>
            <label htmlFor={`teste-${canal}`} className="rotulo-campo">{rot}</label>
            <input id={`teste-${canal}`} type={tipo} value={teste[canal]} onChange={(e) => setTeste((t) => ({ ...t, [canal]: e.target.value }))} />
            <span className="ajuda">{ajuda}</span>
            <button type="button" className="btn btn-contorno" onClick={() => testar(canal)} disabled={!!ocupado || !String(teste[canal] || '').trim()}>{ocupado === canal ? 'Enviando…' : 'Enviar teste'}</button>
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
