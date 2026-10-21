import { createContext, useContext, useEffect, useRef, useState } from 'react'

// dados carregados uma vez pela aba Comercial e compartilhados pelas telas
export const ComercialCtx = createContext(null)
export const useComercial = () => useContext(ComercialCtx)

// Janela (modal) com título, fechar no Esc e no fundo; no celular sobe de baixo
export function Janela({ titulo, rotulo, largura = 'media', ocupado, onFechar, children, rodape, onSubmit }) {
  const ref = useRef(null)
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && !ocupado && onFechar()
    document.addEventListener('keydown', esc)
    ref.current?.querySelector('input, select, textarea, button:not(.janela-fechar)')?.focus()
    return () => document.removeEventListener('keydown', esc)
  }, [ocupado])
  const Corpo = onSubmit ? 'form' : 'div'
  return (
    <div className="modal janela-fundo" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !ocupado && onFechar()}>
      <Corpo ref={ref} className={`janela janela-${largura}`} role="dialog" aria-modal="true" aria-label={titulo}
        onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit(e) } : undefined} noValidate={onSubmit ? true : undefined}>
        <header className="janela-topo">
          <div>
            {rotulo && <span className="rotulo">{rotulo}</span>}
            <h2>{titulo}</h2>
          </div>
          <button type="button" className="btn btn-leve janela-fechar" aria-label="Fechar" onClick={onFechar} disabled={ocupado}>✕</button>
        </header>
        <div className="janela-corpo">{children}</div>
        {rodape && <footer className="janela-rodape">{rodape}</footer>}
      </Corpo>
    </div>
  )
}

// Pergunta simples antes de apagar/cancelar algo
export function Confirmar({ titulo, texto, botao = 'Excluir', onConfirmar, onCancelar }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function ok() {
    setErro('')
    setOcupado(true)
    try {
      await onConfirmar()
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo={titulo} rotulo="Confirme" largura="pequena" ocupado={ocupado} onFechar={onCancelar}
      rodape={<>
        <button type="button" className="btn btn-leve" onClick={onCancelar} disabled={ocupado}>Voltar</button>
        <button type="button" className="btn btn-principal" onClick={ok} disabled={ocupado}>{ocupado ? 'Aguarde…' : botao}</button>
      </>}>
      {texto && <p className="dica">{texto}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
    </Janela>
  )
}

// campo com rótulo e mensagem de erro
export function Campo({ id, rotulo, erro, ajuda, obrigatorio, children }) {
  return (
    <div className={`campo ${erro ? 'campo-com-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}{obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}</label>
      {children}
      {erro ? <span className="campo-erro" role="alert">{erro}</span> : ajuda ? <span className="ajuda">{ajuda}</span> : null}
    </div>
  )
}

// escolher vários arquivos (lista com remover antes de salvar)
export function EscolherArquivos({ id, rotulo, aceitar = 'image/*,application/pdf', arquivos, onChange, ajuda }) {
  const ref = useRef(null)
  return (
    <div className="campo escolher-arquivos">
      <span className="rotulo-campo">{rotulo}</span>
      <div className="escolher-linha">
        <button type="button" className="btn btn-contorno" onClick={() => ref.current?.click()}>+ Adicionar arquivos</button>
        <input ref={ref} id={id} type="file" multiple accept={aceitar} hidden aria-label={rotulo}
          onChange={(e) => { onChange([...arquivos, ...e.target.files]); e.target.value = '' }} />
        {ajuda && <span className="ajuda">{ajuda}</span>}
      </div>
      {arquivos.length > 0 && (
        <ul className="arquivos-escolhidos">
          {arquivos.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span>{f.name}</span><small>{(f.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB</small>
              <button type="button" className="btn btn-leve" aria-label={`Tirar ${f.name}`} onClick={() => onChange(arquivos.filter((_, j) => j !== i))}>Tirar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// botões tipo "segmentado" (escolha única)
export function Escolha({ id, rotulo, opcoes, valor, onChange, erro }) {
  return (
    <div className="campo">
      <span className="rotulo-campo" id={id}>{rotulo}</span>
      <div className="segmentado" role="radiogroup" aria-labelledby={id}>
        {opcoes.map(([k, t]) => (
          <button key={String(k)} type="button" role="radio" aria-checked={valor === k} className={valor === k ? 'ativo' : ''} onClick={() => onChange(k)}>{t}</button>
        ))}
      </div>
      {erro && <span className="campo-erro" role="alert">{erro}</span>}
    </div>
  )
}

export function Icone({ nome, titulo }) {
  const caminhos = {
    sino: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
    briefing: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
    agenda: 'M4 6h16v14H4zM4 10h16M9 3v5M15 3v5',
    anexo: 'M8 12.5 13.5 7a2.5 2.5 0 0 1 3.5 3.5l-7 7a4 4 0 0 1-5.7-5.7L11 5',
  }
  return (
    <svg className={`icone icone-${nome}`} viewBox="0 0 24 24" width="16" height="16" role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {titulo && <title>{titulo}</title>}
      <path d={caminhos[nome]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
