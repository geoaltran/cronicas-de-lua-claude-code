"""Cenário em camadas de parallax a partir de uma ilustração única.

Camadas (de trás para frente):
  fundo        céu + Lua + castelo + nuvens baixas   parado (o horizonte)
  nuvens       nuvens altas                          desliza devagar + vento
  ilhas        ilhas flutuantes (sprites soltos)     balançam
  meio         árvores, ruínas, arbustos             meia velocidade
  chao         chão, ponte, água                     velocidade total

O que fica escondido atrás de uma camada é completado para não abrir buraco
quando ela se mexe. As camadas que rolam saem emendáveis na horizontal.

Uso: python cenario.py   (gera assets/cenarios/<nome>/ e uma prévia animada)
"""
from pathlib import Path
import colorsys
import math
import json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from scipy.cluster.vq import kmeans2

import preparar_assets as pa

RAIZ = Path(__file__).parent
BRUTOS = RAIZ / "assets-brutos" / "cenarios"
SAIDA = RAIZ / "assets" / "cenarios"

CENARIOS = {
    "floresta": {
        "arquivo": "floresta.jpg",
        "cores": 48,
        # regiões em pixels nativos (479x268)
        "lua": (200, 18, 296, 110),            # x0, y0, x1, y1: a Lua fica no fundo
        "castelo_x": (165, 305),               # colunas do castelo
        "castelo_centro": 240,                 # eixo para espelhar a base escondida
        "ilhas": [(130, 48, 162, 90), (318, 93, 342, 130)],
        "plataforma": (412, 170),              # da coluna 412 em diante o chão começa mais alto
        "topo_chao": 192,
        "pes": 209,                            # linha onde os personagens pisam
        "nuvens_altas_ate": 114,               # nuvem que termina acima disso é "alta"
    },
}

VELOCIDADE = {"fundo": 0.0, "nuvens": 0.15, "ilhas": 0.2, "meio": 0.5, "chao": 1.0}


def _hsv(a):
    f = a.reshape(-1, 3) / 255.0
    h = np.array([colorsys.rgb_to_hsv(*p) for p in f])
    return h[:, 0].reshape(a.shape[:2]) * 360, h[:, 1].reshape(a.shape[:2]), h[:, 2].reshape(a.shape[:2])


def nativo(cfg):
    rgb = np.asarray(Image.open(BRUTOS / cfg["arquivo"]).convert("RGB"))
    m = np.ones(rgb.shape[:2], bool)
    grid = pa.detectar_grid(rgb, m)
    cor, _ = pa.reamostrar(rgb, m, grid)
    # paleta limpa (tira o ruído do JPEG), k-means como nos personagens
    px = cor.reshape(-1, 3).astype(float)
    pal, rot = kmeans2(px, cfg["cores"], minit="++", seed=7, iter=30)
    pal = np.clip(pal.round(), 0, 255).astype(np.uint8)
    return pal[rot].reshape(cor.shape)


def classificar(a, cfg):
    """True = pixel de fundo distante (céu, nuvem, castelo, morros azulados)."""
    h, s, v = _hsv(a.astype(int))
    ciano = (h >= 160) & (h <= 205) & (v > 0.6)
    claro = (v > 0.72) & (s < 0.5) & ~((h > 60) & (h < 140) & (s > 0.15))
    lavanda = (h >= 230) & (h <= 300) & (v > 0.7) & (s < 0.45)
    return ciano | claro | lavanda


def _grama(a):
    return (a[..., 1] > 180) & (a[..., 0] < 150) & (a[..., 2] < 110)


def topo_do_chao(a, cfg):
    """Nível de trás do chão (onde as árvores ficam), com a plataforma alta.
    Inclui a linha de contorno logo acima da grama."""
    H, W, _ = a.shape
    topo = np.full(W, cfg["topo_chao"])
    x0, y0 = cfg["plataforma"]
    grama = _grama(a)
    for x in range(x0, W):
        ys = np.nonzero(grama[y0:cfg["topo_chao"], x])[0]
        if len(ys):
            topo[x] = y0 + ys[0] - 1
    return topo


def topo_da_frente(a, cfg):
    """Faixa da frente (onde os personagens pisam): primeira grama a partir de
    algumas linhas acima dos pés, contando a linha de contorno."""
    H, W, _ = a.shape
    grama = _grama(a)
    y0 = cfg["pes"] - 6
    topo = np.full(W, cfg["pes"] - 1)
    for x in range(W):
        ys = np.nonzero(grama[y0:cfg["pes"] + 6, x])[0]
        if len(ys):
            topo[x] = y0 + ys[0] - 1
    return topo


def preencher_linhas(img, buraco):
    """Completa cada pixel escondido com o pixel visível mais próximo NA MESMA
    LINHA. No horizonte isso vira faixas de névoa/nuvem, que combinam com o fundo."""
    out = img.copy()
    for y in range(img.shape[0]):
        ok = np.nonzero(~buraco[y])[0]
        falta = np.nonzero(buraco[y])[0]
        if len(ok) == 0 or len(falta) == 0:
            continue
        i = np.clip(np.searchsorted(ok, falta), 1, len(ok) - 1)
        esq, dir_ = ok[i - 1], ok[i]
        perto = np.where(np.abs(falta - esq) <= np.abs(dir_ - falta), esq, dir_)
        out[y, falta] = img[y, perto]
    return out


def _mais_comum(px):
    cores, n = np.unique(px, axis=0, return_counts=True)
    return cores[n.argmax()]


def _ligar_suave(valores, ok):
    """Liga os trechos conhecidos com uma curva suave (smoothstep): uma encosta
    arredondada, como um morro desenhado, em vez de uma rampa reta."""
    out = valores.astype(float).copy()
    idx = np.nonzero(ok)[0]
    W = len(valores)
    out[:idx[0]] = valores[idx[0]]
    out[idx[-1] + 1:] = valores[idx[-1]]
    for a0, a1 in zip(idx[:-1], idx[1:]):
        if a1 - a0 > 1:
            t = (np.arange(a0 + 1, a1) - a0) / (a1 - a0)
            s = t * t * (3 - 2 * t)
            out[a0 + 1:a1] = valores[a0] + (valores[a1] - valores[a0]) * s
    return out


def _bolhas(topo, desconhecido, largura_bolha=18, altura=0.32):
    """Nos trechos que estavam escondidos, a borda de cima da nuvem ganha
    bolhas arredondadas, como as nuvens desenhadas, em vez de uma reta."""
    out = topo.astype(float).copy()
    x = 0
    W = len(topo)
    while x < W:
        if not desconhecido[x]:
            x += 1
            continue
        fim = x
        while fim < W and desconhecido[fim]:
            fim += 1
        n = fim - x
        if n >= 8:
            k = max(1, round(n / largura_bolha))
            for j in range(k):
                a0, a1 = x + j * n // k, x + (j + 1) * n // k
                w = a1 - a0
                for xx in range(a0, a1):
                    t = (xx - a0 + 0.5) / w
                    out[xx] -= round(w * altura * math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2)))
        x = fim
    return out


def reconstruir_fundo(a, esconde, ceu, cfg):
    """Fundo parado completo, montado como silhuetas em camadas, que é como a
    ilustração foi desenhada: céu (degradê por linha) -> nuvens brancas ->
    sombra lavanda -> morros e castelo azul-petróleo.

    O que está visível fica como está. O que estava escondido (atrás das
    árvores, ruínas e ilhas) é refeito a partir de onde cada faixa começa nas
    colunas visíveis vizinhas: as linhas continuam suaves, a nuvem ganha
    bolhas, a encosta do morro sobe até o castelo. Nada é copiado de outro
    lugar, então não aparece emenda, cunha nem castelo cortado."""
    H, W, _ = a.shape
    lim = cfg["topo_chao"]
    h, s, v = _hsv(a.astype(int))
    azul = (h >= 175) & (h <= 212) & (v < 0.9) & (v > 0.5) & (s > 0.3)
    branca = (v > 0.9) & (s < 0.22)
    lavanda = (h >= 228) & (h <= 300) & (v > 0.72) & (s < 0.45)
    vis = ~esconde
    out = a.copy()
    linha_ceu = np.broadcast_to(ceu[:, None, :], a.shape)

    # 1) céu alto limpo: tudo o que não é céu e termina acima do banco de nuvens
    #    (restos de contorno e sombra das nuvens altas) vira céu. Lua e castelo ficam.
    lx0, ly0, lx1, ly1 = cfg["lua"]
    dif = np.abs(a.astype(int) - linha_ceu.astype(int)).sum(2) > 30
    rot, n = nd.label(dif & vis, structure=np.ones((3, 3)))
    for i, sl in enumerate(nd.find_objects(rot), 1):
        na_lua = sl[1].start >= lx0 - 2 and sl[1].stop <= lx1 + 2 and sl[0].start >= ly0 - 2 and sl[0].stop <= ly1 + 2
        if sl[0].stop <= 100 and not na_lua:
            comp = rot == i
            out[comp] = linha_ceu[comp]
    # castelo + morros: o maior bloco azul-petróleo que encosta no chão
    rot, n = nd.label(azul & vis)
    castelo = np.zeros_like(azul)
    for i, sl in enumerate(nd.find_objects(rot), 1):
        if sl[0].stop >= lim - 12:
            castelo |= rot == i

    # 2) onde cada faixa começa, coluna a coluna (só quando a borda está à vista)
    def topo_de(classe, y_inicio):
        topo = np.full(W, np.nan)
        for x in range(W):
            for y in range(y_inicio[x], lim):
                if not vis[y, x]:
                    continue
                if classe[y, x]:
                    if y == y_inicio[x] or vis[y - 1, x]:
                        topo[x] = y
                    break
            else:
                if vis[y_inicio[x]:lim, x].all():
                    topo[x] = lim      # coluna toda à vista e a faixa não existe nela
        return topo

    inicio_nuvem = np.full(W, 86)
    cx0, cx1 = cfg["castelo_x"]
    inicio_azul = np.full(W, 86)
    inicio_azul[cx0:cx1] = 30
    nuvem = (branca | lavanda) & ~castelo
    topos = {
        "nuvem": topo_de(nuvem, inicio_nuvem),
        "lavanda": topo_de(lavanda & ~castelo, inicio_nuvem),
        "azul": topo_de(castelo, inicio_azul),
    }
    # base do castelo: onde a encosta está escondida, usa o lado oposto
    # (espelhado no centro do castelo), que está à vista. Castelo no alto de um
    # morro simétrico, em vez de uma rampa inventada.
    # O mesmo vale para a nuvem que abraça a muralha.
    centro = cfg["castelo_centro"]
    for t in topos.values():
        for x in range(cx0 - 30, cx1 + 30):
            m = 2 * centro - x
            if 0 <= x < W and 0 <= m < W and np.isnan(t[x]) and not np.isnan(t[m]):
                t[x] = t[m]
    xs = np.arange(W)
    final = {}
    for k, t in topos.items():
        ok = ~np.isnan(t)
        cheio = _ligar_suave(t, ok)
        if k == "nuvem":
            cheio = _bolhas(cheio, ~ok, 18, 0.32)
        elif k == "lavanda":
            cheio = _bolhas(cheio, ~ok, 14, 0.18)
        final[k] = cheio
    final["lavanda"] = np.maximum(final["lavanda"], final["nuvem"])

    # 3) preenche só o que estava escondido, com a cor principal de cada faixa
    cor = {
        "branca": _mais_comum(a[branca & vis & ~castelo]),
        "lavanda": _mais_comum(a[lavanda & vis & ~castelo]),
        "azul": _mais_comum(a[castelo & vis & (np.arange(H)[:, None] > 150)]),
    }
    # pixels "perdidos" no horizonte (não são céu, nuvem, lavanda nem morro:
    # restos de contorno de árvore, fiapos) também seguem o modelo
    perto_ceu = np.abs(a.astype(int) - linha_ceu.astype(int)).sum(2) <= 30
    estranho = vis & (np.arange(H)[:, None] >= 95) & (np.arange(H)[:, None] < lim) \
        & ~(perto_ceu | branca | lavanda | azul)
    lx0, ly0, lx1, ly1 = cfg["lua"]
    estranho[ly0:ly1, lx0:lx1] = False
    ys, xs_ = np.nonzero(esconde | estranho)
    for y, x in zip(ys, xs_):
        if y >= lim or y >= final["azul"][x]:
            out[y, x] = cor["azul"]
        elif y >= final["lavanda"][x]:
            out[y, x] = cor["lavanda"]
        elif y >= final["nuvem"][x]:
            out[y, x] = cor["branca"]
        else:
            out[y, x] = ceu[y]
    # fiapos de 1 px (resto de contorno de árvore): se os dois vizinhos da linha
    # são iguais e o pixel do meio é diferente, ele vira igual aos vizinhos.
    # A área do castelo fica de fora (torres finas são de propósito).
    for _ in range(2):
        for y in range(95, lim):
            for x in range(1, W - 1):
                if cx0 <= x < cx1:
                    continue
                esq, meio_, dir_ = out[y, x - 1], out[y, x], out[y, x + 1]
                if (esq == dir_).all() and not (esq == meio_).all():
                    out[y, x] = esq
    return out, final, cor


def _perfil_bolhas(n, base, larguras, altura, fase=0, onda=0.0):
    """Borda de cima feita de bolhas (arcos) com larguras e alturas que variam,
    e um nível que ondula devagar, para não parecer carimbo repetido."""
    alturas = [1.0, 0.65, 1.2, 0.8, 1.05, 0.55, 0.9]
    out = np.full(n, float(base))
    x, j = 0, fase
    while x < n:
        w = larguras[j % len(larguras)]
        hf = altura * alturas[(j * 3 + fase) % len(alturas)]
        for xx in range(x, min(n, x + w)):
            t = (xx - x + 0.5) / w
            nivel = base + onda * math.sin(xx / 47.0 + fase)
            out[xx] = nivel - round(w * hf * math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2)))
        x += w
        j += 1
    return out


def fundo_largo(base, final, cor, ceu, largura, lim):
    """Fundo parado mais largo que a ilustração. A ilustração (já limpa) fica
    no centro, com a Lua e o castelo uma vez só. As laterais são desenhadas
    com o mesmo modelo de silhuetas (céu, bolhas de nuvem, sombra lavanda,
    morros), partindo exatamente da borda da ilustração e virando aos poucos
    o perfil novo, então não há emenda nem forma espelhada."""
    H, W, _ = base.shape
    pad = (largura - W + 1) // 2
    out = np.zeros((H, pad * 2 + W, 3), np.uint8)
    out[:, pad:pad + W] = base
    for lado in ("esq", "dir"):
        borda = 0 if lado == "esq" else W - 1
        amostra = slice(0, 120) if lado == "esq" else slice(W - 120, W)
        nivel = {k: float(np.median(v[amostra])) for k, v in final.items()}
        gerado = {
            "nuvem": _perfil_bolhas(pad, nivel["nuvem"] + 4, [22, 15, 31, 18, 26, 13, 24, 20, 35], 0.32,
                                    fase=0 if lado == "esq" else 3, onda=6),
            "lavanda": _perfil_bolhas(pad, nivel["lavanda"] + 3, [16, 11, 21, 14, 18, 25], 0.18,
                                      fase=1 if lado == "esq" else 2, onda=4),
            "azul": _perfil_bolhas(pad, nivel["azul"], [30, 9, 24, 6, 34, 11], 0.10, fase=2),
        }
        for d in range(pad):                       # d = distância até a ilustração
            s = min(1.0, d / 24)
            s = s * s * (3 - 2 * s)
            x = pad - 1 - d if lado == "esq" else pad + W + d
            topo = {k: final[k][borda] * (1 - s) + gerado[k][d] * s for k in final}
            topo["lavanda"] = max(topo["lavanda"], topo["nuvem"])
            for y in range(H):
                if y >= lim or y >= topo["azul"]:
                    out[y, x] = cor["azul"]
                elif y >= topo["lavanda"]:
                    out[y, x] = cor["lavanda"]
                elif y >= topo["nuvem"]:
                    out[y, x] = cor["branca"]
                else:
                    out[y, x] = ceu[y]
    return Image.fromarray(np.dstack([out, np.full(out.shape[:2], 255, np.uint8)])).crop((0, 0, largura, H)), pad


def cor_do_ceu_por_linha(a, fundo):
    """Cor de céu de cada linha: a mais comum entre os pixels ciano da linha."""
    h, s, v = _hsv(a.astype(int))
    # céu = ciano ou menta bem claros; o azul-petróleo do castelo é mais escuro
    ceu = fundo & (h >= 140) & (h <= 200) & (s > 0.25) & (v > 0.9)
    linhas = np.zeros((a.shape[0], 3), np.uint8)
    ultima = a[0, 0]
    for y in range(a.shape[0]):
        px = a[y][ceu[y]]
        if len(px):
            cores, n = np.unique(px, axis=0, return_counts=True)
            ultima = cores[n.argmax()]
        linhas[y] = ultima
    return linhas


def rgba(cor, mascara):
    return Image.fromarray(np.dstack([cor, np.where(mascara, 255, 0).astype(np.uint8)]))


def espelhar_emendavel(im):
    """Camada que rola: original + espelho. A última coluna do espelho é a
    primeira do original, então a emenda some quando a faixa dá a volta."""
    out = Image.new("RGBA", (im.width * 2, im.height))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (im.width, 0))
    return out


def _vai_e_volta(faixa, largura):
    """Pedaços que se afastam da ilustração: espelho, original, espelho...
    O primeiro (espelho) encosta na ilustração pela mesma coluna: sem emenda."""
    espelho = faixa.transpose(Image.FLIP_LEFT_RIGHT)
    pecas, total = [], 0
    while total < largura:
        pecas.append(espelho if len(pecas) % 2 == 0 else faixa)
        total += faixa.width
    return pecas


def _juntar(pecas, altura):
    out = Image.new("RGBA", (sum(p.width for p in pecas), altura))
    x = 0
    for p in pecas:
        out.paste(p, (x, 0))
        x += p.width
    return out


def alargar_fundo(im, largura, castelo_x):
    """Fundo parado mais largo que a ilustração: a ilustração fica no centro e
    as laterais repetem, em vai-e-volta, só as faixas SEM castelo e Lua, que
    assim aparecem uma vez só."""
    pad = (largura - im.width + 1) // 2
    cx0, cx1 = castelo_x
    esq_faixa = im.crop((0, 0, cx0, im.height))
    dir_faixa = im.crop((cx1, 0, im.width, im.height))
    # esquerda: os pedaços crescem para a esquerda, então a ordem é invertida
    esq = _juntar(list(reversed(_vai_e_volta(esq_faixa, pad))), im.height)
    esq = esq.crop((esq.width - pad, 0, esq.width, im.height))
    dir_ = _juntar(_vai_e_volta(dir_faixa, pad), im.height).crop((0, 0, pad, im.height))
    out = Image.new("RGBA", (pad * 2 + im.width, im.height))
    out.paste(esq, (0, 0))
    out.paste(im, (pad, 0))
    out.paste(dir_, (pad + im.width, 0))
    return out.crop((0, 0, largura, im.height)), pad


def montar(nome, cfg):
    a = nativo(cfg)
    H, W, _ = a.shape
    fundo = classificar(a, cfg)
    topo = topo_do_chao(a, cfg)
    frente = topo_da_frente(a, cfg)
    yy = np.arange(H)[:, None]
    # chão rápido = só a faixa da frente; o nível de trás (água, ponte,
    # plataforma) anda junto com as árvores que estão em cima dele
    chao = yy >= frente[None, :]
    nivel_tras = (yy >= topo[None, :]) & ~chao

    # objetos do meio: tudo acima do chão que não é fundo. Só buracos pequenos
    # (brilho em pedra clara, fresta de copa) viram objeto; um vão grande de céu
    # entre dois objetos continua sendo céu.
    objetos = ~fundo & (yy < topo[None, :])
    buracos = nd.binary_fill_holes(objetos) & ~objetos
    rot, n = nd.label(buracos)
    tam = nd.sum(buracos, rot, range(1, n + 1))
    objetos |= np.isin(rot, [i + 1 for i, t in enumerate(tam) if t <= 30])
    rot, n = nd.label(objetos)
    tam = nd.sum(objetos, rot, range(1, n + 1))
    objetos &= np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= 6])

    # ilhas flutuantes: sprites separados. Dentro da caixa, é ilha tudo o que
    # não é o céu daquela linha nem nuvem (as partes claras da ilha também)
    ceu = cor_do_ceu_por_linha(a, fundo)
    h, s, v = _hsv(a.astype(int))
    nuvem_cor = fundo & (v > 0.8) & (s < 0.35)
    dist_ceu = np.abs(a.astype(int) - ceu[:, None, :].astype(int)).sum(2)
    ilhas_m = np.zeros_like(objetos)
    ilhas = []
    for (x0, y0, x1, y1) in cfg["ilhas"]:
        caixa = np.zeros_like(objetos)
        caixa[y0:y1, x0:x1] = True
        # as cores da borda da caixa são todas de fundo (céu, menta, nuvem):
        # é ilha o que não se parece com nenhuma delas
        borda_caixa = caixa & ~nd.binary_erosion(caixa)
        cores_fundo = np.unique(a[borda_caixa], axis=0).astype(int)
        dif = np.abs(a.astype(int)[:, :, None, :] - cores_fundo[None, None]).sum(-1).min(-1)
        objeto = caixa & (dif > 30)
        objeto = nd.binary_fill_holes(nd.binary_closing(objeto, iterations=1))
        rot, n = nd.label(objeto)
        if n > 1:  # fica com o pedaço principal (ilha + árvore)
            tam = nd.sum(objeto, rot, range(1, n + 1))
            objeto = rot == (np.argmax(tam) + 1)
        ilhas_m |= objeto
        ys, xs = np.nonzero(objeto)
        sprite = rgba(a, objeto).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        ilhas.append((sprite, int(xs.min()), int(ys.min())))
    objetos &= ~ilhas_m
    meio = objetos | nivel_tras

    # nuvens altas: claras, inteiras acima da linha limite, fora da Lua
    lx0, ly0, lx1, ly1 = cfg["lua"]
    na_lua = np.zeros_like(meio)
    na_lua[ly0:ly1, lx0:lx1] = True
    rot, n = nd.label(nuvem_cor)
    nuvens = np.zeros_like(meio)
    for i, sl in enumerate(nd.find_objects(rot), 1):
        comp = rot == i
        if sl[0].stop <= cfg["nuvens_altas_ate"] and comp.sum() >= 6 and not (comp & na_lua).any():
            nuvens |= comp
    # a sombra lavanda colada embaixo de cada nuvem vai junto
    lav = fundo & (h >= 230) & (h <= 300) & (v > 0.7)
    nuvens |= lav & nd.binary_dilation(nuvens, iterations=3) & (yy < cfg["nuvens_altas_ate"] + 4)

    # fundo completo: sem nuvens altas, ilhas e meio; o que ficava atrás deles.
    # Atrás das nuvens altas e das ilhas só existe céu: usa a cor do céu da linha.
    # Atrás das árvores: o pixel de fundo visível mais próximo (em 2D), que
    # forma manchas arredondadas, como nuvem e névoa, em vez de listras.
    base = a.copy()
    base[nuvens] = np.broadcast_to(ceu[:, None, :], a.shape)[nuvens]
    # fiapos de objeto pequenos demais para virar camada também somem do fundo
    fiapos = ~fundo & (yy < topo[None, :]) & ~objetos & ~ilhas_m
    esconde = meio | chao | ilhas_m | fiapos
    base, modelo, cores_faixas = reconstruir_fundo(base, esconde | nuvens, ceu, cfg)

    camadas = {
        "fundo": rgba(base, np.ones((H, W), bool)),
        "nuvens": rgba(a, nuvens),
        "meio": rgba(a, meio),
        "chao": rgba(a, chao),
    }
    pasta = SAIDA / nome
    pasta.mkdir(parents=True, exist_ok=True)
    camadas["fundo"].save(pasta / "fundo_referencia.png")  # 479 px, como a ilustração
    largo, pad = fundo_largo(base, modelo, cores_faixas, ceu, 960, cfg["topo_chao"])
    largo.save(pasta / "fundo.png")
    for k in ("nuvens", "meio", "chao"):
        espelhar_emendavel(camadas[k]).save(pasta / f"{k}.png")
    info_ilhas = []
    for i, (sp, x, y) in enumerate(ilhas, 1):
        sp.save(pasta / f"ilha_{i}.png")
        info_ilhas.append({"arquivo": f"ilha_{i}.png", "x": x + pad, "y": y})
    meta = {
        "tamanho_nativo": [W, H],
        "pes_dos_personagens_y": cfg["pes"],
        "camadas": [
            {"arquivo": "fundo.png", "velocidade": VELOCIDADE["fundo"], "rola": False,
             "obs": "parado e centralizado; a ilustração original fica no meio"},
            {"arquivo": "nuvens.png", "velocidade": VELOCIDADE["nuvens"], "rola": True,
             "vento_px_por_s": 2},
            {"ilhas": info_ilhas, "velocidade": VELOCIDADE["ilhas"], "balanco_px": 2,
             "obs": "coordenadas no fundo.png; sobem e descem devagar"},
            {"arquivo": "meio.png", "velocidade": VELOCIDADE["meio"], "rola": True},
            {"arquivo": "chao.png", "velocidade": VELOCIDADE["chao"], "rola": True},
        ],
        "velocidade_1": "px por px que a Lua anda",
        "modos": {
            "chefao": {"janela_y": [0, 226], "obs": "arena aberta: cabem chefões de até ~200 px"},
            "compacto": {"janela_y": [70, 226], "camadas_de_tras_descem": 62,
                         "obs": "faixa baixa: fundo, nuvens e ilhas descem para a Lua do céu e o castelo caberem"},
        },
    }
    (pasta / "cenario.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    return a, camadas, ilhas, pad, meta


if __name__ == "__main__":
    for nome, cfg in CENARIOS.items():
        a, camadas, ilhas, pad, meta = montar(nome, cfg)
        print(nome, "nativo", a.shape[1], "x", a.shape[0], "| fundo 960 px, camadas que rolam",
              camadas["meio"].width * 2, "px")
