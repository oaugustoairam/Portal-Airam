import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { errosFeriado } from '../../lib/apiFerramentas.js'
import { Janela, Campo, Confirmar, Escolha } from '../comercial/comum.jsx'

const ABRANGENCIA = [['todas', 'Todas as lojas'], ['sao_paulo', 'Só Mooca (São Paulo)'], ['guarulhos', 'Só Guarulhos']]
const dataCurta = (s) => (s ? s.split('-').reverse().join('/') : '')

// Configurações > Feriados e recessos da empresa (entram na calculadora de dias úteis)
export default function FeriadosConfig() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState(null)
  const [excluir, setExcluir] = useState(null)
  const carregar = () => api.feriadosEmpresa().then(setLista).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])
  const avisar = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }
  if (!lista) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  return (
    <div className="feriados-config">
      <div className="secao-cab">
        <p className="dica">Feriados nacionais, de SP, de São Paulo e de Guarulhos já são calculados sozinhos. Aqui entram os dias da empresa.</p>
        <button type="button" className="btn btn-principal" onClick={() => setEditando({ data: '', data_fim: '', nome: '', tipo: 'recesso', abrangencia: 'todas' })}>Adicionar</button>
      </div>
      {msg && <span className="toast" role="status">{msg}</span>}
      {lista.length === 0 ? <p className="vazio-mini">Nenhum feriado ou recesso da empresa cadastrado.</p> : (
        <ul className="lista-lembretes">
          {lista.map((f) => (
            <li key={f.id}>
              <span className="lb-info">
                <strong>{dataCurta(f.data)}{f.data_fim && f.data_fim !== f.data ? ` a ${dataCurta(f.data_fim)}` : ''} · {f.nome}</strong>
                <span className="celula-sub">{f.tipo === 'feriado' ? 'Feriado' : 'Recesso'} · {ABRANGENCIA.find(([k]) => k === f.abrangencia)?.[1]}</span>
              </span>
              <span className="acoes-linha">
                <button type="button" className="btn btn-leve" onClick={() => setEditando(f)}>Editar</button>
                <button type="button" className="btn btn-leve texto-atraso" onClick={() => setExcluir(f)}>Excluir</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editando && <FeriadoForm item={editando} onFechar={() => setEditando(null)} onSalvo={async (m) => { setEditando(null); await carregar(); avisar(m) }} />}
      {excluir && <Confirmar titulo={`Excluir ${excluir.nome}?`} texto="Sai da calculadora de dias úteis." onCancelar={() => setExcluir(null)}
        onConfirmar={async () => { await api.excluirFeriado(excluir.id); setExcluir(null); await carregar(); avisar('Excluído') }} />}
    </div>
  )
}

function FeriadoForm({ item, onFechar, onSalvo }) {
  const [f, setF] = useState({ ...item, data_fim: item.data_fim || '' })
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar() {
    const e = errosFeriado(f)
    if (e) return setErro(e)
    setOcupado(true)
    try {
      await api.salvarFeriado(f)
      onSalvo(item.id ? 'Atualizado' : 'Adicionado')
    } catch (err) {
      setErro(err.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo={item.id ? 'Editar feriado ou recesso' : 'Novo feriado ou recesso'} rotulo="Configurações" ocupado={ocupado} onFechar={onFechar} onSubmit={salvar}
      rodape={<>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <Campo id="fe-nome" rotulo="Nome" obrigatorio><input id="fe-nome" maxLength={80} placeholder="Ex.: Recesso de fim de ano" value={f.nome} onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))} /></Campo>
      <div className="grade grade-2">
        <Campo id="fe-data" rotulo="Data (ou início)" obrigatorio><input id="fe-data" type="date" value={f.data} onChange={(e) => setF((x) => ({ ...x, data: e.target.value }))} /></Campo>
        <Campo id="fe-fim" rotulo="Até (opcional)" ajuda="Para recessos de vários dias."><input id="fe-fim" type="date" value={f.data_fim} onChange={(e) => setF((x) => ({ ...x, data_fim: e.target.value }))} /></Campo>
      </div>
      <Escolha id="fe-tipo" rotulo="Tipo" valor={f.tipo} onChange={(v) => setF((x) => ({ ...x, tipo: v }))} opcoes={[['recesso', 'Recesso'], ['feriado', 'Feriado']]} />
      <Campo id="fe-abr" rotulo="Vale para">
        <select id="fe-abr" value={f.abrangencia} onChange={(e) => setF((x) => ({ ...x, abrangencia: e.target.value }))}>
          {ABRANGENCIA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </Campo>
    </Janela>
  )
}
