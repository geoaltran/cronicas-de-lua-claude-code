import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, SessionContextUsage, SessionRateLimit, Timer } from 'claude-code'

import type { AbaDoLivro, Botoes, Caminho, Chefao, Elite, Golpe, Hud, Jogo, Luta, Lutas, Passagem, TipoTrofeu } from '../types'
import { ABAS, LARGURA_MIN as LARGURA_LIVRO, paginaDoLivro } from './livro'
import { BORDA_APAGADO, COR_CLAUDE, ICONE_H, ICONE_W, iconeBotao } from './icones'
import { ABERTURA, BOTOES, FIM_ABERTURA, FIM_PASSAGEM, PASSAGEM, biomaDaPagina, biomaDe, LARGURA_MAX, LARGURA_MIN, alturaCena, faseAbertura, type Alvo, type EstadoBotoes, type NomeBotao, andandoAgora, balaoSolto, distancia, luar, medidaBalaoSolto, montar, nivelDe, regua, tamanhoNoApp } from './cena'
import { type Pedaco, linhaAcao, linhaHud } from './texto'
import { LINGUAS, codigoDe, idioma, idiomaDoSistema, nomeDaLingua, t as tx, temTraducao, tp, usarIdioma } from './t'
import { type Atualizacao, CMD_ATUALIZAR, CMD_CATALOGO, URL_VERSAO, versaoDeTeste, versaoDoJson, versaoNova } from './atualizacao'
import { DEMORADA_MS, ELITE, ELITE_XP, ENTRA, JUNTA_MS, PREVIA, TIPOS_TROFEU, alvoDe, danoDe, lutaDaVez, marcos, nomeDoErro, papelDe, personagemDe, previaDoChefao, quandoAcerta, roteiro, tipoTrofeu, xpDaFerramenta } from './luta'
import { A_CADA, JORNADA, NOME_CHEFAO, QUEDA_MS, chefaoPeloNome, crescer, critico, defesa, ferir, lerTarefas, novoChefao, paginasNoCiclo, proximoChefao, vidaEmTarefas, xpDoChefao } from './chefao'

const PLUGIN = 'cronicas-de-lua'
/** O app desenha SVG de até 131.072 caracteres; uma margem para não arriscar. */
// O app documenta 131.072 caracteres (crus): vale para o Svg único (editor, celular,
// modo quadro). No desktop (prova de 24/11/2026) o teto real vale para o Svg
// CODIFICADO como endereço (encodeURIComponent: base64, aspas, espaços e <> viram
// 3 letras): recusa de ~128 mil para cima. Por isso lá a cena vai em dois Svg
// (cenário atrás, frente por cima), cada um medido codificado, até 124 mil.
const LIMITE_SVG = 129_000
const LIMITE_CODIFICADO = 124_000

const JOGO0: Jogo = { xp: 0, paginas: 0, lutas: 0 }
const HUD0: Hud = { luz: null, mana: {}, mochila: null, jogo: JOGO0 }
const CAMINHO0: Caminho = { andando: false, desde: 0, dist0: 0 }
const LUTAS0: Lutas = { lista: [], vezes: {}, n: 0 }

/** /cronicas passear: quantos segundos a Lua anda (padrão e máximo). */
const PASSEIO_S = 8
const PASSEIO_MAX = 120
/** Os biomas na ordem da jornada (a floresta guarda as duas primeiras páginas). */
const ORDEM_BIOMAS = Array.from({ length: 10 }, (_, k) => biomaDaPagina(k)).filter((b, k, l) => l.indexOf(b) === k)

/** O bioma pelo nome digitado (a chave ou o nome no idioma, com ou sem acento, só o começo). */
function biomaPeloNome(texto: string): string | undefined {
  const limpa = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, '')
  const q = limpa(texto)
  const nomes = (b: string) => [b, tx(`chefao.biomas.${b}`), ...(BIOMAS_EN[b] ?? [])].map(limpa)
  return q === '' ? undefined : ORDEM_BIOMAS.find(b => nomes(b).some(n => n.startsWith(q)))
}

/** Nomes em inglês dos biomas, que valem em qualquer idioma (como os subcomandos). */
const BIOMAS_EN: Readonly<Record<string, readonly string[]>> = {
  floresta: ['forest'],
  ruinas: ['ruins'],
  mar: ['sea'],
  vulcao: ['volcano'],
  torre: ['tower', 'clock tower'],
  aurora: ['dawn'],
  castelo_vidro: ['castle', 'glass castle'],
  ceu_estelar: ['sky', 'starry sky'],
  eclipse: ['eclipse'],
}

// Mude a etiqueta quando o formato mudar: o valor antigo (que sobrevive ao
// recarregar o mod) passa a ser lido como o inicial.
const caminho = atom({ plugin: 'cronicas-de-lua', key: 'caminho' } as const, CAMINHO0, { shape: 'caminho-2' })
const lutas = atom({ plugin: 'cronicas-de-lua', key: 'lutas' } as const, LUTAS0, { shape: 'lutas-1' })
const turno = atom({ plugin: 'cronicas-de-lua', key: 'turno' } as const, false)
const hud = atom({ plugin: 'cronicas-de-lua', key: 'hud' } as const, HUD0, { shape: 'hud-1' })
const tique = atom({ plugin: 'cronicas-de-lua', key: 'tique' } as const, 0)
const confirma = atom({ plugin: 'cronicas-de-lua', key: 'confirma' } as const, false)
const chefao = atom({ plugin: 'cronicas-de-lua', key: 'chefao' } as const, null as Chefao | null, { shape: 'chefao-2' })
const ELITE0: Elite = { erros: {} }
const elite = atom({ plugin: 'cronicas-de-lua', key: 'elite' } as const, ELITE0, { shape: 'elite-1' })
const BOTOES0: Botoes = { vigilia: { ligada: false, envios: 0 }, mochila: 'nada', estandarte: 'nada', livro: false }
const botoes = atom({ plugin: 'cronicas-de-lua', key: 'botoes' } as const, BOTOES0, { shape: 'botoes-1' })
const livroAba = atom({ plugin: 'cronicas-de-lua', key: 'livroAba' } as const, 'ficha' as AbaDoLivro)
const abertura = atom({ plugin: 'cronicas-de-lua', key: 'abertura' } as const, null as number | null)
const passagem = atom({ plugin: 'cronicas-de-lua', key: 'passagem' } as const, null as Passagem | null, { shape: 'passagem-1' })
/** Bioma visitado com /cronicas fase (só para ver o cenário); null = o da página da jornada. */
const visita = atom({ plugin: 'cronicas-de-lua', key: 'visita' } as const, null as string | null)
/** Versão nova do mod publicada no GitHub (o número), ou null: estrelinha no Livro. */
const novaVersao = atom({ plugin: 'cronicas-de-lua', key: 'novaVersao' } as const, null as string | null)
/** Quantos erros de ações diferentes o elite lembra (os mais velhos saem). */
const ERROS_MAX = 20
/** Quantos troféus ficam guardados. */
const TROFEUS_MAX = 30

/** O chefão está de pé em cena (ainda não caiu). */
const dePe = (c: Chefao | null): c is Chefao => c !== null && c.caiu === undefined

/** Configuração da faixa, guardada entre sessões. */
type Ajustes = {
  escala: number
  pxColuna: number
  /** true: quadro interativo (balões no hover); false: imagem (só animação). */
  quadro: boolean
  /** Mostra os dois modos, um embaixo do outro, para comparar no app. */
  teste: boolean
  /** Mostra a régua de calibrar a largura embaixo da cena. */
  regua?: boolean
  /** Fase 4, prova técnica: áreas de hover e de clique do app por cima da cena. */
  prova?: boolean
  /** Altura de uma linha (célula) da faixa em px: as posições do app são em células. */
  pxLinha?: number
  /** px por coluna no VS Code e no celular (cada um calibra a sua régua). */
  pxColunaPor?: Partial<Record<Remota, number>>
  /** false: sem a tela de abertura (/cronicas abertura off). */
  abertura?: boolean
}

/** As superfícies que desenham a cena em Svg. Fora do desktop: sem hover, botões numa linha. */
type Sup = 'desktop' | 'vscode' | 'mobile'
type Remota = Exclude<Sup, 'desktop'>
/**
 * px por coluna fora do desktop, até a régua calibrar. O VS Code estica a
 * imagem até a largura da faixa (e a altura cresce junto): a cena tem que ser
 * desenhada na largura certa. Medido no VS Code em 22/11/2026: 647 px em 49
 * colunas. O celular ainda é palpite.
 */
const PX_COLUNA_REMOTA: Record<Remota, number> = { vscode: 13.2, mobile: 8.4 }
const pxColunaDe = (a: Ajustes, sup: Sup): number => (sup === 'desktop' ? a.pxColuna : (a.pxColunaPor?.[sup] ?? PX_COLUNA_REMOTA[sup]))
const NOME_SUP = {} as Record<Sup, string>
for (const s of ['desktop', 'vscode', 'mobile'] as const) {
  Object.defineProperty(NOME_SUP, s, { get: () => tx(`superficies.${s}`), enumerable: true })
}
/** "vscode", "celular"... no fim de um comando. */
function supDoTexto(t: string | undefined): Sup | undefined {
  const x = (t ?? '').toLowerCase()
  return x === 'vscode' || x === 'editor' ? 'vscode' : x === 'celular' || x === 'mobile' || x === 'phone' ? 'mobile' : x === 'desktop' || x === 'app' ? 'desktop' : undefined
}
// 8,9 px por coluna: medido no app desktop (85 colunas = ~752 px), com uns px de folga
// 20 px por linha: medido no app desktop (print da prova técnica, 22/11/2026)
const AJUSTES0: Ajustes = { escala: 1, pxColuna: 8.9, quadro: false, teste: false, regua: false, prova: false, pxLinha: 20 }

type $ = EngineInterface

async function lerAjustes($: $): Promise<Ajustes> {
  const v = { ...((await $.store.get('ajustes')) as Partial<Ajustes> | undefined) }
  if (v.pxLinha === 18) {
    // 18 era o palpite da 1ª prova técnica, gravado junto com os ajustes; o medido é 20
    delete v.pxLinha
  }
  return { ...AJUSTES0, ...v }
}

function manaDe(limites: readonly SessionRateLimit[]): Hud['mana'] {
  const cinco = limites.find(l => l.kind === 'five_hour')
  const sete = limites.find(l => l.kind === 'seven_day')
  return {
    cinco: cinco?.percentUsed,
    cincoRenova: cinco?.resetsAt,
    sete: sete?.percentUsed,
    seteRenova: sete?.resetsAt,
  }
}

const mochilaDe = (c: SessionContextUsage): number | null => (c.percent === undefined ? null : c.percent)

/** O progresso guardado (o mesmo para todas as sessões abertas). */
async function jogoGuardado($: $): Promise<Jogo> {
  const salvo = (await $.store.get('jogo')) as Partial<Jogo> | undefined
  return { ...JOGO0, ...(salvo ?? {}) }
}

// Uma mudança de progresso por vez nesta sessão (os ganchos correm juntos).
let filaJogo: Promise<unknown> = Promise.resolve()

/**
 * Muda o progresso (XP, páginas, lutas, troféus, grimório). O progresso é
 * compartilhado entre as sessões: cada mudança parte do que está guardado
 * agora no $.store (outra sessão pode ter ganhado XP desde a última leitura),
 * não da cópia desta sessão, e a cópia da sessão (hud.jogo) segue o resultado.
 * Antes (1.0.1) cada sessão gravava a sua cópia inteira por cima da outra.
 */
function mudarJogo($: $, fn: (j: Jogo) => Jogo): Promise<Jogo> {
  const vez = filaJogo.then(async () => {
    const novo = fn(await jogoGuardado($))
    await $.store.set('jogo', novo)
    await update($, hud, h => ({ ...h, jogo: novo }))
    return novo
  })
  filaJogo = vez.catch(() => undefined)
  return vez
}

/** Traz para esta sessão o progresso que outras sessões gravaram. */
async function sincronizarJogo($: $): Promise<void> {
  await filaJogo
  const j = await jogoGuardado($)
  const atual = (await read($, hud)).jogo
  if (JSON.stringify(j) !== JSON.stringify(atual)) {
    await update($, hud, h => ({ ...h, jogo: j }))
  }
}

/** XP para a Lua; com `tool`, conta também o feitiço no Grimório do Livro. */
async function ganharXp($: $, quanto: number, tool?: string): Promise<void> {
  const papel = tool === undefined ? undefined : papelDe(tool)
  await mudarJogo($, j => {
    const feiticos = papel === undefined ? j.feiticos : { ...(j.feiticos ?? {}), [papel]: (j.feiticos?.[papel] ?? 0) + 1 }
    return { ...j, xp: j.xp + quanto, ...(feiticos === undefined ? {} : { feiticos }) }
  })
}

/** Colunas do último desenho da faixa em cada superfície (para calibrar a largura com /cronicas largura). */
const colunasPor: Record<Sup, number> = { desktop: 0, vscode: 0, mobile: 0 }
/** A superfície que desenhou a faixa por último: é a que a /cronicas largura calibra. */
let ultimaSup: Sup = 'desktop'


// Um só alarme para "o luar acabou": redesenha a faixa (desmaio).
let alarme: Timer | undefined

async function marcarFimDoLuar($: $, restanteMs: number): Promise<void> {
  alarme?.cancel()
  alarme = $.clock.after(Math.max(0, restanteMs) + 400, () => {
    void update($, tique, n => n + 1)
  })
}

// ---------------------------------------------------------------- abertura

// A tela de abertura (marca + a Lua chegando) aparece na primeira sessão do
// dia e na primeira sessão depois que o app reinicia; /cronicas abertura
// mostra de novo; um clique na cena pula.
let alarmesAbertura: Timer[] = []

/** O README no idioma do jogo, já na seção dos comandos (a âncora que o GitHub gera do título). */
const README_COMANDOS: Readonly<Record<string, readonly [string, string]>> = {
  en: ['README.md', 'commands'],
  'pt-BR': ['README.pt-BR.md', 'comandos'],
  es: ['README.es.md', 'comandos'],
  fr: ['README.fr.md', 'commandes'],
  de: ['README.de.md', 'befehle'],
  'zh-CN': ['README.zh-CN.md', '命令'],
  ja: ['README.ja.md', 'コマンド'],
  ko: ['README.ko.md', '명령어'],
}

function readmeDosComandos(): string {
  const [arq, ancora] = README_COMANDOS[idioma()] ?? ['README.md', 'commands']
  return `https://github.com/geoaltran/cronicas-de-lua-claude-code/blob/main/${arq}#${encodeURIComponent(ancora)}`
}

/** Quanto o aviso de versão nova espera depois do começo da sessão (a faixa desenha antes). */
const ESPERA_ATUALIZACAO = 3000

/** A versão instalada (o plugin.json do próprio mod), validada; undefined se não deu para ler. */
async function versaoLocal($: $): Promise<string | undefined> {
  try {
    return versaoDoJson(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
  } catch {
    return undefined
  }
}

async function lerAtualizacao($: $): Promise<Atualizacao> {
  return { ...((await $.store.get('atualizacao')) as Atualizacao | undefined) }
}

type Conferencia = { local: string | undefined; nova: string | null; resultado: 'ok' | 'falhou' | 'bloqueado' | 'desligado' | 'hoje' }

/**
 * Aviso de versão nova: no máximo uma consulta por dia (ou agora, com `forcar`),
 * só a leitura do plugin.json público no GitHub. Ver `atualizacao.ts`.
 * O resultado acende ou apaga a estrelinha do Livro; a primeira vez que uma
 * versão nova aparece, um aviso de canto (uma vez por versão).
 */
async function conferirAtualizacao($: $, forcar: boolean, avisar: boolean): Promise<Conferencia> {
  const st = await lerAtualizacao($)
  const local = await versaoLocal($)
  if (st.desligada === true) {
    await update($, novaVersao, () => null)
    return { local, nova: null, resultado: 'desligado' }
  }
  const hoje = diaDe(await $.clock.now())
  let resultado: Conferencia['resultado'] = 'hoje'
  if (forcar || st.dia !== hoje) {
    if ((await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')) !== undefined) {
      resultado = 'bloqueado'
    } else {
      try {
        const r = await $.http.fetch(URL_VERSAO)
        const remota = r.ok ? versaoDoJson(r.text) : undefined
        if (remota === undefined) {
          resultado = 'falhou'
        } else {
          st.remota = remota
          resultado = 'ok'
        }
      } catch {
        resultado = 'falhou'
      }
      // falhou também conta como a consulta do dia (sem internet, não insiste a cada sessão)
      st.dia = hoje
    }
  }
  const nova = versaoNova(st.remota, local)
  await update($, novaVersao, () => nova)
  if (nova !== null && avisar && st.avisada !== nova) {
    $.ui.toast(tx('avisos.atualizacao', { nova }))
    st.avisada = nova
  }
  await $.store.set('atualizacao', st)
  return { local, nova, resultado }
}

/** O texto do /cronicas updates (sem argumento, check, on). */
function textoAtualizacao(c: Conferencia, st: Atualizacao): string {
  const local = c.local ?? '?'
  if (c.resultado === 'desligado') {
    return tx('comando.atualizacao.desligado', { local }) + '\n' + tx('comando.atualizacao.como')
  }
  const linhas = [
    c.nova !== null
      ? tx('comando.atualizacao.tem_nova', { nova: c.nova, local, cmd1: CMD_CATALOGO, cmd2: CMD_ATUALIZAR })
      : c.resultado === 'bloqueado'
        ? tx('comando.atualizacao.bloqueado', { local })
        : c.resultado === 'falhou'
          ? tx('comando.atualizacao.sem_resposta', { local })
          : tx('comando.atualizacao.em_dia', { local }),
  ]
  if (st.dia !== undefined && c.resultado !== 'bloqueado') {
    linhas.push(tx('comando.atualizacao.ultima', { dia: st.dia }))
  }
  linhas.push(tx('comando.atualizacao.como'))
  return linhas.join('\n')
}

/** O dia local (AAAA-MM-DD) de uma hora em ms. */
function diaDe(ms: number): string {
  const d = new Date(ms)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

/**
 * Quando o app que abriu esta sessão começou (o texto do `ps`), ou nada se não
 * der para saber. A API do mod não diz; o processo mais alto acima desta sessão
 * (abaixo do sistema) é o app: Claude, VS Code ou o terminal. Se esse começo
 * mudou desde a última abertura, o app reiniciou.
 */
async function inicioDoApp($: $): Promise<string | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(['/bin/sh', '-c', 'echo $PPID; ps -A -o pid=,ppid=,lstart='], { timeoutMs: 5000 })
    if (exitCode !== 0) {
      return undefined
    }
    const [primeira, ...resto] = stdout.trim().split('\n')
    const pai = new Map<number, { ppid: number; inicio: string }>()
    for (const l of resto) {
      const m = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(l)
      if (m !== null) {
        pai.set(Number(m[1]), { ppid: Number(m[2]), inicio: m[3] ?? '' })
      }
    }
    let pid = Number(primeira)
    let topo: string | undefined
    for (let i = 0; i < 40; i++) {
      const p = pai.get(pid)
      if (p === undefined || p.ppid <= 1) {
        topo = p?.inicio ?? topo
        break
      }
      topo = p.inicio
      pid = p.ppid
    }
    return topo
  } catch {
    return undefined
  }
}

async function abrirAbertura($: $, app?: string): Promise<void> {
  const agora = await $.clock.now()
  for (const t of alarmesAbertura) {
    t.cancel()
  }
  await update($, abertura, () => agora)
  alarmesAbertura = [
    // fase 2 (a floresta e a Lua) é um redesenho novo
    $.clock.after(ABERTURA.fase2 + 20, () => {
      void update($, tique, n => n + 1)
    }),
    $.clock.after(FIM_ABERTURA + 20, () => {
      void update($, abertura, () => null)
    }),
  ]
  await $.store.set('aberturaDia', diaDe(agora))
  if (app !== undefined) {
    await $.store.set('aberturaApp', app)
  }
}

// ---------------------------------------------------------------- passagem de fase

let alarmesPassagem: Timer[] = []

/**
 * O chefão caiu e saiu de cena em `at`: a jornada passa do bioma dele para o
 * da próxima página (a Lua sai andando, escurece, o bioma novo clareia com o
 * título e ela entra pela esquerda). Dois redesenhos, marcados no relógio.
 */
async function comecarPassagem($: $, ch: Chefao | null, at: number, destino?: Omit<Passagem, 'at'>): Promise<void> {
  const agora = await $.clock.now()
  if (agora >= at + FIM_PASSAGEM) {
    return
  }
  const h = await read($, hud)
  const de = destino?.de ?? biomaDe({ agora: ch?.caiu ?? at, hud: h, ...(ch === null ? {} : { chefao: ch }) })
  const para = destino?.para ?? biomaDe({ agora, hud: h })
  const pagina = destino?.pagina ?? (h.jogo.paginas % 10) + 1
  for (const t of alarmesPassagem) {
    t.cancel()
  }
  await update($, passagem, () => ({ at, de, para, pagina }))
  alarmesPassagem = [
    // a entrada (o bioma novo) é um redesenho novo
    $.clock.after(Math.max(0, at + PASSAGEM.saida - agora) + 20, () => {
      void update($, tique, n => n + 1)
    }),
    $.clock.after(at + FIM_PASSAGEM - agora + 20, () => {
      void update($, passagem, () => null)
    }),
  ]
}

async function pularAbertura($: $): Promise<void> {
  for (const t of alarmesAbertura) {
    t.cancel()
  }
  alarmesAbertura = []
  await update($, abertura, () => null)
}

/**
 * Durante a abertura, a cena inteira vira um botão invisível (uma linha de
 * botões por linha da faixa, cada um esticado na largura): um clique pula.
 */
function areaDePular($: $, els: Elementos, a: Ajustes, colunas: number) {
  const { Box, Button } = els
  const linhas = Math.ceil((alturaCena('compacto') * a.escala) / (a.pxLinha ?? 20))
  const estilo = { color: INVISIVEL, backgroundColor: INVISIVEL }
  return (
    <Box key="pular" position="absolute" top={0} left={0} width={colunas} height={linhas} flexDirection="column">
      {Array.from({ length: linhas }, (_, i) => (
        <Button key={`pula_${i}`} plain label={ROTULO_INVISIVEL} hover={estilo} onPress={() => pularAbertura($)} />
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------- lutas

/**
 * Uma ferramenta começou: entra na luta aberta, ou começa uma nova (agora, ou
 * logo depois da que está acabando). Devolve o número da luta.
 */
function entrar(s: Lutas, agora: number, tool: string, ch: Chefao | null = null, trofeu?: string, trofeuTipo?: TipoTrofeu, daPagina?: string): { s: Lutas; n: number; nova: Luta | null } {
  // as que já acabaram ficam na lista até revisar() tirá-las (e devolver o caminho à Lua)
  const vivas = s.lista.filter(l => (roteiro(l).fim ?? Infinity) > agora)
  const ult = vivas[vivas.length - 1]
  if (ult !== undefined && ult.fecha === undefined) {
    return { s: { ...s, lista: s.lista.map(l => (l.n === ult.n ? { ...l, ativas: l.ativas + 1 } : l)) }, n: ult.n, nova: null }
  }
  const papel = papelDe(tool)
  const t0 = ult === undefined ? agora : Math.max(agora, roteiro(ult).fim ?? agora)
  if (dePe(ch)) {
    // com o chefão em cena, a ferramenta vira um golpe nele
    const nova: Luta = { n: s.n + 1, papel, monstro: ch.nome, t0, ativas: 1, golpes: [], fixo: true }
    return { s: { ...s, lista: [...s.lista, nova], n: nova.n }, n: nova.n, nova }
  }
  if (trofeu !== undefined) {
    // um erro foi consertado: esta luta é o elite, com o nome do erro como troféu
    const nova: Luta = { n: s.n + 1, papel: 'elite', monstro: ELITE, t0, ativas: 1, golpes: [], trofeu, trofeuTipo: trofeuTipo ?? 'edicao' }
    return { s: { ...s, lista: [...s.lista, nova], n: nova.n }, n: nova.n, nova }
  }
  const n = s.n + 1
  if (daPagina !== undefined && previaDoChefao(n, agora, daPagina, s.vezes[PREVIA])) {
    // de vez em quando o chefão da página aparece numa luta comum, como prévia do que vem
    const nova: Luta = { n, papel, monstro: daPagina, t0, ativas: 1, golpes: [] }
    return { s: { lista: [...s.lista, nova], vezes: { ...s.vezes, [PREVIA]: n }, n }, n, nova }
  }
  const vez = s.vezes[papel] ?? 0
  const nova: Luta = { n, papel, monstro: personagemDe(papel, vez), t0, ativas: 1, golpes: [] }
  return { s: { lista: [...s.lista, nova], vezes: { ...s.vezes, [papel]: vez + 1 }, n }, n, nova }
}

function golpear(s: Lutas, n: number, g: Golpe): Lutas {
  return { ...s, lista: s.lista.map(l => (l.n === n ? { ...l, ativas: Math.max(0, l.ativas - 1), golpes: [...l.golpes, g] } : l)) }
}

/** Fecha as lutas sem ferramenta rodando: no instante dado, ou 1,5 s depois do último golpe. */
function decidir(s: Lutas, agora: number, ja: boolean): Lutas {
  return {
    ...s,
    lista: s.lista.map(l => {
      if (l.fecha !== undefined || l.ativas > 0 || l.golpes.length === 0) {
        return l
      }
      const ult = Math.max(...l.golpes.map(g => g.at))
      if (ja) {
        return { ...l, fecha: Math.max(ult, agora) }
      }
      return agora >= ult + JUNTA_MS ? { ...l, fecha: ult + JUNTA_MS } : l
    }),
  }
}

let alarmeLuta: Timer | undefined

/** Um chefão entra em cena (se não há outro): a Lua para quando ele chega. */
async function chamarChefao($: $, origem: Chefao['origem'], tarefas?: Chefao['tarefas'], escolhido?: string, trocar = false): Promise<boolean> {
  const agora = await $.clock.now()
  const [atual, estado, ls] = await Promise.all([read($, chefao), read($, hud), read($, lutas)])
  if (atual !== null && !trocar) {
    return false
  }
  if (atual !== null && tarefas === undefined && dePe(atual) && atual.origem === 'lista') {
    // trocado pelo comando no meio de uma lista de verdade: o novo herda as tarefas
    origem = 'lista'
    tarefas = atual.tarefas
  }
  await update($, chefao, () => novoChefao(estado.jogo.paginas, origem, agora, tarefas, escolhido))
  // o chefão traz o bioma dele: a visita do /cronicas fase acaba
  await update($, visita, () => null)
  if (lutaDaVez(ls.lista, agora) === undefined) {
    await update($, caminho, c => (c.andando ? { ...c, ate: agora + ENTRA } : c))
  }
  return true
}

/** O que um golpe fez com o chefão: a vida antes e depois (em pontos), e se ele caiu. */
type Ferida = { antes: number; depois: number; caiu: boolean }

/**
 * Tira vida do chefão (`at`: quando o golpe acerta). Se ele cai: a luta `n`
 * (golpe no chefão) vira a final (ele se desfaz nela), a página é recuperada
 * e a Lua sobe de nível.
 */
async function ferirChefao($: $, vida: (c: Chefao) => number, n?: number, at?: number): Promise<Ferida | null> {
  const agora = await $.clock.now()
  let antes: Chefao | null = null
  let depois: Chefao | null = null
  await update($, chefao, c => {
    antes = c
    depois = dePe(c) ? ferir(c, vida(c), agora, at ?? agora) : c
    return depois
  })
  const a = antes as Chefao | null
  const b = depois as Chefao | null
  if (a === null || b === null || a.caiu !== undefined) {
    return null
  }
  const ferida: Ferida = { antes: a.vida, depois: b.vida, caiu: b.caiu !== undefined }
  if (b.caiu === undefined) {
    return ferida
  }
  if (n !== undefined) {
    await update($, lutas, s => ({ ...s, lista: s.lista.map(l => (l.n === n && l.fixo === true ? { ...l, final: true } : l)) }))
  }
  await mudarJogo($, j => ({ ...j, paginas: j.paginas + 1, xp: j.xp + xpDoChefao(a, nivelDe(j.xp).precisa, j.paginas) }))
  return ferida
}

/**
 * Põe a luta em dia: decide as que esperaram o bastante, tira as que acabaram
 * (a Lua volta a andar se o Claude ainda trabalha) e marca o próximo redesenho.
 */
async function revisar($: $, turnoAcabou = false): Promise<void> {
  const agora = await $.clock.now()
  let antes: Lutas = LUTAS0
  let depois: Lutas = LUTAS0
  await update($, lutas, s => {
    antes = s
    const dec = decidir(s, agora, turnoAcabou)
    depois = { ...dec, lista: dec.lista.filter(l => (roteiro(l).fim ?? Infinity) > agora) }
    return depois
  })
  // vitórias novas: as comuns contam lutas (o chefão vem a cada 12); os golpes
  // no chefão que veio pelas lutas tiram vida dele
  const ganhas = depois.lista.filter(l => l.fecha !== undefined && antes.lista.some(a => a.n === l.n && a.fecha === undefined) && roteiro(l).desfecho?.tipo === 'vitoria')
  const vitorias = ganhas.filter(l => l.fixo !== true).length
  if (vitorias > 0) {
    const jogo = await mudarJogo($, j => ({ ...j, lutas: j.lutas + vitorias }))
    if (Math.floor(jogo.lutas / A_CADA) > Math.floor((jogo.lutas - vitorias) / A_CADA)) {
      await chamarChefao($, 'lutas')
    }
  }
  const elites = ganhas.filter(l => l.trofeu !== undefined)
  if (elites.length > 0) {
    await mudarJogo($, j => {
      const antes = j.trofeus ?? []
      const tiposAntes = antes.map((_, i) => j.trofeusTipos?.[i] ?? 'edicao')
      const trofeus = [...elites.map(l => l.trofeu as string), ...antes].slice(0, TROFEUS_MAX)
      const trofeusTipos = [...elites.map(l => l.trofeuTipo ?? 'edicao'), ...tiposAntes].slice(0, TROFEUS_MAX)
      return { ...j, trofeus, trofeusTipos, xp: j.xp + ELITE_XP * elites.length }
    })
  }
  for (const l of ganhas.filter(g => g.fixo === true && g.comando !== true)) {
    const ch = await read($, chefao)
    if (dePe(ch) && ch.origem === 'lutas') {
      await ferirChefao($, c => c.vida - 1, l.n)
    }
  }
  // a luta final se decidiu: o chefão cai quando ela termina de se desfazer
  const final = (await read($, lutas)).lista.find(l => l.final === true)
  const dz = final === undefined ? undefined : roteiro(final).desfecho?.d
  let ch = await read($, chefao)
  if (ch !== null && ch.caiu !== undefined && dz !== undefined && ch.caiu !== dz) {
    await update($, chefao, c => (c === null ? c : { ...c, caiu: dz }))
    ch = await read($, chefao)
  }
  if (ch !== null && ch.caiu !== undefined && final === undefined && agora >= ch.caiu + QUEDA_MS) {
    await update($, chefao, () => null)
    await comecarPassagem($, ch, ch.caiu + QUEDA_MS)
    ch = null
  }
  const presente = dePe(ch)
  // a luta da vez acabou: a Lua retoma o caminho de onde parou
  const acabou = antes.lista.filter(l => !depois.lista.some(d => d.n === l.n))
  if (acabou.length > 0) {
    const fim = Math.max(...acabou.map(l => roteiro(l).fim ?? agora))
    const prox = depois.lista[0]
    const trabalhando = await read($, turno)
    await update($, caminho, c => {
      const d = distancia(c, fim)
      // com o chefão em cena, a Lua fica parada diante dele
      const base: Caminho = { andando: trabalhando && !presente, desde: fim, dist0: d }
      return prox !== undefined && trabalhando && !presente ? { ...base, ate: prox.t0 + ENTRA } : base
    })
  }
  // próximo instante que interessa
  const futuros: number[] = []
  for (const l of depois.lista) {
    futuros.push(...marcos(l))
    if (l.fecha === undefined && l.ativas === 0 && l.golpes.length > 0) {
      futuros.push(Math.max(...l.golpes.map(g => g.at)) + JUNTA_MS)
    }
  }
  if (ch !== null && ch.caiu !== undefined) {
    futuros.push(ch.caiu + QUEDA_MS + 50)
  }
  const prox = Math.min(...futuros.filter(t => t > agora))
  alarmeLuta?.cancel()
  alarmeLuta = undefined
  proximoMarco = Number.isFinite(prox) ? prox : null
  if (Number.isFinite(prox)) {
    alarmeLuta = $.clock.after(prox - agora + 20, () => {
      void marcoChegou($)
    })
  }
  if (proximoMarco !== null) {
    baterPulso($)
  }
}

/** O instante do próximo redesenho da luta (null: nada marcado). */
let proximoMarco: number | null = null
/** Quanto o redesenho de um marco pode atrasar antes que o pulso o faça. */
const ATRASO_MAX = 600
const PULSO_MS = 1000
let pulso: Timer | undefined

/**
 * Um marco da luta chegou: redesenha (a cena só leva as poses da Lua até o
 * próximo marco) e põe a luta em dia. O redesenho vem antes, para a Lua não
 * ficar parada se o revisar falhar.
 */
async function marcoChegou($: $): Promise<void> {
  await update($, tique, n => n + 1)
  try {
    await revisar($)
  } catch {
    // o pulso tenta de novo
  }
}

/**
 * Rede de segurança durante lutas e chefões. Cada redesenho da luta leva só
 * as poses da Lua até o próximo marco; se o alarme do marco se perde (o mod
 * recarregou ou foi instalado no meio da sessão, o app recusou o alarme, um
 * revisar falhou), o monstro continua a animação dele e a Lua fica parada
 * respirando, sem atacar nem seguir viagem (bug relatado em 24/11/2026). O
 * pulso confere uma vez por segundo e, se o marco passou sem redesenho, faz
 * o redesenho. Para sozinho quando não há marco marcado.
 */
function baterPulso($: $): void {
  if (pulso !== undefined) {
    return
  }
  pulso = $.clock.every(PULSO_MS, () => {
    void (async () => {
      const agora = await $.clock.now()
      if (proximoMarco === null) {
        pulso?.cancel()
        pulso = undefined
        return
      }
      if (proximoMarco !== null && agora > proximoMarco + ATRASO_MAX) {
        await marcoChegou($)
      }
    })().catch(() => undefined)
  })
}

/**
 * Ferramentas de lista de tarefas: chamam o chefão, ou tiram vida dele a cada
 * tarefa concluída (a vida desce até o fim do bloco). Devolve o que o golpe fez.
 */
async function lista($: $, tool: string, input: unknown, n: number, at?: number): Promise<Ferida | null> {
  const ch = await read($, chefao)
  const doChefao = dePe(ch) && ch.origem === 'lista' ? ch.tarefas : null
  const t = lerTarefas(tool, input, doChefao)
  if (t === null) {
    return null
  }
  if (doChefao === null) {
    if (ch === null && t.total > t.feitas) {
      await chamarChefao($, 'lista', t)
    }
    return null
  }
  // cada tarefa concluída vale 5 de XP
  const concluidas = t.feitas - doChefao.feitas
  if (concluidas > 0) {
    await ganharXp($, 5 * concluidas)
  }
  // tarefas novas na lista: o chefão ganha um bloco de vida por tarefa (sem golpe)
  await update($, chefao, c => (dePe(c) ? crescer(c, t) : c))
  const f = await ferirChefao($, c => (t.total - t.feitas) * c.bloco, n, at)
  return f !== null && f.depois < f.antes ? f : null
}

/**
 * O que um golpe (ferramenta que voltou bem) fez num chefão: a tarefa
 * concluída desce a vida até o fim do bloco (a última é crítico); um golpe
 * comum no chefão de lista bate no escudo e tira pouco. Marca o golpe na luta.
 */
async function golpeNoChefao($: $, tool: string, input: unknown, n: number, at: number, dano: number): Promise<void> {
  const l = (await read($, lutas)).lista.find(x => x.n === n)
  const acerto = l === undefined ? at : quandoAcerta(l, at)
  let marca: Partial<Golpe> | null = null
  const f = await lista($, tool, input, n, acerto)
  if (f !== null) {
    marca = f.caiu ? { critico: critico(f.antes, dano) } : { tarefa: f.antes - f.depois }
  } else if (l?.fixo === true) {
    const ch = await read($, chefao)
    if (dePe(ch) && ch.origem === 'lista') {
      const tira = defesa(ch, dano)
      if (tira > 0) {
        await ferirChefao($, c => c.vida - tira, n, acerto)
      }
      marca = { escudo: tira }
    }
  }
  if (marca !== null) {
    const m = marca
    await update($, lutas, s => ({ ...s, lista: s.lista.map(x => (x.n === n ? { ...x, golpes: x.golpes.map(g => (g.at === at ? { ...g, ...m } : g)) } : x)) }))
  }
}

/**
 * `/cronicas golpe`: uma luta de verdade contra o chefão, como se uma ferramenta
 * rápida tivesse voltado bem agora. A Lua ataca, o chefão pisca branco, recua e
 * treme, sai o número de dano; a vida cai quando o feitiço acerta. No chefão de
 * lista, o golpe conclui uma tarefa (a vida desce até o fim do bloco). O que
 * derruba é crítico.
 */
async function golpeDeComando($: $, ch: Chefao): Promise<void> {
  if (!dePe(ch)) {
    return
  }
  const agora = await $.clock.now()
  let n = 0
  let nova: Luta | null = null
  await update($, lutas, s => {
    // cada golpe é uma luta: fecha a que já levou golpe (a nova vem logo depois dela)
    const r = entrar(decidir(s, agora, true), agora, 'Read', ch)
    n = r.n
    nova = r.nova
    return r.nova === null ? r.s : { ...r.s, lista: r.s.lista.map(l => (l.n === r.n ? { ...l, comando: true } : l)) }
  })
  if (nova === null) {
    // uma ferramenta de verdade está lutando agora: o golpe entra nela e a vitória dela conta
    await update($, lutas, s => golpear(s, n, { at: agora + 1, ok: true, dano: DANO_COMANDO }))
    await revisar($)
    return
  }
  const comeco = nova as Luta | null
  if (comeco !== null && comeco.t0 <= agora) {
    await update($, caminho, c => (c.andando ? { ...c, ate: comeco.t0 + ENTRA } : c))
  }
  const fim = agora + 1
  const dano = DANO_COMANDO
  await update($, lutas, s => golpear(s, n, { at: fim, ok: true, dano }))
  const l = (await read($, lutas)).lista.find(x => x.n === n)
  const acerto = l === undefined ? fim : quandoAcerta(l, fim)
  let f: Ferida | null
  if (ch.origem === 'lista') {
    const t = { total: ch.tarefas.total, feitas: Math.min(ch.tarefas.total, ch.tarefas.feitas + 1) }
    await update($, chefao, c => (dePe(c) ? { ...c, tarefas: t } : c))
    f = await ferirChefao($, c => (t.total - t.feitas) * c.bloco, n, acerto)
  } else {
    f = await ferirChefao($, c => c.vida - 1, n, acerto)
  }
  const marca: Partial<Golpe> | null =
    f === null ? null : f.caiu ? { critico: critico(f.antes, dano) } : ch.origem === 'lista' ? { tarefa: f.antes - f.depois } : null
  if (marca !== null) {
    await update($, lutas, s => ({ ...s, lista: s.lista.map(x => (x.n === n ? { ...x, golpes: x.golpes.map(g => (g.at === fim ? { ...g, ...marca } : g)) } : x)) }))
  }
  await revisar($)
}

/** Dano do golpe do comando: o de uma leitura média (o número branco na cena). */
const DANO_COMANDO = 17

/**
 * Elite: guarda o erro de cada ação (ferramenta + alvo); quando a mesma ação
 * dá certo, o nome do erro vira o troféu da próxima luta comum.
 */
async function lembrarErro($: $, tool: string, input: unknown, ok: boolean, texto: string | undefined): Promise<void> {
  const alvo = alvoDe(tool, input)
  if (alvo === null) {
    return
  }
  await update($, elite, el => {
    const erros = { ...el.erros }
    if (!ok) {
      delete erros[alvo]
      erros[alvo] = nomeDoErro(texto)
      const chaves = Object.keys(erros)
      for (const k of chaves.slice(0, Math.max(0, chaves.length - ERROS_MAX))) {
        delete erros[k]
      }
      return { ...el, erros }
    }
    const nome = erros[alvo]
    if (nome === undefined) {
      return el
    }
    delete erros[alvo]
    return { erros, proximo: nome, proximoTipo: tipoTrofeu(alvo) }
  })
}

/**
 * Áreas de mouse do próprio app por cima da cena (o SVG em modo imagem não tem
 * hover): um Box com `key` em cada alvo (barra, selo), posicionado em células
 * (colunas x linhas), com o balão pixel art escondido que o hover revela, logo
 * acima do alvo e centrado nele. `visivel` desenha a borda (prova técnica).
 */
/**
 * Uma célula de texto da faixa no app mede 8,8 px, e as células começam onde a
 * cena começa (medido pelas bordas das áreas no print da 3ª prova, 22/11/2026;
 * o `pxColuna` da largura da cena tem folga e não serve aqui).
 */
const PX_CELULA = 8.8
/** Cor transparente: a borda das áreas de mouse existe (o hover precisa dela) mas não aparece. */
const INVISIVEL = '#00000000'
const DESLOC_CENA = 0

/** Posição na faixa em células (colunas x linhas), a partir de px da arte. */
function celulas(a: Ajustes) {
  const pxL = a.pxLinha ?? 20
  return {
    pxL,
    col: (px: number) => Math.round((px * a.escala + DESLOC_CENA) / PX_CELULA),
    lin: (px: number) => Math.round((px * a.escala) / pxL),
    larg: (px: number) => Math.ceil(px / PX_CELULA),
  }
}

/** Os elementos do desktop (o único que tem Svg). */
type Elementos = Extract<ReturnType<$['ui']['resolve']>, { Svg: unknown }>


/** O grupo de hover (`scope`) que liga a área de mouse de um alvo ao balão dele. */
const grupo = (t: Alvo) => `cronicas_${t.id}`

/**
 * O balão de um alvo, solto na cena (não dentro da área: o app ignora posição
 * negativa, e o balão saía da cena pela direita). Escondido; acende com o grupo
 * do alvo. Fica acima do alvo, centrado nele, e sempre dentro da cena,
 * contando o cartão que o app põe em volta.
 */
function balaoDoAlvo(els: Elementos, a: Ajustes, colunas: number, W: number, t: Alvo) {
  const { Box, Svg } = els
  const { pxL, col, lin, larg } = celulas(a)
  const m = medidaBalaoSolto(t.titulo, t.explica, a.escala, W)
  const largura = larg(m.w)
  const cena = Math.min(colunas, Math.floor((W * a.escala) / PX_CELULA))
  const left = Math.max(0, Math.min(cena - largura, col(t.x + t.w / 2) - Math.round(largura / 2)))
  // logo acima do alvo; a ponta aponta para o meio dele, onde quer que o balão tenha parado
  const top = Math.max(0, lin(t.y) - Math.ceil(m.h / pxL))
  const b = balaoSolto(t.titulo, t.explica, a.escala, W, (t.x + t.w / 2) * a.escala - left * PX_CELULA)
  return (
    <Box key={`bl_${t.id}`} position="absolute" top={top} left={left} display="none" hover={{ scope: grupo(t), display: 'flex' }}>
      <Svg source={b.svg} height={b.altura} alt={`${t.titulo}: ${t.explica.replace(/\n/g, ' ')}`} />
    </Box>
  )
}

/**
 * Áreas de mouse por cima da cena (barras e selo) e os balões delas. Cada área
 * é um Box vazio do tamanho do alvo, em células, no grupo de hover do alvo.
 * `visivel` desenha a borda (prova técnica).
 */
function areasDeHover(els: Elementos, a: Ajustes, colunas: number, W: number, alvos: readonly Alvo[], visivel: boolean) {
  const { Box } = els
  const { col, lin } = celulas(a)
  const deBarra = alvos.filter(t => !t.id.startsWith('botao_'))
  const areas = deBarra.map(t => {
    const left = col(t.x)
    const top = lin(t.y)
    // as duas bordas arredondadas para a célula mais próxima: vizinhas não se sobrepõem
    const tam = { width: Math.max(2, col(t.x + t.w) - left), height: Math.max(1, lin(t.y + t.h) - top) }
    return visivel ? (
      <Box key={`pv_${t.id}`} position="absolute" top={top} left={left} {...tam} borderStyle="single" borderColor="gray" hover={{ scope: grupo(t), borderColor: 'yellow' }} />
    ) : (
      // igual à da prova (que o app reconhece no hover), mas com a borda transparente
      <Box key={`hv_${t.id}`} position="absolute" top={top} left={left} {...tam} borderStyle="single" borderColor={INVISIVEL} hover={{ scope: grupo(t), borderColor: INVISIVEL }} />
    )
  })
  // os balões depois das áreas: ficam por cima
  return [...areas, ...deBarra.map(t => balaoDoAlvo(els, a, colunas, W, t))]
}

/**
 * Fase 4, prova técnica: as áreas de hover com borda (para ver onde caem) e os
 * 4 ícones de botão na cena, cada um com um botão do app de rótulo invisível
 * por cima (clique = aviso) e o balão do botão no hover.
 */
function provaTecnica($: $, els: Elementos, colunas: number, W: number, a: Ajustes, cena: unknown, alvos: readonly Alvo[]) {
  const { Box, Button, Text } = els
  const { pxL, lin } = celulas(a)
  const areas = areasDeHover(els, a, colunas, W, alvos, true)
  // Áreas dos ícones: um bloco contínuo, sem vão. Cada área começa na coluna à
  // esquerda do ícone e vai até a próxima; a última, até o fim do último ícone.
  // O botão do app usa fonte proporcional ("•" ≈ 6,5 px + ~14 px de recuo): o
  // rótulo tem os pontos que enchem a área. Uma linha por botão (o app ignora
  // quebra no rótulo): dois empilhados cobrem as 2 linhas do ícone.
  const icones = ['vigilia', 'mochila', 'estandarte', 'livro'].map(b => alvos.find(x => x.id === `botao_${b}`)).filter((t): t is Alvo => t !== undefined)
  const inicio = (t: Alvo) => Math.floor((t.x * a.escala) / PX_CELULA)
  const botao = (t: Alvo, i: number) => {
    const left = inicio(t)
    const prox = icones[i + 1]
    const fim = prox !== undefined ? inicio(prox) : Math.ceil(((t.x + t.w) * a.escala) / PX_CELULA)
    const largura = Math.max(2, fim - left)
    const pontos = Math.max(2, Math.round((largura * PX_CELULA - 14) / 6.5))
    // a prova usa as ações de verdade: os "•" só mostram onde a área de clique cai
    const aperta = () => apertar($, t.id.slice('botao_'.length) as NomeBotao)
    return (
      <Box key={`pb_${t.id}`} position="absolute" top={lin(t.y)} left={left} width={largura} height={2} flexDirection="column" hover={{ scope: grupo(t) }}>
        <Button key={`pv_${t.id}`} plain label={'•'.repeat(pontos)} onPress={aperta} />
        <Button key={`pv2_${t.id}`} plain label={'•'.repeat(pontos)} onPress={aperta} />
      </Box>
    )
  }
  const botoes = ['vigilia', 'mochila', 'estandarte', 'livro'].map(b => `botao_${b}`)
  return (
    <Box flexDirection="column">
      <Box position="relative">
        {cena as never}
        {areas}
        {icones.map(botao)}
        {alvos.filter(t => botoes.includes(t.id)).map(t => balaoDoAlvo(els, a, colunas, W, t))}
      </Box>
      <Text dimColor>{tx('comando.prova.rodape', { colunas, px: PX_CELULA, linha: pxL })}</Text>
    </Box>
  )
}

// ---------------------------------------------------------------- botões (Fase 4)

/** O painel do Livro. */
const LIVRO = 'livro'
/** A Vigília manda no máximo 6 mensagens por vez que é acesa; depois apaga sozinha. */
export const VIGILIA_MAX = 6
/** A mensagem curtinha da Vigília (reacende o cache), no idioma em uso. */
export const msgVigilia = (): string => tx('mensagens.vigilia')
/** O pedido do Estandarte: o resumo da missão para continuar numa sessão nova. */
export const pedidoResumo = (): string => tx('mensagens.estandarte')

/** Quanto antes de o luar acabar a Vigília manda a mensagem: 5 min (cache de 1 h) ou 1 min (cache de 5 min). */
const antecedencia = (ttlMs: number) => (ttlMs >= 1_800_000 ? 300_000 : 60_000)

async function tocar($: $, som: 'vigilia' | 'apagou'): Promise<void> {
  try {
    await $.audio.play({ asset: `sons/${som}.wav` }, { gain: 0.6 })
  } catch {
    // sem player de som (ou o som falhou): só o visual
  }
}

let alarmeVigilia: Timer | undefined

/** Marca o próximo envio da Vigília (se acesa e com luar): antes de o cache esfriar. */
async function agendarVigilia($: $): Promise<void> {
  alarmeVigilia?.cancel()
  alarmeVigilia = undefined
  const [bt, h, agora] = await Promise.all([read($, botoes), read($, hud), $.clock.now()])
  const luz = h.luz
  if (!bt.vigilia.ligada || luz === null) {
    return
  }
  const fim = luz.at + luz.ttlMs
  if (fim - agora < 15_000) {
    // o cache já esfriou (ou está para esfriar agora): não há mais o que guardar
    return
  }
  const quando = fim - antecedencia(luz.ttlMs)
  alarmeVigilia = $.clock.after(Math.max(0, quando - agora), () => {
    void vigiar($, luz.at)
  })
}

/** Hora da Vigília: se o usuário não escreveu e o Claude está parado, manda a mensagem curtinha. */
async function vigiar($: $, luzAt: number): Promise<void> {
  const [bt, h, trabalhando, agora] = await Promise.all([read($, botoes), read($, hud), read($, turno), $.clock.now()])
  if (!bt.vigilia.ligada) {
    return
  }
  if (h.luz?.at !== luzAt) {
    // houve resposta nova desde que marcamos: o luar já foi reaceso
    await agendarVigilia($)
    return
  }
  if (trabalhando) {
    // o Claude está trabalhando: o fim do turno reacende o luar e remarca
    return
  }
  const envios = bt.vigilia.envios + 1
  const apaga = envios >= VIGILIA_MAX
  await update($, botoes, (b): Botoes => ({ ...b, vigilia: { ligada: !apaga, envios, pisca: agora } }))
  void tocar($, 'vigilia')
  void $.prompt.submit({ text: msgVigilia() })
  if (apaga) {
    $.clock.after(900, () => {
      void avisarApagou($)
    })
  }
}

async function avisarApagou($: $): Promise<void> {
  const agora = await $.clock.now()
  await update($, botoes, (b): Botoes => ({ ...b, vigilia: { ...b.vigilia, pisca: agora } }))
  void tocar($, 'apagou')
  $.ui.toast(tx('avisos.vigilia.apagou_sozinha', { max: VIGILIA_MAX }))
}

async function alternarVigilia($: $): Promise<void> {
  const agora = await $.clock.now()
  const antes = (await read($, botoes)).vigilia.ligada
  await update($, botoes, (b): Botoes => ({ ...b, vigilia: antes ? { ligada: false, envios: 0 } : { ligada: true, envios: 0, pisca: agora } }))
  if (antes) {
    $.ui.toast(tx('avisos.vigilia.apagada'))
  } else {
    void tocar($, 'vigilia')
    $.ui.toast(tx('avisos.vigilia.acesa', { max: VIGILIA_MAX }))
  }
  await agendarVigilia($)
}

async function arrumarMochila($: $): Promise<void> {
  if (await read($, turno)) {
    $.ui.toast(tx('avisos.mochila.espere'))
    await update($, botoes, (b): Botoes => ({ ...b, mochila: 'nada' }))
    return
  }
  await update($, botoes, (b): Botoes => ({ ...b, mochila: 'arrumando' }))
  try {
    const r = await $.session.compact({})
    $.ui.toast(r.skip === undefined ? tx('avisos.mochila.arrumada') : tx('avisos.mochila.nao_arrumada', { motivo: String(r.skip) }))
  } catch (err) {
    $.ui.toast(tx('avisos.mochila.falhou', { erro: err instanceof Error ? err.message : String(err) }))
  } finally {
    await update($, botoes, (b): Botoes => ({ ...b, mochila: 'nada' }))
  }
}

async function erguerEstandarte($: $): Promise<void> {
  if (await read($, turno)) {
    $.ui.toast(tx('avisos.estandarte.espere'))
    return
  }
  if ((await read($, botoes)).estandarte === 'escrevendo') {
    return
  }
  await update($, botoes, (b): Botoes => ({ ...b, estandarte: 'escrevendo' }))
  try {
    await $.prompt.submit({ text: pedidoResumo() })
  } catch (err) {
    await update($, botoes, (b): Botoes => ({ ...b, estandarte: 'nada' }))
    $.ui.toast(tx('avisos.estandarte.falhou', { erro: err instanceof Error ? err.message : String(err) }))
  }
}

async function alternarLivro($: $): Promise<void> {
  const aberto = (await $.ui.panes()).some(p => p.id === LIVRO)
  if (aberto) {
    await $.ui.close({ id: LIVRO })
    await update($, botoes, (b): Botoes => ({ ...b, livro: false }))
    return
  }
  // com a estrelinha de versão nova acesa, o Livro abre na página dos comandos (o aviso está lá)
  if ((await read($, novaVersao)) !== null) {
    await update($, livroAba, () => 'comandos')
  }
  const r = await $.ui.open({ id: LIVRO, title: tx('livro.titulo_painel') })
  await update($, botoes, (b): Botoes => ({ ...b, livro: true }))
  if (!r.isPlaced) {
    $.ui.toast(tx('avisos.livro.nao_abriu', { motivo: r.reason }))
  }
}

function apertar($: $, b: NomeBotao): Promise<void> {
  switch (b) {
    case 'vigilia':
      return alternarVigilia($)
    case 'mochila':
      return update($, botoes, (x): Botoes => ({ ...x, mochila: x.mochila === 'confirma' ? 'nada' : x.mochila === 'arrumando' ? x.mochila : 'confirma' })).then(() => undefined)
    case 'estandarte':
      return erguerEstandarte($)
    case 'livro':
      return alternarLivro($)
  }
}

/**
 * O rótulo invisível do botão. O desktop desenha o rótulo (não os filhos), não
 * deixa mudar a cor dele e, quando ele não cabe, corta com "…", que aparece
 * (foi o que se viu com "•", braile e espaços: o recuo interno do botão é maior
 * do que parece). Como o botão se estica na largura da área (coluna), basta um
 * espaço de algarismo (U+2007, não desenha nada na fonte do sistema) entre dois
 * "word joiners" (U+2060, largura zero), para o app não o tomar por vazio.
 */
const ROTULO_INVISIVEL = '\u2060\u2007\u2060'

/**
 * Os 4 botões de verdade: por cima de cada ícone pixel art, uma área com dois
 * botões do app empilhados (mesma ação; o botão tem 1 linha e o ícone, 2) de
 * rótulo invisível. As áreas formam um bloco contínuo, sem vão: cada uma começa
 * na coluna à esquerda do ícone e vai até a próxima. O balão de cada botão
 * acende no hover, como nas barras.
 */
function botoesDoHud($: $, els: Elementos, a: Ajustes, colunas: number, W: number, alvos: readonly Alvo[]) {
  const { Box, Button } = els
  const { lin } = celulas(a)
  const icones = BOTOES.map(b => alvos.find(x => x.id === `botao_${b}`)).filter((t): t is Alvo => t !== undefined)
  const inicio = (t: Alvo) => Math.floor((t.x * a.escala) / PX_CELULA)
  const areas = icones.map((t, i) => {
    const b = t.id.slice('botao_'.length) as NomeBotao
    const left = inicio(t)
    const prox = icones[i + 1]
    const fim = prox !== undefined ? inicio(prox) : Math.ceil(((t.x + t.w) * a.escala) / PX_CELULA)
    const largura = Math.max(2, fim - left)
    const aperta = () => apertar($, b)
    // o hover do próprio botão entra no grupo do balão (a caixa em volta não
    // basta: o botão fica por cima dela)
    const estilo = { scope: grupo(t), color: INVISIVEL, backgroundColor: INVISIVEL }
    const botao = (k: string) => <Button key={k} plain label={ROTULO_INVISIVEL} hover={estilo} onPress={aperta} />
    return (
      <Box key={`ab_${b}`} position="absolute" top={lin(t.y)} left={left} width={largura} height={2} flexDirection="column" hover={{ scope: grupo(t) }}>
        {botao(`bt_${b}`)}
        {botao(`bt2_${b}`)}
      </Box>
    )
  })
  return [...areas, ...icones.map(t => balaoDoAlvo(els, a, colunas, W, t))]
}

/**
 * Fora do desktop (VS Code, celular) não há posição em células nem hover no
 * desenho: os 4 botões viram uma linha embaixo da cena, na variante C aprovada
 * (maquete em previa_faixa/botoes_vscode.html). Cada um é uma caixa com
 * contorno (cinza discreto apagado; cor do Claude aceso), o ícone outline em
 * Svg e o nome num botão do app.
 *
 * Visto no VS Code (22/11/2026): o editor desenha todo Button como um chip
 * próprio (azul), mesmo com `plain`, e ignora a cor do texto e o hover da caixa;
 * só o chip recebe o clique. Por isso: chip "secondary" (o cinza do editor)
 * sempre, e o estado fica na caixa (contorno na cor do Claude) e no ícone.
 */
function botoesEmLinha($: $, els: Elementos, bt: Botoes) {
  const { Box, Button, Svg } = els
  const rotulo: Record<NomeBotao, string> = {
    vigilia: bt.vigilia.ligada ? tx('chips.vigilia_acesa', { envios: bt.vigilia.envios, max: VIGILIA_MAX }) : tx('chips.vigilia'),
    mochila: tx('chips.mochila'),
    estandarte: bt.estandarte === 'escrevendo' ? tx('chips.escrevendo') : tx('chips.estandarte'),
    livro: tx('chips.livro'),
  }
  const ativo: Record<NomeBotao, boolean> = { vigilia: bt.vigilia.ligada, mochila: bt.mochila !== 'nada', estandarte: bt.estandarte !== 'nada', livro: bt.livro }
  return (
    <Box key="l_botoes" flexDirection="row" gap={1} flexWrap="wrap">
      {BOTOES.map(b => {
        const aceso = ativo[b]
        return (
          <Box
            key={`lc_${b}`}
            flexDirection="row"
            alignItems="center"
            paddingX={1}
            borderStyle="round"
            borderColor={aceso ? COR_CLAUDE : BORDA_APAGADO}
          >
            <Svg source={iconeBotao(b, aceso)} width={ICONE_W} height={ICONE_H} alt="" />
            <Button key={`lb_${b}`} variant="secondary" label={rotulo[b]} onPress={() => apertar($, b)} />
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * VS Code (variante A, escolhida pelo usuário em 22/11/2026): só os chips do
 * editor, com o nome. O editor desenha todo Button como um chip azul próprio e
 * só ele recebe o clique; dentro dele só cabe texto (o ícone outline é imagem).
 * O estado fica no texto e nos ícones pixel art da cena (lanterna acesa, livro
 * aberto). A variante C (caixa + ícone outline, `botoesEmLinha`) fica para
 * quando o editor deixar estilizar o botão; o celular ainda usa a C.
 */
function botoesChips($: $, els: Elementos, bt: Botoes) {
  const { Box, Button } = els
  const rotulo: Record<NomeBotao, string> = {
    vigilia: bt.vigilia.ligada ? tx('chips.vigilia_acesa', { envios: bt.vigilia.envios, max: VIGILIA_MAX }) : tx('chips.vigilia'),
    mochila: tx('chips.mochila'),
    estandarte: bt.estandarte === 'escrevendo' ? tx('chips.escrevendo') : tx('chips.estandarte'),
    livro: bt.livro ? tx('chips.livro_aberto') : tx('chips.livro'),
  }
  // tudo encostado à esquerda (pedido do usuário): a linha não estica os chips
  return (
    <Box key="l_botoes" flexDirection="row" gap={1} flexWrap="wrap" justifyContent="flex-start" alignItems="flex-start" alignSelf="flex-start">
      {BOTOES.map(b => (
        <Button key={`lb_${b}`} label={rotulo[b]} onPress={() => apertar($, b)} />
      ))}
    </Box>
  )
}

/**
 * A faixa do terminal (Fase 5): duas linhas de texto colorido (o HUD e o que a
 * Lua está fazendo; `texto.ts` monta os pedaços) e os botões embaixo. Cada
 * linha corta no fim se não couber.
 */
function faixaEmTexto(els: Elementos, linhas: readonly (readonly Pedaco[])[], resto: readonly RenderChildren[]) {
  const { Box, Text } = els
  return (
    <Box flexDirection="column">
      {linhas.map((l, i) => (
        <Text key={`tx_${i}`} wrap="truncate-end">
          {l.map((p, j) => (
            <Text key={`tx_${i}_${j}`} {...(p.cor === undefined ? {} : { color: p.cor })} {...(p.dim === true ? { dimColor: true } : {})} {...(p.negrito === true ? { bold: true } : {})}>
              {p.t}
            </Text>
          ))}
        </Text>
      ))}
      {resto}
    </Box>
  )
}

/** As linhas de ação embaixo da cena: confirmações e ofertas dos botões e da lua nova. */
function acoesDaFaixa($: $, els: Elementos, bt: Botoes, confirmando: boolean, cansada: boolean) {
  const { Box, Button, Text } = els
  const linhas = []
  if (confirmando) {
    linhas.push(
      <Box key="l_confirma" flexDirection="row" gap={1} alignItems="center">
        <Text>{tx('faixa.nova_conversa.explica')}</Text>
        <Button
          key="sim"
          variant="primary"
          onPress={async () => {
            await update($, confirma, () => false)
            await $.command.run({ command: 'clear' })
          }}
        >
          {tx('faixa.nova_conversa.sim')}
        </Button>
        <Button key="nao" onPress={() => update($, confirma, () => false)}>
          {tx('faixa.nova_conversa.nao')}
        </Button>
      </Box>,
    )
  } else if (cansada) {
    linhas.push(
      <Box key="l_luanova" flexDirection="row" gap={1} alignItems="center">
        <Button key="nova" variant="primary" onPress={() => update($, confirma, () => true)}>
          {tx('faixa.nova_conversa.botao')}
        </Button>
        <Text dimColor>{tx('faixa.lua_nova.continuar')}</Text>
      </Box>,
    )
  }
  if (bt.mochila === 'confirma') {
    linhas.push(
      <Box key="l_mochila" flexDirection="row" gap={1} alignItems="center">
        <Text>{tx('faixa.mochila.explica')}</Text>
        <Button key="mochila_sim" variant="primary" onPress={() => arrumarMochila($)}>
          {tx('faixa.mochila.sim')}
        </Button>
        <Button key="mochila_nao" onPress={() => update($, botoes, (b): Botoes => ({ ...b, mochila: 'nada' }))}>
          {tx('faixa.mochila.nao')}
        </Button>
      </Box>,
    )
  } else if (bt.mochila === 'arrumando') {
    linhas.push(
      <Text key="l_mochila" dimColor>
        {tx('faixa.mochila.arrumando')}
      </Text>,
    )
  }
  if (bt.estandarte === 'pronto' && !confirmando) {
    linhas.push(
      <Box key="l_estandarte" flexDirection="row" gap={1} alignItems="center">
        <Text>{tx('faixa.estandarte.pronto')}</Text>
        <Button key="est_nova" variant="primary" onPress={() => update($, confirma, () => true)}>
          {tx('faixa.nova_conversa.botao')}
        </Button>
        <Button key="est_ok" onPress={() => update($, botoes, (b): Botoes => ({ ...b, estandarte: 'nada' }))}>
          {tx('faixa.estandarte.fechar')}
        </Button>
      </Box>,
    )
  }
  return linhas
}

/** O Livro (por enquanto): a ficha da Lua em texto. As abas e a estante vêm no passo 4. */
/**
 * O Livro no painel do desktop: as 4 abas (botões do app) e a página da aba
 * aberta, um SVG em modo imagem na largura do painel. Na estante de troféus,
 * as áreas de hover do app por cima de cada troféu mostram o nome do erro.
 */
function livroNoPainel($: $, els: Elementos, jogo: Jogo, aba: AbaDoLivro, colunas: number, a: Ajustes, sup: Sup = 'desktop', nova: string | null = null) {
  const { Box, Button, Link, Svg } = els
  const remota = sup !== 'desktop'
  const px = Math.max(200, colunas * (remota ? pxColunaDe(a, sup) : PX_CELULA) - 4)
  // pixel art em escala inteira: 2x quando a página cabe (o texto em 1x fica miúdo), senão 1x
  const escala = px >= 2 * LARGURA_LIVRO ? 2 : 1
  const W = Math.floor(px / escala)
  const p = paginaDoLivro(aba, jogo, W, escala, nova ?? undefined)
  const aj: Ajustes = { ...a, escala }
  return (
    <Box flexDirection="column" gap={1}>
      <Box key="abas" flexDirection="row" gap={1}>
        {ABAS.map(t => (
          <Button key={`aba_${t.id}`} label={t.nome} {...(t.id === aba ? { variant: 'primary' as const } : remota ? { variant: 'secondary' as const } : {})} onPress={() => void update($, livroAba, () => t.id)} />
        ))}
      </Box>
      <Box key="pagina" position="relative">
        {remota ? <Svg source={p.svg} alt={p.alt} /> : <Svg source={p.svg} height={p.altura} alt={p.alt} />}
        {p.alvos.length > 0 && !remota ? areasDeHover(els, aj, colunas, W, p.alvos, false) : null}
      </Box>
      {aba === 'comandos' ? <Link key="readme" href={readmeDosComandos()} label={tx('livro.comandos.link')} /> : null}
    </Box>
  )
}

/** O Livro em texto, onde o app não desenha Svg. */
function livroEmTexto(els: Elementos, jogo: Jogo) {
  const { Box, Text } = els
  const nv = nivelDe(jogo.xp)
  const trofeus = jogo.trofeus ?? []
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>{tx('livro.ficha.titulo')}</Text>
      <Box flexDirection="column">
        <Text>{tx('livro.texto.nivel', { nivel: nv.nivel, xp: jogo.xp, faltam: nv.precisa - nv.dentro, proximo: nv.nivel + 1 })}</Text>
        <Text>{tx('livro.texto.paginas', { ciclo: paginasNoCiclo(jogo.paginas), total: jogo.paginas })}</Text>
        <Text>{tp('livro.texto.lutas', A_CADA - (jogo.lutas % A_CADA), { lutas: jogo.lutas })}</Text>
        <Text>{tx('livro.texto.trofeus', { n: trofeus.length })}</Text>
      </Box>
      {trofeus.length > 0 ? (
        <Box flexDirection="column">
          {trofeus.slice(0, 8).map((t, i) => (
            <Text key={`tr_${i}`} dimColor>{`· ${t}`}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

/** Lê uma variável do sistema sem deixar um erro parar a sessão. */
async function variavel(ler: () => Promise<string | undefined>): Promise<string | undefined> {
  try {
    return await ler()
  } catch {
    return undefined
  }
}

/**
 * O primeiro idioma das preferências do macOS (`defaults read -g
 * AppleLanguages`, só leitura). O app desktop não recebe LANG, então é por
 * aqui que ele sabe o idioma no Mac. Fora do Mac (ou se falhar): undefined.
 */
async function idiomaDoMac($: $): Promise<string | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(['/usr/bin/defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 3000 })
    return exitCode === 0 ? /([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)/.exec(stdout.replace(/^\s*\(/, ''))?.[1] : undefined
  } catch {
    return undefined
  }
}

/**
 * Põe em uso o idioma escolhido com /cronicas language (guardado em $.store),
 * ou, sem escolha, o do sistema (LC_ALL, LC_MESSAGES, LANG, LANGUAGE; sem
 * nenhuma, as preferências do macOS) se tiver tradução; senão, inglês.
 */
async function aplicarIdioma($: $): Promise<void> {
  const escolhido = (await $.store.get('idioma')) as string | undefined
  if (typeof escolhido === 'string' && temTraducao(escolhido)) {
    usarIdioma(escolhido)
    return
  }
  const sistema = await Promise.all([
    variavel(() => $.env.get('LC_ALL')),
    variavel(() => $.env.get('LC_MESSAGES')),
    variavel(() => $.env.get('LANG')),
    variavel(() => $.env.get('LANGUAGE')),
  ])
  if (sistema.every(v => codigoDe(v) === undefined)) {
    sistema.push(await idiomaDoMac($))
  }
  usarIdioma(idiomaDoSistema(sistema))
}

/** A resposta do /cronicas language: troca o idioma ou mostra a lista. */
async function comandoIdioma($: $, pedido: string | undefined): Promise<string> {
  const p = (pedido ?? '').trim()
  if (['auto', 'sistema', 'system'].includes(p.toLowerCase())) {
    await $.store.delete('idioma')
    await aplicarIdioma($)
    await update($, tique, t => t + 1)
    return tx('comando.idioma.auto', { nome: nomeDaLingua(idioma()) })
  }
  if (p !== '') {
    const cod = codigoDe(p)
    if (cod === undefined) {
      return tx('comando.idioma.desconhecido', { pedido: p }) + '\n' + listaDeIdiomas()
    }
    if (!temTraducao(cod)) {
      return tx('comando.idioma.sem_traducao', { nome: nomeDaLingua(cod), atual: nomeDaLingua(idioma()) })
    }
    await $.store.set('idioma', cod)
    usarIdioma(cod)
    await update($, tique, t => t + 1)
    return tx('comando.idioma.trocado', { nome: nomeDaLingua(cod) })
  }
  return listaDeIdiomas()
}

/** Os 8 idiomas, cada um no próprio idioma, o atual marcado, e como escolher. */
function listaDeIdiomas(): string {
  const linhas = LINGUAS.map(l => `${l.cod === idioma() ? '▸' : ' '} ${l.nome} (${l.cod})${temTraducao(l.cod) ? '' : ' · ' + tx('comando.idioma.em_breve')}`)
  return [tx('comando.idioma.titulo', { nome: nomeDaLingua(idioma()) }), ...linhas, tx('comando.idioma.como')].join('\n')
}

/**
 * Os subcomandos do /cronicas em inglês (para quem não fala português), cada
 * um apontando para o nome português de sempre, que continua valendo.
 */
export const SUBCOMANDOS: Readonly<Record<string, string>> = {
  surfaces: 'superficies',
  scale: 'escala',
  column: 'coluna',
  width: 'largura',
  frame: 'quadro',
  image: 'imagem',
  test: 'teste',
  probe: 'prova',
  line: 'linha',
  ruler: 'regua',
  boss: 'chefao',
  hit: 'golpe',
  walk: 'passear',
  stage: 'fase',
  updates: 'atualizacao',
  update: 'atualizacao',
  'atualização': 'atualizacao',
  'atualizações': 'atualizacao',
  atualizacoes: 'atualizacao',
  vigil: 'vigilia',
  'new-moon': 'lua-nova',
}

/** O mod já se preparou nesta sessão (idioma, progresso, barras). */
let iniciado = false

/** Prepara a sessão: idioma, progresso guardado, barras, lutas e Vigília. */
async function iniciar($: $): Promise<void> {
  iniciado = true
  await aplicarIdioma($)
  const jogo = await jogoGuardado($)
  const uso = await $.session.usage()
  await update($, hud, h => ({
    ...h,
    jogo,
    mana: uso.rateLimits.length > 0 ? manaDe(uso.rateLimits) : h.mana,
    mochila: mochilaDe(uso.context) ?? h.mochila,
  }))
  await revisar($)
  await agendarVigilia($)
}

async function registrarComando($: $): Promise<void> {
  await $.command.register({
    name: 'cronicas',
    description: tx('comando.descricao'),
    argumentHint: 'language [en|pt-BR|…] | updates [check|off|on] | intro [on|off] | scale 2 | ruler | width 690 | image | frame | test | new-moon | vigil | boss [list N] [name] | hit | elite | surfaces',
  })
}

/**
 * Instalado ou atualizado no meio de uma sessão, o mod não recebe o
 * session.start dela: sem isto ele ficaria no idioma padrão, com o progresso
 * zerado e sem o /cronicas. O primeiro gancho da sessão faz o começo.
 */
async function garantirInicio($: $): Promise<void> {
  if (iniciado) {
    return
  }
  await iniciar($)
  try {
    await registrarComando($)
  } catch {
    // fora do session.start o app pode recusar: o /cronicas volta na próxima sessão
  }
}

/** Mochila e Mana lidas na hora (o session.measure pode trazer o contexto vazio). */
async function medirAgora($: $): Promise<void> {
  const uso = await $.session.usage()
  await update($, hud, h => ({
    ...h,
    mana: uso.rateLimits.length > 0 ? manaDe(uso.rateLimits) : h.mana,
    mochila: mochilaDe(uso.context) ?? h.mochila,
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await iniciar($)
    // abertura: na primeira sessão do dia ou depois que o app reiniciou (com
    // alguém olhando), se não foi desligada
    const aj = await lerAjustes($)
    if (e.isInteractive && aj.abertura !== false) {
      const hojeJa = (await $.store.get('aberturaDia')) === diaDe(await $.clock.now())
      const app = await inicioDoApp($)
      const reiniciou = app !== undefined && (await $.store.get('aberturaApp')) !== app
      if (!hojeJa || reiniciou) {
        await abrirAbertura($, app)
      }
    }
    await registrarComando($)
    // aviso de versão nova: num alarme logo depois (a sessão não fica presa à
    // rede; o trabalho solto de um gancho não sobrevive a ele)
    const interativa = e.isInteractive
    try {
      $.clock.after(ESPERA_ATUALIZACAO, () => {
        void conferirAtualizacao($, false, interativa).catch(() => undefined)
      })
    } catch {
      // sem alarme, fica para a próxima sessão
    }
    return next(e)
  })

  on('command.run', { command: 'cronicas' }, async ($, e) => {
    const [bruta, valor] = String(e.args ?? '').trim().split(/\s+/)
    // nome em inglês (funciona em qualquer idioma) ou o português de sempre
    const chave = SUBCOMANDOS[(bruta ?? '').toLowerCase()] ?? bruta
    const a = await lerAjustes($)
    const n = Number(valor)
    if (chave === 'language' || chave === 'lang' || chave === 'idioma') {
      return { text: await comandoIdioma($, valor) }
    }
    if (chave === 'atualizacao') {
      const op = (valor ?? '').toLowerCase()
      const st = await lerAtualizacao($)
      if (['off', 'desligar', 'desliga', 'nao', 'não'].includes(op)) {
        await $.store.set('atualizacao', { ...st, desligada: true })
        await update($, novaVersao, () => null)
        return { text: tx('comando.atualizacao.desligada') }
      }
      if (['test', 'teste', 'prova'].includes(op)) {
        const versao = versaoDeTeste(await versaoLocal($))
        await update($, novaVersao, () => versao)
        return { text: tx('comando.atualizacao.teste', { versao }) }
      }
      const ligar = ['on', 'ligar', 'liga', 'sim'].includes(op)
      if (ligar) {
        await $.store.set('atualizacao', { ...st, desligada: false })
      }
      const forcar = ligar || ['check', 'conferir', 'verificar', 'agora', 'now'].includes(op)
      const c = await conferirAtualizacao($, forcar, false)
      const texto = textoAtualizacao(c, await lerAtualizacao($))
      return { text: ligar ? tx('comando.atualizacao.ligada') + '\n' + texto : texto }
    }
    if (chave === 'superficies' || chave === 'superfícies') {
      // diagnóstico da Fase 5: onde esta sessão está desenhando agora
      const lista = await $.session.surfaces()
      const nomes: Record<string, string> = { terminal: tx('superficies.terminal'), desktop: NOME_SUP.desktop, vscode: NOME_SUP.vscode, mobile: NOME_SUP.mobile }
      return { text: lista.length === 0 ? tx('comando.superficies.nenhuma') : tx('comando.superficies.lista', { lista: lista.map(x => nomes[x] ?? x).join(', ') }) }
    }
    if (chave === 'abertura' || chave === 'intro') {
      const op = (valor ?? '').toLowerCase()
      if (['off', 'desligar', 'desliga', 'nao', 'não'].includes(op)) {
        await $.store.set('ajustes', { ...a, abertura: false })
        return { text: tx('comando.abertura.desligada') }
      }
      if (['on', 'ligar', 'liga', 'sim'].includes(op)) {
        await $.store.set('ajustes', { ...a, abertura: true })
        return { text: tx('comando.abertura.ligada') }
      }
      await abrirAbertura($)
      return { text: tx('comando.abertura.mostra', { s: Math.round(FIM_ABERTURA / 1000) }) + ' ' + tx(a.abertura === false ? 'comando.abertura.mostra_desligada' : 'comando.abertura.mostra_ligada') }
    }
    if (chave === 'escala' && (n === 1 || n === 2 || n === 3)) {
      a.escala = n
    } else if (chave === 'coluna' && n >= 4 && n <= 20) {
      a.pxColuna = n
    } else if (chave === 'largura' && n >= 200 && n <= 4000) {
      // a régua mostrou a largura da faixa em px: daí sai o px por coluna.
      // Sem superfície no comando, vale a que desenhou a faixa por último.
      const sup = supDoTexto(String(e.args ?? '').trim().split(/\s+/)[2]) ?? ultimaSup
      if (colunasPor[sup] <= 0) {
        return { text: tx('comando.largura.sem_colunas', { sup: NOME_SUP[sup] }) }
      }
      // desktop: uns px a mais (desenho mais largo que a faixa é cortado à
      // direita, sem distorcer). VS Code e celular esticam ou encolhem a imagem
      // até a largura da faixa: a borda está entre o número lido e o próximo
      // (a régua marca de 100 em 100), então o meio do caminho
      const px = Math.round(((n + (sup === 'desktop' ? 4 : 50)) / colunasPor[sup]) * 100) / 100
      if (sup === 'desktop') {
        a.pxColuna = px
      } else {
        a.pxColunaPor = { ...a.pxColunaPor, [sup]: px }
      }
      a.regua = false
      await $.store.set('ajustes', a)
      await update($, tique, t => t + 1)
      return { text: tx('comando.largura.calibrada', { sup: NOME_SUP[sup], n, colunas: colunasPor[sup], px }) }
    } else if (chave === 'quadro' || chave === 'imagem') {
      a.quadro = chave === 'quadro'
      a.teste = false
    } else if (chave === 'teste') {
      a.teste = !a.teste
    } else if (chave === 'prova') {
      a.prova = a.prova !== true
      await $.store.set('ajustes', a)
      await update($, tique, t => t + 1)
      return {
        text: a.prova
          ? tx('comando.prova.ligada')
          : tx('comando.prova.desligada'),
      }
    } else if (chave === 'linha' && n >= 8 && n <= 40) {
      // altura de uma linha da faixa em px (medida com a régua vertical da prova)
      a.pxLinha = n
    } else if (chave === 'regua' || chave === 'régua') {
      a.regua = a.regua !== true
      await $.store.set('ajustes', a)
      await update($, tique, t => t + 1)
      return {
        text: a.regua
          ? tx('comando.regua.ligada')
          : tx('comando.regua.desligada'),
      }
    } else if (chave === 'chefao' || chave === 'chefão') {
      // para ver o chefão sem lista de tarefas: 3 de vida, /cronicas golpe tira 1.
      // Com um nome (/cronicas chefao relojoeiro), chama esse; sem, o próximo da jornada.
      // Com "lista" (/cronicas chefao lista 3 relojoeiro): um chefão de lista de mentira
      // com N tarefas (padrão 3), com escudo; /cronicas golpe conclui uma tarefa.
      let palavras = String(e.args ?? '').trim().split(/\s+/).slice(1)
      const comLista = ['lista', 'list'].includes(palavras[0]?.toLowerCase() ?? '')
      let tarefas: Chefao['tarefas'] | undefined
      if (comLista) {
        palavras = palavras.slice(1)
        const q = /^\d+$/.test(palavras[0] ?? '') ? Math.min(20, Math.max(1, Number(palavras[0]))) : 3
        if (/^\d+$/.test(palavras[0] ?? '')) {
          palavras = palavras.slice(1)
        }
        tarefas = { total: q, feitas: 0 }
      }
      const pedido = palavras.join(' ')
      const escolhido = chefaoPeloNome(pedido)
      if (pedido !== '' && escolhido === undefined) {
        return { text: tx('comando.chefao.desconhecido', { pedido, lista: JORNADA.map(n => NOME_CHEFAO[n] ?? n).join(', ') }) }
      }
      // pedido explícito: troca o chefão que estiver em cena (o bioma vai junto)
      const veio = await chamarChefao($, comLista ? 'lista' : 'lutas', tarefas, escolhido, true)
      await revisar($)
      const ch = await read($, chefao)
      if (!veio || ch === null) {
        return { text: tx('comando.chefao.ja_em_cena') }
      }
      const nome = NOME_CHEFAO[ch.nome] ?? ch.nome
      return {
        text: comLista
          ? tp('comando.chefao.com_lista', tarefas?.total ?? 0, { nome, pagina: ch.pagina })
          : tx('comando.chefao.entrou', { nome, pagina: ch.pagina }),
      }
    } else if (chave === 'golpe') {
      const ch = await read($, chefao)
      if (!dePe(ch)) {
        return { text: tx('comando.golpe.sem_chefao') }
      }
      await golpeDeComando($, ch)
      const depois = await read($, chefao)
      const v = depois === null ? { resta: 0, total: 0 } : vidaEmTarefas(depois)
      return {
        text:
          depois?.caiu !== undefined
            ? tx('comando.golpe.caiu', { nome: NOME_CHEFAO[ch.nome] ?? ch.nome, pagina: ch.pagina })
            : ch.origem === 'lista'
              ? tx('comando.golpe.tarefa', { resta: v.resta, total: v.total })
              : tx('comando.golpe.golpe', { resta: v.resta, total: v.total }),
      }
    } else if (chave === 'passear') {
      // a Lua anda uns segundos pelo cenário (as camadas rolam em laço) e para respirando
      const ch = await read($, chefao)
      const agora = await $.clock.now()
      if (dePe(ch) || lutaDaVez((await read($, lutas)).lista, agora) !== undefined || (await read($, passagem)) !== null) {
        return { text: tx('comando.passear.ocupada') }
      }
      const seg = Number.isFinite(n) && n > 0 ? Math.min(PASSEIO_MAX, Math.round(n)) : PASSEIO_S
      await update($, caminho, c => ({ andando: true, desde: agora, dist0: distancia(c, agora), ate: agora + seg * 1000 }))
      $.clock.after(seg * 1000 + 20, () => {
        void update($, tique, x => x + 1)
      })
      return { text: tx('comando.passear.anda', { s: seg }) }
    } else if (chave === 'fase') {
      // passagem de fase só para ver: a Lua sai, o próximo bioma (ou o pedido) entra; não conta página
      const ch = await read($, chefao)
      const agora = await $.clock.now()
      if (ch !== null) {
        return { text: tx('comando.fase.chefao') }
      }
      if (lutaDaVez((await read($, lutas)).lista, agora) !== undefined || (await read($, passagem)) !== null) {
        return { text: tx('comando.passear.ocupada') }
      }
      const h = await read($, hud)
      const de = (await read($, visita)) ?? biomaDe({ agora, hud: h })
      const pedido = String(e.args ?? '').trim().split(/\s+/).slice(1).join(' ')
      const para = pedido === '' ? ORDEM_BIOMAS[(ORDEM_BIOMAS.indexOf(de) + 1) % ORDEM_BIOMAS.length] ?? 'floresta' : biomaPeloNome(pedido)
      if (para === undefined) {
        return { text: tx('comando.fase.desconhecido', { pedido, lista: ORDEM_BIOMAS.map(b => tx(`chefao.biomas.${b}`)).join(', ') }) }
      }
      const i = Array.from({ length: 10 }, (_, k) => k).find(k => biomaDaPagina(k) === para) ?? 0
      await update($, caminho, c => ({ andando: false, desde: agora, dist0: distancia(c, agora) }))
      await comecarPassagem($, null, agora, { de, para, pagina: i + 1 })
      await update($, visita, () => para)
      return { text: tx('comando.fase.vai', { de: tx(`chefao.biomas.${de}`), para: tx(`chefao.biomas.${para}`) }) }
    } else if (chave === 'elite') {
      // para ver o elite sem esperar um erro de verdade: a próxima ferramenta chama o Golem
      // cada teste traz o próximo dos 4 troféus, para ver todos
      const ja = (await read($, hud)).jogo.trofeus?.length ?? 0
      const tipo = TIPOS_TROFEU[ja % TIPOS_TROFEU.length] ?? 'edicao'
      const exemplo: Record<TipoTrofeu, string> = {
        comando: 'Error: command not found: pyhton',
        edicao: 'Error: String to replace not found in file.',
        leitura: 'Error: File does not exist.',
        web: 'Error: Request failed with status code 404',
      }
      await update($, elite, el => ({ ...el, proximo: nomeDoErro(exemplo[tipo]), proximoTipo: tipo }))
      return { text: tx('comando.elite.proximo', { elite: NOME_CHEFAO[ELITE] ?? ELITE, trofeu: tx(`comando.elite.trofeu.${tipo}`) }) }
    } else if (chave === 'vigilia' || chave === 'vigília') {
      // para ver a Vigília sem esperar: o luar fica a 10 s da hora em que ela manda a mensagem
      const agora = await $.clock.now()
      const ttlMs = (await read($, hud)).luz?.ttlMs ?? 3_600_000
      const restante = antecedencia(ttlMs) + 10_000
      await update($, hud, h => ({ ...h, luz: { at: agora - (ttlMs - restante), ttlMs } }))
      await marcarFimDoLuar($, restante)
      await agendarVigilia($)
      const acesa = (await read($, botoes)).vigilia.ligada
      return {
        text: acesa
          ? tx('comando.vigilia.acesa')
          : tx('comando.vigilia.apagada'),
      }
    } else if (chave === 'lua-nova') {
      // só para ver o aviso: a próxima resposta acende o luar de novo
      const agora = await $.clock.now()
      await update($, hud, h => ({ ...h, luz: { at: agora - (h.luz?.ttlMs ?? 3_600_000) - 1000, ttlMs: h.luz?.ttlMs ?? 3_600_000 } }))
      return { text: tx('comando.lua_nova') }
    } else {
      const atual = await read($, hud)
      const nv = nivelDe(atual.jogo.xp)
      return {
        text:
          tx('comando.ajuda.estado', { escala: a.escala, px: a.pxColuna, modo: tx(a.quadro ? 'comando.modo.quadro' : 'comando.modo.imagem'), nivel: nv.nivel, xp: atual.jogo.xp, paginas: paginasNoCiclo(atual.jogo.paginas) }) +
          '\n' +
          tx('comando.ajuda.uso') +
          '\n' +
          tx('comando.ajuda.uso_cenario') +
          '\n' +
          tx('comando.ajuda.uso_atualizacao') +
          ((atual.jogo.trofeus ?? []).length > 0 ? '\n' + tx('comando.ajuda.trofeus', { lista: (atual.jogo.trofeus ?? []).slice(0, 5).join(' · ') }) : ''),
      }
    }
    await $.store.set('ajustes', a)
    await update($, tique, t => t + 1)
    if (chave === 'linha') {
      return { text: tx('comando.linha', { n }) }
    }
    return {
      text: a.teste
        ? tx('comando.teste')
        : tx('comando.ajustada', { escala: a.escala, px: a.pxColuna, modo: tx(a.quadro ? 'comando.modo.quadro_baloes' : 'comando.modo.imagem') }),
    }
  })

  // /clear começa uma conversa nova: não há cache para perder nem contexto na mochila.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, hud, h => ({ ...h, luz: null, mochila: null }))
      await update($, confirma, () => false)
      await update($, botoes, (b): Botoes => ({ ...b, estandarte: 'nada', mochila: 'nada' }))
      await agendarVigilia($)
    }
    return next(e)
  })

  // o Livro fechado pelo próprio app (o x do painel): o ícone volta a fechado
  on('ui.close', async ($, e, next) => {
    if (e.id === LIVRO) {
      await update($, botoes, (b): Botoes => ({ ...b, livro: false }))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: LIVRO }, async ($, e) => {
    const els = $.ui.resolve(e) as Elementos
    const jogo = (await read($, hud)).jogo
    if (e.surface === 'terminal') {
      return livroEmTexto(els, jogo)
    }
    if (e.props.placement === 'widget') {
      // painel minimizado: só uma linha que se lê de relance
      const { Text } = els
      return <Text>{tx('livro.widget', { nivel: nivelDe(jogo.xp).nivel, paginas: paginasNoCiclo(jogo.paginas), trofeus: (jogo.trofeus ?? []).length })}</Text>
    }
    const [aba, a, nova] = await Promise.all([read($, livroAba), lerAjustes($), read($, novaVersao)])
    return livroNoPainel($, els, jogo, aba, e.props.bodyColumns, a, e.surface, nova)
  })

  // Mana e Mochila: o engine avisa quando os números mudam.
  on('session.measure', async ($, e, next) => {
    await update($, hud, h => ({
      ...h,
      mana: e.rateLimits.length > 0 ? manaDe(e.rateLimits) : h.mana,
      mochila: mochilaDe(e.context) ?? h.mochila,
    }))
    return next(e)
  })

  // A Lua anda enquanto o Claude trabalha e para quando ele termina
  // (numa luta, ela só volta a andar quando a luta acaba).
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await garantirInicio($)
      // o progresso é compartilhado: traz o que outra sessão ganhou
      await sincronizarJogo($)
      const agora = await $.clock.now()
      await update($, turno, () => true)
      const emLuta = lutaDaVez((await read($, lutas)).lista, agora) !== undefined || dePe(await read($, chefao))
      if (!emLuta) {
        await update($, caminho, c => (c.andando && c.ate === undefined ? c : { andando: true, desde: agora, dist0: distancia(c, agora) }))
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (e.agentId === undefined) {
      const agora = await $.clock.now()
      await update($, turno, () => false)
      const emLuta = lutaDaVez((await read($, lutas)).lista, agora) !== undefined
      if (!emLuta) {
        await update($, caminho, c => (c.andando ? { andando: false, desde: agora, dist0: distancia(c, agora) } : c))
      }
      // a última ferramenta do turno decide a luta na hora
      await revisar($, true)
      await ganharXp($, 1)
      await medirAgora($)
      if ((await read($, botoes)).estandarte === 'escrevendo') {
        await update($, botoes, (b): Botoes => ({ ...b, estandarte: 'pronto' }))
      }
      await agendarVigilia($)
    }
    return res
  })

  // Luz da Lua: cada pedido ao modelo reacende o cache por 5 min ou 1 h.
  on('turn.step', async function* ($, e, next) {
    const at = await $.clock.now()
    const resposta = yield* next(e)
    if (e.agentId === undefined && resposta.usage !== null) {
      const u = resposta.usage
      const antes = (await read($, hud)).luz
      let ttlMs = antes?.ttlMs ?? 3_600_000
      if ((u.ephemeral_1h_input_tokens ?? 0) > 0) {
        ttlMs = 3_600_000
      } else if ((u.ephemeral_5m_input_tokens ?? 0) > 0) {
        ttlMs = 300_000
      }
      const usouCache = u.cache_read_input_tokens + u.cache_creation_input_tokens > 0
      if (usouCache) {
        await update($, hud, h => ({ ...h, luz: { at, ttlMs } }))
        await marcarFimDoLuar($, at + ttlMs - (await $.clock.now()))
        await agendarVigilia($)
      }
    }
    return resposta
  })

  // Cada ferramenta do Claude é uma luta: o monstro entra quando ela começa e
  // leva o golpe (ou contra-ataca, se deu erro) quando ela volta.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      // as ferramentas de dentro de um subagente não chamam monstro (o próprio Agent já é a luta)
      const res = await next(e)
      if (res.deny === undefined && res.isError !== true) {
        await ganharXp($, 2, e.tool)
      }
      return res
    }
    await garantirInicio($)
    const agora = await $.clock.now()
    let n = 0
    let nova: Luta | null = null
    const ch0 = await read($, chefao)
    const el0 = await read($, elite)
    const daPagina = proximoChefao((await read($, hud)).jogo.paginas).nome
    await update($, lutas, s => {
      const r = entrar(s, agora, e.tool, ch0, el0.proximo, el0.proximoTipo, daPagina)
      n = r.n
      nova = r.nova
      return r.s
    })
    if ((nova as Luta | null)?.trofeu !== undefined) {
      await update($, elite, el => ({ erros: el.erros }))
    }
    // começou agora: a Lua para quando o monstro chegar
    const comeco = nova as Luta | null
    if (comeco !== null && comeco.t0 <= agora) {
      await update($, caminho, c => (c.andando ? { ...c, ate: comeco.t0 + ENTRA } : c))
    }
    await revisar($)
    let ok = false
    let texto: string | undefined
    try {
      const res = await next(e)
      ok = res.deny === undefined && res.isError !== true
      texto = res.deny ?? res.text
      return res
    } finally {
      const fim = await $.clock.now()
      const dano = danoDe(texto)
      await update($, lutas, s => golpear(s, n, { at: fim, ok, dano }))
      await lembrarErro($, e.tool, e, ok, texto)
      if (ok) {
        await golpeNoChefao($, e.tool, e, n, fim, dano)
      }
      await revisar($)
      if (ok) {
        await ganharXp($, xpDaFerramenta(papelDe(e.tool), fim - agora >= DEMORADA_MS), e.tool)
      }
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    if (e.surface === 'terminal') {
      // Fase 5: no terminal não há Svg: a faixa em texto, com emojis
      await read($, tique)
      const [c, estado, agora, confirmando, ls, bt, ch] = await Promise.all([read($, caminho), read($, hud), $.clock.now(), read($, confirma), read($, lutas), read($, botoes), read($, chefao)])
      const els = $.ui.resolve(e) as unknown as Elementos
      const cansada = luar(estado, agora).desmaiada
      const linhas = [
        linhaHud(estado, agora, e.props.bodyColumns),
        linhaAcao(estado, agora, andandoAgora(c, agora), lutaDaVez(ls.lista, agora), ch),
      ]
      return faixaEmTexto(els, linhas, [botoesChips($, els, bt), ...acoesDaFaixa($, els, bt, confirmando, cansada)])
    }
    const sup: Sup = e.surface
    const remota = sup !== 'desktop'
    const { Box, Svg, Text } = $.ui.resolve(e)
    await read($, tique)
    const [c, estado, agora, a, confirmando, ls, bt] = await Promise.all([
      read($, caminho),
      read($, hud),
      $.clock.now(),
      lerAjustes($),
      read($, confirma),
      read($, lutas),
      read($, botoes),
    ])
    const ch = await read($, chefao)
    const ab = await read($, abertura)
    const ps = await read($, passagem)
    const vis = await read($, visita)
    const nova = await read($, novaVersao)
    colunasPor[sup] = e.props.bodyColumns
    ultimaSup = sup
    const pxColuna = pxColunaDe(a, sup)
    // a cena acompanha a largura da faixa (colunas x px por coluna, calibrado pela régua)
    const W = Math.max(LARGURA_MIN, Math.min(LARGURA_MAX, Math.floor((e.props.bodyColumns * pxColuna) / a.escala)))
    const luta = lutaDaVez(ls.lista, agora)
    // a faixa tem sempre a mesma altura (pedido do usuário): todo monstro cabe nela
    const modo = 'compacto'
    // a Pixelify (textos longos) só entra quando os balões podem aparecer (modo quadro)
    // (fora do desktop não há hover: nada de balões nem quadro interativo)
    const textoLongo = !remota && (a.quadro || a.teste)
    const estadoBotoes: EstadoBotoes = {
      vigilia: bt.vigilia.ligada,
      envios: bt.vigilia.envios,
      maxEnvios: VIGILIA_MAX,
      ...(bt.vigilia.pisca === undefined ? {} : { pisca: bt.vigilia.pisca }),
      mochila: (estado.mochila ?? 0) > 80 || bt.mochila !== 'nada',
      estandarte: bt.estandarte === 'nada' ? 'enrolado' : bt.estandarte,
      livro: bt.livro,
      ...(nova === null ? {} : { novaVersao: nova }),
    }
    const vista = { agora, W, escala: a.escala, celula: PX_CELULA / a.escala, modo, caminho: c, hud: estado, textoLongo, botoes: true, estadoBotoes, semBaloes: !textoLongo, ...(vis === null ? {} : { bioma: vis }), ...(luta === undefined ? {} : { luta }), ...(ch === null ? {} : { chefao: ch }), ...(ab !== null && luta === undefined && ch === null ? { abertura: ab } : {}), ...(ps !== null && ab === null && luta === undefined && ch === null ? { passagem: ps } : {}) } as const
    // desktop (sem quadro, teste ou prova): cenário e frente em dois Svg sobrepostos
    const dividida = !remota && !a.quadro && !a.teste && a.prova !== true
    const tamanho = (m: ReturnType<typeof montar>): number => (dividida ? Math.max(tamanhoNoApp(m.fundo), tamanhoNoApp(m.frente)) : m.svg.length)
    const limite = dividida ? LIMITE_CODIFICADO : LIMITE_SVG
    // celular: menos animação (sem partículas nem a tira de andar na luta)
    let montada = montar(sup === 'mobile' ? { ...vista, economia: true } : vista)
    const { altura, alvos } = montada
    if (tamanho(montada) > limite) {
      // não coube: sem partículas e sem a tira de andar na luta; se ainda não
      // couber, sem a assinatura; por fim, a cena sem a luta (o app recusa
      // um Svg grande demais e a faixa ficaria parada no desenho anterior)
      // (os biomas da noite são pesados: no modo quadro ou com a Lua dormindo, os
      // balões e a fonte dos textos longos saem antes da luta)
      const leve = { economia: true, semAssinatura: true, textoLongo: false, semBaloes: true, semFonteLonga: true } as const
      const tentativas = [{ economia: true }, { economia: true, semAssinatura: true }, leve] as const
      for (const t of tentativas) {
        montada = montar({ ...vista, ...t })
        if (tamanho(montada) <= limite) {
          break
        }
      }
      if (tamanho(montada) > limite) {
        const { luta: _fora, ...semLuta } = vista as typeof vista & { luta?: unknown }
        montada = montar({ ...semLuta, ...leve })
      }
    }
    const { svg, fundo, frente } = montada

    // altura fixa: se a cena passar da largura da faixa, o app corta a sobra à
    // direita (preserveAspectRatio slice) em vez de encolher o desenho
    const nv = nivelDe(estado.jogo.xp)
    const cansada = luar(estado, agora).desmaiada
    const alt = tx('cena_alt.frase', {
      acao: cansada
        ? tx('cena_alt.cansada')
        : dePe(ch)
          ? tx('cena_alt.chefao', { nome: NOME_CHEFAO[ch.nome] ?? ch.nome, resta: vidaEmTarefas(ch).resta, total: vidaEmTarefas(ch).total })
          : luta !== undefined
            ? tx('cena_alt.luta')
            : c.andando
              ? tx('cena_alt.anda')
              : tx('cena_alt.descansa'),
      nivel: nv.nivel,
    })
    const cena = remota ? (
      // sem altura fixa: o editor estica ou encolhe a imagem inteira até a largura
      // da faixa (não corta os botões); com a largura calibrada, fica perto de 1:1
      <Svg source={svg} alt={alt} />
    ) : a.teste ? (
      <Box flexDirection="column" gap={1}>
        <Text key="ta">{tx('comando.teste_a')}</Text>
        <Svg key="sa" source={svg} isInteractive height={altura} alt={alt} />
        <Text key="tb">{tx('comando.teste_b')}</Text>
        <Svg key="sb" source={svg} height={altura} alt={alt} />
      </Box>
    ) : a.quadro ? (
      <Svg source={svg} isInteractive height={altura} alt={alt} />
    ) : (
      <Box position="relative">
        <Svg source={fundo} height={altura} alt={alt} />
        <Box position="absolute" top={0} left={0} right={0}>
          <Svg source={frente} height={altura} alt={alt} />
        </Box>
        {areasDeHover($.ui.resolve(e) as Elementos, a, e.props.bodyColumns, W, alvos, false)}
        {botoesDoHud($, $.ui.resolve(e) as Elementos, a, e.props.bodyColumns, W, alvos)}
        {faseAbertura(vista) === undefined ? null : areaDePular($, $.ui.resolve(e) as Elementos, a, e.props.bodyColumns)}
      </Box>
    )
    if (a.prova === true && !remota) {
      const prova = provaTecnica($, $.ui.resolve(e) as Elementos, e.props.bodyColumns, W, a, <Svg source={svg} height={altura} alt={alt} />, alvos)
      const linhas = acoesDaFaixa($, $.ui.resolve(e) as Elementos, bt, confirmando, cansada)
      return linhas.length === 0 ? (
        prova
      ) : (
        <Box flexDirection="column" gap={1}>
          {prova}
          {linhas}
        </Box>
      )
    }
    if (a.regua === true) {
      return (
        <Box flexDirection="column" gap={1}>
          {cena}
          <Svg key="regua" source={regua(e.props.bodyColumns, pxColuna)} height={44} alt={tx('regua_alt')} />
        </Box>
      )
    }
    const acoes = acoesDaFaixa($, $.ui.resolve(e) as Elementos, bt, confirmando, cansada)
    if (remota) {
      acoes.unshift(sup === 'vscode' ? botoesChips($, $.ui.resolve(e) as Elementos, bt) : botoesEmLinha($, $.ui.resolve(e) as Elementos, bt))
    }
    if (acoes.length === 0) {
      return cena
    }
    // VS Code e celular: sem a linha vazia entre a cena e os botões (a faixa
    // do editor é baixa e a linha de botões rolava para fora)
    return (
      <Box flexDirection="column" gap={remota ? 0 : 1}>
        {cena}
        {acoes}
      </Box>
    )
  })
}

