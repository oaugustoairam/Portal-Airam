// Cubo da marca Airam, usado como ícone da etapa de produção (com efeito de carregamento).
export default function IconeCubo({ carregando }) {
  const contorno = 'M12 2.2 20.8 7.1v9.8L12 21.8 3.2 16.9V7.1Z'
  return (
    <svg viewBox="0 0 24 24" className={`cubo ${carregando ? 'cubo-carregando' : ''}`} aria-hidden="true">
      <defs>
        <clipPath id="cubo-clip">
          <path d={contorno} />
        </clipPath>
      </defs>
      {carregando && (
        <g clipPath="url(#cubo-clip)">
          <rect className="cubo-enchimento" x="0" y="0" width="24" height="24" />
        </g>
      )}
      <path d={contorno} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3.2 7.1 12 12l8.8-4.9M12 12v9.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
