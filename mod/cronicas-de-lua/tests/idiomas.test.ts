import { expect, test } from 'claude-code/testing'

import { JORNADA, NOME_CHEFAO } from '../hooks/chefao'
import { ABAS, FEITICOS, NOME_TROFEU } from '../hooks/livro'
import { chaves, idioma, t, tp } from '../hooks/t'

test('t troca os marcadores e tp escolhe o plural', () => {
  expect(idioma()).toBe('pt-BR')
  expect(t('barras.selo.titulo', { nivel: 7 })).toBe('Nível 7')
  expect(tp('barras.xp.chefao_vida', 1)).toBe('O chefão cai em 1 vitória.')
  expect(tp('barras.xp.chefao_vida', 3)).toBe('O chefão cai em 3 vitórias.')
  // chave que não existe aparece como ela mesma (fácil de achar na tela)
  expect(t('nao.existe')).toBe('nao.existe')
})

test('todo texto do padrão existe e os nomes montados por código têm chave', () => {
  expect(chaves().length).toBeGreaterThan(200)
  expect(chaves().every(k => t(k) !== '')).toBe(true)
  for (const n of JORNADA) {
    expect(NOME_CHEFAO[n]).not.toBe(`chefoes.${n}`)
  }
  expect(Object.keys(NOME_CHEFAO)).toEqual([...JORNADA])
  for (const tipo of ['comando', 'edicao', 'leitura', 'web'] as const) {
    expect(NOME_TROFEU[tipo].startsWith('livro.')).toBe(false)
  }
  for (const f of FEITICOS) {
    expect(f.nome.startsWith('livro.')).toBe(false)
    expect(f.desc.startsWith('livro.')).toBe(false)
  }
  expect(ABAS.map(a => a.nome)).toEqual(['Ficha', 'Bestiário', 'Troféus', 'Grimório'])
})
