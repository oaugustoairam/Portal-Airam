import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { hojeISO } from '../lib/constants.js'
import { fotoDoProcesso } from '../lib/fotos.js'
import {
  montarRelatorio, linhaLista, COLUNAS_LISTA, valorColuna, csvLista, baixarArquivo, nomeArquivo, imagemParaJpeg, dataCurta,
} from '../lib/relatorio.js'

const CATEGORIAS_IMAGEM = ['render', 'projeto_inicial', 'projeto_final', 'outro']

// Carrega o gerador de PDF só quando precisa (deixa o portal leve)
const gerador = () => import('./relatorio/PdfRelatorios.jsx')

export default function Relatorios({ processos, onFechar }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <section>
      <button className="btn btn-leve voltar" onClick={onFechar}>← Todos os processos</button>
      {processos.length === 1 ? <RelatorioUm processo={processos[0]} /> : <RelatorioVarios processos={processos} />}
    </section>
  )
}

// ============================================================ Um cliente: PDF de apresentação
function RelatorioUm({ processo }) {
  const [dados, setDados] = useState(null)
  const [interno, setInterno] = useState(true)
  const [estado, setEstado] = useState('') // '', 'gerando', 'pronto'
  const [erro, setErro] = useState('')
  const [arquivo, setArquivo] = useState(null)

  useEffect(() => {
    Promise.all([api.processo(processo.id), api.controleInterno(processo.id)])
      .then(([p, c]) => setDados(montarRelatorio(p, c)))
      .catch((e) => setErro(e.message))
    gerador() // já vai baixando o gerador enquanto a pessoa lê a tela
  }, [processo.id])

  if (!dados) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  const { p } = dados
  const imagensDisponiveis = dados.documentos.filter((d) => d.tipo_mime?.startsWith('image/') && CATEGORIAS_IMAGEM.includes(d.categoria))

  async function gerar() {
    setErro('')
    setEstado('gerando')
    try {
      const docs = imagensDisponiveis.slice(0, 6)
      const imagens = (await Promise.all(docs.map(async (d) => {
        const img = await imagemParaJpeg(await api.urlDocumento(d))
        return img && { ...img, titulo: d.titulo, categoria: d.categoriaNome, render: d.categoria === 'render' }
      }))).filter(Boolean)
      const foto = imagens.find((i) => i.render) || (await imagemParaJpeg(fotoDoProcesso(p.ambientes || '').src))
      const { gerarPdfCliente } = await gerador()
      const blob = await gerarPdfCliente({ r: dados, foto, imagens, interno, geradoEm: hojeISO() })
      const nome = `relatorio-${nomeArquivo(`${p.codigo}-${p.cliente_nome}`)}.pdf`
      setArquivo({ blob, nome })
      baixarArquivo(blob, nome)
      setEstado('pronto')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o PDF: ' + e.message)
      setEstado('')
    }
  }

  return (
    <div className="relatorio">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Relatório · {p.codigo}</span>
          <h1 className="titulo-grande">{p.cliente_nome}</h1>
        </div>
      </div>

      <div className="relatorio-capa">
        <div className="relatorio-capa-info">
          <span className="rotulo">PDF com a identidade da Airam</span>
          <ul className="relatorio-conteudo">
            <li><strong>Capa</strong> com foto do projeto, progresso e prazo máximo</li>
            <li><strong>Visão geral</strong> com gráfico de progresso e dados do cliente</li>
            <li><strong>Linha do tempo</strong> e <strong>cronograma</strong> com a duração de cada fase</li>
            <li><strong>Prazos</strong> de conferência, PDF e entrega, com a situação de cada um</li>
            <li><strong>Passo a passo</strong> com datas previstas e reais</li>
            {interno && <li><strong>Controle interno</strong>: liberador, montador, ATT, vistoria, assistência e documentos</li>}
            {imagensDisponiveis.length > 0 && <li><strong>Imagens do projeto</strong> ({Math.min(6, imagensDisponiveis.length)} anexadas)</li>}
          </ul>
        </div>
        <div className="relatorio-resumo">
          <div><span className="rotulo">Progresso</span><strong className="num">{dados.progresso}%</strong></div>
          <div><span className="rotulo">Etapa atual</span><strong>{dados.concluido ? 'Concluído' : dados.atual.nome}</strong></div>
          <div><span className="rotulo">Prazo máximo</span><strong className="num">{dataCurta(p.data_entrega_prevista)}</strong></div>
          <div><span className="rotulo">Situação</span><strong className={dados.situacaoEntrega.tipo === 'atraso' ? 'texto-atraso' : ''}>{dados.situacaoEntrega.texto}</strong></div>
        </div>
      </div>

      <label className="check check-destaque">
        <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} />
        Incluir controle interno (liberador, montador, ATT, vistoria, documentos). Desmarque para enviar ao cliente.
      </label>

      <div className="acoes">
        <button className="btn btn-principal" onClick={gerar} disabled={estado === 'gerando'}>
          {estado === 'gerando' ? 'Montando o PDF…' : 'Gerar PDF'}
        </button>
        {arquivo && estado === 'pronto' && (
          <>
            <span className="toast">PDF pronto</span>
            <button className="btn btn-leve" onClick={() => baixarArquivo(arquivo.blob, arquivo.nome)}>Baixar de novo</button>
          </>
        )}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  )
}

// ============================================================ Vários clientes: lista com prazos e datas
function RelatorioVarios({ processos }) {
  const [controles, setControles] = useState(null)
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    api.controlesInternos(processos.map((p) => p.id)).then(setControles).catch((e) => setErro(e.message))
  }, [processos])

  const linhas = useMemo(() => controles && processos.map((p) => linhaLista(p, controles[p.id])), [controles, processos])
  if (!linhas) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>

  const hoje = hojeISO()
  async function pdf() {
    setErro('')
    setGerando(true)
    try {
      const { gerarPdfLista } = await gerador()
      baixarArquivo(await gerarPdfLista({ linhas, geradoEm: hoje }), `relatorio-processos-${hoje}.pdf`)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando(false)
    }
  }

  const vencida = (l, k) => {
    const feito = { prazoConferencia: l.conferido, prazoPdf: l.pdf, prazoMaximo: l.entregue }[k]
    return k in { prazoConferencia: 1, prazoPdf: 1, prazoMaximo: 1 } && !feito && l[k] && l[k] < hoje
  }

  return (
    <div className="relatorio">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Relatório · {dataCurta(hoje)}</span>
          <h1 className="titulo-grande">{linhas.length} processos</h1>
        </div>
        <div className="acoes">
          <button className="btn btn-contorno" onClick={() => baixarArquivo(new Blob([csvLista(linhas)], { type: 'text/csv;charset=utf-8' }), `relatorio-processos-${hoje}.csv`)}>
            Baixar planilha
          </button>
          <button className="btn btn-principal" onClick={pdf} disabled={gerando}>{gerando ? 'Montando…' : 'Baixar PDF'}</button>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="tabela-wrap tabela-relatorio-wrap">
        <table className="tabela tabela-relatorio">
          <thead>
            <tr>{COLUNAS_LISTA.map(([k, t]) => <th key={k}>{t}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                {COLUNAS_LISTA.map((col) => {
                  const [k, , tipo] = col
                  if (k === 'progresso')
                    return (
                      <td key={k} className="num">
                        <span className="mini-barra"><span style={{ width: `${l.progresso}%` }} /></span>{l.progresso}%
                      </td>
                    )
                  if (k === 'situacao')
                    return <td key={k}><span className={`chip chip-mini chip-sit-${l.situacao.tipo}`}>{l.situacao.texto}</span></td>
                  if (k === 'cliente') return <td key={k}><strong>{l.cliente}</strong><span className="celula-sub">{l.ambientes}</span></td>
                  return (
                    <td key={k} className={`${tipo === 'data' || k === 'codigo' ? 'num' : ''} ${vencida(l, k) ? 'texto-atraso' : ''}`}>
                      {valorColuna(l, col)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dica">Datas em vermelho: prazo vencido sem a etapa concluída. A planilha abre direto no Excel ou no Google Planilhas.</p>
    </div>
  )
}
