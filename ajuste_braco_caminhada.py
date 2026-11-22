"""Ajuste fino da caminhada de 8 quadros (ChatGPT): suaviza o braço da frente.

No q7 o braço que cruza a frente do corpo voltava para trás antes da hora e no
q8 ia para a frente de novo (frente -> trás -> frente em 3 quadros: a "quebra").
Aqui a parte de cima (tronco e braços) do q7 e do q8 é trocada, mantendo as
pernas de cada quadro. O braço fica meio ciclo atrás (q8, q1, q2, q3) e meio
ciclo à frente (q4..q7), acompanhando as pernas.

Também tira pixels claros soltos perto das pernas (sobra do recorte).
O original fica salvo em lua_andar_8f_backup.png.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as nd

POSES = Path(__file__).parent / "assets" / "lua" / "poses"
QW = 80
TROCAR = (6, 7)          # q7 e q8 (índices a partir de 0)


def fim_da_tunica(q):
    """Última linha da barra dourada da túnica + o contorno de baixo."""
    r, g, b, a = (q[..., k].astype(int) for k in range(4))
    ouro = (a > 0) & (r > 200) & (g > 140) & (b < 110)
    return int(np.nonzero(ouro[60:90].any(1))[0].max()) + 60 + 2


def limpar_soltos(q, y0=74):
    """Pixels claros isolados (1–2 px) da cintura para baixo viram transparentes."""
    op = q[..., 3] > 0
    claro = op & (q[..., :3].min(-1) > 190)
    rot, n = nd.label(claro)
    for i in range(1, n + 1):
        m = rot == i
        if m.sum() <= 2 and np.nonzero(m)[0].min() >= y0:
            q[m] = 0
    return q


def ajustar():
    base = np.asarray(Image.open(POSES / "lua_andar_8f_backup.png")).copy()
    quadros = [base[:, i * QW:(i + 1) * QW].copy() for i in range(8)]
    a, b = (quadros[i] for i in TROCAR)
    corte_a, corte_b = fim_da_tunica(a), fim_da_tunica(b)
    novo_a = np.zeros_like(a)
    novo_b = np.zeros_like(b)
    # pernas de cada quadro primeiro, a parte de cima do outro por cima
    novo_a[corte_a:] = a[corte_a:]
    novo_b[corte_b:] = b[corte_b:]
    for novo, cima, corte in ((novo_a, b, corte_b), (novo_b, a, corte_a)):
        m = cima[:corte, :, 3] > 0
        novo[:corte][m] = cima[:corte][m]
    quadros[TROCAR[0]], quadros[TROCAR[1]] = novo_a, novo_b
    quadros = [limpar_soltos(q) for q in quadros]
    Image.fromarray(np.concatenate(quadros, axis=1)).save(POSES / "lua_andar_8f.png")
    return corte_a, corte_b


if __name__ == "__main__":
    print("cortes (linha do fim da túnica):", ajustar())
