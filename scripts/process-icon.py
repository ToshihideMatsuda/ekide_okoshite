#!/usr/bin/env python3
"""
アイコン画像処理スクリプト - 駅で起こして
処理内容:
  1. 緑と白のRGBをサンプリング → 中間値を閾値として2色化
  2. 正方形にクロップ
  3. iOS/Android最適サイズで出力

使い方: python3 scripts/process-icon.py <source_image_path>
"""

import sys
import os
import numpy as np
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sample_representative_pixels(img_array):
    """
    画像の特定領域から緑・白のRGBをサンプリングする。
    戦略: 緑=アイコン下部中央(電車より下)、白=電車車体の中心
    角丸のアンチエイリアス境界を避けるため、アイコン中央寄りでサンプリング。
    """
    h, w = img_array.shape[:2]

    # 緑サンプル: アイコン下部 (電車より下 = 75-88%行 / 中央列)
    # ここは白アイコン要素が少なく、確実に緑背景
    green_region_fracs = [
        (0.80, 0.45), (0.82, 0.50), (0.80, 0.55),
        (0.84, 0.45), (0.84, 0.55), (0.86, 0.50),
        (0.78, 0.15), (0.78, 0.85),   # 左右端も追加
    ]
    green_samples = []
    for (rf, cf) in green_region_fracs:
        r, c = int(rf * h), int(cf * w)
        pixel = img_array[r, c, :3]
        green_samples.append(pixel)

    # 白サンプル: 電車車体の中心下部 (緑カットアウトのない白い領域)
    # 電車体下半分 (55-70%行 / 中央 25-45%列)
    white_region_fracs = [
        (0.58, 0.28), (0.60, 0.30), (0.62, 0.28),
        (0.65, 0.25), (0.65, 0.35), (0.68, 0.30),
    ]
    white_samples = []
    for (rf, cf) in white_region_fracs:
        r, c = int(rf * h), int(cf * w)
        pixel = img_array[r, c, :3]
        white_samples.append(pixel)

    green_avg = np.mean(green_samples, axis=0)
    white_avg = np.mean(white_samples, axis=0)
    return green_avg, white_avg


def create_two_color_image(img_array, green_avg, white_avg):
    """
    各ピクセルを「緑」「白」のどちらに近いか（ユークリッド距離）で塗り分ける。
    閾値 = 緑と白のRGB中間値（= 決定境界）
    """
    h, w = img_array.shape[:2]
    rgb = img_array[:, :, :3].astype(np.float32)

    # ユークリッド距離で分類
    dist_green = np.linalg.norm(rgb - green_avg, axis=2)
    dist_white = np.linalg.norm(rgb - white_avg, axis=2)
    is_green_mask = dist_green < dist_white

    # 出力画像: RGBA
    output = np.full((h, w, 4), 255, dtype=np.uint8)
    # 1565C0
    output[is_green_mask, 0] = int(21)
    output[is_green_mask, 1] = int(101)
    output[is_green_mask, 2] = int(192)
    output[is_green_mask, 3] = 255
    # 白ピクセルは既に (255,255,255,255) で初期化済み

    return Image.fromarray(output, 'RGBA'), is_green_mask


def crop_to_square(two_color_img, is_green_mask, padding_ratio=0.02):
    """
    緑領域のバウンディングボックスを検出し、正方形にクロップ。
    グレーの外枠部分を除去する。
    """
    h, w = is_green_mask.shape

    rows = np.any(is_green_mask, axis=1)
    cols = np.any(is_green_mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    print(f"  緑領域検出: rows {rmin}-{rmax}, cols {cmin}-{cmax}")

    crop_h = rmax - rmin
    crop_w = cmax - cmin
    side = max(crop_h, crop_w)

    # 少しパディングを加える
    padding = int(padding_ratio * side)
    side += 2 * padding

    center_r = (rmin + rmax) // 2
    center_c = (cmin + cmax) // 2

    r1 = max(0, center_r - side // 2)
    r2 = min(h, r1 + side)
    c1 = max(0, center_c - side // 2)
    c2 = min(w, c1 + side)

    # 端に寄りすぎた場合の調整
    if r2 - r1 < side:
        r1 = max(0, r2 - side)
    if c2 - c1 < side:
        c1 = max(0, c2 - side)

    cropped = two_color_img.crop((c1, r1, c2, r2))
    return cropped


def generate_icons(base_img_1024, output_dir):
    """
    iOS/Android 向けの各サイズアイコンを生成する。
    """
    # iOS アイコンサイズ (App Store 含む全サイズ)
    ios_sizes = [
        (1024, "AppStore"),   # App Store
        (180, "iPhone@3x"),   # iPhone @3x
        (120, "iPhone@2x"),   # iPhone @2x
        (167, "iPad@2x"),     # iPad Pro
        (152, "iPad"),        # iPad @2x
        (87,  "Settings@3x"), # Settings @3x
        (80,  "Spotlight@2x x3"), # Spotlight @2x/@3x
        (76,  "iPad@1x"),     # iPad @1x
        (60,  "iPhone@2x_legacy"),
        (58,  "Settings@2x"),
        (40,  "Spotlight"),
        (29,  "Settings"),
        (20,  "Notification"),
    ]

    # Android アイコンサイズ
    android_sizes = [
        (192, "xxxhdpi"),
        (144, "xxhdpi"),
        (96,  "xhdpi"),
        (72,  "hdpi"),
        (48,  "mdpi"),
        (36,  "ldpi"),
    ]

    ios_dir = os.path.join(output_dir, "ios")
    android_dir = os.path.join(output_dir, "android")
    os.makedirs(ios_dir, exist_ok=True)
    os.makedirs(android_dir, exist_ok=True)

    print("\n  [iOS アイコン生成]")
    for size, label in ios_sizes:
        resized = base_img_1024.resize((size, size), Image.LANCZOS)
        path = os.path.join(ios_dir, f"icon-{size}.png")
        resized.save(path, "PNG")
        print(f"    {size}x{size}  ({label})  → {path}")

    print("\n  [Android アイコン生成]")
    for size, density in android_sizes:
        resized = base_img_1024.resize((size, size), Image.LANCZOS)
        path = os.path.join(android_dir, f"icon-{size}-{density}.png")
        resized.save(path, "PNG")
        print(f"    {size}x{size}  ({density})  → {path}")

    return ios_dir, android_dir


def process_icon(source_path):
    print("=" * 60)
    print("アイコン処理開始")
    print("=" * 60)

    # --- Step 1: 画像読み込み ---
    print(f"\n[Step 1] 画像読み込み: {source_path}")
    img = Image.open(source_path).convert("RGBA")
    width, height = img.size
    print(f"  サイズ: {width}x{height}")
    img_array = np.array(img)

    # --- Step 2: RGB サンプリング & 閾値算出 ---
    print("\n[Step 2] 緑・白のRGBサンプリング")
    green_avg, white_avg = sample_representative_pixels(img_array)
    threshold = (green_avg + white_avg) / 2


    print(f"  緑 (サンプル平均) : RGB({green_avg[0]:.0f}, {green_avg[1]:.0f}, {green_avg[2]:.0f})")
    print(f"  白 (サンプル平均) : RGB({white_avg[0]:.0f}, {white_avg[1]:.0f}, {white_avg[2]:.0f})")
    print(f"  閾値 (中間値)    : RGB({threshold[0]:.0f}, {threshold[1]:.0f}, {threshold[2]:.0f})")

    # --- Step 3: 2色化画像の生成 ---
    print("\n[Step 3] 2色化画像の生成（緑 / 白）")
    two_color_img, is_green_mask = create_two_color_image(img_array, green_avg, white_avg)
    two_color_path = os.path.join(BASE_DIR, "assets", "icon-2color.png")
    two_color_img.save(two_color_path, "PNG")
    print(f"  保存: {two_color_path}")

    # --- Step 4: 正方形クロップ ---
    print("\n[Step 4] 正方形クロップ（グレー外枠を除去）")
    cropped = crop_to_square(two_color_img, is_green_mask)
    # 1024x1024 にリサイズ
    icon_1024 = cropped.resize((1024, 1024), Image.LANCZOS)
    square_path = os.path.join(BASE_DIR, "assets", "icon-square-1024.png")
    icon_1024.save(square_path, "PNG")
    print(f"  保存: {square_path}  (1024x1024)")

    # --- Step 5: iOS/Android アイコンサイズ生成 ---
    print("\n[Step 5] iOS/Android アイコンサイズ生成")
    icon_output_dir = os.path.join(BASE_DIR, "assets", "icons")
    generate_icons(icon_1024, icon_output_dir)

    # --- Step 6: Expo 設定ファイルへの配置 ---
    print("\n[Step 6] Expo アセットへの配置")

    # iOS メインアイコン (1024x1024)
    ios_icon_path = os.path.join(BASE_DIR, "assets", "icon.png")
    icon_1024.save(ios_icon_path, "PNG")
    print(f"  assets/icon.png            (1024x1024) ← iOS メインアイコン")

    # Android アダプティブアイコン前景 (1024x1024)
    adaptive_path = os.path.join(BASE_DIR, "assets", "adaptive-icon.png")
    icon_1024.save(adaptive_path, "PNG")
    print(f"  assets/adaptive-icon.png   (1024x1024) ← Android アダプティブ前景")

    # スプラッシュ用 (白背景に1024x1024のアイコンを中央配置)
    splash = Image.new("RGBA", (2048, 2048), (255, 255, 255, 255))
    icon_512 = icon_1024.resize((512, 512), Image.LANCZOS)
    splash.paste(icon_512, (768, 768), icon_512)
    splash_path = os.path.join(BASE_DIR, "assets", "splash.png")
    splash.save(splash_path, "PNG")
    print(f"  assets/splash.png          (2048x2048) ← スプラッシュ画面")

    # Web ファビコン (32x32)
    favicon = icon_1024.resize((32, 32), Image.LANCZOS)
    favicon_path = os.path.join(BASE_DIR, "assets", "favicon.png")
    favicon.save(favicon_path, "PNG")
    print(f"  assets/favicon.png         (32x32)     ← Web ファビコン")

    # 通知アイコン用 (96x96, 白部分を保持・透過背景)
    notif_src = icon_1024.copy()
    notif_array = np.array(notif_src)
    # 緑ピクセルを透明に
    g_r, g_g, g_b = int(green_avg[0]), int(green_avg[1]), int(green_avg[2])
    thr_r, thr_g, thr_b = int(threshold[0]), int(threshold[1]), int(threshold[2])
    notif_rgba = notif_array.copy()
    # 緑に近いピクセルを透明化
    green_dist = np.linalg.norm(
        notif_array[:, :, :3].astype(np.float32) - green_avg, axis=2
    )
    white_dist = np.linalg.norm(
        notif_array[:, :, :3].astype(np.float32) - white_avg, axis=2
    )
    is_green_notif = green_dist < white_dist
    notif_rgba[is_green_notif, 3] = 0   # 緑部分を透明に
    notif_rgba[~is_green_notif, :3] = 255  # 白部分は純白に
    notif_img = Image.fromarray(notif_rgba, "RGBA")
    notif_96 = notif_img.resize((96, 96), Image.LANCZOS)
    notif_path = os.path.join(BASE_DIR, "assets", "notification-icon.png")
    notif_96.save(notif_path, "PNG")
    print(f"  assets/notification-icon.png (96x96)   ← Android 通知アイコン")

    print("\n" + "=" * 60)
    print("処理完了！")
    print("=" * 60)
    print(f"""
生成ファイル一覧:
  assets/icon-2color.png          ← 2色化確認用
  assets/icon-square-1024.png     ← 正方形クロップ確認用
  assets/icon.png                 ← iOS メインアイコン (1024x1024)
  assets/adaptive-icon.png        ← Android アダプティブ前景 (1024x1024)
  assets/splash.png               ← スプラッシュ画面 (2048x2048)
  assets/favicon.png              ← Web ファビコン (32x32)
  assets/notification-icon.png    ← Android 通知アイコン (96x96)
  assets/icons/ios/               ← iOS 全サイズ
  assets/icons/android/           ← Android 全サイズ
""")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方: python3 scripts/process-icon.py <source_image_path>")
        print("例:     python3 scripts/process-icon.py assets/source-icon.png")
        sys.exit(1)

    source = sys.argv[1]
    if not os.path.isabs(source):
        source = os.path.join(BASE_DIR, source)

    if not os.path.exists(source):
        print(f"エラー: ファイルが見つかりません: {source}")
        sys.exit(1)

    process_icon(source)
