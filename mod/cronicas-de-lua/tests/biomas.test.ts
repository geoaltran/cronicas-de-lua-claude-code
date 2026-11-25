import { expect, test } from 'claude-code/testing'
import { biomaDe, montar, tamanhoNoApp } from '../hooks/cena'
import { novoChefao } from '../hooks/chefao'

const T = 1_800_000_000_000
const hud = (paginas: number) => ({
  luz: { at: T - 19 * 60000, ttlMs: 3600000 },
  mana: { cinco: 28 },
  mochila: 35,
  jogo: { xp: 137, paginas, lutas: 5 },
})

test('o bioma segue a página da jornada (o próximo chefão)', () => {
  const de = (paginas: number) => biomaDe({ agora: T, hud: hud(paginas) })
  expect(de(0)).toBe('floresta') // Vespera
  expect(de(1)).toBe('floresta') // Dama Penumbra
  expect(de(2)).toBe('ruinas') // Golem
  expect(de(3)).toBe('mar') // Leviatã
  expect(de(4)).toBe('vulcao') // Ignis
  expect(de(5)).toBe('torre') // Relojoeiro
  expect(de(6)).toBe('aurora') // Sir Solis
  expect(de(7)).toBe('castelo_vidro') // Rei Espelho
  expect(de(8)).toBe('ceu_estelar') // Nébula
  expect(de(9)).toBe('eclipse') // Malakor
  expect(de(10)).toBe('floresta') // Novo Jogo+: recomeça
})

test('com um chefão em cena, o bioma é o dele (mesmo chamado fora da ordem)', () => {
  const ch = novoChefao(0, 'comando', T, { total: 0, feitas: 0 }, 'nebula')
  expect(biomaDe({ agora: T + 1000, hud: hud(0), chefao: ch })).toBe('ceu_estelar')
  expect(biomaDe({ agora: T, hud: hud(0), bioma: 'mar' })).toBe('mar')
  expect(biomaDe({ agora: T, hud: hud(0), bioma: 'nao_existe' })).toBe('floresta')
})

test('todo bioma cabe no limite do app nas cenas mais pesadas', () => {
  const parada = { andando: false, desde: T, dist0: 500 }
  const luta = (papel: string, monstro: string, golpes: { at: number; ok: boolean; dano: number }[], extra = {}) =>
    ({ n: 1, papel, monstro, t0: T, ativas: 0, golpes, fecha: Math.max(...golpes.map(g => g.at)) + 1500, ...extra })
  const malakor = { ...novoChefao(9, 'lista', T - 9000, { total: 3, feitas: 0 }), vida: 0, golpe: { at: T + 300, antes: 1 }, caiu: T + 3060 }
  const estados = [
    { caminho: { andando: true, desde: T - 5000, dist0: 300 } },
    { luta: luta('web', 'nebula', [{ at: T + 900, ok: true, dano: 31 }]) },
    { luta: { n: 2, papel: 'web', monstro: 'leviata', t0: T, ativas: 1, golpes: [] } },
    { chefao: malakor, luta: luta('integracao', 'malakor', [{ at: T + 300, ok: true, dano: 9 }], { fixo: true, final: true }) },
    { luta: luta('elite', 'golem_obsidiana', [{ at: T + 300, ok: true, dano: 21 }], { trofeu: 'STRING TO REPLACE NOT F…' }) },
  ]
  for (const bioma of ['floresta', 'ruinas', 'mar', 'vulcao', 'torre', 'aurora', 'castelo_vidro', 'ceu_estelar', 'eclipse']) {
    for (const W of [508, 760, 958]) {
      for (const e of estados) {
        const vista = { agora: T, W, escala: 2, modo: 'compacto', caminho: parada, hud: hud(2), botoes: true, bioma, ...e } as Parameters<typeof montar>[0]
        const { svg, fundo, frente } = montar(vista)
        // o Svg único (editor, celular, modo quadro): se passar, o mod refaz com
        // os mesmos cortes do register (economia, sem assinatura, leve); algum cabe
        const cortes = [{ economia: true }, { economia: true, semAssinatura: true }, { economia: true, semAssinatura: true, textoLongo: false, semBaloes: true, semFonteLonga: true }]
        let unico = svg
        for (const c of cortes) {
          if (unico.length < 129000) {
            break
          }
          unico = montar({ ...vista, ...c } as Parameters<typeof montar>[0]).svg
        }
        expect(unico.length).toBeLessThan(129000)
        expect(svg).toContain(bioma === 'floresta' ? '#meio' : `#b_${bioma}_chao`)
        // desktop: cenário e frente em dois Svg, cada um abaixo do teto codificado
        // (~124 mil; recusa de ~127 mil para cima), com 14 mil de folga. A Torre
        // é a mais pesada (~100 mil com vapor, ponteiros e lanternas)
        expect(tamanhoNoApp(fundo)).toBeLessThan(110000)
        expect(tamanhoNoApp(frente)).toBeLessThan(110000)
        expect(fundo).toContain(bioma === 'floresta' ? '#meio' : `#b_${bioma}_chao`)
        expect(frente).not.toContain(bioma === 'floresta' ? '#meio' : `#b_${bioma}_chao`)
      }
    }
  }
})
