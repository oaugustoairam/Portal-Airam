import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { AMBIENTE_VAZIO, montarContratoPdf, valorBR, num } from '../lib/contrato.js'
import { baixarArquivo, nomeArquivo } from '../lib/relatorio.js'
import { TabelaAmbientes, AmbienteModal, ListaPecas } from './Ambientes.jsx'
import ConfirmarExclusao from './ConfirmarExclusao.jsx'

// Contrato salvo: número (gerado pelo sistema), ambientes com XML do Promob, e o PDF no modelo da Airam.
export default function ContratoEditor({ g, perfil, onFechar, onNovoContrato }) {
  const [ambientes, setAmbientes] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [lojas, setLojas] = useState([])
  const [editando, setEditando] = useState(null)
  const [remover, setRemover] = useState(null)
  const [pecas, setPecas] = useState(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)

  const carregar = () => api.ambientes(g.id).then(setAmbientes).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
    if (g.cliente_id) api.cliente(g.cliente_id).then(setCliente).catch(() => {})
    api.lojas().then(setLojas).catch(() => {})
  }, [g.id])

  const avisar = (t) => {
    setMsg(t)
    setTimeout(() => setMsg(''), 2500)
  }

  async function salvarAmbiente(a, xml) {
    const { _xml, _chave, xml_path, xml_nome, xml_enviado_em, pecas: p, pecas_erro, criado_em, atualizado_em, ...dados } = a
    const salvo = await api.salvarAmbiente({ ...dados, processo_id: g.id, ordem: dados.ordem || (ambientes.length + 1) })
    if (xml?.arquivo) await api.enviarXmlAmbiente({ ...salvo, xml_path: a.xml_path }, xml.arquivo)
    setEditando(null)
    await carregar()
    avisar('Ambiente salvo')
  }

  async function baixarXml(a) {
    try {
      const url = await api.urlXmlAmbiente(a)
      const r = await fetch(url)
      baixarArquivo(await r.blob(), a.xml_nome || 'promob.xml')
    } catch (e) {
      setErro('Não foi possível baixar o XML: ' + e.message)
    }
  }

  async function pdf() {
    setErro('')
    setGerando(true)
    try {
      const k = montarContratoPdf({ g, cliente, ambientes, lojaNome: lojas.find((l) => l.id === g.comercial?.loja)?.nome?.replace('Loja ', '') })
      const { gerarPdfContrato } = await import('./relatorio/PdfContrato.jsx')
      baixarArquivo(await gerarPdfContrato(k), `contrato-${nomeArquivo(`${g.codigo}-${g.cliente_nome}`)}.pdf`)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando(false)
    }
  }

  const total = (ambientes || []).reduce((t, a) => t + num(a.valor ?? a.valor_bruto) * (num(a.qtd) || 1), 0)
  return (
    <section className="gestao contrato-editor">
      <button className="btn btn-leve voltar" onClick={onFechar}>← Voltar ao cadastro</button>
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Contrato nº {g.codigo}</span>
          <h1 className="titulo-grande">{g.cliente_nome}</h1>
          <p className="dica">{g.comercial?.vendedor_nome || '—'} · {lojas.find((l) => l.id === g.comercial?.loja)?.nome || '—'} · total R$ {valorBR(total)}</p>
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
        <div className="acoes">
          <button className="btn btn-principal" onClick={pdf} disabled={gerando || !ambientes}>{gerando ? 'Gerando…' : 'Baixar contrato (PDF)'}</button>
          {onNovoContrato && <button className="btn btn-contorno" onClick={() => onNovoContrato(cliente)}>Novo contrato para este cliente</button>}
        </div>
      </div>
      {!g.comercial?.contrato && <p className="aviso-config">Este cliente veio da planilha ou do cadastro antigo: o PDF sai com os dados que existirem. Complete os ambientes abaixo.</p>}

      <fieldset className="grupo">
        <legend>Ambientes</legend>
        <div className="cab-linha">
          <p className="dica">Valor bruto e XML do Promob ficam só para a loja. Alterações ficam registradas no histórico.</p>
          <button type="button" className="btn btn-principal" onClick={() => setEditando({ a: { ...AMBIENTE_VAZIO }, novo: true })}>Adicionar ambiente</button>
        </div>
        {!ambientes ? <div className="carregando">Carregando…</div> : (
          <TabelaAmbientes itens={ambientes} onEditar={(a) => setEditando({ a: { ...a, valor: a.valor ?? '' }, novo: false })}
            onRemover={(a) => setRemover(a)} onPecas={setPecas} onBaixarXml={baixarXml} />
        )}
      </fieldset>
      {erro && <p className="erro" role="alert">{erro}</p>}

      {editando && <AmbienteModal inicial={editando.a} novo={editando.novo} onFechar={() => setEditando(null)} onSalvar={salvarAmbiente} />}
      {pecas && <ListaPecas ambiente={pecas} onFechar={() => setPecas(null)} />}
      {remover && (
        <ConfirmarExclusao nome={`o ambiente ${remover.nome}`} codigo={`contrato ${g.codigo}`}
          texto="O ambiente sai do contrato, junto com o XML do Promob e a listagem de peças. O registro da remoção fica no histórico." onCancelar={() => setRemover(null)}
          onConfirmar={async () => { await api.excluirAmbiente(remover); setRemover(null); await carregar(); avisar('Ambiente removido') }} />
      )}
    </section>
  )
}
