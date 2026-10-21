import { useState } from 'react'
import { api } from '../../lib/api.js'
import { ITENS_CHECKLIST, competencia, nomeMes } from '../../lib/salario.js'
import { dataHoraBR, nomeCurto } from '../../lib/comercial.js'
import { useComercial } from './comum.jsx'

// Checklist de venda (cartão em Vendidos): a venda só entra no salário com os 5 itens prontos
export default function ChecklistVenda({ lead, checklist, onMudou }) {
  const { acoes, pessoas } = useComercial()
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')
  // a caixinha muda na hora; se o banco recusar, volta como estava
  const [otimista, setOtimista] = useState({})
  const marcado = (k) => (k in otimista ? otimista[k] : !!checklist?.[`${k}_em`])
  const feitos = ITENS_CHECKLIST.filter(([k]) => marcado(k)).length
  async function marcar(item, feito) {
    setErro('')
    setOcupado(item)
    setOtimista((o) => ({ ...o, [item]: feito }))
    try {
      await api.marcarChecklist(lead.id, item, feito)
      await onMudou(feito ? 'Item marcado' : 'Item desmarcado')
    } catch (e) {
      setErro(e.message)
    } finally {
      setOtimista((o) => {
        const { [item]: _, ...resto } = o
        return resto
      })
      setOcupado('')
    }
  }
  return (
    <div className="checklist-venda">
      <div className="secao-cab">
        <h3>Checklist de venda · {feitos}/5</h3>
        {checklist?.completa_em
          ? <span className="chip chip-col-ganho">Completo · conta no salário de {nomeMes(competencia(lead, checklist, []))}</span>
          : <span className="chip chip-atraso">Pendente · ainda não conta no salário</span>}
      </div>
      <div className="progresso-checklist" aria-hidden="true"><span style={{ width: `${feitos * 20}%` }} /></div>
      <ul className="itens-checklist">
        {ITENS_CHECKLIST.map(([k, t]) => {
          const em = checklist?.[`${k}_em`]
          const automatico = k === 'formalizacao'
          const pode = acoes.mover && (!automatico || acoes.todos)
          return (
            <li key={k} className={marcado(k) ? 'feito' : ''}>
              <label className="check">
                <input type="checkbox" checked={marcado(k)} disabled={!pode || ocupado === k} onChange={(e) => marcar(k, e.target.checked)} />
                <span>{t}{automatico && <small> · marcado sozinho quando a formalização é enviada pelo portal</small>}</span>
              </label>
              {em && <small className="celula-sub">{dataHoraBR(em)}{checklist[`${k}_por`] ? ` · ${nomeCurto(pessoas, checklist[`${k}_por`])}` : automatico ? ' · pelo portal' : ''}</small>}
            </li>
          )
        })}
      </ul>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  )
}
