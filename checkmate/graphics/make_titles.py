"""Caption + end-title overlays (transparent PNG, 1080x1920)."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, features
import arabic_reshaper
from bidi.algorithm import get_display

W, H = 1080, 1920
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', 'fonts')
RAQM = features.check('raqm')


def font(name, size, wght=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size, layout_engine=ImageFont.Layout.RAQM if RAQM else ImageFont.Layout.BASIC)
    if wght:
        try:
            f.set_variation_by_axes([wght])
        except Exception:
            pass
    return f


def ar(text):
    return text if RAQM else get_display(arabic_reshaper.reshape(text))


def glow_text(img, xy, text, f, fill, glow=(0, 0, 0, 200), blur=10, anchor='mm', spacing=0, direction=None):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    kw = dict(font=f, anchor=anchor)
    if direction and RAQM:
        kw['direction'] = direction
    d.text(xy, text, fill=glow, **kw)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    d.text(xy, text, fill=fill, **kw)


def caption(num, line1, line2, path):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = int(H * 0.2)
    glow_text(img, (W // 2, y), f'RULE  {num}', font('Cinzel.ttf', 44, 700), (205, 214, 230, 255), blur=12)
    d = ImageDraw.Draw(img)
    d.line([(W // 2 - 70, y + 42), (W // 2 + 70, y + 42)], fill=(205, 214, 230, 200), width=2)
    glow_text(img, (W // 2, y + 110), line1, font('Cinzel.ttf', 64, 800), (245, 246, 250, 255), blur=14)
    if line2:
        glow_text(img, (W // 2, y + 190), line2, font('Cinzel.ttf', 64, 800), (245, 246, 250, 255), blur=14)
    img.save(path)


def end_title(path):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_text(img, (W // 2, H // 2 - 40), ar('كش ملك.'), font('ArefRuqaa-Bold.ttf', 230), (238, 238, 242, 255),
              glow=(150, 170, 220, 110), blur=26, direction='rtl')
    glow_text(img, (W // 2, H // 2 + 150), 'C H E C K M A T E', font('Cinzel.ttf', 40, 600), (170, 176, 190, 255), glow=(0, 0, 0, 0), blur=2)
    img.save(path)


if __name__ == '__main__':
    out = os.path.join(HERE, 'png')
    os.makedirs(out, exist_ok=True)
    caption('I', 'THE BOARD', 'HAS NO EDGE.', os.path.join(out, 'rule1.png'))
    caption('II', 'EVERY PIECE', 'FALLS.', os.path.join(out, 'rule2.png'))
    caption('III', 'NEVER TURN YOUR', 'BACK ON THE KING.', os.path.join(out, 'rule3.png'))
    end_title(os.path.join(out, 'checkmate_ar.png'))
    print('ok', RAQM)
