"""Prévia animada de uma luta completa (GIF), como o mod vai mostrar.

Roteiro: caminhada -> encontro (!) -> ataque com estrela mágica -> pausa de
impacto + inimigo pisca/recua + explosão + dano -> contra-ataque (a Lua leva
dano) -> golpe final -> inimigo se desfaz em pixels -> vitória (+XP) -> volta a andar.

No mod, cada passo é ligado a um evento real do Claude (ferramenta começou,
terminou, deu erro). Aqui é só para ver o ritmo e o "impacto".
"""
import json
import math
import random
from pathlib import Path
from PIL import Image, ImageOps

import efeitos
from previa_cenario import carregar, rolar, quadro_particula

RAIZ = Path(__file__).parent
A = RAIZ / "assets"


def tira_quadros(caminho, n):
    im = Image.open(caminho).convert("RGBA")
    w = im.width // n
    return [im.crop((i * w, 0, (i + 1) * w, im.height)) for i in range(n)]


def silhueta(im, cor):
    """O sprite inteiro numa cor só (o 'piscar' de quando leva golpe)."""
    s = Image.new("RGBA", im.size, (*cor, 255))
    s.putalpha(im.getchannel("A"))
    return s


def tingir(im, cor, forca):
    base = im.convert("RGBA")
    camada = Image.new("RGBA", im.size, (*cor, 0))
    camada.putalpha(im.getchannel("A").point(lambda a: int(a * forca)))
    return Image.alpha_composite(base, camada)


def gerar(inimigo="vespera", largura=560, escala=2):
    meta, cam, img, ilhas, part = carregar()
    poses = json.loads((A / "lua" / "poses" / "poses.json").read_text())
    Q = {k: tira_quadros(A / "lua" / "poses" / v["arquivo"], v["n"]) for k, v in poses["quadros"].items()}
    circulo = tira_quadros(A / "efeitos" / "canalizar_4f.png", 4)
    pontas = {k: v.get("ponta_da_varinha") for k, v in poses["quadros"].items()}
    fx = {k: tira_quadros(A / "efeitos" / f"{k}_{n}f.png", n) for k, n in (("projetil", 4), ("impacto", 6))}
    excl = Image.open(A / "efeitos" / "exclamacao.png").convert("RGBA")
    info = json.loads((A / "chefoes" / "chefoes.json").read_text())[inimigo]
    ini = Image.open(A / "chefoes" / inimigo / info["arena"]).convert("RGBA")
    if info["espelhar"]:
        ini = ini.transpose(Image.FLIP_LEFT_RIGHT)
    dano_txt = efeitos.texto("-12")
    dano2_txt = efeitos.texto("-30")
    lua_dano_txt = tingir(efeitos.texto("-3"), (232, 72, 72), 0.85)
    xp_txt = efeitos.texto("+5XP", "xp")

    pad = (img["fundo.png"].width - meta["tamanho_nativo"][0] + 1) // 2
    x0 = img["fundo.png"].width // 2 - largura // 2
    fy0, fy1, desce = 70, 226, 62
    altura = fy1 - fy0
    pes = meta["pes_dos_personagens_y"] - fy0
    QW = poses["quadro"][0]
    lua_x = 40
    ini_x_final = largura - 90 - ini.width

    # roteiro (em quadros de 70 ms)
    # ataque = preparar (3) + balançar (3) + soltar (6, o feitiço sai) + recuperar (6)
    ANDA1, PARA, PREP1 = 0, 26, 34
    LANCA1, VOO1, CONGELA1, IMPACTO1 = PREP1 + 3, PREP1 + 6, PREP1 + 14, PREP1 + 16
    CONTRA, CANAL, PREP2 = 62, 76, 90
    LANCA2, VOO2, CONGELA2, IMPACTO2 = PREP2 + 3, PREP2 + 6, PREP2 + 14, PREP2 + 16
    VITORIA, ANDA2, FIM = 120, 142, 160

    def quadro_ataque(t, prep):
        d = t - prep
        for lim, q in ((3, 0), (6, 1), (12, 2), (18, 3)):
            if 0 <= d < lim:
                return q
        return None

    rnd = random.Random(5)
    pixels_ini = [(x, y, ini.getpixel((x, y))) for y in range(ini.height) for x in range(ini.width)
                  if ini.getpixel((x, y))[3] > 0 and rnd.random() < 0.35]
    vel = [(rnd.uniform(-0.8, 0.8), rnd.uniform(-2.2, -0.6)) for _ in pixels_ini]
    trilha = []
    andou = 0
    frames = []

    for t in range(FIM):
        andando = t < PARA or t >= ANDA2
        congelado = CONGELA1 <= t < IMPACTO1 or CONGELA2 <= t < IMPACTO2
        if andando:
            andou += 2
        tela = Image.new("RGBA", (largura, altura))
        # cenário (mesmas camadas e velocidades do cenario.json)
        tela.alpha_composite(img["fundo.png"].crop((x0, fy0 - desce, x0 + largura, fy1 - desce)))
        rolar(tela, img["nuvens.png"], x0 - pad + andou * 0.15 + t * 0.4, 0, (fy0 - desce, fy1 - desce), largura)
        for k, (sp, ix, iy) in enumerate(ilhas):
            tela.alpha_composite(sp, (int(ix - x0 - andou * 0.2), iy - fy0 + desce + round(2 * math.sin(t / 7 + k * 2))))
        rolar(tela, img["meio.png"], x0 - pad + andou * 0.5, 0, (fy0, fy1), largura)
        rolar(tela, img["chao.png"], x0 - pad + andou, 0, (fy0, fy1), largura)

        # ---------------- inimigo
        ini_vivo = t < IMPACTO2 + 2
        tremor = 0
        recuo = 0
        if IMPACTO1 <= t < IMPACTO1 + 8:
            recuo = max(0, 6 - (t - IMPACTO1))
            tremor = (-1, 1)[t % 2]
        investida = 0
        if CONTRA <= t < CONTRA + 10:
            k = t - CONTRA
            investida = -[0, 6, 14, 22, 24, 20, 14, 8, 3, 0][k]
        ix = ini_x_final + (PARA - t) * 2 if t < PARA else ini_x_final
        ix += recuo + tremor + investida
        if ini_vivo:
            spr = ini
            if congelado or IMPACTO1 <= t < IMPACTO1 + 1:
                spr = silhueta(ini, (255, 255, 255))
            elif IMPACTO1 + 1 <= t < IMPACTO1 + 3:
                spr = tingir(ini, (255, 80, 80), 0.45)
            resp = (t // 8) % 2 if not congelado else 0
            tela.alpha_composite(spr, (ix, pes - ini.height - resp))
        elif t < VITORIA + 14:
            # se desfaz: pixels sobem e somem
            idade = t - (IMPACTO2 + 2)
            for (px, py, c), (vx, vy) in zip(pixels_ini, vel):
                xx = ini_x_final + px + vx * idade
                yy = pes - ini.height + py + vy * idade - 0.05 * idade * idade * -1
                a = int(c[3] * max(0, 1 - idade / 22))
                if a > 0 and 0 <= xx < largura and 0 <= yy < altura:
                    tela.putpixel((int(xx), int(yy)), (min(255, c[0] + 60), min(255, c[1] + 60), min(255, c[2] + 80), a))

        # ---------------- Lua
        PY = poses["pes_y"]
        qa = quadro_ataque(t, PREP1)
        if qa is None:
            qa = quadro_ataque(t, PREP2)
        respira = 0
        if andando:
            spr, nome = Q["andar"][(t // 3) % len(Q["andar"])], "andar"
        elif qa is not None:
            spr, nome = Q["ataque"][qa], "ataque"
        elif CONTRA + 4 <= t < CONTRA + 8:
            spr, nome = Q["dano"][0], "dano"
        elif CONTRA + 8 <= t < CONTRA + 14:
            spr, nome = Q["dano"][1], "dano"
        elif CANAL <= t < PREP2:
            spr, nome = Q["canalizar"][(t // 4) % 2], "canalizar"
        elif VITORIA <= t < VITORIA + 4:
            spr, nome = Q["vitoria"][0], "vitoria"
        elif VITORIA + 4 <= t < ANDA2:
            spr, nome = Q["vitoria"][1], "vitoria"
        else:
            # parada: respira (normal/respirando) e pisca de vez em quando
            k = 2 if t % 40 in (20, 21) else (t // 8) % 2
            spr, nome = Q["parada"][k], "parada"
        lx = lua_x
        if CONTRA + 4 <= t < CONTRA + 12:
            lx -= max(0, 4 - (t - CONTRA - 4))
            if t < CONTRA + 7:
                spr = tingir(spr, (255, 60, 60), 0.55) if t % 2 else silhueta(spr, (255, 255, 255))
        ly = pes - PY + respira
        cabeca = ly + PY - poses["altura_lua"]
        centro = lx + QW // 2
        if nome == "canalizar":
            c = circulo[(t // 2) % 4]
            tela.alpha_composite(c, (centro - c.width // 2, ly + PY - c.height + 3))
        tela.alpha_composite(spr, (lx, ly))

        # ---------------- efeitos
        if PARA <= t < PARA + 8:
            pulo = 2 if t - PARA < 2 else 0
            tela.alpha_composite(excl, (centro - 5, cabeca - 18 - pulo))
        for (lanca, voo, cong) in ((LANCA1, VOO1, CONGELA1), (LANCA2, VOO2, CONGELA2)):
            if voo <= t < cong:
                px0, py0 = pontas["ataque"][2]
                sx, sy = lx + px0, ly + py0
                ex, ey = ini_x_final + ini.width // 3, pes - ini.height // 2
                k = (t - voo) / (cong - voo)
                x = sx + (ex - sx) * k
                y = sy + (ey - sy) * k - 10 * math.sin(math.pi * k)
                pr = fx["projetil"][t % 4]
                tela.alpha_composite(pr, (int(x) - pr.width // 2, int(y) - pr.height // 2))
                trilha.append((x, y, t))
        for (x, y, nasc) in list(trilha):
            idade = t - nasc
            if 1 <= idade < 6:
                fq = quadro_particula(part["faisca"], min(3, idade - 1))
                tela.alpha_composite(fq, (int(x) - 2 - idade, int(y) - 2 + (idade % 2)))
        for (imp, txt) in ((IMPACTO1, dano_txt), (IMPACTO2, dano2_txt)):
            if imp <= t < imp + 6:
                q = fx["impacto"][t - imp]
                cx, cy = ini_x_final + ini.width // 3, pes - ini.height // 2
                tela.alpha_composite(q, (cx - q.width // 2, cy - q.height // 2))
            if imp <= t < imp + 14:
                k = t - imp
                tela.alpha_composite(txt.resize((txt.width * 2, txt.height * 2), Image.NEAREST),
                                     (ini_x_final + ini.width // 2 - txt.width, pes - ini.height - 6 - k * 2))
        if CONTRA + 4 <= t < CONTRA + 16:
            k = t - CONTRA - 4
            tela.alpha_composite(lua_dano_txt.resize((lua_dano_txt.width * 2, 14), Image.NEAREST),
                                 (centro - 6, cabeca - 10 - k * 2))
        if VITORIA <= t < VITORIA + 18:
            k = t - VITORIA
            tela.alpha_composite(xp_txt.resize((xp_txt.width * 2, 14), Image.NEAREST), (centro - xp_txt.width, cabeca - 22 - k))
            for j in range(4):  # estrelinhas em volta na vitória
                ang = t / 3 + j * math.pi / 2
                ex = centro + round(30 * math.cos(ang)) - 3
                ey = cabeca + 30 + round(16 * math.sin(ang))
                tela.alpha_composite(quadro_particula(part["estrela"], (t + j) % 4), (ex, ey))

        frames.append(tela.resize((largura * escala, altura * escala), Image.NEAREST).convert("RGB"))
    frames[0].save(RAIZ / "previa_luta.gif", save_all=True, append_images=frames[1:], duration=70, loop=0)
    return len(frames)


if __name__ == "__main__":
    print(gerar(), "quadros")
