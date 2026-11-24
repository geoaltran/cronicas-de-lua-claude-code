"""Animações da Lua a partir das folhas geradas no Nano Banana.

Cada folha veio numa resolução diferente (o modelo não segue o tamanho de
pixel à risca). Para a Lua ter o MESMO tamanho em todas as animações:
  - cada folha é reamostrada para a Lua medir ALTURA px (a altura do sprite original);
  - as cores são levadas para a paleta da Lua original (mesmos 32 tons);
  - os pés ficam numa linha comum; quem pula (vitória) continua no ar;
  - o alinhamento horizontal é pela cabeça (o corpo não "treme" entre quadros).
Saída: assets/lua/poses/lua_<animação>_<n>f.png + poses.json
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy import ndimage as nd

import preparar_assets as pa

RAIZ = Path(__file__).parent
BRUTOS = RAIZ / "assets-brutos" / "lua_poses"
SAIDA = RAIZ / "assets" / "lua" / "poses"
ALTURA = 83                     # altura da Lua em pé (sprite original)
QW, QH, PES = 80, 100, 96       # quadro comum a todas as animações

# altura da Lua em pé na imagem de origem (px), por folha: base da escala.
# Medida sem a varinha erguida e sem faíscas (na vitória, a varinha passa da cabeça).
FOLHAS = {
    # na caminhada todo quadro é a Lua em pé: cada quadro é ajustado à mesma
    # altura (o Nano Banana desenhou dois deles 5% menores e a cabeça "pulsava")
    # caminhada refeita no ChatGPT (8 quadros, pernas e braços alternando)
    "andar": {"n": 8, "arquivo": "lua_andar_v2.webp", "por_quadro": True},
    "ataque": {"n": 4, "altura_origem": 634},
    "dano": {"n": 2, "altura_origem": 1033},
    "vitoria": {"n": 2, "altura_origem": 1000},
    "canalizar": {"n": 2, "altura_origem": 1051},
    "parada": {"n": 2, "altura_origem": 1039},
    # reação quando o escudo do chefão segura o golpe (8ª sessão; escolher uma)
    "triste": {"n": 2, "altura_origem": 1255},
    "duvida": {"n": 2, "altura_origem": 1258},
    # lua nova (o luar acabou): ela dorme deitada no lugar do desmaio.
    # Quadro largo; a escala casa a cabeça com a da Lua em pé (pixel de 15,5 px
    # na folha; o da própria folha, 19,8, deixava a cabeça pequena demais)
    "dormindo": {"n": 2, "arquivo": "lua_dormindo.jpeg", "deitada": True,
                 "pixel_origem": 15.5, "qw": 100},
}


def paleta_lua():
    hexes = json.loads((RAIZ / "assets" / "paleta_lua.json").read_text())
    pal = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in hexes]
    # tons de faísca dourada, que o sprite original não tinha
    pal += [(255, 236, 150), (255, 214, 110), (255, 250, 220)]
    return np.array(pal, int)


def figuras(rgb):
    """Máscaras de cada quadro (corpo + faíscas/partes soltas mais próximas), em ordem."""
    fundo = pa.mascara_fundo(rgb)
    frente = nd.binary_opening(~fundo, iterations=1)
    rot, n = nd.label(nd.binary_dilation(frente, iterations=6))
    areas = nd.sum(frente, rot, range(1, n + 1))
    grandes = [i + 1 for i, a in enumerate(areas) if a > 0.15 * areas.max()]
    eh = np.isin(rot, grandes)
    dist, (iy, ix) = nd.distance_transform_edt(~eh, return_indices=True)
    dono = rot.copy()
    for i in range(1, n + 1):
        if i in grandes:
            continue
        pts = rot == i
        y, x = np.argwhere(pts)[0]
        dono[pts] = rot[iy[y, x], ix[y, x]] if dist[pts].min() < 120 else 0
    centros = sorted((nd.center_of_mass(eh, rot, g)[1], g) for g in grandes)
    return [frente & (dono == g) for _, g in centros]


def quantizar(cor, alfa, pal):
    d = ((cor[:, :, None, :].astype(int) - pal[None, None]) ** 2).sum(-1)
    q = pal[d.argmin(-1)].astype(np.uint8)
    return np.dstack([q, np.where(alfa, 255, 0).astype(np.uint8)])


def processar(nome, cfg, pal):
    rgb = np.asarray(Image.open(BRUTOS / cfg.get("arquivo", f"lua_{nome}.jpg")).convert("RGB"))
    if cfg.get("deitada"):
        return processar_deitada(rgb, cfg, pal)
    s = cfg.get("altura_origem", 0) / ALTURA
    mascaras = figuras(rgb)
    assert len(mascaras) == cfg["n"], f"{nome}: achei {len(mascaras)} quadros, esperava {cfg['n']}"
    chao = max(np.nonzero(m.any(1))[0].max() for m in mascaras)     # linha do chão da folha
    quadros, info = [], []
    for m in mascaras:
        sl = pa.recorte(m)
        if cfg.get("por_quadro"):
            ys_m = np.nonzero(m.any(1))[0]
            s = (ys_m.max() - ys_m.min()) / ALTURA
        grid = pa.detectar_grid(rgb[sl], m[sl], (s, s))
        cor, alfa = pa.reamostrar(rgb[sl], m[sl], grid)
        alfa = pa.limpar_halo(cor, alfa)
        alfa = pa.limpar_pes(alfa)
        spr = quantizar(cor, alfa, pal)
        ys, xs = np.nonzero(spr[..., 3])
        spr = spr[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        # quanto o pé está acima do chão da folha (pulo), em pixels nativos
        pe_src = np.nonzero(m.any(1))[0].max()
        acima = round((chao - pe_src) / s)
        # centro da cabeça: média das colunas opacas no terço de cima
        topo = spr[: spr.shape[0] // 3, :, 3] > 0
        cx = int(np.nonzero(topo)[1].mean())
        quadros.append((spr, acima, cx))
    # monta a tira com quadro comum
    tira = np.zeros((QH, QW * len(quadros), 4), np.uint8)
    for i, (spr, acima, cx) in enumerate(quadros):
        h, w = spr.shape[:2]
        x = i * QW + QW // 2 - cx
        y = PES - acima - h
        x0, y0 = max(x, i * QW), max(y, 0)
        recorte_x0, recorte_y0 = x0 - x, y0 - y
        x1, y1 = min(x + w, (i + 1) * QW), min(y + h, QH)
        bloco = spr[recorte_y0:recorte_y0 + (y1 - y0), recorte_x0:recorte_x0 + (x1 - x0)]
        dest = tira[y0:y1, x0:x1]
        tira[y0:y1, x0:x1] = np.where(bloco[..., 3:] > 0, bloco, dest)
        info.append({"altura": int(h), "acima_do_chao": int(acima)})
    return tira, info


def processar_deitada(rgb, cfg, pal):
    """Pose deitada (dormindo): quadro largo, corpo apoiado na linha dos pés.
    O 2º quadro é encaixado no 1º pelo deslocamento que mais casa os pixels
    (a respiração não pode fazer a cabeça pular)."""
    s, qw = cfg["pixel_origem"], cfg["qw"]
    sprs = []
    for m in figuras(rgb):
        sl = pa.recorte(m)
        grid = pa.detectar_grid(rgb[sl], m[sl], (s, s))
        cor, alfa = pa.reamostrar(rgb[sl], m[sl], grid)
        alfa = pa.limpar_halo(cor, alfa)
        spr = quantizar(cor, alfa, pal)
        ys, xs = np.nonzero(spr[..., 3])
        sprs.append(spr[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    assert len(sprs) == cfg["n"], f"deitada: achei {len(sprs)} quadros"

    def apoio(spr):
        # linha onde o corpo encosta no chão: o fundo do terço da direita
        # (pernas e botas); a varinha, na frente, pode descer um pouco mais
        a = spr[..., 3] > 0
        return int(np.nonzero(a[:, a.shape[1] * 2 // 3:].any(1))[0].max())

    base = sprs[0]
    pos = [(0, 0)]
    for spr in sprs[1:]:
        melhor = None
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                h = min(base.shape[0], spr.shape[0]); w = min(base.shape[1], spr.shape[1])
                a = np.zeros((h + 10, w + 10, 4), np.uint8); b = a.copy()
                a[5:5 + h, 5:5 + w] = base[:h, :w]
                y0, x0 = 5 + dy, 5 + dx
                b[y0:y0 + h, x0:x0 + w] = spr[:h, :w]
                # compara só a metade da esquerda (cabeça e mochila)
                meia = (w + 10) // 2
                d = (np.abs(a[:, :meia].astype(int) - b[:, :meia].astype(int))).sum()
                if melhor is None or d < melhor[0]:
                    melhor = (d, dx, dy)
        pos.append((melhor[1], melhor[2]))
    tira = np.zeros((QH, qw * len(sprs), 4), np.uint8)
    info = []
    # a varinha desce além do apoio; se não couber no quadro, o corpo sobe
    y_base = min(PES - apoio(base), QH - max(sp.shape[0] + dy for sp, (_, dy) in zip(sprs, pos)))
    x_base = (qw - base.shape[1]) // 2
    for i, (spr, (dx, dy)) in enumerate(zip(sprs, pos)):
        h, w = spr.shape[:2]
        x, y = i * qw + x_base + dx, y_base + dy
        dest = tira[y:y + h, x:x + w]
        tira[y:y + h, x:x + w] = np.where(spr[..., 3:] > 0, spr, dest)
        info.append({"altura": int(h), "acima_do_chao": 0})
    return tira, info


def ponta_da_varinha(tira, i):
    """Ponta da varinha no quadro i: o pixel opaco mais à direita na metade de cima."""
    q = tira[:, i * QW:(i + 1) * QW, 3] > 0
    ys, xs = np.nonzero(q[: PES - 20])
    k = np.argmax(xs)
    return [int(xs[k]), int(ys[k])]


# a parada aprovada (normal, respirando, piscando) foi montada à parte e não
# é regerada aqui; o quadro 1 da folha do Nano Banana é a base dela
NAO_REGERAR = {"parada"}


def gerar(apenas=None):
    SAIDA.mkdir(parents=True, exist_ok=True)
    pal = paleta_lua()
    arq_meta = SAIDA / "poses.json"
    meta = json.loads(arq_meta.read_text()) if arq_meta.exists() else {"quadros": {}}
    meta.update({"quadro": [QW, QH], "pes_y": PES, "altura_lua": ALTURA})
    for nome, cfg in FOLHAS.items():
        if (apenas and nome not in apenas) or (not apenas and nome in NAO_REGERAR):
            continue
        tira, info = processar(nome, cfg, pal)
        arq = f"lua_{nome}_{cfg['n']}f.png"
        Image.fromarray(tira).save(SAIDA / arq)
        meta["quadros"][nome] = {"arquivo": arq, "n": cfg["n"], "quadros": info}
        if "qw" in cfg:
            meta["quadros"][nome]["quadro"] = [cfg["qw"], QH]
        if nome == "ataque":
            meta["quadros"][nome]["ponta_da_varinha"] = [ponta_da_varinha(tira, i) for i in range(cfg["n"])]
            meta["quadros"][nome]["lancamento"] = 2
        print(f"{nome:10} {cfg['n']} quadros  alturas {[q['altura'] for q in info]}  "
              f"pulo {[q['acima_do_chao'] for q in info]}")
    (SAIDA / "poses.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    import sys
    gerar(set(sys.argv[1:]) or None)
