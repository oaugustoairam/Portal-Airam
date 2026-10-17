import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Modelos de planilha da Airam embutidos no código (import 'arquivo.xlsx?base64'),
// para gerar a capa e a planilha do mês sem depender de arquivo separado no servidor.
const modelosXlsx = {
  name: 'modelos-xlsx',
  enforce: 'pre',
  load(id) {
    if (!id.endsWith('.xlsx?base64')) return null
    const arquivo = readFileSync(id.slice(0, -'?base64'.length)).toString('base64')
    return `export default ${JSON.stringify(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${arquivo}`)}`
  },
}

export default defineConfig({
  plugins: [modelosXlsx, react()],
  base: './',
  // caracteres especiais escritos como \uXXXX no código final (evita problemas de codificação)
  esbuild: { charset: 'ascii' },
})
