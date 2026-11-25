import { expect, mock, test } from 'claude-code/testing'

import { JORNADA, NOME_CHEFAO } from '../hooks/chefao'
import { ABAS, FEITICOS, NOME_TROFEU } from '../hooks/livro'
import { SUBCOMANDOS } from '../hooks/register'
import { chaves, codigoDe, idioma, idiomaDoSistema, t, tp } from '../hooks/t'

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
  expect(ABAS.map(a => a.nome)).toEqual(['Ficha', 'Mapa', 'Bestiário', 'Troféus', 'Grimório'])
})

const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as const

test('/cronicas language: lista os 8 idiomas e troca entre eles', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  const guardado = mock.store(on, { jogo: { xp: 0, paginas: 0, lutas: 0 }, ajustes: { abertura: false } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 1000, percent: 1 }, rateLimits: [] } }))
  on('env.get', (_, e) => ({ value: e.name === 'LANG' ? 'pt_BR.UTF-8' : undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const rodar = async (args: string) => String((await $.command.run({ command: 'cronicas', args, ...CMD }))?.text ?? '')

  const lista = await rodar('language')
  expect(lista).toContain('Idioma do jogo: Português.')
  expect(lista).toContain('▸ Português (pt-BR)')
  for (const nome of ['English', 'Español', 'Français', 'Deutsch', '中文', '日本語', '한국어']) {
    expect(lista).toContain(nome)
  }
  expect(lista).toContain('  English (en)\n')
  expect(lista).toContain('  Español (es)\n')
  // os 8 idiomas já têm tradução: nenhum aparece como "em breve"
  expect(lista).not.toContain('em breve')
  expect(lista).toContain('  日本語 (ja)\n')
  expect(await rodar('idioma klingon')).toContain('Não conheço o idioma "klingon".')
  // espanhol, francês e alemão já respondem no próprio idioma
  expect(await rodar('lang es')).toBe('Idioma cambiado a Español.')
  expect(await rodar('lang fr')).toBe('Langue changée : Français.')
  expect(await rodar('lang de')).toBe('Sprache gewechselt zu Deutsch.')
  // chinês, japonês e coreano (Fusion Pixel no desenho)
  expect(await rodar('lang zh')).toBe('语言已切换为 中文。')
  expect(await rodar('lang ja')).toBe('言語を 日本語 に変えました。')
  expect(await rodar('lang ko')).toBe('언어를 한국어(으)로 바꿨어요.')
  expect(await rodar('idioma português')).toBe('Idioma trocado para Português.')
  expect(await rodar('language auto')).toBe('Idioma do sistema: Português.')
  void guardado
})

test('o idioma pelo que se digita ou pelo sistema; desconhecido, inglês', () => {
  expect(codigoDe('pt_BR.UTF-8')).toBe('pt-BR')
  expect(codigoDe('pt-PT')).toBe('pt-BR')
  expect(codigoDe('es-MX')).toBe('es')
  expect(codigoDe('zh')).toBe('zh-CN')
  expect(codigoDe('日本語')).toBe('ja')
  expect(codigoDe('Français')).toBe('fr')
  expect(codigoDe('C')).toBeUndefined()
  expect(codigoDe('xx')).toBeUndefined()
  // a primeira variável que diz um idioma vale (LC_ALL, LC_MESSAGES, LANG, LANGUAGE)
  expect(idiomaDoSistema([undefined, 'C', 'pt_BR.UTF-8'])).toBe('pt-BR')
  expect(idiomaDoSistema([undefined, undefined, 'de_DE.UTF-8'])).toBe('de')
  expect(idiomaDoSistema([undefined, undefined, 'ja_JP.UTF-8'])).toBe('ja')
  expect(idiomaDoSistema([undefined, undefined, 'ko_KR.UTF-8'])).toBe('ko')
  expect(idiomaDoSistema([undefined, undefined, 'zh_CN.UTF-8'])).toBe('zh-CN')
  expect(idiomaDoSistema([])).toBe('en')
})

test('subcomandos em inglês funcionam igual aos portugueses', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 0, paginas: 0, lutas: 0 }, ajustes: { abertura: false } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 1000, percent: 1 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const rodar = async (args: string) => String((await $.command.run({ command: 'cronicas', args, ...CMD }))?.text ?? '')

  expect(await rodar('ruler')).toContain('Régua ligada')
  expect(await rodar('regua')).toBe('Régua desligada.')
  expect(await rodar('boss vespera')).toBe('Vespera entrou em cena (página 1/10). Use /cronicas golpe para tirar vida.')
  expect(await rodar('Hit')).toBe('Golpe! Vida 2/3.')
  expect(await rodar('golpe')).toBe('Golpe! Vida 1/3.')
  expect(await rodar('scale 2')).toContain('escala 2x')
  expect(await rodar('new-moon')).toBe(await rodar('lua-nova'))
  // todo nome em inglês aponta para um subcomando que existe
  for (const pt of Object.values(SUBCOMANDOS)) {
    expect(['superficies', 'escala', 'coluna', 'largura', 'quadro', 'imagem', 'teste', 'prova', 'linha', 'regua', 'chefao', 'golpe', 'vigilia', 'lua-nova']).toContain(pt)
  }
})

test('em inglês: o jogo responde e nomeia os chefões em inglês; a escolha vale na sessão seguinte', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 0, paginas: 0, lutas: 0 }, ajustes: { abertura: false } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 1000, percent: 1 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const rodar = async (args: string) => String((await $.command.run({ command: 'cronicas', args, ...CMD }))?.text ?? '')

  expect(await rodar('language en')).toBe('Language changed to English.')
  expect(await rodar('boss relojoeiro')).toBe('Clockmaker entered the stage (page 6/10). Use /cronicas hit to take health away.')
  expect(await rodar('hit')).toBe('Hit! Health 2/3.')
  // nova sessão: a escolha guardada continua valendo
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(await rodar('language')).toContain('▸ English (en)')
  expect(await rodar('idioma pt')).toBe('Idioma trocado para Português.')
})
