"""Gera os ícones PNG (tafetá azul/creme com um A vermelho) sem dependências."""
import struct, sys, zlib

A = ["01110", "10001", "10001", "11111", "10001", "10001", "10001"]
NAVY, CREAM, RED = (31, 58, 95), (232, 224, 207), (192, 57, 43)


def png(path, size, pad_ratio):
    cell = 8  # tafetá em blocos de 8px (escalado)
    pad = int(size * pad_ratio)
    inner = size - 2 * pad
    mw, mh = 5, 7
    cs = inner // 9  # tamanho de cada quadrado do A
    ox = pad + (inner - mw * cs) // 2
    oy = pad + (inner - mh * cs) // 2
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            c = NAVY if ((x // cell) + (y // cell)) % 2 == 0 else (22, 44, 74)
            if ox <= x < ox + mw * cs and oy <= y < oy + mh * cs:
                if A[(y - oy) // cs][(x - ox) // cs] == "1":
                    c = RED
            row += bytes(c)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(t, d):
        b = struct.pack(">I", len(d)) + t + d
        return b + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)


out = sys.argv[1]
png(out + "/icon-192.png", 192, 0.10)
png(out + "/icon-512.png", 512, 0.10)
png(out + "/icon-maskable-512.png", 512, 0.22)
print("icones ok")
