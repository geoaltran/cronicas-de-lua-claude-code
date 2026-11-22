/**
 * Onde a Lua está no caminho: andando desde `desde`, tendo andado `dist0` px
 * antes. Com `ate`, ela para sozinha nesse instante (um monstro chegou).
 */
export type Caminho = { andando: boolean; desde: number; dist0: number; ate?: number }

/** O resultado de uma ferramenta numa luta: quando voltou, se deu certo e o dano do golpe. */
export type Golpe = { at: number; ok: boolean; dano: number }

/**
 * Uma luta comum: um monstro por vez. Ferramentas em paralelo (ou seguidas, com
 * menos de 1,5 s entre elas) entram na mesma luta e somam golpes.
 */
export type Luta = {
  /** Número da luta nesta sessão. */
  n: number
  /** Papel do monstro (ler, editar, terminal, web, integracao, subagente). */
  papel: string
  /** Personagem (chave em chefoes.json). */
  monstro: string
  /** Quando o monstro começa a entrar. */
  t0: number
  /** Ferramentas ainda rodando nesta luta. */
  ativas: number
  golpes: Golpe[]
  /** Quando a luta se decidiu (nenhuma ferramenta nova a tempo, ou o turno acabou). */
  fecha?: number
  /** Golpe no chefão (Fase 3): o monstro já está em cena, não entra nem foge. */
  fixo?: boolean
  /** O chefão cai nesta luta: na vitória ele se desfaz em pixels. */
  final?: boolean
  /** Elite (erro consertado): o nome do erro, guardado como troféu (vai para o Livro). */
  trofeu?: string
  /** Que troféu o Golem traz (pelo tipo da ação que errou e foi consertada). */
  trofeuTipo?: TipoTrofeu
}

/** Os 4 troféus do elite: comando (Bash), edição (Edit/Write...), leitura (Read), web (WebFetch). */
export type TipoTrofeu = 'comando' | 'edicao' | 'leitura' | 'web'

/**
 * Elite: o último erro de cada ação (ferramenta + alvo). Quando a mesma ação
 * dá certo, o nome do erro espera em `proximo` e a próxima luta comum vira o
 * Golem de Obsidiana com ele como troféu.
 */
export type Elite = { erros: Record<string, string>; proximo?: string; proximoTipo?: TipoTrofeu }

/**
 * O chefão da vez (Fase 3). Com lista de tarefas, a vida é o que falta da
 * lista; sem lista (a cada 12 lutas), 3 de vida e cada vitória tira 1.
 */
export type Chefao = {
  /** Personagem (chave em chefoes.json), pela ordem da jornada. */
  nome: string
  /** Página das Crônicas que ele guarda (1..10). */
  pagina: number
  origem: 'lista' | 'lutas'
  /** Quando entrou em cena. */
  t0: number
  vidaMax: number
  vida: number
  /** O último golpe que tirou vida: quando, e quanto havia antes (rastro escuro na barra). */
  golpe?: { at: number; antes: number }
  /** Tarefas da lista: total e concluídas (TodoWrite, TaskCreate/Update, plano do app). */
  tarefas: { total: number; feitas: number }
  /** Quando caiu (vida 0). */
  caiu?: number
}

export type Lutas = {
  /** A luta da vez e, no máximo, a próxima na fila. */
  lista: Luta[]
  /** Quantas lutas cada papel já teve (os personagens se alternam). */
  vezes: Record<string, number>
  n: number
}

/** Luz da Lua: quando o cache da conversa foi escrito/lido e quanto dura. */
export type Luz = { at: number; ttlMs: number }

export type Mana = {
  /** % do limite de 5 h já usado. */
  cinco?: number
  cincoRenova?: string
  sete?: number
  seteRenova?: string
}

/** O que dura entre sessões (também em $.store). */
export type Jogo = {
  xp: number
  paginas: number
  lutas: number
  /** Troféus dos elites vencidos (nomes de erros consertados), do mais novo ao mais velho; até 30. */
  trofeus?: string[]
  /** O tipo de cada troféu, na mesma ordem de `trofeus` (os antigos, sem tipo, contam como 'edicao'). */
  trofeusTipos?: TipoTrofeu[]
}

export type Hud = {
  luz: Luz | null
  mana: Mana
  /** % do contexto usado. */
  mochila: number | null
  jogo: Jogo
}

declare module 'claude-code' {
  interface PluginState {
    'cronicas-de-lua': {
      caminho: Shaped<Caminho>
      lutas: Shaped<Lutas>
      chefao: Shaped<Chefao | null>
      elite: Shaped<Elite>
      /** O Claude está trabalhando (um turno em andamento). */
      turno: boolean
      hud: Shaped<Hud>
      /** Sobe para redesenhar a faixa num momento marcado (ex.: a luz acabou). */
      tique: number
      /** O botão de conversa nova pediu confirmação. */
      confirma: boolean
    }
  }
}
