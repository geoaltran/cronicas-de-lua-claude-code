"""Troféus do elite e estante do Livro (arte do Nano Banana em assets-brutos/trofeus/).

    .venv/bin/python trofeus.py [altura] [--previa arquivo.png] [--aplicar]

- Acha os 4 troféus (ordem: comando, edição, leitura, web), lê no grid nativo
  (pixel de ~12,65 px no bruto), tira o branco de dentro (furo da engrenagem,
  alças, anel) e reduz para `altura` px (padrão 24) refazendo o contorno.
- Estante: grid nativo (~8,3 px), tira as silhuetas de taça das prateleiras
  (copia o fundo da mesma linha) e devolve as posições das 15 vagas.
- Sem --aplicar só gera a prévia; com --aplicar grava em assets/ui/trofeus/.
"""
from pathlib import Path
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

from preparar_assets import mascara_fundo, detectar_grid, reamostrar, recortar, quantizar, limpar_halo

AQUI = Path(__file__).parent
BRUTOS = AQUI / "assets-brutos" / "trofeus"
SAIDA = AQUI / "assets" / "ui" / "trofeus"
TIPOS = ["comando", "edicao", "leitura", "web"]
CONTORNO = np.array([0x22, 0x15, 0x2E])
PIXEL_TROFEU = 12.65
# ícones pequenos para a estante (2ª geração do Bloco 3 de prompt_trofeus.md)
PIXEL_ICONE = 18.8


def branco(rgb):
    return (rgb.min(2) > 205) & (np.ptp(rgb, axis=2) < 40)


def trofeus_nativos(arquivo="trofeus.jpg", pixel=PIXEL_TROFEU):
    rgb = np.asarray(Image.open(BRUTOS / arquivo).convert("RGB"))
    frente = ~mascara_fundo(rgb) & ~branco(rgb)  # branco de dentro também sai
    rot, _ = nd.label(nd.binary_dilation(frente, iterations=30))
    objs = [o for o in nd.find_objects(rot) if o and o[0].stop - o[0].start > 300]
    objs.sort(key=lambda o: o[1].start)
    assert len(objs) == 4, len(objs)
    saida = []
    for o in objs:
        sl = (slice(o[0].start - 4, o[0].stop + 4), slice(max(0, o[1].start - 4), min(rgb.shape[1], o[1].stop + 4)))
        m = frente[sl] & (rot[sl] == rot[o][rot[o] > 0][0])
        g = detectar_grid(rgb[sl], m, (pixel, pixel))
        cor, alfa = reamostrar(rgb[sl], m, g)
        saida.append(recortar(cor, alfa))
    return saida


def tapar_furos(rgba, maximo=2):
    """Furo de até `maximo` px cercado só de dourado (um brilho branco do bruto
    que saiu junto com o fundo, como o da taça) vira o tom mais claro dos
    vizinhos. Furos com contorno em volta (o vão do anel do orbe, o furo da
    engrenagem) são do desenho e ficam."""
    rgba = rgba.copy()
    furo = rgba[..., 3] == 0
    rot, n = nd.label(furo)
    borda = set(np.unique(np.r_[rot[0], rot[-1], rot[:, 0], rot[:, -1]]))
    for i in range(1, n + 1):
        if i in borda:
            continue
        ys, xs = np.nonzero(rot == i)
        if len(ys) > maximo:
            continue
        viz = nd.binary_dilation(rot == i) & ~furo
        cores = rgba[viz][:, :3].astype(int)
        if (cores.max(1) < 80).any():
            continue  # tem contorno escuro em volta: é um vão do desenho (anel do orbe)
        clara = cores[cores.sum(1).argmax()]
        rgba[ys, xs, :3] = clara
        rgba[ys, xs, 3] = 255
    return rgba


def reduzir(cor, alfa, k):
    """Redução de pixel art (fator k, o mesmo para os 4): média por área, cores
    presas na paleta do próprio troféu e contorno de 1 px refeito."""
    h0, w0 = alfa.shape
    altura = max(1, round(h0 * k))
    w = max(1, round(w0 * k))
    paleta = np.unique(cor[alfa].reshape(-1, 3), axis=0).astype(int)
    a = Image.fromarray(np.where(alfa, 255, 0).astype(np.uint8)).resize((w, altura), Image.BOX)
    # cor média só dos pixels opacos (pré-multiplica)
    pre = (cor.astype(float) * alfa[..., None])
    c = np.dstack([np.asarray(Image.fromarray(pre[..., i].astype(np.float32)).resize((w, altura), Image.BOX)) for i in range(3)])
    af = np.asarray(a).astype(float) / 255
    c = c / np.maximum(af[..., None], 1e-6)
    # sem o escuro do contorno na média, o miolo fica com a cor do miolo
    m = af > 0.45
    dist = ((c[:, :, None, :] - paleta[None, None]) ** 2).sum(-1)
    q = paleta[dist.argmin(-1)]
    borda = m & ~nd.binary_erosion(m, border_value=0)
    q[borda] = CONTORNO
    return np.dstack([q.astype(np.uint8), np.where(m, 255, 0).astype(np.uint8)])


PEDESTAL = 8  # linhas de baixo (aro dourado + bloco escuro) no de 24 px
PEDESTAL_NATIVO = 19  # o mesmo no tamanho nativo


def pedestal_unico(pequenos, PEDESTAL=PEDESTAL):
    """Os 4 troféus ganham o pedestal do 1º (a taça): na redução cada um sai
    um tiquinho diferente, e na estante eles têm que parecer uma coleção."""
    ped = pequenos[0][-PEDESTAL:]
    cols = np.nonzero(ped[..., 3].any(0))[0]
    ped = ped[:, cols.min():cols.max() + 1]
    saida = []
    for p in pequenos:
        topo = p[:-PEDESTAL]
        cols = np.nonzero(topo[..., 3].any(0))[0]
        topo = topo[:, cols.min():cols.max() + 1]
        w = max(topo.shape[1], ped.shape[1])
        if (w - topo.shape[1]) % 2 != (w - ped.shape[1]) % 2:
            w += 1  # os dois centralizados sem meio pixel
        img = np.zeros((topo.shape[0] + PEDESTAL, w, 4), np.uint8)
        x = (w - topo.shape[1]) // 2
        img[:topo.shape[0], x:x + topo.shape[1]] = topo
        x = (w - ped.shape[1]) // 2
        base = img[topo.shape[0]:, x:x + ped.shape[1]]
        opaco = ped[..., 3] > 0
        base[opaco] = ped[opaco]
        saida.append(img)
    return saida


def estante():
    rgb = np.asarray(Image.open(BRUTOS / "estante.jpg").convert("RGB"))
    frente = ~mascara_fundo(rgb)
    sl = nd.find_objects(frente.astype(int))[0]
    sl = (slice(sl[0].start - 4, sl[0].stop + 4), slice(sl[1].start - 4, sl[1].stop + 4))
    g = detectar_grid(rgb[sl], frente[sl])
    cor, alfa = reamostrar(rgb[sl], frente[sl], g)
    cor, alfa = recortar(cor, alfa)
    return np.dstack([cor, np.where(alfa, 255, 0).astype(np.uint8)])


def esvaziar(est):
    """Tira as 15 silhuetas de taça das prateleiras e devolve (estante, vagas).

    O painel do fundo é liso e a madeira tem veio horizontal, então cada linha
    da vaga é preenchida repetindo a mesma linha do vão à esquerda dela.
    vagas = [[(x_centro, y_chão), ...5] por prateleira], y_chão = última linha
    em que o pedestal do troféu encosta (onde as silhuetas pisavam)."""
    rgba = est.copy()
    lum = rgba[..., :3].astype(int).sum(2)
    h, w = lum.shape
    # painel = cor quase lisa (~110 de luminância) atrás das prateleiras
    painel = (np.abs(lum - 110) < 12)
    # colunas internas: onde a linha de referência (logo abaixo da moldura) é painel
    ref_y = int(painel.sum(1).argmax())  # a linha com mais painel (sem silhuetas)
    rot, _ = nd.label(painel[ref_y])
    maior = np.bincount(rot[rot > 0]).argmax()  # o trecho contínuo mais longo
    cols = np.nonzero(rot == maior)[0]
    x_in, x_out = cols.min(), cols.max()
    # faixas de painel (prateleiras) olhando o vão à esquerda da 1ª vaga
    linhas = painel[:, x_in:x_out + 1].mean(1)
    vagas = []
    y = 0
    while y < h:
        if linhas[y] > 0.3 and painel[y, x_in + 1]:
            y0 = y
            while y < h and painel[y, x_in + 1]:
                y += 1
            y1 = y - 1  # última linha de painel; depois vem a tábua
            # silhuetas: o que não é painel dentro da faixa
            sil = ~painel[y0:y1 + 1, x_in:x_out + 1]
            proj = sil.any(0)
            runs, x = [], 0
            while x < len(proj):
                if proj[x]:
                    a = x
                    while x < len(proj) and proj[x]:
                        x += 1
                    if x - a >= 6:
                        runs.append((a + x_in, x - 1 + x_in))
                else:
                    x += 1
            if len(runs) == 5:
                topo = y0 + int(np.nonzero(sil.any(1))[0].min())
                chao = y1 + 6  # o pé da silhueta pisa na face de cima da tábua
                for k, (a, b) in enumerate(runs):
                    a, b = a - 1, b + 1
                    gap_b = a - 1
                    gap_a = (runs[k - 1][1] + 2) if k else x_in
                    for yy in range(topo - 1, chao + 1):
                        fonte = rgba[yy, gap_a:gap_b + 1].copy()
                        for xx in range(a, b + 1):
                            rgba[yy, xx] = fonte[(xx - a) % len(fonte)]
                vagas.append([((a + b) // 2, chao) for a, b in runs])
        y += 1
    assert len(vagas) == 3, vagas
    return rgba, vagas


def main():
    args = sys.argv[1:]
    altura = int(args[0]) if args and args[0].isdigit() else 24
    nativos = trofeus_nativos()
    k = altura / max(a.shape[0] for _, a in nativos)  # o mais alto fica com `altura`
    reduzidos = pedestal_unico([reduzir(c, a, k) for c, a in nativos])
    # estante: os ícones desenhados pequenos (trofeus_pequenos.jpg), no grid nativo;
    # sem eles, os grandes reduzidos
    if (BRUTOS / "trofeus_pequenos.jpg").exists():
        icones = [(c, limpar_halo(c, a)) for c, a in trofeus_nativos("trofeus_pequenos.jpg", PIXEL_ICONE)]
        pequenos = pedestal_unico([tapar_furos(np.dstack([c, np.where(a, 255, 0).astype(np.uint8)])) for c, a in (recortar(c, a) for c, a in icones)], 10)
    else:
        pequenos = reduzidos
    # grandes: o tamanho nativo da arte (1 px da arte = 1 px da cena), para a faixa
    grandes = pedestal_unico([np.dstack([c, np.where(a, 255, 0).astype(np.uint8)]) for c, a in nativos], PEDESTAL_NATIVO)
    for t, g in zip(TIPOS, grandes):
        print(f"{t:8} grande {g.shape[1]}x{g.shape[0]}")
    for t, p in zip(TIPOS, pequenos):
        print(f"{t:8} estante {p.shape[1]}x{p.shape[0]}")
    if "--previa" in args:
        caminho = args[args.index("--previa") + 1]
        W = sum(g.shape[1] * 3 + 24 for g in grandes) + 24
        H = max(g.shape[0] for g in grandes)
        out = Image.new("RGBA", (W, H * 3 + 48), (58, 48, 72, 255))
        x = 24
        for g in grandes:
            im = Image.fromarray(g).resize((g.shape[1] * 3, g.shape[0] * 3), Image.NEAREST)
            out.alpha_composite(im, (x, 24 + (H - g.shape[0]) * 3))
            x += im.width + 24
        out.save(caminho.replace(".png", "_grandes.png"))
        k = 6
        W = sum(p.shape[1] * k + 24 for p in pequenos) + 24
        out = Image.new("RGBA", (W, altura * k + 48), (58, 48, 72, 255))
        x = 24
        for p in pequenos:
            im = Image.fromarray(p).resize((p.shape[1] * k, p.shape[0] * k), Image.NEAREST)
            out.alpha_composite(im, (x, 24 + (altura - p.shape[0]) * k))
            x += im.width + 24
        out.save(caminho)
    est, vagas = esvaziar(estante())
    print("estante", est.shape[1], "x", est.shape[0], "vagas", vagas)
    if "--previa" in args:
        k = 4
        def cheia(jogo):
            im = Image.fromarray(est.copy())
            for i, fileira in enumerate(vagas):
                for j, (cx, chao) in enumerate(fileira):
                    p = jogo[(i * 5 + j) % 4]
                    im.alpha_composite(Image.fromarray(p), (cx - p.shape[1] // 2, chao - p.shape[0] + 1))
            return im
        lado = Image.new("RGBA", (est.shape[1] * 2 * k + 3 * 24, est.shape[0] * k + 48), (58, 48, 72, 255))
        lado.alpha_composite(cheia(reduzidos).resize((est.shape[1] * k, est.shape[0] * k), Image.NEAREST), (24, 24))
        lado.alpha_composite(cheia(pequenos).resize((est.shape[1] * k, est.shape[0] * k), Image.NEAREST), (48 + est.shape[1] * k, 24))
        lado.save(caminho.replace(".png", "_estante.png"))
    if "--aplicar" in args:
        SAIDA.mkdir(parents=True, exist_ok=True)
        for t, p, g in zip(TIPOS, pequenos, grandes):
            Image.fromarray(p).save(SAIDA / f"trofeu_{t}.png")
            Image.fromarray(g).save(SAIDA / f"trofeu_{t}_grande.png")
        # estante com a paleta presa (o bruto do JPEG tem milhares de tons)
        imgs, _ = quantizar({"estante": (est[..., :3], est[..., 3] > 0)}, 32)
        imgs["estante"].save(SAIDA / "estante.png")
        (SAIDA / "trofeus.json").write_text(json.dumps({
            "tipos": {
                "comando": "comando no terminal (Bash)",
                "edicao": "editar ou escrever arquivo (Edit, Write, MultiEdit, NotebookEdit)",
                "leitura": "ler arquivo (Read)",
                "web": "página da web (WebFetch)",
            },
            "trofeus": {t: {"arquivo": f"trofeu_{t}.png", "w": int(p.shape[1]), "h": int(p.shape[0]),
                            "grande": f"trofeu_{t}_grande.png", "gw": int(g.shape[1]), "gh": int(g.shape[0])}
                        for t, p, g in zip(TIPOS, pequenos, grandes)},
            "uso_grande": "o grande (tamanho nativo) aparece na faixa quando o elite cai; o pequeno vai na estante",
            "estante": {"arquivo": "estante.png", "w": int(est.shape[1]), "h": int(est.shape[0]),
                        "vagas": [[[int(x), int(y)] for x, y in f] for f in vagas],
                        "uso": "vaga = [x do centro, y do chão]: o troféu pisa com a última linha em y"},
        }, ensure_ascii=False, indent=1))
        print("gravado em", SAIDA)


if __name__ == "__main__":
    main()
