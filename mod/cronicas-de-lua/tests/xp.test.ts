import { expect, test } from 'claude-code/testing'
import { xpDoChefao, novoChefao } from '../hooks/chefao'
import { xpDaFerramenta } from '../hooks/luta'

test('XP pelo tamanho da vitória: comum 2, demorada 4, subagente 6', () => {
  expect(xpDaFerramenta('terminal', false)).toBe(2)
  expect(xpDaFerramenta('terminal', true)).toBe(4)
  expect(xpDaFerramenta('subagente', false)).toBe(6)
})

test('chefão dá XP pela força, com teto de 60% do nível (não sobe o nível sozinho)', () => {
  const vespera = novoChefao(0, 'lista', 0, { total: 2, feitas: 0 })
  // página 1, 2 tarefas: 20 + 10 + 10 + 10 = 50
  expect(xpDoChefao(vespera, 1000, 0)).toBe(50)
  // teto: 60% de 50 = 30
  expect(xpDoChefao(vespera, 50, 0)).toBe(30)
  // Novo Jogo+ (depois de Malakor): 1,5 vez
  expect(xpDoChefao(vespera, 1000, 10)).toBe(75)
})
