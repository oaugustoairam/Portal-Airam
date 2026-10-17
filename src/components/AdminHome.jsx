import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import {
  CATEGORIAS_CLIENTE,
  CATEGORIAS_INTERNAS,
  ehInterna,
  TIPOS_PRAZO,
  calcularTipoPrazo,
  diasEntre,
  diasAte,
  linhaDoTempo,
  etapaAtual,
  formatarData,
  prazoTexto,
  formatarCpf,
  cpfValido,
  prazosContratuais,
} from '../lib/constants.js'
import ProcessoView, { LinhaDoc } from './ProcessoView.jsx'
import CampoData from './CampoData.jsx'
import ControleInterno from './ControleInterno.jsx'
import Relatorios from './Relatorios.jsx'
import PastaProcessos, { ResumoPastas } from './PastaProcessos.jsx'
import { PASTAS } from '../lib/pastas.js'
import Avatar from './Avatar.jsx'
import { ROTULO_STATUS_AVISO, telefoneWhatsApp } from '../lib/avisos.js'

// ============================================================ Lista de processos
const ETAPAS_FILTRO = [
  ['financeiro', 'Solução financeira'],
  ['projeto_inicial', 'Projeto inicial'],
  ['medicao', 'Medição'],
  ['conferencia', 'Projeto final · Conferência'],
  ['assinatura_projeto', 'Projeto final · Assinatura'],
  ['producao', 'Fabricação'],
  ['entrega', 'Montagem'],
]
const FILTROS_VAZIOS = { busca: '', situacao: 'ativos', prazo: '', etapa: '', financeiro: '', de: '', ate: '', ordem: 'entrega' }
const CHAVE_FILTROS = 'airam-filtros-processos'

function lerFiltros() {
  try {
    return { ...FILTROS_VAZIOS, ...JSON.parse(sessionStorage.getItem(CHAVE_FILTROS) || '{}') }
  } catch {
    return FILTROS_VAZIOS
  }
}

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function AdminHome({ abrirInicial = null, pasta = 'geral', onPasta }) {
  const [processos, setProcessos] = useState(null)
  const [controles, setControles] = useState({})
  const [editando, setEditando] = useState(abrirInicial) // id ou 'novo'
  const [abaEditor, setAbaEditor] = useState('dados')
  const [filtros, setFiltros] = useState(lerFiltros)
  const [abertoMobile, setAbertoMobile] = useState(false)
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [relatorio, setRelatorio] = useState(false)

  const recarregar = () =>
    api.listarProcessos().then((lista) => {
      setProcessos(lista)
      if (lista.length) api.controlesInternos(lista.map((p) => p.id)).then(setControles).catch(() => {})
    })
  useEffect(() => {
    recarregar()
  }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_FILTROS, JSON.stringify(filtros))
    } catch {}
  }, [filtros])

  const linhas = useMemo(
    () =>
      (processos || []).map((p) => {
        const etapas = linhaDoTempo(p, p.assinaturas)
        const atual = etapaAtual(etapas)
        const dEntrega = diasAte(p.data_entrega_prevista)
        return {
          ...p,
          atual,
          etapasAtuais: etapas.filter((e) => e.status === 'atual').map((e) => e.id),
          concluido: p.entrega_concluida,
          aguardandoAssinatura: p.assinaturas?.some((a) => a.status === 'pendente'),
          atrasado: !p.entrega_concluida && (etapas.some((e) => e.atrasada) || (dEntrega !== null && dEntrega < 0)),
          dEntrega,
        }
      }),
    [processos]
  )

  if (relatorio)
    return <Relatorios processos={linhas.filter((p) => selecionados.has(p.id))} onFechar={() => setRelatorio(false)} />

  if (editando)
    return (
      <EditorProcesso
        id={editando === 'novo' ? null : editando}
        abaInicial={abaEditor}
        codigos={(processos || []).map((p) => p.codigo)}
        onFechar={() => {
          setEditando(null)
          setAbaEditor('dados')
          recarregar()
        }}
        onCriado={(id) => setEditando(id)}
      />
    )

  const alternar = (id) => setSelecionados((atual) => {
    const novo = new Set(atual)
    novo.has(id) ? novo.delete(id) : novo.add(id)
    return novo
  })
  const nSel = linhas.filter((p) => selecionados.has(p.id)).length
  const barraSelecao = nSel > 0 && (
    <div className="barra-selecao" role="region" aria-label="Processos selecionados">
      <span><strong className="num">{nSel}</strong> {nSel === 1 ? 'processo selecionado' : 'processos selecionados'}</span>
      <div className="acoes">
        <button className="btn btn-leve" onClick={() => setSelecionados(new Set())}>Limpar</button>
        <button className="btn btn-principal" onClick={() => setRelatorio(true)}>
          Criar relatório{nSel === 1 ? ' em PDF' : ''}
        </button>
      </div>
    </div>
  )

  const pastaAtual = PASTAS.find((x) => x.id === pasta)
  if (pastaAtual)
    return (
      <>
        {!processos ? <div className="carregando">Carregando…</div> : (
          <PastaProcessos pasta={pastaAtual} processos={linhas} controles={controles} selecionados={selecionados} onAlternar={alternar}
            onAbrir={(id) => { setAbaEditor('cronograma'); setEditando(id) }} />
        )}
        {barraSelecao}
      </>
    )

  const set = (k) => (v) => setFiltros((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))
  const ativos = linhas.filter((p) => !p.concluido)
  const indicadores = [
    ['ativos', 'Processos ativos', ativos.length],
    ['assinatura', 'Aguardando assinatura', ativos.filter((p) => p.aguardandoAssinatura).length],
    ['financeiro', 'Financeiro pendente', ativos.filter((p) => p.solucao_financeira === 'pendente').length],
    ['atrasados', 'Com atraso', ativos.filter((p) => p.atrasado).length],
    ['entrega30', 'Prazo máximo em 30 dias', ativos.filter((p) => p.dEntrega !== null && p.dEntrega >= 0 && p.dEntrega <= 30).length],
  ]

  const termo = semAcento(filtros.busca.trim())
  const termoNum = filtros.busca.replace(/\D/g, '')
  const f = filtros
  const visiveis = linhas
    .filter((p) => {
      if (f.situacao === 'ativos' && p.concluido) return false
      if (f.situacao === 'entregues' && !p.concluido) return false
      if (f.situacao === 'assinatura' && (p.concluido || !p.aguardandoAssinatura)) return false
      if (f.situacao === 'financeiro' && (p.concluido || p.solucao_financeira !== 'pendente')) return false
      if (f.situacao === 'atrasados' && !p.atrasado) return false
      if (f.situacao === 'entrega30' && (p.concluido || p.dEntrega === null || p.dEntrega < 0 || p.dEntrega > 30)) return false
      if (f.prazo && p.tipo_prazo !== f.prazo) return false
      if (f.etapa && (p.concluido || !p.etapasAtuais.includes(f.etapa))) return false
      if (f.financeiro && p.solucao_financeira !== f.financeiro) return false
      if (f.de && (!p.data_entrega_prevista || p.data_entrega_prevista < f.de)) return false
      if (f.ate && (!p.data_entrega_prevista || p.data_entrega_prevista > f.ate)) return false
      if (termo) {
        const texto = semAcento([p.codigo, p.cliente_nome, p.ambientes, p.endereco, p.cliente_email].join(' '))
        const numeros = (p.cliente_cpf || '') + ' ' + String(p.cliente_telefone || '').replace(/\D/g, '')
        if (!texto.includes(termo) && !(termoNum.length >= 3 && numeros.includes(termoNum))) return false
      }
      return true
    })
    .sort((a, b) => {
      if (f.ordem === 'recentes') return (b.criado_em || '').localeCompare(a.criado_em || '')
      if (f.ordem === 'codigo') return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })
      if (f.ordem === 'cliente') return a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
      return (a.data_entrega_prevista || '9999').localeCompare(b.data_entrega_prevista || '9999')
    })

  const todosVisiveis = visiveis.length > 0 && visiveis.every((p) => selecionados.has(p.id))
  const alternarTodos = () => setSelecionados((atual) => {
    const novo = new Set(atual)
    visiveis.forEach((p) => (todosVisiveis ? novo.delete(p.id) : novo.add(p.id)))
    return novo
  })
  const ativosFiltro = ['prazo', 'etapa', 'financeiro', 'de', 'ate'].filter((k) => f[k]).length + (f.busca ? 1 : 0)

  return (
    <section>
      <div className="cab-linha">
        <h1 className="titulo-grande">Processos</h1>
        <button className="btn btn-principal" onClick={() => setEditando('novo')}>Novo processo</button>
      </div>

      {processos && onPasta && (
        <section className="secao-resumo" aria-label="Resumo por pasta">
          <h2 className="titulo-secao">Resumo por fase</h2>
          <ResumoPastas pastas={PASTAS} processos={linhas} controles={controles} onPasta={onPasta} />
        </section>
      )}

      {processos && (
        <div className="indicadores">
          {indicadores.map(([k, t, v]) => (
            <button key={k} type="button" className={`indicador ${f.situacao === k ? 'indicador-ativo' : ''}`}
              aria-pressed={f.situacao === k} onClick={() => set('situacao')(f.situacao === k ? 'ativos' : k)}>
              <span className="indicador-valor num">{v}</span>
              <span className="rotulo">{t}</span>
            </button>
          ))}
        </div>
      )}

      <div className="painel-filtros">
        <div className="filtros-linha">
          <input id="busca" type="search" autoCapitalize="none" autoCorrect="off" placeholder="Buscar por nome, código, CPF ou telefone"
            value={f.busca} onChange={set('busca')} aria-label="Buscar processo" />
          <button type="button" className="btn btn-contorno so-mobile" aria-expanded={abertoMobile}
            onClick={() => setAbertoMobile(!abertoMobile)}>
            Filtros{ativosFiltro ? ` (${ativosFiltro})` : ''}
          </button>
        </div>
        <div className={`filtros-grade ${abertoMobile ? 'aberto' : ''}`}>
          <Filtro id="f-situacao" rotulo="Situação" valor={f.situacao} onChange={set('situacao')} opcoes={[
            ['ativos', 'Em andamento'], ['todos', 'Todos'], ['atrasados', 'Com atraso'], ['assinatura', 'Aguardando assinatura'],
            ['financeiro', 'Financeiro pendente'], ['entrega30', 'Prazo máximo em 30 dias'], ['entregues', 'Montagem concluída'],
          ]} />
          <Filtro id="f-prazo" rotulo="Prazo" valor={f.prazo} onChange={set('prazo')}
            opcoes={[['', 'Normal e futuro'], ['normal', 'Prazo normal'], ['futuro', 'Entrega futura']]} />
          <Filtro id="f-etapa" rotulo="Etapa atual" valor={f.etapa} onChange={set('etapa')}
            opcoes={[['', 'Todas as etapas'], ...ETAPAS_FILTRO]} />
          <Filtro id="f-fin" rotulo="Solução financeira" valor={f.financeiro} onChange={set('financeiro')}
            opcoes={[['', 'OK e pendente'], ['ok', 'OK'], ['pendente', 'Pendente']]} />
          <CampoData id="f-de" rotulo="Prazo máximo a partir de" valor={f.de} onChange={set('de')} />
          <CampoData id="f-ate" rotulo="Prazo máximo até" valor={f.ate} onChange={set('ate')} />
          <Filtro id="f-ordem" rotulo="Ordenar por" valor={f.ordem} onChange={set('ordem')}
            opcoes={[['entrega', 'Prazo máximo mais próximo'], ['recentes', 'Vendas mais recentes'], ['codigo', 'Código'], ['cliente', 'Nome do cliente']]} />
        </div>
        <div className="filtros-rodape">
          <span className="num">{processos ? `Mostrando ${visiveis.length} de ${linhas.length} processos` : ''}</span>
          {JSON.stringify(f) !== JSON.stringify(FILTROS_VAZIOS) && (
            <button type="button" className="btn btn-leve" onClick={() => setFiltros(FILTROS_VAZIOS)}>Limpar filtros</button>
          )}
        </div>
      </div>

      {!processos && <div className="carregando">Carregando…</div>}
      {processos && !visiveis.length && <p className="vazio">Nenhum processo com esses filtros.</p>}
      {visiveis.length > 0 && (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th className="col-sel">
                  <input type="checkbox" aria-label="Selecionar todos os processos da lista" checked={todosVisiveis} onChange={alternarTodos} />
                </th>
                <th>Código</th>
                <th>Cliente</th>
                <th>Prazo</th>
                <th>Etapa atual</th>
                <th>Financeiro</th>
                <th>Prazo máximo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.id} onClick={() => setEditando(p.id)} tabIndex={0} className={selecionados.has(p.id) ? 'linha-selecionada' : ''}
                  onKeyDown={(e) => e.key === 'Enter' && setEditando(p.id)}>
                  <td className="col-sel" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Selecionar ${p.codigo} ${p.cliente_nome}`} checked={selecionados.has(p.id)} onChange={() => alternar(p.id)} />
                  </td>
                  <td className="num"><strong>{p.codigo}</strong></td>
                  <td>{p.cliente_nome}<span className="celula-sub">{p.ambientes}</span></td>
                  <td><span className={`chip chip-prazo-${p.tipo_prazo}`}>{TIPOS_PRAZO[p.tipo_prazo]?.nome}</span></td>
                  <td>
                    {p.concluido ? 'Montagem concluída' : p.atual.nome}
                    {p.aguardandoAssinatura && !p.concluido && <span className="celula-sub">Aguardando assinatura</span>}
                    {p.atrasado && <span className="celula-sub texto-atraso">Com atraso</span>}
                  </td>
                  <td>
                    <span className={`chip ${p.solucao_financeira === 'ok' ? 'chip-concluida' : 'chip-atraso'}`}>
                      {p.solucao_financeira === 'ok' ? 'OK' : 'Pendente'}
                    </span>
                  </td>
                  <td className="num">
                    {formatarData(p.data_entrega_prevista)}
                    <span className={`celula-sub ${!p.concluido && p.dEntrega < 0 ? 'texto-atraso' : ''}`}>
                      {p.concluido ? 'Concluído' : prazoTexto(p.data_entrega_prevista)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {barraSelecao}
    </section>
  )
}

function Filtro({ id, rotulo, valor, onChange, opcoes }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={valor} onChange={onChange} className={valor && id !== 'f-ordem' && valor !== 'ativos' ? 'filtro-ativo' : ''}>
        {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  )
}

// ============================================================ Editor
// próximo código numérico do cliente (o mesmo usado no contrato, ex.: 2561)
function proximoCodigo(codigos) {
  const n = codigos.map((c) => Number(String(c).replace(/\D/g, ''))).filter((x) => Number.isFinite(x) && x > 0)
  return String((n.length ? Math.max(...n) : 0) + 1)
}

const VAZIO = {
  notificar: true,
  codigo: '', cliente_nome: '', cliente_cpf: '', cliente_email: '', cliente_telefone: '', endereco: '', ambientes: '',
  data_venda: '', data_disponivel_medicao: '', data_entrega_prevista: '', solucao_financeira: 'pendente',
  data_medicao: '', medicao_concluida: false, data_conferencia: '', conferencia_concluida: false,
  data_assinatura_projeto: '', projeto_assinado_manual: false, entrega_concluida: false, recado_cliente: '',
}

function EditorProcesso({ id, abaInicial = 'dados', codigos, onFechar, onCriado }) {
  const [processo, setProcesso] = useState(id ? null : { ...VAZIO, codigo: proximoCodigo(codigos), documentos: [], assinaturas: [] })
  const [aba, setAba] = useState(id ? abaInicial : 'dados')
  const [msg, setMsg] = useState('')

  const recarregar = () => api.processo(id).then(setProcesso)
  useEffect(() => {
    if (id) recarregar()
  }, [id])

  if (!processo) return <div className="carregando">Carregando…</div>

  const avisar = (t) => {
    setMsg(t)
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <section>
      <button className="btn btn-leve voltar" onClick={onFechar}>← Voltar</button>
      <div className="cab-linha">
        <div className="titulo-processo">
          {id && <span className="rotulo">{processo.codigo}</span>}
          <h1 className="titulo-grande">{id ? processo.cliente_nome : 'Novo processo'}</h1>
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>

      {id && (
        <div className="abas">
          {[['dados', 'Dados e prazos'], ['anexos', 'Anexos'], ['internos', 'Arquivos internos'], ['assinaturas', 'Assinaturas'], ['cronograma', 'Controle interno'], ['avisos', 'Avisos'], ['acesso', 'Acesso do cliente'], ['cliente', 'Ver como cliente']].map(([k, t]) => (
            <button key={k} className={`aba ${aba === k ? 'aba-ativa' : ''}`} onClick={() => setAba(k)}>{t}</button>
          ))}
        </div>
      )}

      {aba === 'dados' && id && <InfoDoCliente processo={processo} />}
      {aba === 'dados' && (
        <FormDados
          key={processo.id || 'novo'}
          processo={processo}
          onSalvo={async (salvo) => {
            if (!id) onCriado(salvo.id)
            else await recarregar()
            avisar(salvo.avisos ? 'Processo salvo · cliente avisado por WhatsApp e e-mail' : 'Processo salvo')
          }}
          onExcluido={onFechar}
        />
      )}
      {aba === 'anexos' && <Anexos processo={processo} categorias={CATEGORIAS_CLIENTE} onMudou={async (t) => { await recarregar(); avisar(t) }} />}
      {aba === 'internos' && <Anexos processo={processo} categorias={CATEGORIAS_INTERNAS} interno onMudou={async (t) => { await recarregar(); avisar(t) }} />}
      {aba === 'assinaturas' && <Assinaturas processo={processo} onMudou={async (t) => { await recarregar(); avisar(t) }} />}
      {aba === 'cronograma' && (
        <>
          <ControleInterno processo={processo} />
          <section className="secao-historico">
            <h3 className="titulo-secao">Registro automático do sistema</h3>
            <CronogramaInterno processo={processo} />
          </section>
        </>
      )}
      {aba === 'avisos' && <Avisos processo={processo} />}
      {aba === 'acesso' && <Acesso processo={processo} />}
      {aba === 'cliente' && (
        <div className="preview-cliente">
          <ProcessoView processo={{ ...processo, documentos: processo.documentos.filter((d) => !ehInterna(d.categoria)) }} visualizacao />
        </div>
      )}
    </section>
  )
}

function Campo({ id, rotulo, obrigatorio, ajuda, children }) {
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}
      </label>
      {children}
      {ajuda && <span className="ajuda">{ajuda}</span>}
    </div>
  )
}

function FormDados({ processo, onSalvo, onExcluido }) {
  const [f, setF] = useState(() => {
    const { documentos, assinaturas, ...resto } = processo
    return { ...resto, cliente_cpf: formatarCpf(resto.cliente_cpf) }
  })
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))

  const tipo = calcularTipoPrazo(f.data_venda, f.data_disponivel_medicao)
  const dias = diasEntre(f.data_venda, f.data_disponivel_medicao)
  const assinaturaZapSign = processo.assinaturas?.find((a) => a.tipo === 'projeto_final' && a.status === 'assinado')
  const projetoAssinadoZapSign = !!assinaturaZapSign
  const sugestao = prazosContratuais({ ...f, tipo_prazo: tipo }, assinaturaZapSign?.assinado_em)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (f.cliente_cpf && !cpfValido(f.cliente_cpf)) return setErro('O CPF informado não é válido.')
    if (dias !== null && dias < 0) return setErro('A disponibilidade para medição não pode ser antes da data da venda.')
    if (!f.data_entrega_prevista) return setErro('Informe o prazo do cliente (entrega prevista).')
    setSalvando(true)
    try {
      await onSalvo(await api.salvarProcesso(f))
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="form" onSubmit={salvar}>
      <fieldset className="grupo">
        <legend>Cliente</legend>
        <div className="grade">
          <Campo id="p-codigo" rotulo="Código do cliente" obrigatorio>
            <input id="p-codigo" required value={f.codigo} onChange={set('codigo')} />
          </Campo>
          <Campo id="p-contrato" rotulo="Nº do contrato">
            <input id="p-contrato" value={f.numero_contrato || ''} onChange={set('numero_contrato')} placeholder="100000503-1" />
          </Campo>
          <Campo id="p-nome" rotulo="Nome do cliente" obrigatorio>
            <input id="p-nome" required value={f.cliente_nome} onChange={set('cliente_nome')} />
          </Campo>
          <Campo id="p-cpf" rotulo="CPF" ajuda="Usado para o cliente entrar no portal">
            <input id="p-cpf" inputMode="numeric" value={f.cliente_cpf || ''} placeholder="000.000.000-00"
              onChange={(e) => set('cliente_cpf')(formatarCpf(e.target.value))} />
          </Campo>
          <Campo id="p-email" rotulo="E-mail" obrigatorio ajuda="Login do cliente e assinatura">
            <input id="p-email" type="email" required autoCapitalize="none" autoCorrect="off" spellCheck={false} value={f.cliente_email} onChange={set('cliente_email')} />
          </Campo>
          <Campo id="p-tel" rotulo="Telefone / WhatsApp" ajuda="Também serve para o cliente entrar no portal">
            <input id="p-tel" inputMode="tel" value={f.cliente_telefone || ''} onChange={set('cliente_telefone')} />
          </Campo>
          <CampoData id="p-nasc" rotulo="Data de nascimento" valor={f.cliente_nascimento} onChange={set('cliente_nascimento')}
            ajuda="Para o calendário de aniversários" />
          <Campo id="p-amb" rotulo="Ambientes">
            <input id="p-amb" value={f.ambientes || ''} onChange={set('ambientes')} placeholder="Cozinha, suíte, home office" />
          </Campo>
        </div>
        <Campo id="p-end" rotulo="Endereço da obra">
          <input id="p-end" value={f.endereco || ''} onChange={set('endereco')} />
        </Campo>
      </fieldset>

      <fieldset className="grupo">
        <legend>Venda e prazo</legend>
        <div className="grade">
          <CampoData id="p-venda" rotulo="Data da venda" obrigatorio valor={f.data_venda} onChange={set('data_venda')} />
          <CampoData id="p-disp" rotulo="Previsão do imóvel pronto para os móveis" obrigatorio valor={f.data_disponivel_medicao}
            onChange={set('data_disponivel_medicao')} ajuda="Na entrega futura, o cliente vê a contagem regressiva até esta data" />
          <CampoData id="p-entrega" rotulo="Prazo máximo para entrega" obrigatorio
            valor={f.data_entrega_prevista} onChange={set('data_entrega_prevista')} />
        </div>
        <div className={`tipo-prazo ${tipo ? 'tipo-prazo-' + tipo : ''}`} aria-live="polite">
          {tipo ? (
            <>
              <strong>{TIPOS_PRAZO[tipo].nome}</strong>
              <span>{dias} dias entre a venda e o imóvel pronto. {TIPOS_PRAZO[tipo].desc}. Uso interno: o cliente não vê esta classificação.</span>
            </>
          ) : (
            <span>Informe a data da venda e a previsão do imóvel pronto: o sistema classifica em Prazo normal (até 90 dias) ou Entrega futura (acima de 90).</span>
          )}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>Depois da venda</legend>
        <div className="campo">
          <span className="rotulo-campo" id="fin-rot">Solução financeira</span>
          <div className="segmentado" role="radiogroup" aria-labelledby="fin-rot">
            {[['ok', 'OK'], ['pendente', 'Pendente']].map(([k, t]) => (
              <button key={k} type="button" role="radio" aria-checked={f.solucao_financeira === k}
                className={f.solucao_financeira === k ? `ativo ativo-${k}` : ''} onClick={() => set('solucao_financeira')(k)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grade grade-etapas">
          <EtapaData id="p-pi" rotulo="Envio do projeto inicial" valor={f.data_projeto_inicial} onData={set('data_projeto_inicial')}
            feito={f.projeto_inicial_enviado} onFeito={set('projeto_inicial_enviado')} textoFeito="Projeto inicial enviado" />
          <EtapaData id="p-med" rotulo="Dia da medição" valor={f.data_medicao} onData={set('data_medicao')}
            feito={f.medicao_concluida} onFeito={set('medicao_concluida')} textoFeito="Medição feita" />
          <EtapaData id="p-conf" rotulo="Projeto final · Conferência" valor={f.data_conferencia} onData={set('data_conferencia')}
            feito={f.conferencia_concluida} onFeito={set('conferencia_concluida')} textoFeito="Conferência feita" />
          <EtapaData id="p-assproj" rotulo="Projeto final · Assinatura" valor={f.data_assinatura_projeto}
            onData={set('data_assinatura_projeto')} feito={projetoAssinadoZapSign || f.projeto_assinado_manual}
            travado={projetoAssinadoZapSign} onFeito={set('projeto_assinado_manual')}
            textoFeito={projetoAssinadoZapSign ? 'Assinado pelo portal' : 'Assinado fora do portal'}
            sugestao={sugestao.assinaturaProjeto && {
              data: sugestao.assinaturaProjeto,
              texto: `10 dias úteis após ${sugestao.baseAssinatura}`,
            }} />
          <EtapaData id="p-entr" rotulo="Montagem (prazo máximo para entrega)" valor={f.data_entrega_prevista} onData={set('data_entrega_prevista')}
            feito={f.entrega_concluida} onFeito={set('entrega_concluida')} textoFeito="Montagem concluída" obrigatorio
            sugestao={sugestao.entrega && {
              data: sugestao.entrega,
              texto: `45 dias úteis a partir do 2º dia útil após a assinatura${sugestao.entregaReal ? '' : ' prevista'}`,
            }} />
        </div>
        <p className="dica">Ao anexar o PDF do projeto inicial, a etapa é marcada como enviada sozinha. A fabricação aparece para o cliente depois da assinatura do projeto final, até a montagem.</p>
        <label className="check check-destaque">
          <input type="checkbox" checked={f.notificar !== false} onChange={set('notificar')} />
          Avisar o cliente por WhatsApp e e-mail a cada etapa
        </label>
        <label className="check check-destaque">
          <input type="checkbox" checked={f.aceita_marketing !== false} onChange={set('aceita_marketing')} />
          Aceita receber e-mails de novidades (e-mail marketing)
        </label>
        {f.notificar !== false && !telefoneWhatsApp(f.cliente_telefone) && (
          <p className="dica">Sem um telefone válido com DDD, o cliente recebe os avisos só por e-mail.</p>
        )}
      </fieldset>

      <Campo id="p-recado" rotulo="Recado para o cliente (aparece no topo do portal)">
        <textarea id="p-recado" rows={2} value={f.recado_cliente || ''} onChange={set('recado_cliente')} />
      </Campo>

      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="acoes">
        <button className="btn btn-principal" disabled={salvando}>{f.id ? 'Salvar processo' : 'Criar processo'}</button>
        {f.id && !confirmar && (
          <button type="button" className="btn btn-perigo-leve" onClick={() => setConfirmar(true)}>Excluir processo</button>
        )}
        {confirmar && (
          <span className="confirmar">
            Excluir o processo e todos os anexos?
            <button type="button" className="btn btn-perigo" onClick={async () => { await api.excluirProcesso(f.id); onExcluido() }}>
              Sim, excluir
            </button>
            <button type="button" className="btn btn-leve" onClick={() => setConfirmar(false)}>Cancelar</button>
          </span>
        )}
      </div>
    </form>
  )
}

function EtapaData({ id, rotulo, valor, onData, feito, onFeito, textoFeito, travado, obrigatorio, sugestao }) {
  return (
    <div className={`etapa-data ${feito ? 'etapa-data-feita' : ''}`}>
      <CampoData id={id} rotulo={rotulo} valor={valor} onChange={onData} obrigatorio={obrigatorio} />
      {sugestao && !feito && (
        <div className="sugestao-prazo">
          <span>Pelo contrato: <strong className="num">{formatarData(sugestao.data)}</strong> <small>({sugestao.texto}, sem feriados municipais)</small></span>
          {sugestao.data !== valor && <button type="button" className="btn btn-leve" onClick={() => onData(sugestao.data)}>Usar</button>}
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={!!feito} disabled={travado} onChange={(e) => onFeito(e.target.checked)} />
        {textoFeito}
      </label>
    </div>
  )
}

// ============================================================ Anexos
// Anexos que o cliente vê (contrato, projetos, renders) ou arquivos internos do cliente
// (medição, Promob vendido, documentos pessoais e ficha cadastral), que só a loja vê.
function Anexos({ processo, onMudou, categorias, interno = false }) {
  const [categoria, setCategoria] = useState(categorias[0].id)
  const [titulo, setTitulo] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [excluir, setExcluir] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    if (!arquivo) return
    setErro('')
    setEnviando(true)
    try {
      await api.enviarDocumento(processo.id, { categoria, titulo: titulo || arquivo.name }, arquivo)
      setTitulo('')
      setArquivo(null)
      e.target.reset()
      await onMudou('Anexo enviado')
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="form">
      {interno ? (
        <div className="aviso-interno" role="note">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          <span><strong>Somente a loja vê esta aba.</strong> O cliente não tem acesso a estes arquivos no portal, nem pelo link do arquivo.</span>
        </div>
      ) : (
        <p className="dica">O cliente vê estes anexos no portal. Arquivos do cliente que são só da loja ficam em Arquivos internos.</p>
      )}
      <form className="envio" onSubmit={enviar}>
        <div className="grade grade-3">
          <Campo id="d-cat" rotulo="Tipo de anexo">
            <select id="d-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo id="d-titulo" rotulo="Título">
            <input id="d-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder={interno ? 'Ex.: Cozinha — versão vendida' : 'Ex.: Projeto final — rev. 2'} />
          </Campo>
          <Campo id="d-arq" rotulo={interno ? 'Arquivo (Promob, PDF, imagem, ZIP, DOCX ou DWG, até 50 MB)' : 'Arquivo (PDF, JPG, PNG, WEBP ou DWG, até 50 MB)'}>
            <input id="d-arq" type="file" required accept={interno ? '.promob,.pdf,.jpg,.jpeg,.png,.webp,.zip,.docx,.dwg' : '.pdf,.jpg,.jpeg,.png,.webp,.dwg'}
              onChange={(e) => setArquivo(e.target.files[0] || null)} />
          </Campo>
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button className="btn btn-principal" disabled={enviando || !arquivo}>{enviando ? 'Enviando…' : 'Enviar anexo'}</button>
        </div>
      </form>

      {categorias.map((c) => {
        const docs = processo.documentos.filter((d) => d.categoria === c.id)
        if (!docs.length) return interno ? (
          <div key={c.id} className="grupo-docs">
            <h3 className="rotulo">{c.nome}</h3>
            <p className="vazio-mini">Nenhum arquivo ainda.</p>
          </div>
        ) : null
        return (
          <div key={c.id} className="grupo-docs">
            <h3 className="rotulo">
              {c.nome}
              {!interno && c.interno && <span className="chip chip-interno chip-mini">Somente loja</span>}
            </h3>
            <ul className="docs">
              {docs.map((d) => (
                <LinhaDoc key={d.id} doc={d} acoes={
                  excluir === d.id ? (
                    <span className="confirmar">
                      <button className="btn btn-perigo" onClick={async () => { await api.excluirDocumento(d); setExcluir(null); onMudou('Anexo excluído') }}>Excluir</button>
                      <button className="btn btn-leve" onClick={() => setExcluir(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button className="btn btn-perigo-leve" onClick={() => setExcluir(d.id)}>Remover</button>
                  )
                } />
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================ Assinaturas (ZapSign)
// O contrato é assinado na loja antes do acesso ao portal (anexe o PDF assinado em Anexos).
const TIPOS_ASSINATURA = [
  { tipo: 'projeto_final', nome: 'Projeto final', categoria: 'projeto_final' },
]

function Assinaturas({ processo, onMudou }) {
  return (
    <div className="form">
      <p className="dica">
        O PDF do projeto final vai para o ZapSign e o cliente assina dentro do Portal Airam, com código de confirmação no e-mail. O contrato não passa por aqui: ele é assinado na loja e entra em Anexos como "Contrato assinado".
        Quando todos assinarem, o PDF assinado entra sozinho nos anexos.
      </p>
      {TIPOS_ASSINATURA.map((t) => (
        <CartaoAssinatura key={t.tipo} processo={processo} config={t} onMudou={onMudou} />
      ))}
    </div>
  )
}

function CartaoAssinatura({ processo, config, onMudou }) {
  const historico = processo.assinaturas.filter((a) => a.tipo === config.tipo).sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))
  const ativa = historico.find((a) => a.status === 'pendente' || a.status === 'assinado')
  const pdfs = processo.documentos.filter((d) => d.categoria === config.categoria && !d.assinado && d.tipo_mime === 'application/pdf')
  const [docId, setDocId] = useState(pdfs[0]?.id || '')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [cancelar, setCancelar] = useState(false)

  async function enviar() {
    setErro('')
    setOcupado(true)
    try {
      await api.enviarParaAssinatura(processo.id, docId, config.tipo)
      await onMudou(`${config.nome} enviado para assinatura`)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="cartao-ass">
      <div className="cartao-ass-topo">
        <h3>{config.nome}</h3>
        {ativa?.status === 'assinado' && <span className="chip chip-concluida">Assinado em {formatarData(ativa.assinado_em)}</span>}
        {ativa?.status === 'pendente' && <span className="chip chip-em_andamento">Aguardando o cliente</span>}
        {!ativa && <span className="chip chip-neutro">Não enviado</span>}
      </div>

      {ativa?.status === 'pendente' && (
        <div className="acoes">
          <span className="dica">Enviado em {formatarData(ativa.criado_em)}. O cliente vê o botão "Assinar agora" no portal.</span>
          {!cancelar ? (
            <button className="btn btn-perigo-leve" onClick={() => setCancelar(true)}>Cancelar envio</button>
          ) : (
            <span className="confirmar">
              Cancelar esta assinatura?
              <button className="btn btn-perigo" onClick={async () => { await api.cancelarAssinatura(ativa.id); setCancelar(false); onMudou('Assinatura cancelada') }}>Sim, cancelar</button>
              <button className="btn btn-leve" onClick={() => setCancelar(false)}>Voltar</button>
            </span>
          )}
        </div>
      )}

      {!ativa && (
        pdfs.length ? (
          <div className="acoes">
            <select aria-label={`PDF do ${config.nome}`} value={docId} onChange={(e) => setDocId(e.target.value)} className="select-doc">
              {pdfs.map((d) => <option key={d.id} value={d.id}>{d.titulo}</option>)}
            </select>
            <button className="btn btn-principal" disabled={ocupado || !docId} onClick={enviar}>
              {ocupado ? 'Enviando…' : 'Enviar para assinatura'}
            </button>
          </div>
        ) : (
          <p className="dica">Anexe o PDF em "Anexos" (tipo {config.nome}) para enviar para assinatura.</p>
        )
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  )
}

// ============================================================ Acesso do cliente
function Acesso({ processo }) {
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function liberar() {
    setErro('')
    setOcupado(true)
    try {
      setResultado(await api.liberarAcesso(processo.id))
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const login = processo.cliente_cpf ? `seu CPF (${formatarCpf(processo.cliente_cpf)}) ou e-mail` : `seu e-mail (${processo.cliente_email})`
  const mensagem = resultado &&
    `Olá, ${processo.cliente_nome.split(' ')[0]}! Seu acesso ao Portal Airam está liberado.\n` +
    `Endereço: ${window.location.origin}${window.location.pathname}\nLogin: ${login}\nSenha provisória: ${resultado.senha}\n` +
    `No primeiro acesso você cria uma senha só sua.`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      document.getElementById('msg-acesso')?.select()
    }
  }

  return (
    <div className="form">
      <p className="dica">
        Gera uma senha provisória para <strong>{processo.cliente_nome}</strong>. O cliente entra com {login}, e no primeiro acesso é obrigado a criar a própria senha.
        Gerar de novo invalida a senha anterior.
      </p>
      <div className="acoes">
        <button className="btn btn-principal" disabled={ocupado} onClick={liberar}>
          {ocupado ? 'Gerando…' : 'Liberar acesso / gerar nova senha'}
        </button>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {resultado && (
        <div className="senha-gerada">
          <span className="rotulo">Senha provisória</span>
          <strong className="senha-valor">{resultado.senha}</strong>
          <span className="dica">
            {resultado.emailEnviado ? 'Também enviamos por e-mail para o cliente.' : 'Envie a mensagem abaixo para o cliente pelo WhatsApp.'} A senha não fica salva: copie agora.
          </span>
          <textarea id="msg-acesso" readOnly rows={6} value={mensagem} />
          <div className="acoes">
            <button className="btn btn-contorno" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar mensagem'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================ Avisos enviados ao cliente
const CANAL = { whatsapp: 'WhatsApp', email: 'E-mail' }

function Avisos({ processo }) {
  const [avisos, setAvisos] = useState(null)
  const [msg, setMsg] = useState('')
  const carregar = () => api.listarAvisos(processo.id).then(setAvisos)
  useEffect(() => {
    carregar()
  }, [processo.id])

  async function reenviar(a) {
    setMsg('')
    try {
      await api.reenviarAviso(a.id)
      setMsg(`Aviso reenviado por ${CANAL[a.canal]}.`)
      await carregar()
    } catch (err) {
      setMsg('Não foi possível reenviar: ' + err.message)
    }
  }

  return (
    <div className="form">
      <p className="dica">
        A cada etapa (medição agendada e concluída, conferência, documento para assinar, produção, nova data de
        entrega, entrega concluída) o cliente recebe uma mensagem no WhatsApp e um e-mail automaticamente.
        {processo.notificar === false && <strong> Os avisos estão desligados neste processo (aba Dados e prazos).</strong>}
      </p>
      {msg && <p className="toast" role="status">{msg}</p>}
      {!avisos && <div className="carregando">Carregando…</div>}
      {avisos && !avisos.length && <p className="vazio">Nenhum aviso enviado ainda. O primeiro sai na próxima mudança de etapa.</p>}
      {avisos?.length > 0 && (
        <ul className="avisos">
          {avisos.map((a) => (
            <li key={a.id} className="aviso-item">
              <span className={`aviso-canal aviso-${a.canal}`}>{CANAL[a.canal]}</span>
              <div className="aviso-corpo">
                <div className="aviso-topo">
                  <strong>{a.titulo}</strong>
                  <span className={`chip chip-mini chip-aviso-${a.status}`}>{ROTULO_STATUS_AVISO[a.status]}</span>
                </div>
                <p>{a.mensagem}</p>
                <span className="doc-data num">
                  {new Date(a.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {a.destino}
                </span>
                {a.erro && <span className="aviso-erro">{a.erro}</span>}
              </div>
              {a.status !== 'pendente' && (
                <button className="btn btn-leve" onClick={() => reenviar(a)}>Reenviar</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================ Cronograma interno (só a loja vê)
function dataHora(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const EVENTOS_DA_ETAPA = {
  venda: [],
  financeiro: ['financeiro_aprovado'],
  projeto_inicial: ['projeto_inicial'],
  medicao: ['medicao_agendada', 'medicao_realizada'],
  conferencia: ['conferencia_agendada', 'conferencia_realizada'],
  assinatura_projeto: ['projeto_final_disponivel', 'producao_iniciada'],
  entrega: ['entrega_reagendada', 'entrega_concluida'],
}

function CronogramaInterno({ processo: p }) {
  const [avisos, setAvisos] = useState([])
  useEffect(() => {
    api.listarAvisos(p.id).then(setAvisos)
  }, [p.id])

  const projetoAssinado = p.assinaturas?.find((a) => a.tipo === 'projeto_final' && a.status === 'assinado')
  const linhas = [
    { id: 'venda', nome: 'Venda / processo criado', previsto: p.data_venda, feito: p.criado_em },
    { id: 'financeiro', nome: 'Solução financeira', previsto: null, feito: p.financeiro_ok_em },
    { id: 'projeto_inicial', nome: 'Projeto inicial', previsto: p.data_projeto_inicial, feito: p.projeto_inicial_em },
    { id: 'medicao', nome: 'Medição', previsto: p.data_medicao, feito: p.medicao_concluida_em },
    { id: 'conferencia', nome: 'Projeto final · Conferência', previsto: p.data_conferencia, feito: p.conferencia_concluida_em },
    { id: 'assinatura_projeto', nome: 'Projeto final · Assinatura', previsto: p.data_assinatura_projeto, feito: projetoAssinado?.assinado_em || p.projeto_assinado_em },
    { id: 'producao', nome: 'Fabricação', previsto: null, feito: null, inicio: projetoAssinado?.assinado_em || p.projeto_assinado_em },
    { id: 'entrega', nome: 'Montagem', previsto: p.data_entrega_prevista, feito: p.montagem_concluida_em },
  ]

  const avisosDe = (id) => avisos.filter((a) => (EVENTOS_DA_ETAPA[id] || []).includes(a.evento) && ['enviado', 'simulado'].includes(a.status))

  return (
    <div className="form">
      <p className="dica">
        Uso interno: o cliente não vê esta tela. As datas de conclusão são registradas sozinhas quando a etapa é marcada,
        e os avisos mostram quando o e-mail e o WhatsApp foram enviados.
      </p>
      <div className="tabela-wrap">
        <table className="tabela tabela-cronograma">
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Previsto</th>
              <th>Concluído em</th>
              <th>Dias</th>
              <th>Avisos ao cliente</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const anterior = linhas.slice(0, i).reverse().find((x) => x.feito)?.feito
              const dias = l.feito && anterior ? Math.max(0, Math.round((new Date(l.feito) - new Date(anterior)) / 86400000)) : null
              const atrasada = !l.feito && l.previsto && diasAte(l.previsto) < 0
              const env = avisosDe(l.id)
              return (
                <tr key={l.id} className={l.feito ? 'linha-feita' : ''}>
                  <td><strong>{l.nome}</strong></td>
                  <td className="num">{l.previsto ? formatarData(l.previsto) : '—'}</td>
                  <td className="num">
                    {l.feito ? dataHora(l.feito)
                      : l.inicio && !p.entrega_concluida ? <span className="chip chip-mini chip-em_andamento">Em fabricação desde {formatarData(l.inicio.slice(0, 10))}</span>
                      : <span className={atrasada ? 'texto-atraso' : 'celula-sub'}>{atrasada ? 'Atrasada' : 'Pendente'}</span>}
                  </td>
                  <td className="num">{dias !== null && i > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : '—'}</td>
                  <td>
                    {env.length ? env.map((a) => (
                      <span key={a.id} className="celula-sub num">
                        {a.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · {dataHora(a.enviado_em || a.criado_em)}
                      </span>
                    )) : <span className="celula-sub">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="dica">"Dias" é o tempo desde a etapa concluída anterior. Total desde a venda: {
        (() => {
          const ultimo = [...linhas].reverse().find((l) => l.feito && l.id !== 'venda')?.feito
          return ultimo ? `${Math.round((new Date(ultimo) - new Date(p.data_venda + 'T00:00:00')) / 86400000)} dias até a última etapa concluída` : 'nenhuma etapa concluída ainda'
        })()
      }.</p>
    </div>
  )
}

// ============================================================ O que o cliente preencheu em "Meu perfil"
function InfoDoCliente({ processo }) {
  const [p, setP] = useState(undefined)
  useEffect(() => {
    api.perfilDoCliente(processo.cliente_email).then(setP).catch(() => setP(null))
  }, [processo.cliente_email])
  if (p === undefined) return null
  if (!p) return <p className="dica">O cliente ainda não preencheu o perfil no portal.</p>
  const endereco = [p.endereco && `${p.endereco}${p.numero ? ', ' + p.numero : ''}`, p.complemento, p.bairro, p.cidade && `${p.cidade}${p.uf ? '/' + p.uf : ''}`,
    p.cep && `CEP ${String(p.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}`].filter(Boolean).join(' · ')
  const linhas = [
    ['Nome', p.nome_preferido],
    ['Sobrenome', p.sobrenome],
    ['Celular', p.telefone],
    ['Outro telefone', p.telefone_2],
    ['Novidades por e-mail', p.receber_novidades === false ? 'Não quer receber' : 'Aceita'],
    ['Instagram', p.instagram && `@${p.instagram}`],
    ['Endereço de entrega dos móveis', endereco, true],
  ].filter(([, v]) => v)
  return (
    <div className="info-cliente">
      <Avatar caminho={p.foto_path} nome={processo.cliente_nome} tamanho={64} />
      <dl className="info-cliente-dados">
        <div className="largo"><dt>Preenchido pelo cliente no portal</dt></div>
        {linhas.map(([k, v, largo]) => (
          <div key={k} className={largo ? 'largo' : ''}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  )
}
