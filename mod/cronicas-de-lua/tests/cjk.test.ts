import { expect, test } from 'claude-code/testing'

import { linhasDoBalao } from '../hooks/cena'
import { cssFonteLonga, cssTexto, larguraLonga, pedacos, quebrarPorLargura } from '../hooks/fontes'
import { usarIdioma } from '../hooks/t'

test('chinês, japonês e coreano desenham com a Fusion Pixel; os outros com a Silkscreen', () => {
  for (const cod of ['zh-CN', 'ja', 'ko']) {
    usarIdioma(cod)
    expect(cssTexto()).toContain("font-family:'Fusion'")
    expect(cssTexto()).not.toContain("'Silkscreen'")
    expect(cssFonteLonga()).toContain("'Fusion Longa'")
  }
  usarIdioma('pt-BR')
  expect(cssTexto()).toContain("font-family:'Silkscreen'")
  expect(cssTexto()).not.toContain('Fusion')
})

test('a quebra CJK não começa linha com pontuação e não parte palavra coreana', () => {
  usarIdioma('ja')
  // cada letra é um pedaço; a pontuação de fechamento gruda na letra de antes
  expect(pedacos('整理しよう（圧縮）。')).toEqual(['整', '理', 'し', 'よ', 'う', '（圧', '縮）。'])
  // palavras latinas ficam inteiras
  expect(pedacos('Lua の XP')).toEqual(['Lua', ' の', ' XP'])
  for (const l of quebrarPorLargura('会話がほぼ満杯です。そろそろ整理しよう（圧縮）。', 60)) {
    expect('、。）」！？'.includes(l[0] ?? '')).toBe(false)
    expect(larguraLonga(l)).toBeLessThanOrEqual(60)
  }
  usarIdioma('ko')
  const frase = '배낭을 정리하면 대화를 요약하고 자리를 비워요'
  const palavras = new Set(frase.split(' '))
  for (const l of quebrarPorLargura(frase, 70)) {
    for (const p of l.split(' ')) {
      expect(palavras.has(p)).toBe(true)
    }
  }
  usarIdioma('pt-BR')
})

test('o balão em japonês quebra pela largura em px e junta as frases sem espaço', () => {
  usarIdioma('ja')
  // cabe numa linha: as duas frases se juntam sem espaço
  expect(linhasDoBalao('会話のキャッシュ。\n灯ります。')).toEqual(['会話のキャッシュ。灯ります。'])
  const linhas = linhasDoBalao('会話がほぼ満杯（99%）。\nそろそろ整理しよう（圧縮）。リュックを整理すると会話が要約されます。')
  expect(linhas.length).toBeGreaterThan(1)
  for (const l of linhas) {
    expect(larguraLonga(l)).toBeLessThanOrEqual(Math.ceil(34 * 5.4))
  }
  usarIdioma('pt-BR')
})
