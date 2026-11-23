"""Escudo do chefão (defesa), 3 quadros, da arte do Nano Banana em assets-brutos/escudo/.

    .venv/bin/python escudo.py [--fator 1] [--previa previa_escudo.png] [--aplicar]

- Separa os 3 quadros (aparece, bloqueia, some) pelas colunas brancas entre eles,
  lê cada um no grid nativo do bruto, tira o fundo (o xadrez do quadro 3 que
  encosta no fundo vira transparente: é o efeito de sumir) e alinha os três
  pelo centro do botão dourado do escudo.
- Padrão: tamanho nativo (~36 px, perto da explosão de impacto, 31 px), sem
  redução: reduzir pela metade apagava o contorno, as linhas de impacto e o
  xadrez do quadro 3. `--fator 0.5` reduz (cores presas na paleta do escudo,
  contorno de 1 px refeito), se um dia precisar menor.
- No quadro 3 os pixels brancos do xadrez viram furos (o escudo quebra);
  `--sem-furos` mantém o branco do bruto.
- Sem --aplicar só gera a prévia; com --aplicar grava assets/efeitos/escudo_3f.png
  e a entrada "escudo" no efeitos.json.
"""
from pathlib import Path
import json
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

from preparar_assets import mascara_fundo, detectar_grid, reamostrar, recortar
from trofeus import reduzir

AQUI = Path(__file__).parent
BRUTO = AQUI / "assets-brutos" / "escudo" / "escudo_3f.jpg"
EFEITOS = AQUI / "assets" / "efeitos"
MS_POR_QUADRO = [90, 120, 120]  # aparece rápido, segura o bloqueio, some


def quadros_nativos():
    rgb = np.asarray(Image.open(BRUTO).convert("RGB"))
    frente = ~mascara_fundo(rgb)
    # os 3 quadros: grupos de colunas separados por mais de 60 px de branco
    cols = np.nonzero(frente.any(0))[0]
    cortes = np.nonzero(np.diff(cols) > 60)[0]
    inicios = np.r_[cols[0], cols[cortes + 1]]
    fins = np.r_[cols[cortes], cols[-1]] + 1
    assert len(inicios) == 3, f"esperava 3 quadros, achei {len(inicios)}"
    saida = []
    for x0, x1 in zip(inicios, fins):
        linhas = np.nonzero(frente[:, x0:x1].any(1))[0]
        y0, y1 = linhas[0], linhas[-1] + 1
        sl = (slice(max(0, y0 - 4), y1 + 4), slice(max(0, x0 - 4), x1 + 4))
        g = detectar_grid(rgb[sl], frente[sl])
        cor, alfa = reamostrar(rgb[sl], frente[sl], g)
        cor, alfa = recortar(cor, alfa)
        saida.append((cor, alfa, g[0][0]))
    return saida


def quebrar(cor, alfa, s):
    """Quadro 3 (some): os pixels brancos do xadrez viram furos transparentes,
    para o escudo parecer quebrando (pedido do usuário, 22/11/2026)."""
    c = cor.astype(int)
    branco = alfa & (c.min(2) > 205) & (np.ptp(c, axis=2) < 40)
    return cor, alfa & ~branco, s


def centro_do_botao(rgba):
    """Centro do botão dourado do miolo (amarelo forte no terço do meio)."""
    c = rgba[..., :3].astype(int)
    amarelo = (rgba[..., 3] > 0) & (c[..., 0] > 200) & (c[..., 1] > 150) & (c[..., 2] < 110)
    h, w = amarelo.shape
    miolo = np.zeros_like(amarelo)
    miolo[h // 4: 3 * h // 4, w // 4: 3 * w // 4] = True
    ys, xs = np.nonzero(amarelo & miolo)
    return (ys.mean(), xs.mean()) if len(ys) else (h / 2, w / 2)


def montar_tira(pecas):
    """Os 3 quadros no mesmo tamanho, alinhados pelo centro do botão."""
    centros = [centro_do_botao(p) for p in pecas]
    cima = max(round(cy) for cy, _ in centros)
    esq = max(round(cx) for _, cx in centros)
    baixo = max(p.shape[0] - round(cy) for p, (cy, _) in zip(pecas, centros))
    dir_ = max(p.shape[1] - round(cx) for p, (_, cx) in zip(pecas, centros))
    qh, qw = cima + baixo, esq + dir_
    tira = np.zeros((qh, qw * len(pecas), 4), np.uint8)
    for i, (p, (cy, cx)) in enumerate(zip(pecas, centros)):
        y, x = cima - round(cy), esq - round(cx)
        tira[y:y + p.shape[0], i * qw + x:i * qw + x + p.shape[1]] = p
    return tira, (qw, qh)


def previa(tira, quadro, nativos, arquivo):
    """Fundo da faixa, quadros ampliados (nativo em cima, reduzido embaixo) e um dígito de dano para escala."""
    fundo = (27, 24, 51, 255)
    z = 6
    qw, qh = quadro
    linhas = []
    nat = [Image.fromarray(np.dstack([c, np.where(a, 255, 0).astype(np.uint8)])) for c, a, _ in nativos]
    W = max(sum(n.width for n in nat) * 3 + 80, tira.shape[1] * z + 200, 700)
    img = Image.new("RGBA", (W, 40 + max(n.height for n in nat) * 3 + 60 + qh * z + 60 + qh * 2 + 40), fundo)
    d = ImageDraw.Draw(img)
    d.text((10, 8), "nativo do bruto (x3)", fill=(220, 220, 220, 255))
    x = 10
    for n in nat:
        img.alpha_composite(n.resize((n.width * 3, n.height * 3), Image.NEAREST), (x, 30))
        x += n.width * 3 + 20
    y = 40 + max(n.height for n in nat) * 3 + 20
    d.text((10, y - 14), f"tira final: quadro {qw}x{qh} px (x{z}), ao lado de um dígito de dano", fill=(220, 220, 220, 255))
    t = Image.fromarray(tira)
    img.alpha_composite(t.resize((t.width * z, t.height * z), Image.NEAREST), (10, y + 6))
    dig = Image.open(EFEITOS / "digitos" / "dano_2.png").convert("RGBA")
    img.alpha_composite(dig.resize((dig.width * z, dig.height * z), Image.NEAREST), (t.width * z + 40, y + 6 + (qh - dig.height) * z // 2))
    y2 = y + 6 + qh * z + 30
    d.text((10, y2 - 14), "tamanho real (x2, como na faixa ampliada)", fill=(220, 220, 220, 255))
    img.alpha_composite(t.resize((t.width * 2, t.height * 2), Image.NEAREST), (10, y2 + 4))
    img.save(arquivo)


def main():
    args = sys.argv[1:]
    fator = float(args[args.index("--fator") + 1]) if "--fator" in args else 1.0
    arq_previa = args[args.index("--previa") + 1] if "--previa" in args else "previa_escudo.png"
    nativos = quadros_nativos()
    if "--sem-furos" not in args:
        nativos[2] = quebrar(*nativos[2])
    pecas = [np.dstack([c, np.where(a, 255, 0).astype(np.uint8)]) if fator == 1 else reduzir(c, a, fator) for c, a, _ in nativos]
    tira, quadro = montar_tira(pecas)
    previa(tira, quadro, nativos, AQUI / arq_previa)
    print(f"pixel do bruto: {', '.join(f'{s:.1f}' for _, _, s in nativos)} px; nativos {[a.shape[::-1] for _, a, _ in nativos]}; quadro reduzido {quadro[0]}x{quadro[1]} px")
    print(f"prévia: {arq_previa}")
    if "--aplicar" in args:
        Image.fromarray(tira).save(EFEITOS / "escudo_3f.png")
        meta = json.loads((EFEITOS / "efeitos.json").read_text())
        meta["escudo"] = {"arquivo": "escudo_3f.png", "quadro": list(quadro), "quadros": 3, "ms_por_quadro": MS_POR_QUADRO}
        (EFEITOS / "efeitos.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n")
        print("gravado: assets/efeitos/escudo_3f.png e a entrada escudo no efeitos.json")


if __name__ == "__main__":
    main()
