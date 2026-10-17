import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { formatarCpf, formatarTelefone, formatarData } from '../lib/constants.js'
import { WHATSAPP_AIRAM, linkWhatsApp } from '../lib/contato.js'
import Avatar from './Avatar.jsx'

const formatarCep = (v) => String(v || '').replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')

// Corta a foto no centro (quadrado) e reduz para 512px em JPEG, para enviar leve
function prepararFoto(arquivo) {
  return new Promise((ok, erro) => {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(arquivo.type) && !/\.(jpe?g|png|webp|heic)$/i.test(arquivo.name))
      return erro(new Error('Escolha uma imagem (JPG, PNG ou WEBP).'))
    const img = new Image()
    const url = URL.createObjectURL(arquivo)
    img.onload = () => {
      const lado = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = 512
      c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 512, 512)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => erro(new Error('Não foi possível abrir esta imagem. Tente uma foto em JPG ou PNG.'))
    img.src = url
  })
}

// O cliente vê os dados pessoais, mas só muda foto, e-mail, celular, Instagram e senha.
// O resto vem do cadastro da loja (e o banco também bloqueia a troca).
export default function MeuPerfil({ processo, onAtualizado }) {
  const [f, setF] = useState(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const arquivo = useRef(null)

  useEffect(() => {
    api.meuPerfil().then((p) => setF({ ...p, telefone: p.telefone || processo?.cliente_telefone || '' }))
  }, [])

  if (!f) return <div className="carregando">Carregando seu perfil…</div>

  const set = (k, fmt) => (e) => {
    const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    setF((x) => ({ ...x, [k]: fmt ? fmt(v) : v }))
  }
  const avisar = (t) => {
    setMsg(t)
    setTimeout(() => setMsg(''), 3000)
  }

  async function trocarFoto(e) {
    const a = e.target.files?.[0]
    e.target.value = ''
    if (!a) return
    setErro('')
    setEnviandoFoto(true)
    try {
      const blob = await prepararFoto(a)
      const caminho = await api.enviarFotoPerfil(blob)
      setF((x) => ({ ...x, foto_path: caminho }))
      onAtualizado?.()
      avisar('Foto atualizada')
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviandoFoto(false)
    }
  }

  async function removerFoto() {
    await api.removerFotoPerfil()
    setF((x) => ({ ...x, foto_path: null }))
    onAtualizado?.()
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const tel = (f.telefone || '').replace(/\D/g, '')
    if (tel && tel.length < 10) return setErro('Informe o celular com DDD.')
    setSalvando(true)
    try {
      await api.salvarMeuPerfil({ telefone: f.telefone, instagram: f.instagram, receber_novidades: f.receber_novidades })
      onAtualizado?.()
      avisar('Perfil salvo')
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const nome = processo?.cliente_nome || f.nome_preferido || ''
  const enderecoPerfil = [[f.endereco, f.numero].filter(Boolean).join(', '), f.complemento, f.bairro, [f.cidade, f.uf].filter(Boolean).join(' - '), f.cep && formatarCep(f.cep)]
    .filter(Boolean).join(' · ')
  const endereco = enderecoPerfil || processo?.endereco || ''
  const nascimento = processo?.cliente_nascimento || f.nascimento
  const corrigir = linkWhatsApp(WHATSAPP_AIRAM, `Olá! Sou ${nome}${processo?.codigo ? ` (processo ${processo.codigo})` : ''} e preciso corrigir um dado do meu cadastro.`)

  return (
    <section className="perfil">
      <header className="perfil-cab">
        <div className="perfil-foto">
          <Avatar caminho={f.foto_path} nome={nome} tamanho={132} />
          {enviandoFoto && <span className="perfil-foto-carregando" aria-label="Enviando foto" />}
        </div>
        <div className="perfil-cab-texto">
          <span className="rotulo-mono">Meu perfil</span>
          <h1 className="titulo-grande">{nome}</h1>
          <div className="acoes">
            <input ref={arquivo} id="perfil-foto" type="file" accept="image/*" hidden onChange={trocarFoto} />
            <button type="button" className="btn btn-principal" onClick={() => arquivo.current?.click()} disabled={enviandoFoto}>
              {f.foto_path ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {f.foto_path && <button type="button" className="btn btn-leve" onClick={removerFoto}>Remover foto</button>}
          </div>
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
      </header>

      <fieldset className="grupo">
        <legend>Seus dados</legend>
        <dl className="perfil-dados">
          <div><dt>Nome completo</dt><dd>{nome || '—'}</dd></div>
          <div><dt>CPF</dt><dd className="num">{processo?.cliente_cpf ? formatarCpf(processo.cliente_cpf) : '—'}</dd></div>
          <div><dt>Data de nascimento</dt><dd className="num">{nascimento ? formatarData(nascimento) : '—'}</dd></div>
          <div className="perfil-dados-largo"><dt>Endereço de entrega dos móveis</dt><dd>{endereco || '—'}</dd></div>
        </dl>
        <p className="dica">
          Estes dados são do seu contrato e não podem ser alterados por aqui.
          {corrigir && <> Algo errado? <a href={corrigir} target="_blank" rel="noreferrer">Fale com a Airam</a>.</>}
        </p>
      </fieldset>

      <form className="form perfil-form" onSubmit={salvar}>
        <fieldset className="grupo">
          <legend>Contato</legend>
          <div className="grade">
            <div className="campo">
              <label htmlFor="pf-tel">Celular / WhatsApp</label>
              <input id="pf-tel" inputMode="tel" autoComplete="tel" value={f.telefone || ''} onChange={set('telefone', formatarTelefone)} placeholder="(11) 90000-0000" />
              <span className="ajuda">Usado para os avisos do seu processo</span>
            </div>
            <div className="campo">
              <label htmlFor="pf-insta">Instagram</label>
              <div className="campo-prefixo">
                <span aria-hidden="true">@</span>
                <input id="pf-insta" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={60} value={f.instagram || ''}
                  onChange={set('instagram', (v) => v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[@\s/]/g, ''))} placeholder="seu.perfil" />
              </div>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={f.receber_novidades !== false} onChange={set('receber_novidades')} />
            Quero receber novidades e lançamentos da Airam por e-mail
          </label>
        </fieldset>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes perfil-salvar">
          <button className="btn btn-principal" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>

      <TrocarEmail atual={f.email} onTrocado={(e) => setF((x) => ({ ...x, email: e }))} />
      <TrocarSenhaPerfil />
    </section>
  )
}

function TrocarEmail({ atual, onTrocado }) {
  const [aberto, setAberto] = useState(false)
  const [novo, setNovo] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      const t = await api.trocarEmail(novo)
      setMsg(t)
      if (/trocado/i.test(t)) onTrocado(novo.trim().toLowerCase())
      setNovo('')
      setAberto(false)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <fieldset className="grupo">
      <legend>E-mail de acesso</legend>
      <p className="perfil-email num">{atual || '—'}</p>
      {!aberto ? (
        <div className="acoes">
          <button type="button" className="btn btn-contorno" onClick={() => { setAberto(true); setMsg('') }}>Trocar e-mail</button>
          {msg && <span className="dica">{msg}</span>}
        </div>
      ) : (
        <form className="form" onSubmit={salvar}>
          <div className="campo">
            <label htmlFor="pe-novo">Novo e-mail</label>
            <input id="pe-novo" type="email" autoComplete="email" required value={novo} onChange={(e) => setNovo(e.target.value)} />
            <span className="ajuda">Você continua entrando também pelo CPF ou celular.</span>
          </div>
          {erro && <p className="erro">{erro}</p>}
          <div className="acoes">
            <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Trocar e-mail'}</button>
            <button type="button" className="btn btn-leve" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </fieldset>
  )
}

function TrocarSenhaPerfil() {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const regras = [
    [senha.length >= 8, 'Pelo menos 8 caracteres'],
    [/[A-Za-z]/.test(senha) && /\d/.test(senha), 'Letras e números'],
    [senha.length > 0 && senha === confirma, 'As duas senhas são iguais'],
  ]
  async function salvar(e) {
    e.preventDefault()
    if (!regras.every(([ok]) => ok)) return
    setErro('')
    try {
      await api.trocarSenha(senha)
      setMsg('Senha alterada.')
      setSenha('')
      setConfirma('')
      setAberto(false)
    } catch (err) {
      setErro(err.message)
    }
  }
  return (
    <fieldset className="grupo">
      <legend>Segurança</legend>
      {!aberto ? (
        <div className="acoes">
          <button type="button" className="btn btn-contorno" onClick={() => { setAberto(true); setMsg('') }}>Trocar minha senha</button>
          {msg && <span className="dica">{msg}</span>}
        </div>
      ) : (
        <form className="form" onSubmit={salvar}>
          <div className="grade">
            <div className="campo">
              <label htmlFor="ps-nova">Nova senha</label>
              <input id="ps-nova" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="ps-conf">Repita a nova senha</label>
              <input id="ps-conf" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
            </div>
          </div>
          <ul className="regras">
            {regras.map(([ok, t]) => <li key={t} className={ok ? 'regra-ok' : ''}>{ok ? '✓' : '·'} {t}</li>)}
          </ul>
          {erro && <p className="erro">{erro}</p>}
          <div className="acoes">
            <button className="btn btn-principal" disabled={!regras.every(([ok]) => ok)}>Salvar nova senha</button>
            <button type="button" className="btn btn-leve" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </fieldset>
  )
}
