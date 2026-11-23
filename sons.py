"""Sons em chiptune do mod (gerados aqui, sem baixar nada).

    .venv/bin/python sons.py [pasta_do_mod]     (padrão: mod/cronicas-de-lua)

Grava em <pasta_do_mod>/sons/:
- vigilia.wav: arpejo subindo (a Vigília acende ou manda uma mensagem).
- apagou.wav: arpejo descendo (a Vigília apagou sozinha).
"""
import sys
import wave
from pathlib import Path

import numpy as np

TAXA = 22050


def nota(freq: float, ms: float, ciclo: float = 0.25, volume: float = 0.5) -> np.ndarray:
    """Onda quadrada com ciclo de trabalho (25% soa como os consoles antigos) e queda suave."""
    n = int(TAXA * ms / 1000)
    t = np.arange(n) / TAXA
    onda = np.where((t * freq) % 1.0 < ciclo, 1.0, -1.0)
    ataque = np.minimum(1.0, np.arange(n) / (TAXA * 0.003))
    queda = np.exp(-3.0 * np.arange(n) / n)
    return onda * ataque * queda * volume


def silencio(ms: float) -> np.ndarray:
    return np.zeros(int(TAXA * ms / 1000))


def hz(semitons_de_la4: int) -> float:
    return 440.0 * 2 ** (semitons_de_la4 / 12)


# Dó6, Mi6, Sol6, Dó7 (em semitons a partir do Lá4)
DO6, MI6, SOL6, DO7 = 15, 19, 22, 27
SOL5, MI5, DO5, SOL4 = 10, 7, 3, -2


def gravar(caminho: Path, amostras: np.ndarray) -> None:
    pcm = (np.clip(amostras, -1, 1) * 32767 * 0.8).astype('<i2')
    with wave.open(str(caminho), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(pcm.tobytes())


def main() -> None:
    pasta = Path(sys.argv[1] if len(sys.argv) > 1 else 'mod/cronicas-de-lua') / 'sons'
    pasta.mkdir(parents=True, exist_ok=True)
    sobe = np.concatenate([nota(hz(DO6), 55), nota(hz(MI6), 55), nota(hz(SOL6), 55), nota(hz(DO7), 220, volume=0.45), silencio(40)])
    desce = np.concatenate([nota(hz(SOL5), 80), nota(hz(MI5), 80), nota(hz(DO5), 80), nota(hz(SOL4), 260, ciclo=0.5, volume=0.4), silencio(40)])
    gravar(pasta / 'vigilia.wav', sobe)
    gravar(pasta / 'apagou.wav', desce)
    print(f'gravados em {pasta}: vigilia.wav, apagou.wav')


if __name__ == '__main__':
    main()
