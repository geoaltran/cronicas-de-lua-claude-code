"""Prévia animada (GIF) da arena: parallax, partículas e personagens.

Gera duas cenas, como o mod vai mostrar:
  previa_caminhada.gif  faixa compacta, Lua andando entre lutas (tudo rola)
  previa_chefao.gif     arena aberta para chefão (cena parada, viva)
É só uma prévia: no mod a mesma lógica roda no app, em tempo real.
"""
import json
import math
import random
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).parent
A = RAIZ / "assets"
CEN = A / "cenarios" / "floresta"


def carregar():
    meta = json.loads((CEN / "cenario.json").read_text())
    cam = {c.get("arquivo", "ilhas"): c for c in meta["camadas"]}
    img = {k: Image.open(CEN / k).convert("RGBA") for k in ("fundo.png", "nuvens.png", "meio.png", "chao.png")}
    ilhas = [(Image.open(CEN / i["arquivo"]).convert("RGBA"), i["x"], i["y"]) for i in cam["ilhas"]["ilhas"]]
    part = {n: Image.open(A / "particulas" / f"{n}_4f.png").convert("RGBA")
            for n in ("estrela", "vagalume", "faisca", "folha")}
    return meta, cam, img, ilhas, part


def quadro_particula(tira, i):
    n = tira.height
    return tira.crop((i * n, 0, i * n + n, n))


def rolar(tela, camada, desloc, y_tela, recorte_y, largura):
    """Desenha uma camada que dá a volta (emendável), deslocada `desloc` px."""
    w = camada.width
    x = -(int(round(desloc)) % w)
    faixa = camada.crop((0, recorte_y[0], w, recorte_y[1]))
    while x < largura:
        tela.alpha_composite(faixa, (x, y_tela))
        x += w


def cena(nome, quadros, largura, janela_frente, fundo_desce, andar_px, chefao=None, escala=2):
    meta, cam, img, ilhas, part = carregar()
    pad = (img["fundo.png"].width - meta["tamanho_nativo"][0] + 1) // 2
    x0 = img["fundo.png"].width // 2 - largura // 2          # janela centrada na ilustração
    fy0, fy1 = janela_frente
    altura = fy1 - fy0
    pes = meta["pes_dos_personagens_y"] - fy0
    rnd = random.Random(3)
    estrelas = [(rnd.randrange(8, largura - 8), rnd.randrange(4, 60), rnd.randrange(4)) for _ in range(9)]
    vagalumes = [(rnd.randrange(0, 958), rnd.randrange(130, 185), rnd.random() * 6.28) for _ in range(10)]
    folhas = [(rnd.randrange(0, 958), rnd.randrange(110, 140), rnd.randrange(quadros)) for _ in range(5)]
    lua = Image.open(A / "lua" / "lua_lado.png").convert("RGBA")
    boss = None
    if chefao:
        info = json.loads((A / "chefoes" / "chefoes.json").read_text())[chefao]
        boss = Image.open(A / "chefoes" / chefao / info["arena"]).convert("RGBA")
        if info["espelhar"]:
            boss = boss.transpose(Image.FLIP_LEFT_RIGHT)
    frames = []
    for t in range(quadros):
        andou = t * andar_px
        tela = Image.new("RGBA", (largura, altura))
        # fundo parado (as camadas de trás descem no modo compacto para a Lua do céu caber)
        fundo = img["fundo.png"].crop((x0, fy0 - fundo_desce, x0 + largura, fy1 - fundo_desce))
        tela.alpha_composite(fundo)
        # estrelas cintilando (no céu, presas à tela)
        for (sx, sy, fase) in estrelas:
            k = (t // 3 + fase) % 8
            if k < 4:
                tela.alpha_composite(quadro_particula(part["estrela"], k), (sx, sy))
        # nuvens altas: parallax lento + vento
        nv = cam["nuvens.png"]
        rolar(tela, img["nuvens.png"], x0 - pad + andou * nv["velocidade"] + t * 0.4,
              0, (fy0 - fundo_desce, fy1 - fundo_desce), largura)
        # ilhas: parallax + balanço
        il = cam["ilhas"]
        for k, (sp, ix, iy) in enumerate(ilhas):
            bal = round(il["balanco_px"] * math.sin(t / 7 + k * 2))
            sx = ix - x0 - andou * il["velocidade"]
            tela.alpha_composite(sp, (int(sx), iy - fy0 + fundo_desce + bal))
        # meio (árvores) + vaga-lumes e folhas que andam com ele
        md = cam["meio.png"]
        desl_meio = x0 - pad + andou * md["velocidade"]
        rolar(tela, img["meio.png"], desl_meio, 0, (fy0, fy1), largura)
        for (vx, vy, fase) in vagalumes:
            sx = (vx - desl_meio + 2 * math.sin(t / 5 + fase)) % 958
            sy = vy - fy0 + 2 * math.sin(t / 4 + fase * 2)
            if 0 <= sx < largura:
                k = int((t / 2 + fase * 3) % 8)
                tela.alpha_composite(quadro_particula(part["vagalume"], k if k < 4 else 7 - k),
                                     (int(sx), int(sy)))
        for (lx, ly, nasc) in folhas:
            idade = (t - nasc) % quadros
            sx = (lx - desl_meio - idade * 0.7 + 3 * math.sin(idade / 4)) % 958
            sy = ly - fy0 + idade * 0.9
            if 0 <= sx < largura and sy < pes:
                tela.alpha_composite(quadro_particula(part["folha"], (idade // 2) % 4), (int(sx), int(sy)))
        # chão da frente
        rolar(tela, img["chao.png"], x0 - pad + andou * cam["chao.png"]["velocidade"], 0, (fy0, fy1), largura)
        # personagens: respiração de 1 px; andando, o passo balança mais
        lx = 70 if not chefao else 90
        passo = (t // 3) % 2 if andar_px else (t // 6) % 2
        tela.alpha_composite(lua, (lx, pes - lua.height - passo))
        if boss is not None:
            bx = largura - 70 - boss.width
            tela.alpha_composite(boss, (bx, pes - boss.height - (t // 8) % 2))
            # faíscas saindo da varinha da Lua, em direção ao chefão
            for j in range(3):
                idade = (t + j * 5) % 15
                fx = lx + lua.width - 4 + idade * 3
                fy = pes - 52 - idade + (j - 1) * 4
                tela.alpha_composite(quadro_particula(part["faisca"], min(idade // 4, 3)), (fx, fy))
        frames.append(tela.resize((largura * escala, altura * escala), Image.NEAREST).convert("RGB"))
    frames[0].save(RAIZ / nome, save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=True)
    return frames


if __name__ == "__main__":
    # faixa compacta: só a parte de baixo do chão rola à vista, as camadas de
    # trás descem 62 px para a Lua do céu e o castelo continuarem aparecendo
    cena("previa_caminhada.gif", 64, 560, (70, 226), 62, 2)
    # arena aberta: altura toda, cena parada e viva
    cena("previa_chefao.gif", 48, 560, (0, 226), 0, 0, chefao="ignis")
