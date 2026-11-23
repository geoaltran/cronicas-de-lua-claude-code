// Fase 5: a faixa em texto, para o terminal (onde não há Svg). Só monta as
// linhas (pedaços de texto com cor); quem desenha é o register.tsx.
import type { Chefao, Hud, Luta } from '../types'
import { luar, nivelDe } from './cena'
import { A_CADA, NOME_CHEFAO, paginasNoCiclo, vidaEmTarefas } from './chefao'
import { roteiro } from './luta'

/** Um pedaço de uma linha: o texto e, se tiver, a cor. */
export type Pedaco = { t: string; cor?: string; dim?: boolean; negrito?: boolean }

export const CORES_TEXTO = {
  luz: '#f3dd8f',
  mana: '#8f8cf2',
  mochila: '#c99a6b',
  xp: '#f5c542',
  chefao: '#ff5d6c',
  critico: '#ff3b4e',
  duvida: '#5478c8',
} as const

/** O emoji de cada personagem na faixa em texto. */
export const EMOJI: Record<string, string> = {
  vespera: '🕷️',
  dama_penumbra: '🎭',
  golem_obsidiana: '🪨',
  leviata: '🌊',
  ignis: '🔥',
  relojoeiro: '⚙️',
  sir_solis: '☀️',
  rei_espelho: '🪞',
  nebula: '✨',
  malakor: '🌑',
}

/** Barra de texto: `▰▰▰▱▱`. */
export function barraTexto(frac: number, n = 5): string {
  const k = Math.max(0, Math.min(n, Math.round(frac * n)))
  return '▰'.repeat(k) + '▱'.repeat(n - k)
}

const nome = (m: string) => NOME_CHEFAO[m] ?? m
const comEmoji = (m: string) => `${EMOJI[m] ?? '👾'} ${nome(m)}`

/**
 * A linha do HUD: nível e XP, Luz da Lua (cache), Mana (limite de 5 h) e
 * Mochila (contexto). Em menos colunas, as barras somem e os nomes encurtam.
 */
export function linhaHud(hud: Hud, agora: number, colunas: number): Pedaco[] {
  const nv = nivelDe(hud.jogo.xp)
  const l = luar(hud, agora)
  const largo = colunas >= 84
  const p: Pedaco[] = [{ t: `🌙 Nv ${nv.nivel}`, negrito: true }, { t: ` ${nv.dentro}/${nv.precisa} XP`, cor: CORES_TEXTO.xp }, { t: '  ·  ', dim: true }]
  const luzTxt = !l.temLuz ? '—' : l.desmaiada ? 'lua nova' : `${Math.max(1, Math.round(l.restanteMs / 60000))} min`
  p.push({ t: largo ? 'LUZ ' : '☀ ', dim: true })
  if (largo && l.temLuz) {
    p.push({ t: `${barraTexto(l.frac)} `, cor: CORES_TEXTO.luz })
  }
  p.push({ t: luzTxt, cor: CORES_TEXTO.luz }, { t: '  ·  ', dim: true })
  const cinco = hud.mana.cinco
  p.push({ t: largo ? 'MANA ' : '✦ ', dim: true })
  if (cinco === undefined) {
    p.push({ t: '—', cor: CORES_TEXTO.mana })
  } else {
    const resta = Math.max(0, 100 - cinco)
    if (largo) {
      p.push({ t: `${barraTexto(resta / 100)} `, cor: CORES_TEXTO.mana })
    }
    p.push({ t: `${Math.round(resta)}%`, cor: CORES_TEXTO.mana })
  }
  p.push({ t: '  ·  ', dim: true }, { t: largo ? 'MOCHILA ' : '🎒 ', dim: true })
  if (hud.mochila === null) {
    p.push({ t: '—', cor: CORES_TEXTO.mochila })
  } else {
    if (largo) {
      p.push({ t: `${barraTexto(hud.mochila / 100)} `, cor: CORES_TEXTO.mochila })
    }
    p.push({ t: `${Math.round(hud.mochila)}%${hud.mochila > 80 ? ' (cheia!)' : ''}`, cor: CORES_TEXTO.mochila })
  }
  return p
}

/** O que a Lua está fazendo agora, numa linha. */
export function linhaAcao(hud: Hud, agora: number, andando: boolean, luta: Luta | undefined, ch: Chefao | null): Pedaco[] {
  if (luar(hud, agora).desmaiada) {
    return [{ t: '🌑 Lua nova: a Lua desmaiou (o cache esfriou). A próxima mensagem sai mais cara.', cor: CORES_TEXTO.luz }]
  }
  const p: Pedaco[] = []
  const dePe = ch !== null && ch.caiu === undefined
  if (ch !== null) {
    const v = vidaEmTarefas(ch)
    if (dePe) {
      p.push({ t: `👑 ${nome(ch.nome).toUpperCase()} `, cor: CORES_TEXTO.chefao, negrito: true }, { t: barraTexto(v.total === 0 ? 0 : ch.vida / ch.vidaMax, Math.min(10, Math.max(3, v.total))), cor: CORES_TEXTO.chefao })
      p.push({ t: ch.origem === 'lista' ? ` ${v.resta}/${v.total} tarefas` : ` ${v.resta}/${v.total}`, dim: true })
    } else {
      p.push({ t: `🏆 ${nome(ch.nome)} caiu! +PÁGINA ${paginasNoCiclo(hud.jogo.paginas)}/10`, cor: CORES_TEXTO.xp, negrito: true })
      return p
    }
  }
  if (luta !== undefined) {
    const rt = roteiro(luta)
    const alvo = luta.fixo === true && ch !== null ? nome(ch.nome) : comEmoji(luta.monstro)
    if (p.length > 0) {
      p.push({ t: '  ·  ', dim: true })
    }
    if (rt.desfecho?.tipo === 'fuga') {
      p.push({ t: `💥 ${alvo} contra-atacou e fugiu` })
    } else if (rt.defendida) {
      p.push({ t: `🛡 ${alvo} defendeu com o escudo `, dim: false }, { t: '❓💧', cor: CORES_TEXTO.duvida })
    } else if (rt.desfecho?.tipo === 'vitoria') {
      const critico = luta.final === true
      p.push(critico ? { t: '💥 CRÍTICO! ', cor: CORES_TEXTO.critico, negrito: true } : { t: '⭐ ' }, { t: luta.fixo === true ? `golpe em ${alvo}` : `${alvo} derrotado`, negrito: true }, { t: ` +${rt.xp} XP`, cor: CORES_TEXTO.xp })
      if (luta.trofeu !== undefined) {
        p.push({ t: ' +TROFÉU', cor: CORES_TEXTO.xp, negrito: true })
      }
    } else if (rt.canalAberto && agora >= rt.livre) {
      p.push({ t: `🔮 a Lua canaliza contra ${alvo}…` })
    } else {
      const g = luta.golpes.filter(x => x.ok).length
      p.push({ t: `⚔ a Lua enfrenta ${alvo}${luta.trofeu !== undefined ? ' (elite)' : ''}` }, ...(g > 0 ? [{ t: ` ×${g}`, dim: true }] : []))
    }
    return p
  }
  if (dePe) {
    return p
  }
  const faltam = A_CADA - (hud.jogo.lutas % A_CADA)
  return [andando ? { t: '🌲 a Lua anda pela floresta' } : { t: '💤 a Lua descansa' }, { t: `  ·  chefão em ${faltam} ${faltam === 1 ? 'luta' : 'lutas'}`, dim: true }]
}
