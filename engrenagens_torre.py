"""Engrenagens girando da Torre (fase B).

As engrenagens das casas do meio.png da Torre giram. O miolo de cada uma (aro
de dentro, raios e cubo) fica como está na arte aprovada; só o anel dos dentes
é redesenhado girando, na paleta da própria engrenagem, com a parede de trás
reconstruída onde um dente sai (puxando a parede de fora, no mesmo ângulo).
Cada folha tem F quadros que avançam 1/F de dente: depois do último, volta ao
primeiro sem emenda. Engrenagens que se tocam giram em sentidos opostos, todas
no mesmo ritmo de dentes (a borda anda junto).

Uso:
  engrenagens_torre.py              # prévia em previa_faixa/biomas/torre/engrenagens/
  engrenagens_torre.py --aplicar    # grava as folhas em assets/cenarios/torre/
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

AQUI = Path(__file__).parent
MEIO = AQUI / "assets/cenarios/torre/meio.png"
PREVIA = AQUI / "previa_faixa/biomas/torre/engrenagens"
ASSETS = AQUI / "assets/cenarios/torre"

F = 3  # quadros por dente

# (nome, centro aproximado no meio.png, raio aproximado, sentido: 1 horário, -1 anti-horário, dentes)
ENGRENAGENS = [
    ("grande", (21.5, 150.5), 14, 1, 12),
    ("cima", (43.5, 143.5), 7.5, -1, 8),   # as pequenas: 8 dentes (contados na arte ampliada)
    ("baixo", (43.5, 161.5), 8.5, -1, 8),
    ("dir_cima", (438.5, 143), 7.5, 1, 8),
    ("dir_baixo", (438.5, 162), 8.8, -1, 8),
]
# ponta do dente fixa (medida na arte; o ajuste automático puxava o latão do vizinho)
PONTA = {"grande": 13.6, "cima": 7.0, "baixo": 8.2, "dir_cima": 7.0, "dir_baixo": 8.4}
# a grande tem 3 raios: o miolo gira junto; a volta sem emenda é a dos raios (4 dentes)
RAIOS = {"grande": 3}
# quadros por dente de cada uma (a grande com 2, para caber no teto da faixa; o
# mod faz cada quadro dela durar mais, e todas andam o mesmo dente por segundo)
POR_DENTE = {"grande": 2}

# cores da engrenagem (latão) e do contorno, tiradas da arte
LATAO = np.array([118, 82, 53])
LUZ = np.array([143, 111, 76])
MEIA_LUZ = np.array([134, 97, 60])
SOMBRA = np.array([83, 57, 44])
CONTORNO = np.array([12, 9, 18])


def eh_latao(px):
    r, g, b = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int)
    return (r > 78) & (r - b > 25) & (g > 50)


def ajustar(arr, c, R, dentes=None):
    """Acha o centro, os raios (ponta e raiz do dente), o número de dentes e a
    fase pela própria arte: o latão no anel dos dentes vira um perfil angular."""
    cx0, cy0 = c
    lat = eh_latao(arr[..., :3]) & (arr[..., 3] > 0)
    melhor = None
    for dx in np.arange(-1, 1.1, 0.5):
        for dy in np.arange(-1, 1.1, 0.5):
            cx, cy = cx0 + dx, cy0 + dy
            yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
            dist = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
            perto = lat & (dist < R + 0.8)
            if perto.sum() < 10:
                continue
            ponta = np.percentile(dist[perto], 97)
            ang = np.arctan2(yy + 0.5 - cy, xx + 0.5 - cx)
            anel = perto & (dist > ponta - 1.6)
            for n in ([dentes] if dentes else range(6, 17)):
                z = np.exp(1j * n * ang[anel]).sum()
                nota = abs(z) / max(anel.sum(), 1)
                if melhor is None or nota > melhor[0]:
                    melhor = (nota, cx, cy, ponta, n, float(np.angle(z)) / n)
    nota, cx, cy, ponta, n, fase = melhor
    return {"cx": cx, "cy": cy, "ponta": ponta, "n": n, "fase": fase, "nota": nota}


def girar(rec, cx, cy, ang):
    """Gira o pixel art em volta de (cx, cy) sem borrar: amplia 8x (vizinho),
    gira pelo vizinho e reduz pela cor mais comum de cada bloco 8x8."""
    k = 8
    h, w = rec.shape[:2]
    yy, xx = np.mgrid[0:h * k, 0:w * k]
    x = (xx + 0.5) / k - cx
    y = (yy + 0.5) / k - cy
    ca, sa = math.cos(-ang), math.sin(-ang)
    sx = np.clip(np.floor(cx + x * ca - y * sa).astype(int), 0, w - 1)
    sy = np.clip(np.floor(cy + x * sa + y * ca).astype(int), 0, h - 1)
    grande = rec[sy, sx].reshape(h, k, w, k, 4).transpose(0, 2, 1, 3, 4).reshape(h, w, k * k, 4)
    out = np.zeros_like(rec)
    for j in range(h):
        for i in range(w):
            cores, n = np.unique(grande[j, i], axis=0, return_counts=True)
            out[j, i] = cores[n.argmax()]
    return out


def desenhar_anel(g, ang0, h, w, ox, oy, raiz):
    """Máscara do anel com dentes girado de ang0 (supersample 4x), na caixa."""
    s = 4
    yy, xx = np.mgrid[0:h * s, 0:w * s]
    x = (xx + 0.5) / s + ox - g["cx"]
    y = (yy + 0.5) / s + oy - g["cy"]
    dist = np.hypot(x, y)
    ang = np.arctan2(y, x) - ang0
    # dente: perfil trapezoidal no ângulo (topo um pouco mais estreito que a base)
    per = 2 * math.pi / g["n"]
    u = np.abs(((ang + per / 2) % per) - per / 2) / per  # 0 no meio do dente, 0,5 no vão
    alt = np.clip((0.27 - u) / 0.08, 0, 1)  # 1 no dente, 0 no vão (dente fino, como na arte)
    raio = raiz + (g["ponta"] - raiz) * alt
    m = (dist <= raio) & (dist >= raiz - 0.8)
    return m.reshape(h, s, w, s).mean((1, 3)) > 0.45


def folha(arr, nome, c, R, sentido, dentes):
    g = ajustar(arr, c, R, dentes)
    g["ponta"] = PONTA.get(nome, g["ponta"])
    raiz = g["ponta"] - (2.6 if g["ponta"] > 11 else 1.8)
    rcaixa = int(math.ceil(g["ponta"] + 2))
    ox, oy = int(math.floor(g["cx"])) - rcaixa, int(math.floor(g["cy"])) - rcaixa
    w = h = 2 * rcaixa + 1
    rec = arr[oy:oy + h, ox:ox + w].copy()
    yy, xx = np.mgrid[0:h, 0:w]
    x = xx + 0.5 + ox - g["cx"]
    y = yy + 0.5 + oy - g["cy"]
    dist = np.hypot(x, y)
    ang = np.arctan2(y, x)
    # a engrenagem original (só os pixels dela: miolo, latão do anel e o
    # contorno escuro colado no latão), girada inteira; a parede fica parada
    lat = eh_latao(rec[..., :3])
    escuro = rec[..., :3].astype(int).sum(-1) < 140
    viz = np.zeros_like(lat)
    for dy_, dx_ in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        viz |= np.roll(np.roll(lat, dy_, 0), dx_, 1)
    peca = (dist <= g["ponta"] + 0.7) & ((dist < raiz) | lat | (escuro & viz))
    so = rec.copy()
    so[~peca, 3] = 0
    # parede de trás: só onde havia engrenagem no anel dos dentes; puxa a parede
    # de fora no mesmo ângulo, pulando o que é engrenagem ou escuro (vigas, contornos)
    fundo = rec.copy()
    for (j, i) in zip(*np.nonzero(peca & (dist >= raiz - 1.5))):
        achou = None
        for rr in np.arange(g["ponta"] + 1.2, g["ponta"] + 5, 0.7):
            sx = int(math.floor(g["cx"] + rr * math.cos(ang[j, i]))) - ox
            sy = int(math.floor(g["cy"] + rr * math.sin(ang[j, i]))) - oy
            if not (0 <= sx < w and 0 <= sy < h) or peca[sy, sx]:
                continue
            if not escuro[sy, sx] and not lat[sy, sx]:
                achou = rec[sy, sx]
                break
            if achou is None and not lat[sy, sx]:
                achou = rec[sy, sx]
        if achou is not None:
            fundo[j, i] = achou
    fd = POR_DENTE.get(nome, F)
    nq = fd * (g["n"] // RAIOS[nome]) if nome in RAIOS else fd
    quadros = []
    for q in range(nq):
        passo = sentido * q * (2 * math.pi / g["n"]) / fd
        gir = girar(so, g["cx"] - ox, g["cy"] - oy, passo)
        out = Image.fromarray(fundo)
        out.alpha_composite(Image.fromarray(gir))
        out = np.array(out)
        # só o disco da engrenagem (fora dele, transparente: a parede do meio aparece)
        out[dist > g["ponta"] + 1.6] = 0  # transparente de verdade (o PNG fica menor)
        if nome not in RAIOS:
            out[dist < raiz - 1.6] = 0  # miolo redondo das pequenas: o do meio.png aparece por baixo
        quadros.append(out)
    tira = np.concatenate(quadros, 1)
    info = {"x": ox, "y": oy, "w": w, "h": h, "quadros": nq, "por_dente": fd, "sentido": sentido,
            "dentes": g["n"], "centro": [round(g["cx"], 2), round(g["cy"], 2)], "ponta": round(g["ponta"], 2),
            "nota": round(g["nota"], 3)}
    return Image.fromarray(tira), info


def main():
    aplicar = "--aplicar" in sys.argv
    meio = Image.open(MEIO).convert("RGBA")
    arr = np.array(meio)
    PREVIA.mkdir(parents=True, exist_ok=True)
    infos = {}
    tiras = {}
    for nome, c, R, sentido, dentes in ENGRENAGENS:
        tira, info = folha(arr, nome, c, R, sentido, dentes)
        tiras[nome] = tira
        infos[nome] = info
        print(nome, info)
        tira.save(PREVIA / f"engrenagem_{nome}.png")
    # prévia: o trecho do meio com as engrenagens girando (6x), 4 voltas de dente
    for lado, (x0, x1) in (("esq", (0, 60)), ("dir", (410, 460))):
        y0, y1 = 128, 176
        quadros = []
        for t in range(F * 4):  # 4 dentes = uma volta dos raios da grande
            base = Image.new("RGBA", meio.size, (40, 38, 60, 255))
            base.alpha_composite(meio)
            for nome, info in infos.items():
                q = (t * info["por_dente"] // F) % info["quadros"]
                sp = tiras[nome].crop((q * info["w"], 0, (q + 1) * info["w"], info["h"]))
                base.alpha_composite(sp, (info["x"], info["y"]))
            quadros.append(base.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 6, (y1 - y0) * 6), Image.NEAREST))
        antes = Image.new("RGBA", meio.size, (40, 38, 60, 255))
        antes.alpha_composite(meio)
        antes = antes.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 6, (y1 - y0) * 6), Image.NEAREST)
        lado_a_lado = [Image.new("RGB", (antes.width * 2 + 12, antes.height), (20, 20, 20)) for _ in quadros]
        for im, q in zip(lado_a_lado, quadros):
            im.paste(antes.convert("RGB"), (0, 0))
            im.paste(q.convert("RGB"), (antes.width + 12, 0))
        lado_a_lado[0].save(PREVIA / f"previa_{lado}.gif", save_all=True, append_images=lado_a_lado[1:], duration=300, loop=0)
    (PREVIA / "engrenagens.json").write_text(json.dumps(infos, indent=1, ensure_ascii=False))
    if aplicar:
        for nome, tira in tiras.items():
            tira.save(ASSETS / f"engrenagem_{nome}.png")
        (ASSETS / "engrenagens.json").write_text(json.dumps(
            {"quadros_por_dente": F, "engrenagens": infos,
             "obs": "folhas sobre o meio.png (x, y no meio.png, 1a metade; a 2a é espelhada); um quadro avança 1/F de dente"},
            indent=1, ensure_ascii=False))
        print("aplicado em", ASSETS)


if __name__ == "__main__":
    main()
