"""Prepara os assets de "As Crônicas de Lua" a partir das imagens brutas (fundo branco).

Para cada imagem:
  1. tira o fundo branco por preenchimento a partir das bordas (o branco de dentro
     do personagem, como olhos e brilhos, fica);
  2. separa cada figura (componentes conectados);
  3. detecta o tamanho do "pixel" da arte e reamostra no grid nativo, 1 pixel da
     arte = 1 pixel do PNG (o mod amplia 2x/3x sem suavizar);
  4. reduz as cores para uma paleta por folha, limpando o ruído do JPEG;
  5. salva PNGs transparentes em ./assets e uma folha de prévia.

Uso: python preparar_assets.py
"""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

RAIZ = Path(__file__).parent
BRUTOS = RAIZ / "assets-brutos"
SAIDA = RAIZ / "assets"

# Cada folha: arquivo bruto, nº de cores da paleta e as peças a extrair.
# Peças são escolhidas pelo centro aproximado (x, y) na imagem bruta.
FOLHAS = {
    "lua": {
        "arquivo": "lua_turnaround.jpg",
        "cores": 32,
        "limpar_halo": True,
        "limpar_pes": True,
        "pixel": 7.95,        # medido nas 5 vistas; fixo para nenhuma vista desandar
        "pecas": {
            "lua/lua_frente.png": (230, 650),
            "lua/lua_lado.png": (660, 650),
            "lua/lua_costas.png": (1090, 650),
            "lua/lua_frente_grande.png": (330, 1500),
            "lua/lua_costas_grande.png": (990, 1500),
        },
    },
    "ui": {
        "arquivo": "ui_level_barras.jpg",
        "cores": 32,
        "pecas": {
            "ui/nivel_estrela_lv.png": (730, 300),
            "ui/nivel_estrela.png": (1260, 300),
            # a moldura vazia vira a base das molduras de nível; "1" e "99" ficam
            # só como referência do estilo dos dígitos
            "_moldura_nivel": (650, 750),
            "_moldura_1": (1000, 750),
            "_moldura_99": (1350, 750),
            # "_" = só referência, não é salva: dela sai apenas a gema
            "_barra_cheia": (1000, 1120),
            "ui/barra_trilho.png": (1000, 1340),
        },
    },
}


# Chefões: uma folha de turnaround cada, vistas encontradas automaticamente.
CHEFOES = {
    "vespera": "vespera.jpg",
    "dama_penumbra": "dama_penumbra.jpg",
    "golem_obsidiana": "golem_obsidiana.jpg",
    "leviata": "leviata.jpg",
    "ignis": "ignis.jpg",
    "relojoeiro": "relojoeiro_v3.webp",
    "sir_solis": "sir_solis.jpg",
    "rei_espelho": "rei_espelho.jpg",
    "nebula": "nebula.jpg",
    "malakor": "malakor_v3.jpeg",  # v3 (25/11/2026): fundo escuro, já no porte final
}
# Ampliação de pixel art (Scale2x/Scale3x) por chefão, para o porte combinar com
# a história. 1 = tamanho nativo. A Lua tem 84 px.
AMPLIAR = {
    # mesmo porte da Lua (tamanho nativo): sir_solis (rival), rei_espelho (cópia
    # da Lua), dama_penumbra (feiticeira humana)
    "relojoeiro": 3,       # 41 -> 123 px: o desenho é pequeno demais para um chefão
    "vespera": 2,          # 46 -> 92 px: aranha-espectral
    "ignis": 2,            # 56 -> 112 px: ave gigante
    "leviata": 2,          # 69 -> 138 px: serpente gigante
    "golem_obsidiana": 2,  # 82 -> 164 px: colosso
    "nebula": 2,           # 92 -> 184 px: dragão ancestral
    # malakor: 1 (o v3 já vem com ~169 px; o original era 90 -> 180 com Scale2x)
}
# Como ampliar: "pixelart" (Scale2x/3x, arredonda diagonais) ou "vizinho"
# (bloco exato). O Relojoeiro usa "vizinho": no Scale3x o óculos e o rosto
# ficaram deformados, e o desenho dele fica melhor com os pixels exatos.
METODO_AMPLIAR = {"relojoeiro": "vizinho"}
for _nome, _arquivo in CHEFOES.items():
    FOLHAS[f"chefao_{_nome}"] = {
        "arquivo": f"chefoes/{_arquivo}", "auto": True, "pasta": f"chefoes/{_nome}",
        "nome": _nome, "cores": 32, "limpar_halo": _nome != "malakor",
        # Malakor v3: folha de fundo escuro (#2b2233), pedida assim para o contraste
        # com o Eclipse. limpar_halo tiraria as pedrinhas cinzas (cinza neutro).
        "fundo_escuro": _nome == "malakor",
        "teia_redesenhada": _nome == "vespera",
        "ampliar": AMPLIAR.get(_nome, 1),
        "metodo_ampliar": METODO_AMPLIAR.get(_nome, "pixelart"),
    }


def mascara_fundo_escuro(rgb):
    """Fundo liso e escuro (cor do canto): o que tem essa cor e toca a borda da
    imagem, mais os vãos fechados grandes da mesma cor (entre os anéis e o corpo).
    Os tons escuros do corpo ficam presos pelo contorno, e diferem do fundo."""
    a = rgb.astype(int)
    cor = np.median(np.r_[a[:8, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)], axis=0)
    dif = np.abs(a - cor).sum(2)
    rot, _ = nd.label(dif < 24)
    borda = np.unique(np.r_[rot[0], rot[-1], rot[:, 0], rot[:, -1]])
    tam = np.bincount(rot.ravel())
    media = np.bincount(rot.ravel(), weights=dif.ravel()) / np.maximum(tam, 1)
    vaos = np.where((tam >= 400) & (media < 10))[0]
    ids = np.r_[borda, vaos]
    return np.isin(rot, ids[ids > 0])


def mascara_fundo(rgb):
    """Fundo = regiões claras e sem cor que tocam a borda da imagem."""
    claro = (rgb.min(2) > 205) & (np.ptp(rgb, axis=2) < 40)
    rot, _ = nd.label(claro)
    borda = np.unique(np.r_[rot[0], rot[-1], rot[:, 0], rot[:, -1]])
    return np.isin(rot, borda[borda > 0])


def grupos(frente, dilatacao):
    rot, _ = nd.label(nd.binary_dilation(frente, iterations=dilatacao))
    return rot


def detectar_grid(rgb, mascara, s_fixo=None):
    """Tamanho e deslocamento do pixel da arte, pela periodicidade das bordas."""
    a = rgb.astype(float)
    resultado = []
    for i, eixo in enumerate((1, 0)):
        perfil = np.abs(np.diff(a, axis=eixo)).sum(2)
        perfil = perfil * (mascara[:, 1:] if eixo == 1 else mascara[1:, :])
        perfil = perfil.sum(1 - eixo)
        n = np.arange(len(perfil))

        def nota(s):
            return abs((perfil * np.exp(2j * np.pi * n / s)).sum()) / perfil.sum()

        if s_fixo:
            s = s_fixo[i]
        else:
            s = max(np.arange(4, 14, 0.01), key=nota)
            # metade do pixel real casa tão bem quanto o real (as bordas caem em
            # todo múltiplo); se o dobro ainda casa, o pixel real é o dobro
            while s * 2 <= 30 and nota(s * 2) >= 0.7 * nota(s):
                s *= 2
        fase = np.angle((perfil * np.exp(2j * np.pi * n / s)).sum())
        # as bordas caem em k*s + fase; o centro da célula fica meio pixel adiante
        resultado.append((s, (fase / (2 * np.pi) * s + 0.5) % s))
    return resultado  # [(sx, ox), (sy, oy)]


def reamostrar(rgb, mascara, grid):
    (sx, ox), (sy, oy) = grid
    xs = np.arange(ox + sx / 2, rgb.shape[1] - 1, sx)
    ys = np.arange(oy + sy / 2, rgb.shape[0] - 1, sy)
    h, w = len(ys), len(xs)
    cor = np.zeros((h, w, 3), np.uint8)
    alfa = np.zeros((h, w), bool)
    r = max(1, int(min(sx, sy) * 0.2))  # média do miolo da célula, foge das bordas do JPEG
    for i, y in enumerate(ys.astype(int)):
        for j, x in enumerate(xs.astype(int)):
            bloco_m = mascara[y - r:y + r + 1, x - r:x + r + 1]
            if bloco_m.mean() < 0.5:
                continue
            bloco = rgb[y - r:y + r + 1, x - r:x + r + 1][bloco_m]
            cor[i, j] = np.median(bloco, axis=0)
            alfa[i, j] = True
    return cor, alfa


def limpar_pes(alfa):
    """Tira o pixel solto embaixo da sola (sobra do recorte): na última linha
    do desenho, pixel sem vizinho dos lados vira transparente. Repete se a
    linha de baixo ficar vazia."""
    alfa = alfa.copy()
    for _ in range(2):
        ys = np.nonzero(alfa.any(1))[0]
        if not len(ys):
            break
        y = ys[-1]
        linha = alfa[y]
        sozinho = linha & ~np.r_[False, linha[:-1]] & ~np.r_[linha[1:], False]
        if not sozinho.any():
            break
        alfa[y] = linha & ~sozinho
    return alfa


def limpar_halo(cor, alfa, passadas=3):
    """Tira a franja acinzentada (do cinza médio ao quase branco) que o JPEG deixa
    colada por fora do contorno preto, e pontinhos soltos que sobraram.
    Só mexe na borda externa: as cores da Lua são todas saturadas, e o contorno
    (escuro demais para cair aqui) fica."""
    c = cor.astype(int)
    # cinza neutro (franja: #918481, #606067, #4a4b50). O marrom-escuro do contorno
    # do cabelo (#3a1823) tem mais cor que isso e fica.
    halo = (c.max(2) > 55) & (np.ptp(c, axis=2) < 28)
    for _ in range(passadas):
        borda = alfa & ~nd.binary_erosion(alfa, border_value=0)
        alfa = alfa & ~(borda & halo)
    rot, n = nd.label(alfa)
    tamanhos = nd.sum(alfa, rot, range(1, n + 1))
    for i, t in enumerate(tamanhos, 1):
        if t < 6:
            alfa = alfa & (rot != i)
    return alfa


def recortar(cor, alfa):
    ys, xs = np.nonzero(alfa)
    return cor[ys.min():ys.max() + 1, xs.min():xs.max() + 1], alfa[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def quantizar(pecas, n_cores):
    """Paleta única por folha, calculada só com os pixels opacos de todas as peças."""
    from scipy.cluster.vq import kmeans2
    amostra = np.concatenate([c[a] for c, a in pecas.values()]).astype(float)
    # k-means (semente fixa = resultado repetível) separa melhor tons próximos,
    # como a gola dourada e a pele, do que o median-cut
    paleta, _ = kmeans2(amostra, n_cores, minit="++", seed=7, iter=30)
    paleta = np.clip(paleta.round(), 0, 255).astype(int)
    saida = {}
    for nome, (c, a) in pecas.items():
        dist = ((c[:, :, None, :].astype(int) - paleta[None, None]) ** 2).sum(-1)
        q = paleta[dist.argmin(-1)].astype(np.uint8)
        rgba = np.dstack([q, np.where(a, 255, 0).astype(np.uint8)])
        saida[nome] = Image.fromarray(rgba)
    return saida, paleta


def processar(folha):
    rgb = np.asarray(Image.open(BRUTOS / folha["arquivo"]).convert("RGB"))
    frente = ~mascara_fundo(rgb)
    rot = grupos(frente, dilatacao=4)
    pecas, grids = {}, {}
    for nome, (cx, cy) in folha["pecas"].items():
        # grupo mais próximo do centro informado. Brilhos soltos ficam de fora:
        # o mod desenha as faíscas da varinha como partículas animadas.
        ys, xs = np.nonzero(rot)
        k = np.argmin((xs - cx) ** 2 + (ys - cy) ** 2)
        m = frente & (rot == rot[ys[k], xs[k]])
        px = folha.get("pixel")
        pecas[nome], grids[nome] = extrair(rgb, m, folha, (px, px) if px else None)
    imagens, paleta = quantizar(pecas, folha["cores"])
    return imagens, paleta, grids


def recorte(m):
    sl = nd.find_objects(m.astype(int))[0]
    return (slice(max(0, sl[0].start - 2), sl[0].stop + 2), slice(max(0, sl[1].start - 2), sl[1].stop + 2))


def extrair(rgb, m, folha, s_fixo=None):
    """Uma figura (máscara m) -> sprite no grid nativo."""
    sl = recorte(m)
    grid = detectar_grid(rgb[sl], m[sl], s_fixo)
    cor, alfa = reamostrar(rgb[sl], m[sl], grid)
    if folha.get("limpar_halo"):
        alfa = limpar_halo(cor, alfa)
    if folha.get("limpar_pes"):
        alfa = limpar_pes(alfa)
    return recortar(cor, alfa), round((grid[0][0] + grid[1][0]) / 2, 2)


def processar_auto(folha):
    """Folha de turnaround sem posições marcadas: acha cada vista sozinho, em
    ordem de leitura, e gruda nelas as partes soltas (chamas, brasas, respingos,
    anéis) da vista mais próxima."""
    rgb = np.asarray(Image.open(BRUTOS / folha["arquivo"]).convert("RGB"))
    fundo = mascara_fundo_escuro(rgb) if folha.get("fundo_escuro") else mascara_fundo(rgb)
    if folha.get("buracos_brancos"):
        # branco preso dentro da figura (ex.: entre os anéis do Malakor e o corpo)
        # também é fundo. Só liga por folha: em outros chefões o branco preso é
        # parte do desenho (o reflexo do espelho do Rei Espelho).
        branco = (rgb.min(2) > 225) & (np.ptp(rgb, axis=2) < 30) & ~fundo
        rot_b, n_b = nd.label(branco)
        tam = nd.sum(branco, rot_b, range(1, n_b + 1))
        fundo |= np.isin(rot_b, [i + 1 for i, t in enumerate(tam) if t >= 150])
    frente = nd.binary_opening(~fundo, iterations=1)  # tira poeira do JPEG
    rot, n = nd.label(nd.binary_dilation(frente, iterations=6))
    areas = nd.sum(frente, rot, range(1, n + 1))
    grandes = [i + 1 for i, a in enumerate(areas) if a > 0.15 * areas.max()]
    # cada pixel do fundo aponta para o pixel de figura grande mais próximo
    eh_grande = np.isin(rot, grandes)
    dist, (iy, ix) = nd.distance_transform_edt(~eh_grande, return_indices=True)
    dono = rot.copy()
    for i in range(1, n + 1):
        if i in grandes:
            continue
        pts = rot == i
        if dist[pts].min() > 150:  # longe de tudo: sujeira, não parte de ninguém
            dono[pts] = 0
            continue
        y, x = np.argwhere(pts)[0]
        dono[pts] = rot[iy[y, x], ix[y, x]]
    # ordem de leitura: linhas (quebra quando o centro desce muito), depois x
    centros = sorted(((nd.center_of_mass(eh_grande, rot, g), g) for g in grandes))
    linhas, atual, ultimo_y = [], [], None
    for (cy, cx), g in centros:
        if ultimo_y is not None and cy - ultimo_y > 200:
            linhas.append(atual)
            atual = []
        atual.append((cx, g))
        ultimo_y = cy
    linhas.append(atual)
    ordem = [g for linha in linhas for _, g in sorted(linha)]
    # todas as vistas de uma folha saem do mesmo desenho, na mesma escala: usa a
    # mediana do tamanho de pixel das vistas (uma vista "confusa" não desanda)
    mascaras = [frente & (dono == g) for g in ordem]
    medidas = []
    for m in mascaras:
        sl = recorte(m)
        (sx, _), (sy, _) = detectar_grid(rgb[sl], m[sl])
        medidas.append((sx, sy))
    s_folha = folha.get("pixel") or float(np.median([v for par in medidas for v in par]))
    pecas, grids = {}, {}
    for k, m in enumerate(mascaras, 1):
        nome = f"{folha['pasta']}/{folha['nome']}_{k:02d}.png"
        pecas[nome], grids[nome] = extrair(rgb, m, folha, (s_folha, s_folha))
    print(f"  {folha['nome']}: pixel por vista {[round((a + b) / 2, 2) for a, b in medidas]} -> usado {s_folha:.2f}")
    imagens, paleta = quantizar(pecas, folha["cores"])
    extras = {}
    if folha.get("teia_redesenhada"):
        # Vespera: troca a teia ruidosa original por um apanhador de sonhos limpo.
        # Exporta também a aranha sem teia + quadros de giro, para o mod animar.
        import teia_vespera as tv
        centros = {}
        for k in list(imagens):
            com, sem, cs = tv.aplicar(imagens[k], vista=int(Path(k).stem.split("_")[-1]))
            imagens[k] = com
            extras[k.replace(".png", "_sem_teia.png").replace(folha["nome"] + "/", folha["nome"] + "/teia/")] = sem
            centros[Path(k).name] = cs
        for q, im in enumerate(tv.quadros_giro(4)):
            extras[f"{folha['pasta']}/teia/teia_giro_{q}.png"] = im
        _, (tcx, tcy) = tv.desenhar_teia()
        f = folha.get("ampliar", 1)
        meta = {"centro_da_teia_no_png": [tcx * f, tcy * f], "quadros_giro": 4,
                "teias_por_vista": {v: [[x * f, y * f] for x, y in cs] for v, cs in centros.items()},
                "uso": "desenhe <vista>_sem_teia.png e, em cada centro, teia_giro_N.png com o "
                       "centro_da_teia_no_png alinhado ao centro; alterne N para girar"}
        (SAIDA / folha["pasta"] / "teia").mkdir(parents=True, exist_ok=True)
        (SAIDA / folha["pasta"] / "teia" / "teia.json").write_text(json.dumps(meta, indent=1))
    imagens.update(extras)
    if folha.get("ampliar", 1) > 1:
        f = folha["ampliar"]
        if folha.get("metodo_ampliar") == "vizinho":
            # cópia exata: cada pixel vira um bloco f x f, sem suavizar nada
            imagens = {k: v.resize((v.width * f, v.height * f), Image.NEAREST) for k, v in imagens.items()}
        else:
            imagens = {k: ampliar_pixelart(v, f) for k, v in imagens.items()}
    return imagens, paleta, grids


# Preenchimentos das barras: (escuro, meio, claro) em degraus, estilo pixel art.
# O degradê da imagem original não é pixel art e "listra" ao reduzir as cores,
# então o preenchimento é gerado aqui, um por barra do jogo.
PREENCHIMENTOS = {
    "xp": ["#5a2fb8", "#8a3fd0", "#c04fc0", "#f07ab0", "#ffc94a", "#fee849"],
    # dourado pálido: o "luz" do luar (escolha do usuário em 22/11/2026; era azul, parecia mana)
    "luz": ["#8a6a2a", "#b8913a", "#e0bb55", "#f5d98a", "#fcefc0", "#fffbe8"],
    "mana": ["#24308f", "#2f46c4", "#4b63f0", "#6f7dff", "#9a8cff", "#c2a8ff"],
    "mochila": ["#7a3a16", "#a5531f", "#cf7a2a", "#e8a03a", "#f7c55a", "#ffe08a"],
}


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


def gerar_preenchimento(cores, w, h):
    """Degraus horizontais + sombreado vertical (brilho em cima, sombra embaixo)."""
    banda = (np.arange(w) * len(cores) // w)
    base = np.stack([hex_rgb(cores[b]) for b in banda])  # w x 3
    img = np.repeat(base[None], h, 0)
    branco, sombra = np.array([255, 255, 255.0]), np.array([20, 10, 40.0])
    img[0] = img[0] * 0.45 + branco * 0.55
    img[1] = img[1] * 0.75 + branco * 0.25
    img[-2] = img[-2] * 0.8 + sombra * 0.2
    img[-1] = img[-1] * 0.6 + sombra * 0.4
    return Image.fromarray(np.dstack([img.round().astype(np.uint8), np.full((h, w), 255, np.uint8)]))


def montar_barras(imagens):
    """Separa a barra em trilho (moldura + fundo), gema e preenchimentos.
    O mod desenha: trilho -> preenchimento cortado em N% -> gema na ponta."""
    trilho = np.asarray(imagens["ui/barra_trilho.png"])
    # moldura toda dourada: a metade esquerda (prata) vira o espelho da direita
    meio = trilho.shape[1] // 2
    direita = trilho[:, trilho.shape[1] - meio:]
    trilho = np.ascontiguousarray(np.concatenate([direita[:, ::-1], direita], axis=1))
    imagens["ui/barra_trilho.png"] = Image.fromarray(trilho)
    cheia = np.asarray(imagens.pop("_barra_cheia"))
    # interior = a cor escura dominante do trilho
    opaco = trilho[..., 3] > 0
    cores, contagem = np.unique(trilho[..., :3][opaco], axis=0, return_counts=True)
    fundo = cores[contagem.argmax()].astype(int)
    perto = opaco & (np.abs(trilho[..., :3].astype(int) - fundo).sum(2) < 30)
    linhas = np.nonzero(perto.sum(1) > 0.5 * perto.sum(1).max())[0]
    colunas = np.nonzero(perto[linhas].sum(0) > 0.5 * len(linhas))[0]
    interior = {"x": int(colunas.min()), "y": int(linhas.min()),
                "w": int(colunas.max() - colunas.min() + 1), "h": int(linhas.max() - linhas.min() + 1)}
    # gema: o círculo que passa da altura da barra no meio da imagem cheia
    h, w = cheia.shape[:2]
    meio = np.arange(w // 5, w - w // 5)
    cols = meio[(cheia[1, meio, 3] > 0) | (cheia[h - 2, meio, 3] > 0)]
    cx, cy, r = (cols.min() + cols.max()) / 2, (h - 1) / 2, h / 2
    yy, xx = np.indices((h, w))
    disco = ((xx - cx) ** 2 + (yy - cy) ** 2 <= r * r) & (cheia[..., 3] > 0)
    x0, x1 = int(np.floor(cx - r)), int(np.ceil(cx + r)) + 1
    gema = np.where(disco[..., None], cheia, 0)[:, x0:x1].astype(np.uint8)
    # tira da borda da gema os restos cinza/prata da barra que ficava atrás dela
    c = gema[..., :3].astype(int)
    cinza = (np.ptp(c, axis=2) < 50) & (c.max(2) > 60)
    for _ in range(3):
        alfa = gema[..., 3] > 0
        borda = alfa & ~nd.binary_erosion(alfa, border_value=0)
        gema[borda & cinza, 3] = 0
    imagens["ui/barra_gema.png"] = Image.fromarray(gema)
    for nome, cores in PREENCHIMENTOS.items():
        imagens[f"ui/barra_preench_{nome}.png"] = gerar_preenchimento(cores, interior["w"], interior["h"])
    return {"interior": interior, "gema": {"w": x1 - x0, "h": h}}


def barra_composta(imagens, info, nome, pct):
    """Como o mod vai desenhar uma barra em pct%."""
    tela = imagens["ui/barra_trilho.png"].copy()
    i = info["interior"]
    w = max(1, round(i["w"] * pct))
    tela.alpha_composite(imagens[f"ui/barra_preench_{nome}.png"].crop((0, 0, w, i["h"])), (i["x"], i["y"]))
    gema = imagens["ui/barra_gema.png"]
    gx = min(max(i["x"] + w - gema.width // 2, 0), tela.width - gema.width)
    out = Image.new("RGBA", (tela.width, max(tela.height, gema.height)))
    out.alpha_composite(tela, (0, (out.height - tela.height) // 2))
    out.alpha_composite(gema, (gx, (out.height - gema.height) // 2))
    return out


# Dígitos do selo de nível: grade 3x6 em que cada célula vira 2x2 pixels
# (traço de 2 px, como o "1" e o "99" da arte original), depois contorno escuro.
DIGITOS = {
    "0": ["###", "#.#", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "..#", "###", "#..", "###"],
    "3": ["###", "..#", ".##", "..#", "..#", "###"],
    "4": ["#.#", "#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "#.#", "###"],
    "7": ["###", "..#", "..#", ".#.", ".#.", ".#."],
    "8": ["###", "#.#", "###", "#.#", "#.#", "###"],
    "9": ["###", "#.#", "#.#", "###", "..#", "###"],
}
# cantos arredondados (1 px) onde o traço faz curva
CANTOS = {"0": "nw ne sw se", "3": "nw sw", "6": "ne sw se", "8": "nw ne sw se", "9": "nw ne sw", "2": "nw", "5": "sw"}
COR_DIGITO, COR_CONTORNO, COR_SOMBRA = (254, 246, 207), (34, 21, 46), (17, 12, 42)  # cores do "99" original


def gerar_digito(d):
    g = np.kron(np.array([[c == "#" for c in linha] for linha in DIGITOS[d]]), np.ones((2, 2), bool))
    h, w = g.shape
    for canto in CANTOS.get(d, "").split():
        y = 0 if canto[0] == "n" else h - 1
        x = 0 if canto[1] == "w" else w - 1
        g[y, x] = False
    g = np.pad(g, 1)
    contorno = nd.binary_dilation(g, structure=np.ones((3, 3), bool)) & ~g
    img = np.zeros(g.shape + (4,), np.uint8)
    img[contorno] = COR_CONTORNO + (255,)
    # lado de baixo/direita do contorno um tom mais escuro, como no original
    sombra = contorno & (np.roll(g, 1, 0) | np.roll(g, 1, 1)) & ~(np.roll(g, -1, 0) | np.roll(g, -1, 1))
    img[sombra] = COR_SOMBRA + (255,)
    img[g] = COR_DIGITO + (255,)
    return Image.fromarray(img)


def alargar_moldura(m, extra):
    """Alarga o selo repetindo uma coluna lisa de cada lado (entre a gema do canto
    e a gema do centro), mantendo gema e ponta centralizadas."""
    w = m.shape[1]
    cl, cr = 10, w - 1 - 10
    esq, dir_ = extra // 2, extra - extra // 2
    partes = [m[:, :cl + 1], np.repeat(m[:, cl:cl + 1], esq, 1), m[:, cl + 1:cr],
              np.repeat(m[:, cr:cr + 1], dir_, 1), m[:, cr:]]
    return np.ascontiguousarray(np.concatenate(partes, axis=1))


def montar_nivel(imagens):
    base = np.asarray(imagens.pop("_moldura_nivel"))
    # interior = o azul dominante do miolo
    opaco = base[..., 3] > 0
    cores, contagem = np.unique(base[..., :3][opaco], axis=0, return_counts=True)
    azul = cores[contagem.argmax()].astype(int)
    perto = opaco & (np.abs(base[..., :3].astype(int) - azul).sum(2) < 20)
    linhas = np.nonzero(perto.sum(1) > 0.8 * perto.sum(1).max())[0]
    colunas = np.nonzero(perto[linhas].sum(0) == len(linhas))[0]
    digitos = {d: gerar_digito(d) for d in DIGITOS}
    for d, im in digitos.items():
        imagens[f"ui/nivel/digito_{d}.png"] = im
    dw, dh = digitos["0"].size
    passo = dw - 1  # contornos vizinhos se encostam, 1 px sobreposto
    info = {"digito": {"w": dw, "h": dh, "passo": passo}, "molduras": {}}
    interior_base = int(colunas.max() - colunas.min() + 1)
    for n in (2, 3, 4):
        largura_texto = passo * (n - 1) + dw
        extra = max(0, largura_texto + 4 - interior_base)  # 2 px de folga de cada lado
        m = alargar_moldura(base, extra) if extra else base
        imagens[f"ui/nivel/moldura_{n}dig.png"] = Image.fromarray(m)
        info["molduras"][f"{n}dig"] = {
            "arquivo": f"moldura_{n}dig.png", "w": m.shape[1], "h": m.shape[0], "max_digitos": n,
            "interior": {"x": int(colunas.min()), "y": int(linhas.min()),
                         "w": interior_base + extra, "h": int(linhas.max() - linhas.min() + 1)}}
    return info


def selo_nivel(imagens, info, n):
    """Como o mod vai desenhar o nível n: escolhe a menor moldura que cabe."""
    texto = str(n)
    chave = next(k for k, v in info["molduras"].items() if v["max_digitos"] >= len(texto))
    mold = info["molduras"][chave]
    tela = imagens[f"ui/nivel/{mold['arquivo']}"].copy()
    d = info["digito"]
    largura = d["passo"] * (len(texto) - 1) + d["w"]
    i = mold["interior"]
    x = i["x"] + (i["w"] - largura) // 2
    y = i["y"] + (i["h"] - d["h"]) // 2
    for k, c in enumerate(texto):
        tela.alpha_composite(imagens[f"ui/nivel/digito_{c}.png"], (x + k * d["passo"], y))
    return tela


def vazar_teia(im):
    """Teias da Vespera: só os fios ciano ficam. O branco e o ciano-claro entre
    os fios (fundo preso na malha, e a mistura fio+fundo do JPEG) viram
    transparência. O que estiver dentro da silhueta do corpo fica intacto."""
    a = np.array(im)
    c = a[..., :3].astype(int)
    opaco = a[..., 3] > 0
    claro = opaco & (c[..., 0] > 150) & (c[..., 1] > 190) & (c[..., 2] > 190)
    fio = opaco & (c[..., 0] <= 150) & (c[..., 1] > 170) & (c[..., 2] > 170)
    corpo = nd.binary_fill_holes(opaco & ~claro & ~fio)
    a[claro & ~corpo, 3] = 0
    # franja azul-acinzentada (ciano misturado ao fundo) colada por fora do contorno
    opaco = a[..., 3] > 0
    borda = opaco & ~nd.binary_erosion(opaco, border_value=0)
    azulada = (c[..., 0] < 120) & (c[..., 1] < 170) & (c[..., 2] > 150)
    a[borda & azulada, 3] = 0
    # pontinhos soltos que sobraram (1–2 px longe de tudo)
    rot, n = nd.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    tam = nd.sum(a[..., 3] > 0, rot, range(1, n + 1))
    for i, t in enumerate(tam, 1):
        if t < 3:
            a[rot == i, 3] = 0
    return Image.fromarray(a)


def _vizinhos(c):
    """c: matriz uint32 (RGBA empacotado). Devolve A..I da vizinhança 3x3."""
    p = np.pad(c, 1, mode="edge")
    h, w = c.shape
    v = lambda dy, dx: p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
    return (v(-1, -1), v(-1, 0), v(-1, 1), v(0, -1), c, v(0, 1), v(1, -1), v(1, 0), v(1, 1))


def ampliar_pixelart(im, fator):
    """Scale2x / Scale3x (AdvMAME): amplia pixel art sem borrar, arredondando
    as diagonais. Mantém exatamente as cores originais."""
    rgba = np.array(im.convert("RGBA"))
    rgba[rgba[..., 3] == 0] = 0  # todo transparente igual, para comparar vizinhos
    c = np.ascontiguousarray(rgba).view(np.uint32)[..., 0]
    A, B, C, D, E, F, G, H, I = _vizinhos(c)
    ok = (B != H) & (D != F)
    sel = lambda cond, x: np.where(ok & cond, x, E)
    if fator == 2:
        blocos = [[sel(D == B, D), sel(B == F, F)],
                  [sel(D == H, D), sel(H == F, F)]]
    elif fator == 3:
        blocos = [
            [sel(D == B, D), sel(((D == B) & (E != C)) | ((B == F) & (E != A)), B), sel(B == F, F)],
            [sel(((D == B) & (E != G)) | ((D == H) & (E != A)), D), E, sel(((B == F) & (E != I)) | ((H == F) & (E != C)), F)],
            [sel(D == H, D), sel(((D == H) & (E != I)) | ((H == F) & (E != G)), H), sel(H == F, F)],
        ]
    else:
        raise ValueError(fator)
    h, w = c.shape
    out = np.zeros((h * fator, w * fator), np.uint32)
    for dy in range(fator):
        for dx in range(fator):
            out[dy::fator, dx::fator] = blocos[dy][dx]
    return Image.fromarray(out.view(np.uint8).reshape(h * fator, w * fator, 4))


# Vista usada na arena (o chefão fica à direita, olhando para a Lua) e se o mod
# espelha horizontalmente. A vista de 3/4 dá mais vida que a de frente.
ARENA = {
    "vespera": (2, True),
    "dama_penumbra": (2, True),
    "golem_obsidiana": (2, True),
    "leviata": (2, True),
    "ignis": (2, True),
    "relojoeiro": (2, True),
    "sir_solis": (2, True),
    "rei_espelho": (2, True),
    "nebula": (5, False),
    "malakor": (2, True),  # v3: 3/4 como os outros (era de frente)
}


def info_chefoes(imagens):
    info = {}
    for nome, (vista, espelhar) in ARENA.items():
        arq = f"chefoes/{nome}/{nome}_{vista:02d}.png"
        if arq not in imagens:
            continue
        im = imagens[arq]
        info[nome] = {"arena": f"{nome}_{vista:02d}.png", "espelhar": espelhar,
                      "frente": f"{nome}_01.png", "w": im.width, "h": im.height,
                      "vistas": sorted(Path(k).name for k in imagens
                                       if k.startswith(f"chefoes/{nome}/") and k.count("/") == 2)}
    return info


def previa_arena(imagens, info, caminho, escala=3):
    """Lua x cada chefão, lado a lado, na mesma escala de pixel e no mesmo chão."""
    from PIL import ImageDraw
    lua = Image.open(SAIDA / "lua" / "lua_lado.png")
    pares = []
    for nome, i in info.items():
        im = imagens[f"chefoes/{nome}/{i['arena']}"]
        if i["espelhar"]:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        pares.append((nome, im))
    col, gap = 2, 20
    cel_w = max((lua.width + 30 + im.width) * escala for _, im in pares) + gap
    cel_h = max(max(lua.height, im.height) * escala for _, im in pares) + 30
    linhas = (len(pares) + col - 1) // col
    tela = Image.new("RGBA", (cel_w * col + gap, cel_h * linhas + gap), (24, 22, 48, 255))
    d = ImageDraw.Draw(tela)
    for k, (nome, im) in enumerate(pares):
        x0, y0 = gap + (k % col) * cel_w, gap + (k // col) * cel_h
        chao = y0 + cel_h - 30
        d.line([(x0, chao), (x0 + cel_w - gap * 2, chao)], fill=(60, 55, 100, 255), width=2)
        L = lua.resize((lua.width * escala, lua.height * escala), Image.NEAREST)
        B = im.resize((im.width * escala, im.height * escala), Image.NEAREST)
        tela.alpha_composite(L, (x0, chao - L.height))
        tela.alpha_composite(B, (x0 + L.width + 30 * escala, chao - B.height))
        d.text((x0, chao + 6), f"{nome}  ({im.height} px; Lua 84 px)", fill=(220, 210, 250, 255))
    tela.save(caminho)


def previa_chefoes(imagens, caminho, escala=3):
    """Uma linha por chefão, todas as vistas numeradas, com a Lua de régua à esquerda."""
    from PIL import ImageDraw
    if not imagens:
        return
    lua = Image.open(SAIDA / "lua" / "lua_lado.png")
    por_chefao = {}
    for nome, im in sorted(imagens.items()):
        if nome.count("/") == 2:  # só as vistas; a subpasta teia/ fica de fora
            por_chefao.setdefault(nome.split("/")[1], []).append((nome, im))
    gap, rotulo = 14, 18
    linhas = []
    for chefao, vistas in por_chefao.items():
        itens = [("lua", lua)] + [(Path(n).stem.split("_")[-1], im) for n, im in vistas]
        h = max(im.height for _, im in itens) * escala + rotulo
        w = sum(im.width * escala + gap for _, im in itens) + gap + 150
        linhas.append((chefao, itens, w, h))
    W = max(w for *_, w, _ in linhas)
    H = sum(h + gap for *_, h in linhas) + gap
    tela = Image.new("RGBA", (W, H), (24, 22, 48, 255))
    d = ImageDraw.Draw(tela)
    y = gap
    for chefao, itens, _, h in linhas:
        d.text((gap, y + h // 2), chefao, fill=(230, 220, 255, 255))
        x = 150
        for rot, im in itens:
            g = im.resize((im.width * escala, im.height * escala), Image.NEAREST)
            topo = y + (h - rotulo - g.height)  # todos apoiados no mesmo chão
            tela.alpha_composite(g, (x, topo))
            d.text((x, y + h - rotulo + 3), rot, fill=(150, 140, 190, 255))
            x += g.width + gap
        y += h + gap
    tela.save(caminho)


def previa(todas, caminho, escala=4):
    margem, linha_h, x, y, linha = 16, 0, 16, 16, []
    largura = 1400
    posicoes = []
    for nome, im in todas.items():
        w, h = im.width * escala, im.height * escala
        if x + w > largura - margem:
            x, y = margem, y + linha_h + 40
            linha_h = 0
        posicoes.append((nome, im, x, y))
        x += w + margem
        linha_h = max(linha_h, h)
    altura = y + linha_h + 40
    tela = Image.new("RGBA", (largura, altura), (24, 22, 48, 255))
    # xadrez sutil para mostrar a transparência
    xadrez = np.indices((altura, largura)).sum(0) // 16 % 2
    base = np.where(xadrez[..., None] == 1, [34, 31, 66, 255], [24, 22, 48, 255]).astype(np.uint8)
    tela = Image.fromarray(base)
    for nome, im, x, y in posicoes:
        grande = im.resize((im.width * escala, im.height * escala), Image.NEAREST)
        tela.alpha_composite(grande, (x, y))
    tela.save(caminho)
    return posicoes


def so_um_chefao(nome):
    """Refaz só um chefão (`--so <nome>`), sem tocar no resto de assets/ (que tem
    arte aprovada e editada à mão). Guarda as vistas antigas em
    previa_faixa/backup_chefoes/<nome>_<data>/ e atualiza só a entrada dele no
    chefoes.json."""
    import shutil
    import time
    folha = FOLHAS[f"chefao_{nome}"]
    pasta = SAIDA / folha["pasta"]
    if pasta.exists():
        backup = RAIZ / "previa_faixa" / "backup_chefoes" / f"{nome}_{time.strftime('%Y%m%d_%H%M%S')}"
        shutil.copytree(pasta, backup)
        for velho in pasta.glob(f"{nome}_*.png"):
            velho.unlink()
        print(f"  vistas antigas guardadas em {backup.relative_to(RAIZ)}")
    imagens, paleta, grids = processar_auto(folha)
    for k, im in imagens.items():
        (SAIDA / k).parent.mkdir(parents=True, exist_ok=True)
        im.save(SAIDA / k)
        print(f"{k:34} {im.width:>4}x{im.height:<4} (pixel original ≈ {grids.get(k, 'gerado')} px)")
    (SAIDA / f"paleta_chefao_{nome}.json").write_text(
        json.dumps(["#%02x%02x%02x" % tuple(c) for c in paleta], indent=1))
    arq_info = SAIDA / "chefoes" / "chefoes.json"
    info = json.loads(arq_info.read_text())
    info.update(info_chefoes(imagens))
    arq_info.write_text(json.dumps(info, indent=1, ensure_ascii=False))


def main():
    if "--so" in sys.argv:
        so_um_chefao(sys.argv[sys.argv.index("--so") + 1])
        return
    todas, relatorio, extras = {}, {}, {}
    for chave, folha in FOLHAS.items():
        imagens, paleta, grids = (processar_auto if folha.get("auto") else processar)(folha)
        if "_barra_cheia" in imagens:
            info = montar_barras(imagens)
            (SAIDA / "ui").mkdir(parents=True, exist_ok=True)
            (SAIDA / "ui" / "barra.json").write_text(json.dumps(info, indent=1))
            for nome, pct in [("luz", 0.82), ("mana", 0.55), ("mochila", 0.2), ("xp", 1.0)]:
                extras[f"exemplo: {nome} {int(pct * 100)}%"] = barra_composta(imagens, info, nome, pct)
        if "_moldura_nivel" in imagens:
            info_nivel = montar_nivel(imagens)
            (SAIDA / "ui" / "nivel").mkdir(parents=True, exist_ok=True)
            (SAIDA / "ui" / "nivel" / "nivel.json").write_text(json.dumps(info_nivel, indent=1))
            extras["ref: 1"] = imagens.pop("_moldura_1")
            extras["ref: 99"] = imagens.pop("_moldura_99")
            for n in (1, 7, 42, 99, 128, 777, 1024, 9999):
                extras[f"exemplo: nível {n}"] = selo_nivel(imagens, info_nivel, n)
        for nome, im in imagens.items():
            destino = SAIDA / nome
            destino.parent.mkdir(parents=True, exist_ok=True)
            im.save(destino)
            todas[nome] = im
            relatorio[nome] = {"tamanho": im.size, "pixel_original": grids.get(nome, "gerado")}
        (SAIDA / f"paleta_{chave}.json").write_text(
            json.dumps(["#%02x%02x%02x" % tuple(c) for c in paleta], indent=1)
        )
    base = {k: v for k, v in todas.items() if not k.startswith("chefoes/")}
    previa({**base, **extras}, RAIZ / "previa_assets.png")
    chefoes = {k: v for k, v in todas.items() if k.startswith("chefoes/")}
    if chefoes:
        previa_chefoes(chefoes, RAIZ / "previa_chefoes.png")
        info = info_chefoes(chefoes)
        (SAIDA / "chefoes" / "chefoes.json").write_text(json.dumps(info, indent=1, ensure_ascii=False))
        previa_arena(chefoes, info, RAIZ / "previa_arena.png")
    for nome, info in relatorio.items():
        print(f"{nome:34} {info['tamanho'][0]:>4}x{info['tamanho'][1]:<4} (pixel original ≈ {info['pixel_original']} px)")


if __name__ == "__main__":
    main()
