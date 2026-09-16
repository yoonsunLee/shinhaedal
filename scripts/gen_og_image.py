"""작품 og:image 파일럿 생성기.

작품 1개(work id)를 받아 data/works/<id>.json의 large 이미지를
브랜드 배경(#0b0b0f) 1200x630 캔버스에 레터박스로 앉힌 og.jpg를 만든다.
지금은 파일럿 단계라 수동 실행만 한다 — 전체 작품 자동화는 이 결과를
검증한 뒤 publish_sb.py에 편입할지 별도로 결정한다.

사용법: python scripts/gen_og_image.py HD-2026-009
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CANVAS_SIZE = (1200, 630)
BG_COLOR = (11, 11, 15)  # site.css --bg: #0b0b0f
MARGIN_Y = 20  # 위아래 여백(px). 정사각/세로 작품 사진이 레터박스로 들어갈 때의 최소 여백.


def main(work_id):
    detail_path = ROOT / "data" / "works" / f"{work_id}.json"
    detail = json.loads(detail_path.read_text(encoding="utf-8"))
    src_rel = detail["images"]["large"]
    src_path = ROOT / src_rel
    out_path = ROOT / "assets" / "works" / work_id / "og.jpg"

    photo = Image.open(src_path).convert("RGB")
    max_h = CANVAS_SIZE[1] - MARGIN_Y * 2
    max_w = CANVAS_SIZE[0] - MARGIN_Y * 2
    scale = min(max_w / photo.width, max_h / photo.height)
    new_size = (round(photo.width * scale), round(photo.height * scale))
    photo = photo.resize(new_size, Image.LANCZOS)

    canvas = Image.new("RGB", CANVAS_SIZE, BG_COLOR)
    pos = ((CANVAS_SIZE[0] - new_size[0]) // 2, (CANVAS_SIZE[1] - new_size[1]) // 2)
    canvas.paste(photo, pos)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, "JPEG", quality=88)
    print(f"og image saved: {out_path.relative_to(ROOT)} ({new_size[0]}x{new_size[1]} on {CANVAS_SIZE[0]}x{CANVAS_SIZE[1]})")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/gen_og_image.py <work-id>")
    main(sys.argv[1])
