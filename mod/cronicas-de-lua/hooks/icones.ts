// Ícones outline dos botões fora do desktop (VS Code e celular), variante C
// aprovada pelo usuário em 22/11/2026 (maquete em previa_faixa/botoes_vscode.html):
// apagado = contorno cinza claro; aceso = preenchido na cor do Claude, com os
// detalhes vazados. O Livro aceso vira um livro aberto.
import type { NomeBotao } from './cena'

/** A cor do Claude (terracota). */
export const COR_CLAUDE = '#D97757'
/** Ícone e texto do botão apagado. */
export const COR_APAGADO = '#c9c9c9'
/** Contorno do botão apagado (discreto). */
export const BORDA_APAGADO = '#3a3a3a'
// (hover e fundo do aceso saíram: o VS Code não desenha hover nem fundo numa caixa)
/** Os detalhes vazados de um ícone preenchido (lombada, bolso). */
const MIOLO = '#1e1e1e'

type Traco = { d: string; tipo?: 'vazado' | 'miolo' }

const DESENHOS: Record<NomeBotao | 'livro_aberto', readonly Traco[]> = {
  vigilia: [{ d: 'M12 2.8c.9 3.2 5.4 5.6 5.4 10.6a5.4 5.4 0 0 1-10.8 0c0-2.6 1.5-3.9 2.6-5.4.4 1.6 1.2 2.5 2.1 2.9-.4-2.6-.2-5.4.7-8.1z' }],
  mochila: [
    { d: 'M6 9.5A4.5 4.5 0 0 1 10.5 5h3A4.5 4.5 0 0 1 18 9.5V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z' },
    { d: 'M10 5V4a2 2 0 0 1 4 0v1', tipo: 'vazado' },
    { d: 'M9 14h6M9 14v4h6v-4', tipo: 'miolo' },
  ],
  estandarte: [{ d: 'M6 4h12l-2.6 4.5L18 13H6z' }, { d: 'M6 21V3.5', tipo: 'vazado' }],
  livro: [{ d: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z' }, { d: 'M5 20.5A2.5 2.5 0 0 0 7.5 23H19v-5', tipo: 'vazado' }],
  livro_aberto: [
    { d: 'M12 7.5C10.5 5.6 8 5 3 5v13c5 0 7.5.6 9 2.5 1.5-1.9 4-2.5 9-2.5V5c-5 0-7.5.6-9 2.5z' },
    { d: 'M12 7.5v12.5', tipo: 'miolo' },
    { d: 'M6 9c1.8.1 3 .4 4 1M6 12.5c1.8.1 3 .4 4 1M18 9c-1.8.1-3 .4-4 1M18 12.5c-1.8.1-3 .4-4 1', tipo: 'miolo' },
  ],
}

/** Largura do Svg do ícone em px: 16 do desenho + 6 de respiro até o texto. */
export const ICONE_W = 22
export const ICONE_H = 16

/** O ícone de um botão como SVG (16 px de desenho, respiro à direita). */
export function iconeBotao(b: NomeBotao, aceso: boolean): string {
  const tracos = DESENHOS[aceso && b === 'livro' ? 'livro_aberto' : b]
  const cor = aceso ? COR_CLAUDE : COR_APAGADO
  const corpo = tracos
    .map(t => {
      const miolo = aceso && t.tipo === 'miolo'
      const fill = aceso && t.tipo === undefined ? cor : 'none'
      const stroke = miolo ? MIOLO : cor
      return `<path d="${t.d}" fill="${fill}" stroke="${stroke}" stroke-width="${miolo ? 1.4 : 1.8}" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join('')
  // viewBox de 33 x 24 unidades = 22 x 16 px: o desenho ocupa os 24 da esquerda
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICONE_W}" height="${ICONE_H}" viewBox="0 0 33 24">${corpo}</svg>`
}
