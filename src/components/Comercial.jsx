import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { LISTAS_CONFIG, TIPOS_COLUNA } from '../lib/comercial.js'

// Aba COMERCIAL. Cada sub-aba entra numa etapa; as regras de acesso já valem no banco.
const EM_BREVE = {
  captacao: ['Captação / Agendamentos', 'Cadastro de leads com planta, imagens, conversa e agendamento.', 2],
  crm: ['CRM', 'Quadro com Novo cliente, Não responde, Vendidos e Perdidos, e o cartão completo do cliente.', 3],
  calendario: ['Calendário', 'Agendamentos por mês, semana e dia, com cores por vendedor ou loja.', 4],
  metricas: ['Métricas de Vendas', 'Leads, agendamentos, comparecimentos, vendas, ticket médio, conversão e gráficos.', 8],
}

export default function Comercial({ aba, perfil }) {
  if (aba === 'config') return <ConfigComercial />
  const [titulo, texto, etapa] = EM_BREVE[aba] || EM_BREVE.crm
  return (
    <section className="gestao">
      <div className="titulo-processo">
        <span className="rotulo">Comercial</span>
        <h1 className="titulo-grande">{titulo}</h1>
      </div>
      <div className="aviso-config">{texto} Esta tela chega na etapa {etapa}. As permissões de {perfil.nome || perfil.email} já estão valendo no banco.</div>
    </section>
  )
}

// Configurações do Comercial (master, ou quem tiver a permissão): listas usadas no cadastro, no CRM e nos relatórios
function ConfigComercial() {
  const [listas, setListas] = useState(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const carregar = () => api.comercialListas().then(setListas).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])

  async function salvar(tabela, item) {
    setErro('')
    try {
      await api.salvarItemLista(tabela, item)
      await carregar()
      setMsg('Salvo')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) {
      setErro(e.message)
    }
  }

  if (!listas) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  return (
    <section className="gestao config-comercial">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Comercial</span>
          <h1 className="titulo-grande">Configurações</h1>
          <p className="dica">Itens desativados somem das listas novas, mas continuam nos registros antigos e nos relatórios.</p>
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="config-grade">
        {Object.entries(LISTAS_CONFIG).map(([tabela, cfg]) => (
          <ListaConfig key={tabela} tabela={tabela} cfg={cfg} itens={listas[tabela]} onSalvar={(item) => salvar(tabela, item)} />
        ))}
      </div>
    </section>
  )
}

const idDoNome = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

function ListaConfig({ tabela, cfg, itens, onSalvar }) {
  const [novo, setNovo] = useState('')
  const tipo = 'normal' // novas colunas são sempre intermediárias (entrada, venda e perda já existem)
  const colunas = tabela === 'crm_colunas'
  const proximaOrdem = (itens.filter((x) => x.ordem < 90).reduce((m, x) => Math.max(m, x.ordem), 0) || 0) + 10

  function adicionar(e) {
    e.preventDefault()
    const nome = novo.trim()
    if (nome.length < 2) return
    const item = { nome, ordem: colunas ? (tipo === 'normal' ? proximaOrdem : 95) : proximaOrdem }
    if (colunas) Object.assign(item, { id: idDoNome(nome), tipo })
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
  return (
    <fieldset className="grupo lista-config">
      <legend>{cfg.titulo}</legend>
      <p className="dica">{cfg.ajuda}</p>
      <ul>
        {[...itens].sort((a, b) => a.ordem - b.ordem).map((x, i, arr) => (
          <li key={x.id} className={x.ativa ? '' : 'inativo'}>
            <span className="lista-config-nome">
              {x.nome}
              {colunas && <small>{TIPOS_COLUNA.find(([k]) => k === x.tipo)?.[1]}</small>}
            </span>
            {tabela === 'motivos_perda' && (
              <label className="check"><input type="checkbox" checked={!!x.pede_texto} onChange={(e) => onSalvar({ ...x, pede_texto: e.target.checked })} /> Pede texto</label>
            )}
            {colunas && (
              <span className="lista-config-ordem">
                <button type="button" className="btn btn-leve" aria-label={`Subir ${x.nome}`} disabled={i === 0} onClick={() => mover(x, -1)}>↑</button>
                <button type="button" className="btn btn-leve" aria-label={`Descer ${x.nome}`} disabled={i === arr.length - 1} onClick={() => mover(x, 1)}>↓</button>
              </span>
            )}
            <label className="check"><input type="checkbox" checked={x.ativa} disabled={colunas && x.tipo !== 'normal' && x.ativa}
              onChange={(e) => onSalvar({ ...x, ativa: e.target.checked })} /> Ativa</label>
          </li>
        ))}
      </ul>
      <form className="lista-config-novo" onSubmit={adicionar}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={colunas ? 'Nova coluna (ex.: Em negociação)' : 'Novo item'} aria-label={`Novo item em ${cfg.titulo}`} maxLength={60} />
        <button className="btn btn-contorno" disabled={novo.trim().length < 2}>Adicionar</button>
      </form>
    </fieldset>
  )
}
