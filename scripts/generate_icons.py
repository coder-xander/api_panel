#!/usr/bin/env python3
"""
API 聚合面板 — 现代化图标生成器
设计：四节点互联 + 中心脉冲，代表多平台 API 聚合
"""

from PIL import Image, ImageDraw
import math
import os

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'build', 'icons')

# ─── 配色（ropedia 暗色美学） ───
BG = '#0a0f0a'
ACCENT = '#a3ff47'
ACCENT_DIM = '#7acc35'
NODE_DIM = '#1a3a1a'
EDGE_DIM = '#2a5a2a'
GLOW = 'rgba(163,255,71,0.15)'

def draw_rounded_rect(draw, xy, radius, fill):
    """绘制圆角矩形"""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill)

def draw_hexagon(draw, center, radius, fill, outline=None, width=0):
    """绘制六边形节点"""
    cx, cy = center
    points = []
    for i in range(6):
        angle = math.pi / 6 + i * math.pi / 3
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        points.append((x, y))
    draw.polygon(points, fill=fill, outline=outline)

def draw_circle_node(draw, center, radius, fill, outline=None, width=0):
    """绘制圆形节点（带轻微光晕）"""
    cx, cy = center
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=fill, outline=outline, width=width
    )

def generate_icon():
    img = Image.new('RGBA', (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)
    
    cx, cy = SIZE / 2, SIZE / 2
    
    # ─── 背景：微妙的网格/光晕 ───
    # 中心脉冲光环
    for i in range(4):
        r = 300 + i * 50
        alpha = 15 - i * 3
        color = (163, 255, 71, alpha)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=None, outline=color, width=2
        )
    
    # ─── 边缘连接线（四节点环绕中心） ───
    node_distance = 240
    node_radius = 70
    
    # 4 个外围节点位置（左上、右上、右下、左下）
    angles = [math.pi * 0.75, math.pi * 0.25, -math.pi * 0.25, -math.pi * 0.75]
    node_positions = []
    
    for angle in angles:
        nx = cx + node_distance * math.cos(angle)
        ny = cy + node_distance * math.sin(angle)
        node_positions.append((nx, ny))
    
    # 中心节点
    center_pos = (cx, cy)
    
    # 绘制连接线（带渐变效果，分层绘制）
    edge_colors = [
        (42, 90, 42, 100),   # 底层宽线
        (58, 140, 45, 180),  # 中层
        (130, 220, 60, 220), # 靠近节点处亮一些
    ]
    
    for edge_color in edge_colors:
        lw = 6 if edge_colors.index(edge_color) == 0 else 3 if edge_colors.index(edge_color) == 1 else 1.5
        
        # 节点之间的连接
        for i in range(4):
            j = (i + 1) % 4
            draw.line(
                [node_positions[i], node_positions[j]],
                fill=edge_color, width=int(lw)
            )
        
        # 节点到中心
        for pos in node_positions:
            draw.line(
                [pos, center_pos],
                fill=edge_color, width=int(lw)
            )
    
    # ─── 绘制外围节点（六边形卡片） ───
    hex_radius = 58
    for i, pos in enumerate(node_positions):
        # 底部阴影
        shadow_pos = (pos[0] + 4, pos[1] + 4)
        draw_hexagon(draw, shadow_pos, hex_radius, 
                     fill=(0, 0, 0, 80))
        # 主体
        draw_hexagon(draw, pos, hex_radius,
                     fill=(10, 15, 10, 240),
                     outline=(42, 90, 42, 200), width=3)
        
        # 节点内小图标（用简化的圆点代表 API 端点）
        inner_r = 18
        draw_circle_node(draw, pos, inner_r,
                         fill=(163, 255, 71, 60),
                         outline=(163, 255, 71, 100), width=2)
        
        # 小发光点
        dot_r = 6
        draw_circle_node(draw, pos, dot_r,
                         fill=(163, 255, 71, 200))

    # ─── 中心节点（发光六边形） ───
    center_hex_r = 90
    
    # 中心外发光
    for g in range(3):
        gr = center_hex_r + 15 + g * 10
        ga = 25 - g * 7
        draw_hexagon(draw, center_pos, gr,
                     fill=None, outline=(163, 255, 71, ga), width=2)
    
    # 中心主体
    draw_hexagon(draw, center_pos, center_hex_r,
                 fill=(20, 30, 20, 250),
                 outline=(140, 220, 60, 240), width=4)
    
    # 中心内 AP 文字
    # 使用简单的几何图形代表 API 聚合
    # 内部三个小方块排列
    gap = 14
    sq_size = 22
    for col in [-1, 0, 1]:
        sqx = cx + col * (sq_size + gap) - sq_size / 2
        sqy = cy - sq_size / 2
        draw_rounded_rect(draw, 
                         [sqx, sqy, sqx + sq_size, sqy + sq_size],
                         radius=5,
                         fill=(163, 255, 71, 200))
    
    # ─── 底部渐变装饰线 ───
    for i in range(3):
        y = 780 + i * 15
        alpha = 30 - i * 10
        line_width = SIZE - 300 - i * 80
        x1 = (SIZE - line_width) / 2
        x2 = x1 + line_width
        draw.line(
            [(x1, y), (x2, y)],
            fill=(163, 255, 71, alpha), width=2
        )
    
    # ─── 圆角矩形背景框（让图标在各种形状下都能识别） ───
    # 绘制一个极淡的圆角方框作为轮廓
    margin = 40
    draw.rounded_rectangle(
        [margin, margin, SIZE - margin, SIZE - margin],
        radius=120,
        fill=None,
        outline=(42, 90, 42, 80),
        width=4
    )
    
    return img


def generate_all_sizes():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    master = generate_icon()
    
    # 保存 1024x1024 主文件
    master.save(os.path.join(OUT_DIR, '1024x1024.png'), 'PNG')
    
    # 生成各尺寸
    sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    for s in sizes:
        resized = master.resize((s, s), Image.LANCZOS)
        resized.save(os.path.join(OUT_DIR, f'{s}x{s}.png'), 'PNG')
    
    # 生成 icon.png（512，用于 Linux packaging）
    icon512 = master.resize((512, 512), Image.LANCZOS)
    icon512.save(os.path.join(OUT_DIR, 'icon.png'), 'PNG')
    
    # 生成 icon.ico（多分辨率 Windows 图标）
    # Pillow 支持保存 ICO，但需要特定尺寸
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    ico_images = []
    for s in ico_sizes:
        ico_images.append(master.resize(s, Image.LANCZOS))
    
    ico_path = os.path.join(OUT_DIR, 'icon.ico')
    ico_images[0].save(ico_path, format='ICO', sizes=ico_sizes, append_images=ico_images[1:])
    
    print(f"✅ 图标生成完成！{OUT_DIR}/")
    for f in sorted(os.listdir(OUT_DIR)):
        fpath = os.path.join(OUT_DIR, f)
        size_kb = os.path.getsize(fpath) / 1024
        print(f"  {f:20s} — {size_kb:8.1f} KB")


if __name__ == '__main__':
    generate_all_sizes()
