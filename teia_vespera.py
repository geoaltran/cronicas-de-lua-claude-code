"""Teia de sonhos da Vespera, redesenhada em pixel art limpa.

Substitui as teias originais (malha ruidosa) por um apanhador de sonhos de traço
limpo: aro com luz de um lado, raios, anel interno, conta central e pingentes com
contas. Também gera quadros de giro para o mod animar a teia.
"""
import math
import numpy as np
from PIL import Image
from scipy import ndimage as nd

# cores (o ciano da arte original, em 4 tons)
BRILHO = (220, 255, 255, 255)   # conta central, luz do aro, contas
CIANO = (56, 232, 242, 255)     # aro e anel interno
FIO = (28, 170, 205, 255)       # raios e pingentes (recuam um pouco)
SOMBRA = (20, 110, 160, 255)    # lado de baixo do aro

R = 6  # raio do aro: 13 px de diâmetro, como na arte original


def _ponto(img, x, y, cor):
    h, w = img.shape[:2]
    if 0 <= x < w and 0 <= y < h:
        img[y, x] = cor


def _linha(img, x0, y0, x1, y1, cor):
    """Bresenham: linha de 1 px, sem serrilhado borrado."""
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        _ponto(img, x0, y0, cor)
        if x0 == x1 and y0 == y1:
            return
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def _aro(img, cx, cy, r, cor, cor_luz=None, cor_sombra=None):
    """Círculo de 1 px (ponto médio); luz em cima à esquerda, sombra embaixo à direita."""
    x, y, d = r, 0, 1 - r
    pts = []
    while x >= y:
        pts += [(x, y), (y, x), (-y, x), (-x, y), (-x, -y), (-y, -x), (y, -x), (x, -y)]
        y += 1
        if d < 0:
            d += 2 * y + 1
        else:
            x -= 1
            d += 2 * (y - x) + 1
    for px, py in set(pts):
        c = cor
        if cor_luz and px + py <= -r:          # quadrante de cima/esquerda
            c = cor_luz
        elif cor_sombra and px + py >= r:      # quadrante de baixo/direita
            c = cor_sombra
        _ponto(img, cx + px, cy + py, c)


def desenhar_teia(angulo=0.0, pingentes=True):
    """Um apanhador de sonhos. Devolve (imagem RGBA, centro do aro)."""
    alt_pingente = 9 if pingentes else 0
    w, h = 2 * R + 3, 2 * R + 3 + alt_pingente
    img = np.zeros((h, w, 4), np.uint8)
    cx = cy = R + 1
    # raios (6), girando com o ângulo do quadro
    for k in range(6):
        a = angulo + k * math.pi / 3
        _linha(img, cx, cy, cx + round((R - 1) * math.cos(a)), cy + round((R - 1) * math.sin(a)), FIO)
    # anel interno (hexágono que liga os raios na metade do caminho)
    vert = [(cx + round(3 * math.cos(angulo + k * math.pi / 3)),
             cy + round(3 * math.sin(angulo + k * math.pi / 3))) for k in range(6)]
    for (x0, y0), (x1, y1) in zip(vert, vert[1:] + vert[:1]):
        _linha(img, x0, y0, x1, y1, CIANO)
    _aro(img, cx, cy, R, CIANO, BRILHO, SOMBRA)
    _ponto(img, cx, cy, BRILHO)
    if pingentes:
        # três fios pendurados no aro, com uma conta em cada ponta
        for dx, comp in ((-3, 5), (0, 8), (3, 5)):
            x = cx + dx
            y0 = cy + round(math.sqrt(max(R * R - dx * dx, 0))) + 1
            _linha(img, x, y0, x, y0 + comp - 2, FIO)
            yc = y0 + comp - 1
            for ddx, ddy in ((0, 0), (-1, 1), (1, 1), (0, 1), (0, 2)):  # conta em losango
                _ponto(img, x + ddx, yc + ddy, BRILHO if (ddx, ddy) == (0, 0) else CIANO)
    return Image.fromarray(img), (cx, cy)


def quadros_giro(n=4):
    """n quadros com os raios girando (o aro e os pingentes ficam parados)."""
    return [desenhar_teia(angulo=k * (math.pi / 3) / n)[0] for k in range(n)]


def _eh_teia(c, a):
    """Ciano forte (fio) ou ciano-claro/branco (vão e mistura do JPEG)."""
    opaco = a > 0
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    fio = (r <= 150) & (g > 170) & (b > 170)
    claro = (r > 150) & (g > 190) & (b > 190)
    # mistura ciano+fundo (#517fc1). O verde maior que o vermelho separa do roxo
    # do corpo, que também tem muito azul mas pouco verde.
    azulada = (r < 120) & (g > 100) & (g < 170) & (b > 150) & (g > r + 30)
    # ciano escuro (sombra do fio). A aranha não tem nenhum tom esverdeado:
    # roxo, rosa e contorno têm sempre menos verde que vermelho.
    ciano_escuro = (g > r + 40) & (b > 80)
    return opaco & (fio | claro | azulada | ciano_escuro)


# Centro do aro de cada teia original, medido em cada vista (pixels do sprite).
TEIAS = {
    1: [(7, 6), (44, 6)],
    2: [(8, 8), (44, 6)],
    3: [(8, 6)],
    4: [(9, 8), (42, 6)],
    5: [(7, 6), (45, 6)],
    6: [(42, 6)],
}


def achar_teias(im):
    """Centros dos apanhadores de sonhos originais (blocos densos de ciano)."""
    a = np.asarray(im).astype(int)
    teia = _eh_teia(a[..., :3], a[..., 3])
    denso = nd.binary_closing(teia, iterations=1)
    rot, n = nd.label(denso)
    centros = []
    for i in range(1, n + 1):
        pts = np.argwhere(rot == i)
        if len(pts) < 40:
            continue
        y0 = pts[:, 0].min()
        topo = pts[pts[:, 0] <= y0 + 2 * R]          # só o aro, sem pingentes/fios
        cx = int(round((topo[:, 1].min() + topo[:, 1].max()) / 2))
        centros.append((cx, int(y0 + R)))
    return sorted(centros)


def tirar_teias(im):
    """Apaga todo o ciano: fora do corpo vira transparente; dentro do corpo,
    o buraco é preenchido com a cor do corpo mais próxima."""
    a = np.array(im)
    c = a[..., :3].astype(int)
    teia = _eh_teia(c, a[..., 3])
    resto = (a[..., 3] > 0) & ~teia
    # Silhueta do corpo sem a teia. Os fios das costas chegam até a borda, então
    # "preencher buracos" não basta: fecha a forma com um disco de raio 5 para
    # recuperar as quinas e bordas que a teia cobria. Só os pixels que eram teia
    # mudam, então o fechamento não mexe no vão entre as patas.
    yy, xx = np.mgrid[-5:6, -5:6]
    disco = xx ** 2 + yy ** 2 <= 25
    pad = 6
    fechado = nd.binary_closing(np.pad(resto, pad), structure=disco)[pad:-pad, pad:-pad]
    corpo = nd.binary_fill_holes(fechado | resto)
    # preenche com a cor do corpo mais próxima, nunca com o contorno escuro
    fonte = resto & (c.max(2) >= 60)
    _, (iy, ix) = nd.distance_transform_edt(~fonte, return_indices=True)
    preencher = teia & corpo
    a[preencher] = a[iy[preencher], ix[preencher]]
    a[teia & ~corpo, 3] = 0
    # contorno escuro na borda que foi reconstruída
    escuro = resto & (c.max(2) < 60)
    if escuro.any():
        cores, n = np.unique(c[escuro], axis=0, return_counts=True)
        contorno = cores[n.argmax()]
        opaco = a[..., 3] > 0
        borda = opaco & ~nd.binary_erosion(opaco, border_value=0)
        a[borda & preencher, :3] = contorno
    # sobras soltas de 1–2 px
    rot, n = nd.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    tam = nd.sum(a[..., 3] > 0, rot, range(1, n + 1))
    for i, t in enumerate(tam, 1):
        if t < 3:
            a[rot == i, 3] = 0
    return Image.fromarray(a), corpo


def aplicar(im, vista=None):
    """Sprite da Vespera -> (com teia nova, sem teia, centros das teias)."""
    centros = TEIAS.get(vista) or achar_teias(im)
    sem, corpo = tirar_teias(im)
    teia, (tcx, tcy) = desenhar_teia()
    # espaço para teias/pingentes que passem da borda do sprite original
    m = R + 12
    W, H = sem.width + 2 * m, sem.height + 2 * m
    base = Image.new("RGBA", (W, H))
    base.alpha_composite(sem, (m, m))
    sem_pad = base.copy()
    arr = np.array(base)
    corpo_pad = np.zeros((H, W), bool)
    corpo_pad[m:m + corpo.shape[0], m:m + corpo.shape[1]] = corpo
    for cx, cy in centros:
        cx, cy = cx + m, cy + m
        # fio de ancoragem: do aro até o ponto do corpo mais próximo
        ys, xs = np.nonzero(corpo_pad)
        if len(ys):
            k = np.argmin((xs - cx) ** 2 + (ys - cy) ** 2)
            bx, by = xs[k], ys[k]
            d = math.hypot(bx - cx, by - cy)
            if d > R:
                sx = cx + round((bx - cx) * R / d)
                sy = cy + round((by - cy) * R / d)
                _linha(arr, sx, sy, int(bx), int(by), FIO)
    base = Image.fromarray(arr)
    for cx, cy in centros:
        base.alpha_composite(teia, (cx + m - tcx, cy + m - tcy))
    # recorta de volta ao conteúdo, guardando o deslocamento para os centros
    caixa = base.getbbox()
    com = base.crop(caixa)
    sem_crop = sem_pad.crop(caixa)
    centros_final = [(cx + m - caixa[0], cy + m - caixa[1]) for cx, cy in centros]
    return com, sem_crop, centros_final
