"""Marca "As Crônicas de Lua" em pixel art nativa, a partir do bruto do Nano Banana.

O bruto (assets-brutos/marca/marca_bruta.jpg, nunca vai para o git) é uma imagem
ampliada (~8,3 px de tela por pixel de arte) com ruído de JPG. Passos:
  1. mede a grade de pixel em cada eixo (período e fase, com o leve desvio que a
     IA deixa ao longo da imagem);
  2. reduz para o tamanho nativo pela MODA de cada célula (a média borra);
  3. prende as cores numa paleta fechada (k-means), o que limpa o ruído;
  4. tira o fundo branco ligado à borda (fica transparente).

Sem --aplicar: grava só a prévia em previa_faixa/marca_previa.png (bruto x nativa
ampliada, lado a lado) e previa_faixa/marca_x4.png.
Com --aplicar: grava assets/marca/marca.png (nativa), marca_x2/x4/x8.png e
marca_divulgacao.png (x4 com a assinatura @geoaltran no canto).
A marca é arte: fica sob o LICENSE-ART (CC BY-NC 4.0).
"""
from pathlib import Path
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from scipy.cluster.vq import kmeans2

RAIZ = Path(__file__).parent
BRUTO = RAIZ / "assets-brutos/marca/marca_bruta.jpg"
N_CORES = 28          # cores da paleta fechada
JANELA = 300          # janela (px do bruto) para medir o desvio da grade


def grade(a: np.ndarray, eixo: int) -> tuple[float, float]:
    """Período e início da grade num eixo: as bordas ficam em b0 + k * período."""
    d = np.abs(np.diff(a, axis=eixo)).sum(axis=2)
    perfil = d.sum(axis=1 - eixo)  # soma ao longo do outro eixo
    n = len(perfil)
    idx = np.arange(n)
    centro = perfil - perfil.mean()
    # 1) período aproximado: o pico do espectro entre 5 e 14 px
    cand = np.arange(5.0, 14.0, 0.005)
    forca = [abs((centro * np.exp(2j * np.pi * idx / p)).sum()) for p in cand]
    p = float(cand[int(np.argmax(forca))])
    # 2) fase em janelas: a reta da fase corrige o período (a IA estica um pouco)
    xs, fases = [], []
    for s in range(0, n - JANELA, JANELA // 2):
        seg = perfil[s:s + JANELA] - perfil[s:s + JANELA].mean()
        z = (seg * np.exp(2j * np.pi * idx[s:s + JANELA] / p)).sum()
        xs.append(s + JANELA / 2)
        # o pico em i = b + k*p dá ângulo 2*pi*b/p; o diff i fica entre i e i+1
        fases.append((np.angle(z) / (2 * np.pi) * p + 0.5) % p)
    fases = np.unwrap(np.array(fases) / p * 2 * np.pi) / (2 * np.pi) * p
    inclin, fase0 = np.polyfit(xs, fases, 1)
    periodo = p / (1 - inclin)
    return periodo, float(fase0 % periodo)


def reduzir(a: np.ndarray) -> np.ndarray:
    px, bx = grade(a, 1)
    py, by = grade(a, 0)
    print(f"grade: x {px:.4f} px (início {bx:.2f}), y {py:.4f} px (início {by:.2f})")
    H, W = a.shape[:2]
    bordas_x = np.arange(bx, W, px)
    bordas_y = np.arange(by, H, py)
    # paleta fechada: k-means nas cores dos centros das células
    cx = ((bordas_x[:-1] + bordas_x[1:]) / 2).astype(int)
    cy = ((bordas_y[:-1] + bordas_y[1:]) / 2).astype(int)
    amostra = a[np.ix_(cy, cx)].reshape(-1, 3)
    rng = np.random.default_rng(7)
    paleta, _ = kmeans2(amostra, N_CORES, minit="++", seed=rng)
    # cada pixel do bruto -> índice da cor mais próxima
    flat = a.reshape(-1, 3)
    dist = ((flat[:, None, :] - paleta[None, :, :]) ** 2).sum(axis=2)
    rot = dist.argmin(axis=1).reshape(H, W)
    # moda do miolo de cada célula (60% do meio: as bordas têm o borrão do JPG)
    out = np.zeros((len(cy), len(cx)), int)
    m = 0.2
    for j in range(len(cy)):
        y0 = int(round(bordas_y[j] + m * py)); y1 = int(round(bordas_y[j + 1] - m * py))
        for i in range(len(cx)):
            x0 = int(round(bordas_x[i] + m * px)); x1 = int(round(bordas_x[i + 1] - m * px))
            cel = rot[y0:y1 + 1, x0:x1 + 1].ravel()
            out[j, i] = np.bincount(cel, minlength=N_CORES).argmax()
    rgb = np.clip(paleta, 0, 255).astype(np.uint8)[out]
    # fundo: células claras e quase sem cor, ligadas à borda
    f = rgb.astype(int)
    claro = (f.min(axis=2) > 215) & (f.max(axis=2) - f.min(axis=2) < 25)
    rot_cl, _ = nd.label(claro)
    borda = set(np.unique(np.concatenate([rot_cl[0], rot_cl[-1], rot_cl[:, 0], rot_cl[:, -1]]))) - {0}
    fundo = np.isin(rot_cl, list(borda))
    rgba = np.dstack([rgb, np.where(fundo, 0, 255).astype(np.uint8)])
    ys, xs = np.nonzero(~fundo)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def ampliar(im: Image.Image, k: int) -> Image.Image:
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def divulgacao(m: Image.Image) -> Image.Image:
    """x4 com margem e a assinatura @geoaltran (x2) no canto de baixo à direita."""
    g = ampliar(m, 4)
    ass = ampliar(Image.open(RAIZ / "assets/ui/assinatura.png").convert("RGBA"), 2)
    tela = Image.new("RGBA", (g.width + 32, g.height + 32 + ass.height + 8), (0, 0, 0, 0))
    tela.alpha_composite(g, (16, 16))
    tela.alpha_composite(ass, (tela.width - ass.width - 16, tela.height - ass.height - 8))
    return tela


if __name__ == "__main__":
    a = np.asarray(Image.open(BRUTO).convert("RGB")).astype(float)
    nativa = Image.fromarray(reduzir(a))
    cores = len({tuple(c) for c in np.asarray(nativa).reshape(-1, 4) if c[3]})
    print("nativa:", nativa.size, f"{cores} cores")
    if "--aplicar" in sys.argv:
        pasta = RAIZ / "assets/marca"
        pasta.mkdir(exist_ok=True)
        nativa.save(pasta / "marca.png")
        for k in (2, 4, 8):
            ampliar(nativa, k).save(pasta / f"marca_x{k}.png")
        divulgacao(nativa).save(pasta / "marca_divulgacao.png")
        print("gravado em assets/marca/")
    else:
        prev = RAIZ / "previa_faixa"
        ampliar(nativa, 4).save(prev / "marca_x4.png")
        # lado a lado: bruto reduzido x nativa ampliada à mesma escala
        k = 4
        n = ampliar(nativa, k)
        b = Image.open(BRUTO).convert("RGBA")
        b = b.resize((round(b.width * k / 8.34), round(b.height * k / 8.34)), Image.LANCZOS)
        fundo = Image.new("RGBA", (b.width + n.width + 24, max(b.height, n.height) + 16), (40, 40, 48, 255))
        fundo.alpha_composite(b, (8, 8))
        fundo.alpha_composite(n, (b.width + 16, 8))
        fundo.save(prev / "marca_previa.png")
        print("prévia: previa_faixa/marca_previa.png e previa_faixa/marca_x4.png")
