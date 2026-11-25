// Ajudantes dos testes: a cena como o app desenha. No desktop ela vem em dois Svg
// sobrepostos (cenário atrás, frente por cima); os balões do hover são Svg à parte.
import { tamanhoNoApp } from '../hooks/cena'

type No = { props?: { source?: string; alt?: string } }
type Ui = { findAll: (q: { type: 'Svg' }) => Promise<unknown[]> }

/** Entre os pedaços da cena (fundo e frente) no texto juntado. */
export const CORTE = '\n<!--corte-->\n'

const daCena = async (ui: Ui): Promise<No[]> =>
  (await ui.findAll({ type: 'Svg' })).map(n => n as No).filter(n => String(n.props?.source ?? '').includes('xMinYMin slice'))

/** O desenho inteiro da cena: os Svg dela juntos (cenário + frente; um só fora do desktop). */
export async function fonteDaCena(ui: Ui): Promise<string> {
  return (await daCena(ui)).map(n => String(n.props?.source ?? '')).join(CORTE)
}

/** O texto alternativo da cena (o mesmo nos dois Svg). */
export async function altDaCena(ui: Ui): Promise<string> {
  return String((await daCena(ui))[0]?.props?.alt ?? '')
}

/** O maior pedaço da cena, medido como o app desktop mede (codificado como endereço). */
export const medida = (fonte: string): number => Math.max(0, ...fonte.split(CORTE).map(tamanhoNoApp))

/** O teto do app desktop para cada Svg, codificado (folga sobre os ~127 mil recusados). */
export const LIMITE_APP = 124_000
