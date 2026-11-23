"""Marca animada em SVG: o README e a tela de abertura do jogo usam a mesma montagem.

Usa as camadas de marca_animada.py e anima tudo no próprio SVG (SMIL + CSS, sem script):
  - pingente: um grupo por ângulo, trocado em degraus (ciclo de 2,4 s);
  - luar em volta da lua e reflexo no corpo dela, pulsando (contínuo, liso);
  - cintilação na ponta de baixo da lua;
  - estrelas piscando (CSS compartilhado; cada uma com o seu atraso);
  - reflexo diagonal só no metal (máscara), deslizando liso a cada 4,8 s.
As imagens vão embutidas (PNG com paleta, sem perdas) no tamanho nativo e são
ampliadas sem suavizar (image-rendering: pixelated).

fragmento() devolve o miolo (coordenadas nativas, canto em 0,0) e o CSS, para o
construir_mod.py embutir no mod. Rodando este arquivo: grava previa_marca.svg.
"""
from pathlib import Path
import base64
import math
import numpy as np
from PIL import Image
from scipy import ndimage as nd
import marca_animada as ma
from construir_mod import png_sem_perdas

RAIZ = Path(__file__).parent
ESCALA = 4
MARGEM = 4          # px nativos em volta no README (a cintilação e o luar não cortam)


def png(arr: np.ndarray) -> str:
    dados = png_sem_perdas(Image.fromarray(arr.astype(np.uint8)))
    return "data:image/png;base64," + base64.b64encode(dados).decode()


def recorte(arr: np.ndarray):
    """Corta a camada no que é visível: (png, x, y, w, h) ou None."""
    ys, xs = np.nonzero(arr[..., 3])
    if not len(ys):
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return png(arr[y0:y1, x0:x1]), int(x0), int(y0), int(x1 - x0), int(y1 - y0)


def img(r) -> str:
    d, x, y, w, h = r
    return f'<image href="{d}" x="{x}" y="{y}" width="{w}" height="{h}"/>'


def tempos(n: int) -> str:
    return ";".join(f"{i / n:.3f}".rstrip("0").rstrip(".") for i in range(n)) + ";1"


def degraus(vals, dur: float) -> str:
    """Opacidade em degraus: um valor por quadro do ciclo."""
    v = ";".join(str(x) for x in vals) + f";{vals[-1]}"
    return (f'<animate attributeName="opacity" values="{v}" keyTimes="{tempos(len(vals))}" '
            f'calcMode="discrete" dur="{dur}s" repeatCount="indefinite"/>')


def keyframes(nome: str, vals) -> str:
    n = len(vals)
    passos = "".join(f"{100 * i / n:.2f}%{{opacity:{v}}}" for i, v in enumerate(vals))
    return f"@keyframes {nome}{{{passos}100%{{opacity:{vals[-1]}}}}}"


def fragmento(inicio_reflexo: float = 0.0) -> dict:
    """Miolo animado da marca em coordenadas nativas: {svg, css, w, h}.

    inicio_reflexo: segundos até a primeira passagem do reflexo (antes dela as
    faixas ficam paradas fora da marca, à esquerda)."""
    m = ma.carregar()
    base, quadros, estrelas, _ = ma.separar(m)
    H, W = base.shape[:2]
    N = ma.QUADROS
    dur = N * ma.MS / 1000
    angs = [ma.angulo(t) for t in range(N)]
    out = [f'<image href="{png(base)}" x="0" y="0" width="{W}" height="{H}"/>']
    css = []
    ceu = base[..., 2] > base[..., 0] + 40
    cruz = nd.generate_binary_structure(2, 1)

    # pulso do luar e do reflexo da lua (o mesmo do GIF), liso: CSS com o ciclo todo
    pul = [0.5 + 0.5 * math.cos(2 * math.pi * t / (N / 2)) for t in range(N)]
    css.append(keyframes("mc-luar", [round(0.3 + 0.7 * p, 2) for p in pul]))
    css.append(keyframes("mc-bril", [round(p, 2) for p in pul]))
    css.append(f".mc-luar{{animation:mc-luar {dur}s linear infinite}}.mc-bril{{animation:mc-bril {dur}s linear infinite}}")

    for a in ma.ANGULOS:
        c, l, corpo = quadros[a]
        lua_px = (l[..., 3] > 0) | (c[..., 3] > 0)
        d1 = nd.binary_dilation(lua_px, cruz)
        d2 = nd.binary_dilation(d1, cruz)
        d3 = nd.binary_dilation(d2, cruz)
        luar = np.zeros((H, W, 4))
        luar[..., :3] = ma.LUAR
        for msk, forca in ((d1 & ~lua_px, 0.42), (d2 & ~d1, 0.26), (d3 & ~d2, 0.12)):
            luar[msk & ceu, 3] = round(255 * forca)
        pend = c.copy()
        pend[l[..., 3] > 0] = l[l[..., 3] > 0]
        bril = np.zeros((H, W, 4))
        bril[..., :3] = ma.HALO
        bril[corpo, 3] = round(255 * 0.25)
        vis = [1 if x == a else 0 for x in angs]
        partes = [f'<g opacity="{vis[0]}">', degraus(vis, dur)]
        for r, classe in ((recorte(luar), "mc-luar"), (recorte(pend), ""), (recorte(bril), "mc-bril")):
            if r:
                partes.append(f'<g class="{classe}">{img(r)}</g>' if classe else img(r))
        partes.append("</g>")
        out.append("".join(partes))

    # cintilação na ponta de baixo da lua (quadros 4 a 8)
    for t, braco in ((4, 0), (5, 1), (6, 2), (7, 1), (8, 0)):
        _, _, corpo = quadros[angs[t]]
        ys, xs = np.nonzero(corpo)
        i = (xs + ys).argmax()
        tx, ty = int(xs[i]), int(ys[i])
        rects = [f'<rect x="{tx}" y="{ty}" width="1" height="1"/>']
        for d in range(1, braco + 1):
            for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                op = 0.9 if d == 1 else 0.55
                rects.append(f'<rect x="{tx + dx}" y="{ty + dy}" width="1" height="1" opacity="{op}"/>')
        vis = [1 if x == t else 0 for x in range(N)]
        out.append(f'<g fill="#fdfdfd" opacity="0">{degraus(vis, dur)}{"".join(rects)}</g>')

    # reflexo diagonal só no metal: máscara + duas faixas deslizando
    msk = np.zeros((H, W, 4))
    msk[ma.metal(base)] = 255
    inc = 0.6
    ini, fim = -8, W + inc * H + 8
    ciclo = ma.CICLO_REFLEXO * ma.MS / 1000
    fra = (ma.DURA_REFLEXO - 1) / ma.CICLO_REFLEXO
    cor = "#%02x%02x%02x" % ma.REFLEXO

    def faixa(u0: float, u1: float, op: float) -> str:
        pts = [(u0 + inc * 2, -2), (u1 + inc * 2, -2), (u1 - inc * (H + 2), H + 2), (u0 - inc * (H + 2), H + 2)]
        return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="{cor}" opacity="{op}"/>'

    faixas = faixa(-1.5, 1.5, 1.0) + faixa(-2.5, -1.5, 0.55) + faixa(1.5, 2.5, 0.55) + faixa(-5.2, -4.0, 0.8)
    out.append(
        f'<mask id="mc-metal" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
        f'<image href="{png(msk)}" x="0" y="0" width="{W}" height="{H}"/></mask>'
        f'<g mask="url(#mc-metal)"><g transform="translate({ini} 0)"><g>'
        f'<animateTransform attributeName="transform" type="translate" values="0 0;{fim - ini:.1f} 0;{fim - ini:.1f} 0" '
        f'keyTimes="0;{fra:.4f};1" dur="{ciclo}s" begin="{inicio_reflexo:g}s" repeatCount="indefinite"/>{faixas}</g></g></g>')

    # estrelas (a base não tem as estrelas): cor normal / apagada, branca no auge, cruz nas grandes.
    # Um desenho de piscada por ritmo (CSS); cada estrela entra com o seu atraso.
    ondas = {}
    for ritmo in (1, 2):
        bs = [0.5 + 0.5 * math.sin(2 * math.pi * ritmo * t / N) for t in range(N)]
        css.append(keyframes(f"mc-c{ritmo}", [0.3 if b < 0.2 else (1 if b < 0.8 else 0) for b in bs]))
        css.append(keyframes(f"mc-b{ritmo}", [1 if b >= 0.8 else 0 for b in bs]))
        css.append(f".mc-c{ritmo}{{animation:mc-c{ritmo} {dur}s step-end infinite}}"
                   f".mc-b{ritmo}{{animation:mc-b{ritmo} {dur}s step-end infinite}}")
        ondas[ritmo] = True
    rng = np.random.default_rng(11)   # mesma semente e ordem do GIF
    for e in estrelas:
        fase = rng.uniform(0, 2 * math.pi)
        ritmo = int(rng.choice([1, 2]))
        atraso = -(fase / (2 * math.pi * ritmo)) * dur   # sin(2π r t/N + φ) = onda adiantada
        est = f'style="animation-delay:{atraso:.2f}s"'
        cor_e = "#%02x%02x%02x" % tuple(e["cor"])
        px = "".join(f'<rect x="{x}" y="{y}" width="1" height="1"/>' for x, y in e["px"])
        out.append(f'<g class="mc-c{ritmo}" {est} fill="{cor_e}">{px}</g>')
        braco = ""
        if e["grande"]:
            braco = "".join(f'<rect x="{e["x"] + dx}" y="{e["y"] + dy}" width="1" height="1" opacity="0.6"/>'
                            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)))
        out.append(f'<g class="mc-b{ritmo}" {est} fill="#fdfdfd">{px}{braco}</g>')

    return {"svg": "".join(out), "css": "".join(css), "w": W, "h": H}


def readme() -> str:
    f = fragmento()
    W, H = f["w"], f["h"]
    ass = np.asarray(Image.open(RAIZ / "assets/ui/assinatura.png").convert("RGBA"))
    ah, aw = ass.shape[:2]
    Wt, Ht = W + 2 * MARGEM, H + 2 * MARGEM + ah + 2
    assin = f'<image href="{png(ass)}" x="{Wt - aw - MARGEM}" y="{Ht - ah - 1}" width="{aw}" height="{ah}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{Wt * ESCALA}" height="{Ht * ESCALA}" '
            f'viewBox="0 0 {Wt} {Ht}" shape-rendering="crispEdges" role="img" '
            f'aria-label="As Crônicas de Lua">'
            f'<title>As Crônicas de Lua · art by George Altran (@geoaltran), CC BY-NC 4.0</title>'
            f'<style>image{{image-rendering:pixelated;image-rendering:crisp-edges}}{f["css"]}</style>'
            f'<g transform="translate({MARGEM} {MARGEM})">{f["svg"]}</g>{assin}</svg>')


if __name__ == "__main__":
    svg = readme()
    (RAIZ / "previa_marca.svg").write_text(svg, encoding="utf-8")
    print(f"previa_marca.svg: {len(svg):,} caracteres")
