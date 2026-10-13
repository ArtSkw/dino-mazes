# Dev-only: tile screenshots into a contact sheet. Usage: _sheet.py out.png cols w h files...
import sys
from PIL import Image
out, cols, w, h, *files = sys.argv[1:]
cols, w, h = int(cols), int(w), int(h)
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), 'white')
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB'); im.thumbnail((w, h))
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
