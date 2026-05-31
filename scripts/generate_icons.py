#!/usr/bin/env python3
"""
API 聚合面板 — 图标生成器 v2
透明底 + 青柠绿闪电 ⚡
"""

from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'build', 'icons')

ACCENT = '#a3ff47'       # 主体闪电颜色
ACCENT_GLOW = '#c8ff80'  # 外发光

def draw_lightning(draw, cx, cy, scale=1.0):
    """
    绘制几何闪电形状 — 简洁锐利，类似高压电符号
    中心点在 (cx, cy)
    """
    s = 300 * scale  # 基础尺寸
    
    # 闪电折线路径（从上到下）
    points = [
        (cx - s * 0.10, cy - s * 0.90),   # 顶部左
        (cx + s * 0.20, cy - s * 0.30),   # 右上
        (cx - s * 0.15, cy - s * 0.28),   # 中左
        (cx + s * 0.35, cy + s * 0.55),   # 右下
        (cx - s * 0.05, cy + s * 0.27),   # 中右
        (cx + s * 0.25, cy + s * 0.88),   # 底部右
        (cx - s * 0.15, cy + s * 0.12),   # 下左
        (cx - s * 0.10, cy - s * 0.90),   # 闭合回顶部
    ]
    draw.polygon(points, fill=ACCENT)

def generate_icon():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE / 2, SIZE / 2 + 10  # 微调垂直居中
    
    # 外发光层（逐渐增大的半透明闪电）
    for i in range(3, 0, -1):
        glow_alpha = 60 // i
        scale = 1.0 + i * 0.06
        # 创建临时图层画发光
        glow_img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_img)
        s = 300 * scale
        points = [
            (cx - s * 0.10, cy - s * 0.90),
            (cx + s * 0.20, cy - s * 0.30),
            (cx - s * 0.15, cy - s * 0.28),
            (cx + s * 0.35, cy + s * 0.55),
            (cx - s * 0.05, cy + s * 0.27),
            (cx + s * 0.25, cy + s * 0.88),
            (cx - s * 0.15, cy + s * 0.12),
            (cx - s * 0.10, cy - s * 0.90),
        ]
        glow_color = (163, 255, 71, glow_alpha)
        glow_draw.polygon(points, fill=glow_color)
        img = Image.alpha_composite(img, glow_img)
        draw = ImageDraw.Draw(img)
    
    # 主体闪电
    draw_lightning(draw, cx, cy, scale=1.0)
    
    return img


def generate_all_sizes():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    master = generate_icon()
    master.save(os.path.join(OUT_DIR, '1024x1024.png'), 'PNG')
    
    sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    for s in sizes:
        resized = master.resize((s, s), Image.LANCZOS)
        resized.save(os.path.join(OUT_DIR, f'{s}x{s}.png'), 'PNG')
    
    icon512 = master.resize((512, 512), Image.LANCZOS)
    icon512.save(os.path.join(OUT_DIR, 'icon.png'), 'PNG')
    
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    ico_images = [master.resize(s, Image.LANCZOS) for s in ico_sizes]
    ico_images[0].save(
        os.path.join(OUT_DIR, 'icon.ico'), format='ICO',
        sizes=ico_sizes, append_images=ico_images[1:]
    )
    
    print(f"✅ 图标生成完成")
    for f in sorted(os.listdir(OUT_DIR)):
        sz = os.path.getsize(os.path.join(OUT_DIR, f)) / 1024
        print(f"  {f:20s} {sz:8.1f} KB")


if __name__ == '__main__':
    generate_all_sizes()
