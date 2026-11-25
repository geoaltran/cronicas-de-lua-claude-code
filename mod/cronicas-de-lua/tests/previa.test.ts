import { expect, test } from 'claude-code/testing'
import { previaDoChefao } from '../hooks/luta'

/** Simula uma sessão de lutas comuns: em quais o chefão da página entra. */
function sessao(chefao: string, agora: number, lutas = 400): number[] {
  const viu: number[] = []
  for (let n = 1; n <= lutas; n++) {
    if (previaDoChefao(n, agora + n * 20_000, chefao, viu[viu.length - 1])) {
      viu.push(n)
    }
  }
  return viu
}

test('prévia do chefão: perto de 1 luta em 4, nunca em lutas seguidas', () => {
  for (const agora of [1_800_000_000_000, 1_800_000_123_000, 1_812_345_678_000]) {
    const viu = sessao('leviata', agora)
    expect(viu.length).toBeGreaterThan(400 * 0.12)
    expect(viu.length).toBeLessThan(400 * 0.3)
    for (let i = 1; i < viu.length; i++) {
      expect((viu[i] as number) - (viu[i - 1] as number)).toBeGreaterThanOrEqual(3)
    }
  }
})

test('prévia do chefão: sessões diferentes sorteiam lutas diferentes', () => {
  expect(sessao('ignis', 1_800_000_000_000).join()).not.toBe(sessao('ignis', 1_800_000_777_000).join())
})

test('o Malakor nunca entra numa luta comum: ele só aparece como chefe final', () => {
  expect(sessao('malakor', 1_800_000_000_000)).toEqual([])
})
