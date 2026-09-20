"""Compose EXP052 PNG tiles; requires Pillow. Run after exp052_multiview.js."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
OUT = Path(__file__).parent / 'EXP052_renders'
font = ImageFont.truetype('DejaVuSans.ttf', 18)
small = ImageFont.truetype('DejaVuSans.ttf', 14)
views = ['iso', 'reverse_iso', '+X', '-X', '+Y', '-Y', '+Z', '-Z']
for name in ['C03', 'C04', 'C07', 'C10', 'USB_TOP', 'USB_BOTTOM', 'Pocket', 'Dekor']:
    paired = name not in ['Pocket', 'Dekor']
    columns = ['parser', 'reference', 'difference'] if paired else ['parser']
    canvas = Image.new('RGB', (1080 if paired else 720, 80+390*(8 if paired else 4)), 'white')
    d = ImageDraw.Draw(canvas)
    d.text((12, 8), name + (' | Parser / original STL / difference' if paired else ' | Parser only: no verified independent reference'), font=font, fill='black')
    if paired:
        d.text((12, 36), 'Magenta: parser only | Cyan: STL only | Orange: common depth differs > 0.01 mm', font=small, fill='black')
    for i, view in enumerate(views):
        for j, col in enumerate(columns):
            x, y = (j*360, 80+i*390) if paired else ((i%2)*360, 80+(i//2)*390)
            canvas.paste(Image.open(OUT/f'{name}_{view}_{col}.png'), (x, y+25))
            d.text((x+10, y+3), view+' / '+col, font=small, fill='black')
    canvas.save(OUT/f'{name}_sheet.png')
