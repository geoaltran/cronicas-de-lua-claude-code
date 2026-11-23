"""Marca animada: a lua pendurada no "C" balança e brilha, as estrelas piscam.

Parte da marca aprovada (assets/marca/marca.png, de marca.py) e não muda a arte:
  - separa o pingente (corrente + lua crescente) numa camada própria e tapa o
    buraco na base com as cores vizinhas;
  - gera os quadros do balanço girando o pingente no ponto onde a corrente
    prende (gira a 8x e volta pela moda de cada célula: o pixel continua limpo);
  - halo dourado pulsando em volta da lua e uma cintilação na ponta dela;
  - acha as estrelas do fundo azul; cada uma pisca no seu ritmo.

Sem --aplicar: grava a prévia previa_faixa/marca_animada.gif (x4, assinada).
Com --aplicar: grava assets/marca/animacao/ (base, quadros do pingente, máscara do
metal, json) e previa_marca.gif na raiz. O SVG animado do README sai de marca_svg.py.
"""
from pathlib import Path
import json
import math
import sys
from collections import Counter
import numpy as np
from PIL import Image
from scipy import ndimage as nd

RAIZ = Path(__file__).parent
MARCA = RAIZ / "assets/marca/marca.png"
ANGULOS = (-9, -6, -3, 0, 3, 6, 9)   # graus do balanço
QUADROS = 24                         # quadros do ciclo
MS = 100                             # ms por quadro (ciclo de 2,4 s)
CICLO_REFLEXO = 48                   # o reflexo passa uma vez a cada 4,8 s (2 balanços)
DURA_REFLEXO = 11                    # quadros que ele leva para cruzar a marca
REFLEXO = (255, 255, 246)
HALO = (255, 236, 160)
LUAR = (150, 165, 235)   # azul claro do brilho no céu
BRANCO = (253, 253, 253)
ESCALA_PREVIA = 4


def carregar() -> np.ndarray:
    return np.asarray(Image.open(MARCA).convert("RGBA")).astype(int)


def mascaras(m: np.ndarray):
    """Corrente, lua (com o contorno escuro) e as estrelas do fundo azul."""
    rgb = m[..., :3]
    H, W = rgb.shape[:2]
    yy, xx = np.mgrid[:H, :W]
    lum = rgb.mean(axis=2)
    cinza = (np.abs(rgb[..., 0] - rgb[..., 1]) < 30) & (rgb[..., 2] < rgb[..., 0]) & (lum > 70) & (lum < 190)
    corrente = cinza & (xx >= 40) & (xx <= 45) & (yy >= 33) & (yy <= 47)
    dourado = (rgb[..., 0] > 140) & (rgb[..., 2] < rgb[..., 0] - 40)
    caixa_lua = (xx >= 37) & (xx <= 47) & (yy >= 45) & (yy <= 59)
    lua = dourado & caixa_lua
    lua = nd.binary_fill_holes(lua)
    escuro = lum < 45
    contorno = nd.binary_dilation(lua, np.ones((3, 3), bool)) & escuro & caixa_lua & ~lua
    lua_toda = lua | contorno
    # estrelas: pontos claros pequenos cercados de azul
    azul = (rgb[..., 2] > rgb[..., 0] + 40) & (rgb.sum(axis=2) < 400)
    viz5 = nd.convolve(azul.astype(int), np.ones((5, 5), int), mode="constant")
    clara = (lum > 150) & (m[..., 3] > 0)
    cand = clara & ~azul & (viz5 >= 14) & ~corrente & ~lua_toda
    rot, _ = nd.label(cand, structure=np.ones((3, 3)))
    estrelas = []
    for i, s in enumerate(nd.find_objects(rot), 1):
        pts = np.argwhere(rot[s] == i)
        if len(pts) > 5:
            continue
        ys, xs = pts[:, 0] + s[0].start, pts[:, 1] + s[1].start
        estrelas.append({
            "x": int(round(xs.mean())), "y": int(round(ys.mean())),
            "px": [[int(x), int(y)] for x, y in zip(xs, ys)],
            "grande": len(pts) >= 3,
            "cor": [int(c) for c in Counter(tuple(rgb[y, x]) for x, y in zip(xs, ys)).most_common(1)[0][0]],
        })
    return corrente, lua_toda, lua, estrelas


def tapar(m: np.ndarray, buraco: np.ndarray) -> np.ndarray:
    """Preenche o buraco com a cor mais comum entre os vizinhos já preenchidos."""
    out = m.copy()
    falta = buraco.copy()
    H, W = falta.shape
    while falta.any():
        novos = []
        for y, x in np.argwhere(falta):
            viz = [tuple(out[j, i]) for j, i in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))
                   if 0 <= j < H and 0 <= i < W and not falta[j, i]]
            if viz:
                novos.append((y, x, Counter(viz).most_common(1)[0][0]))
        for y, x, c in novos:
            out[y, x] = c
            falta[y, x] = False
    return out


def pivo(corrente: np.ndarray) -> tuple[float, float]:
    ys, xs = np.nonzero(corrente)
    topo = ys.min()
    return float(xs[ys == topo].mean() + 0.5), float(topo)


def girar(camada: np.ndarray, px: float, py: float, graus: float) -> np.ndarray:
    """Gira a camada RGBA no pivô: amplia 8x, gira sem suavizar e volta pela moda."""
    if graus == 0:
        return camada.copy()
    k = 8
    H, W = camada.shape[:2]
    im = Image.fromarray(camada.astype(np.uint8)).resize((W * k, H * k), Image.NEAREST)
    im = im.rotate(-graus, resample=Image.NEAREST, center=(px * k, py * k))
    g = np.asarray(im).reshape(H, k, W, k, 4).transpose(0, 2, 1, 3, 4).reshape(H, W, k * k, 4)
    out = np.zeros_like(camada)
    for y in range(H):
        for x in range(W):
            cel = g[y, x]
            opaco = cel[cel[:, 3] > 0]
            if len(opaco) * 2 >= k * k:
                out[y, x] = Counter(map(tuple, opaco)).most_common(1)[0][0]
    return out


def separar(m: np.ndarray):
    corrente, lua_toda, lua, estrelas = mascaras(m)
    pend = corrente | lua_toda
    base = tapar(m, pend)
    for e in estrelas:
        sem = np.zeros(pend.shape, bool)
        for x, y in e["px"]:
            sem[y, x] = True
        base = tapar(base, sem)
    px, py = pivo(corrente)
    cam_corr = np.where(corrente[..., None], m, 0)
    cam_lua = np.where(lua_toda[..., None], m, 0)
    cam_brilho = np.repeat(np.where(lua[..., None], 255, 0), 4, axis=2)  # só o corpo dourado da lua
    quadros = {}
    for a in ANGULOS:
        c = girar(cam_corr, px, py, a)
        l = girar(cam_lua, px, py, a)
        b = girar(cam_brilho, px, py, a)[..., 3] > 0
        quadros[a] = (c, l, b)
    return base, quadros, estrelas, (px, py)


def compor(fundo: np.ndarray, cam: np.ndarray, alfa: float = 1.0) -> None:
    a = cam[..., 3:4] / 255 * alfa
    fundo[..., :3] = fundo[..., :3] * (1 - a) + cam[..., :3] * a
    fundo[..., 3] = np.maximum(fundo[..., 3], (cam[..., 3] * alfa).astype(int))


def ponto(img: np.ndarray, x: int, y: int, cor, alfa: float) -> None:
    H, W = img.shape[:2]
    if 0 <= x < W and 0 <= y < H and img[y, x, 3] > 0:
        img[y, x, :3] = img[y, x, :3] * (1 - alfa) + np.array(cor) * alfa


def angulo(t: int) -> int:
    alvo = 9 * math.sin(2 * math.pi * t / QUADROS)
    return min(ANGULOS, key=lambda a: abs(a - alvo))


def metal(img: np.ndarray) -> np.ndarray:
    """Partes de metal dourado: letras, cantoneiras, borda da placa, a lua."""
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    return (img[..., 3] > 0) & (r > 200) & (g > 135) & (b < r - 40)


def reflexo(img: np.ndarray, fase: float) -> None:
    """Faixa de luz na diagonal (/) correndo da esquerda para a direita, só no metal.

    fase: quadros (pode ser fracionária) desde o início da passagem."""
    if fase < 0 or fase > DURA_REFLEXO - 1:
        return
    H, W = img.shape[:2]
    inclin = 0.6                         # quanto a faixa deita: x + 0.6*y = centro
    ini, fim = -6, W + inclin * H + 6
    centro = ini + (fim - ini) * fase / (DURA_REFLEXO - 1)
    msk = metal(img)
    yy, xx = np.mgrid[:H, :W]
    u = xx + inclin * yy - centro            # distância (com sinal) ao centro da faixa
    # duas faixas, como brilho de metal: uma grossa e, logo atrás, uma fina
    faixas = ((np.abs(u) < 1.5, 1.0), ((np.abs(u) >= 1.5) & (np.abs(u) < 2.5), 0.55),
              ((u <= -4) & (u > -5.2), 0.8))
    for sel, alfa in faixas:
        sel = sel & msk
        img[sel, :3] = img[sel, :3] * (1 - alfa) + np.array(REFLEXO) * alfa


def quadro(base, quadros, estrelas, t: int, fase_reflexo: "float | None" = None) -> np.ndarray:
    img = base.astype(float).copy()
    c, l, corpo = quadros[angulo(t)]
    # halo: 2 anéis em volta do corpo da lua, pulsando (o dobro do ritmo do balanço)
    pulso = 0.5 + 0.5 * math.cos(2 * math.pi * t / (QUADROS / 2))
    # luar no céu: anéis redondos (cruz) por fora do contorno escuro, clareando o azul
    cruz = nd.generate_binary_structure(2, 1)
    lua_px = (l[..., 3] > 0) | (c[..., 3] > 0)
    d1 = nd.binary_dilation(lua_px, cruz)
    d2 = nd.binary_dilation(d1, cruz)
    d3 = nd.binary_dilation(d2, cruz)
    ceu = (base[..., 2] > base[..., 0] + 40)
    for msk, forca in ((d1 & ~lua_px, 0.42), (d2 & ~d1, 0.26), (d3 & ~d2, 0.12)):
        for y, x in np.argwhere(msk & ceu):
            ponto(img, x, y, LUAR, forca * (0.3 + 0.7 * pulso))
    compor(img, c.astype(float))
    compor(img, l.astype(float))
    # reflexo: o corpo da lua clareia um pouco no auge do pulso
    for y, x in np.argwhere(corpo):
        ponto(img, x, y, HALO, 0.25 * pulso)
    # cintilação na ponta de baixo da lua (quadros 4 a 8 do ciclo)
    ys, xs = np.nonzero(corpo)
    if len(ys):
        i = (xs + ys).argmax()          # ponta de baixo do crescente
        tx, ty = int(xs[i]), int(ys[i])
        fase = t % QUADROS - 4
        braco = {0: 0, 1: 1, 2: 2, 3: 1, 4: 0}.get(fase)
        if braco is not None:
            ponto(img, tx, ty, BRANCO, 1.0)
            for d in range(1, braco + 1):
                for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                    ponto(img, tx + dx, ty + dy, BRANCO, 0.9 if d == 1 else 0.55)
    if fase_reflexo is not None:
        reflexo(img, fase_reflexo)
    # estrelas: cada uma com a sua fase; as grandes viram cruz no auge
    rng = np.random.default_rng(11)
    for e in estrelas:
        fase = rng.uniform(0, 2 * math.pi)
        ritmo = rng.choice([1, 2])  # 1 ou 2 piscadas por ciclo (o laço fecha certo)
        b = 0.5 + 0.5 * math.sin(2 * math.pi * ritmo * t / QUADROS + fase)
        cor = tuple(e["cor"])
        if b < 0.2:
            alfa, cor_px = 0.3, cor
        elif b < 0.8:
            alfa, cor_px = 1.0, cor
        else:
            alfa, cor_px = 1.0, BRANCO
        for x, y in e["px"]:
            ponto(img, x, y, cor_px, alfa)
        if b >= 0.8 and e["grande"]:
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                ponto(img, e["x"] + dx, e["y"] + dy, BRANCO, 0.6)
    return np.clip(img, 0, 255).astype(np.uint8)


def gif(base, quadros, estrelas, destino: Path, escala: int, assinar: bool, com_reflexo: bool = False) -> None:
    ass = Image.open(RAIZ / "assets/ui/assinatura.png").convert("RGBA")
    ass = ass.resize((ass.width * 2, ass.height * 2), Image.NEAREST)
    imgs, duracoes = [], []
    total = CICLO_REFLEXO if com_reflexo else QUADROS
    SUB = 3   # durante a passagem do reflexo, 3 subquadros por quadro (fica liso no GIF)
    passos = []
    for t in range(total):
        if com_reflexo and t < DURA_REFLEXO:
            passos += [(t, t + k / SUB, MS // SUB) for k in range(SUB)]
        else:
            passos.append((t, None, MS))
    for t, fr, ms in passos:
        duracoes.append(ms)
        q = Image.fromarray(quadro(base, quadros, estrelas, t % QUADROS, fr))
        q = q.resize((q.width * escala, q.height * escala), Image.NEAREST)
        tela = Image.new("RGBA", (q.width + 32, q.height + 32 + (ass.height + 8 if assinar else 0)), (24, 22, 40, 255))
        tela.alpha_composite(q, (16, 16))
        if assinar:
            tela.alpha_composite(ass, (tela.width - ass.width - 16, tela.height - ass.height - 8))
        imgs.append(tela.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    imgs[0].save(destino, save_all=True, append_images=imgs[1:], duration=duracoes, loop=0, optimize=False, disposal=1)


if __name__ == "__main__":
    m = carregar()
    base, quadros, estrelas, (px, py) = separar(m)
    print(f"pivô ({px:.1f}, {py:.1f}); {len(estrelas)} estrelas; ângulos {ANGULOS}")
    if "--aplicar" in sys.argv:
        pasta = RAIZ / "assets/marca/animacao"
        pasta.mkdir(exist_ok=True)
        Image.fromarray(base.astype(np.uint8)).save(pasta / "base.png")
        for a, (c, l, _) in quadros.items():
            cam = c.copy()
            msk = l[..., 3] > 0
            cam[msk] = l[msk]
            ys, xs = np.nonzero(cam[..., 3])
            Image.fromarray(cam.astype(np.uint8)).save(pasta / f"pingente_{a:+d}.png")
        (pasta / "animacao.json").write_text(json.dumps({
            "pivo": [px, py], "angulos": ANGULOS, "ms": MS, "quadros": QUADROS,
            "halo": HALO, "luar": LUAR, "reflexo": {"cor": REFLEXO, "ciclo": CICLO_REFLEXO,
            "dura": DURA_REFLEXO, "inclin": 0.6}, "estrelas": estrelas}, ensure_ascii=False, indent=1))
        Image.fromarray(np.where(metal(base)[..., None], 255, 0).astype(np.uint8).repeat(4, axis=2)).save(pasta / "metal.png")
        gif(base, quadros, estrelas, RAIZ / "previa_marca.gif", 4, True, True)
        print("gravado em assets/marca/animacao/ e previa_marca.gif")
    else:
        gif(base, quadros, estrelas, RAIZ / "previa_faixa/marca_animada.gif", ESCALA_PREVIA, True)
        gif(base, quadros, estrelas, RAIZ / "previa_faixa/marca_reflexo.gif", ESCALA_PREVIA, True, True)
        print("prévias: previa_faixa/marca_animada.gif e marca_reflexo.gif")
