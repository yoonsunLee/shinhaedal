"""공개 작품의 og:image + 공유 스텁 페이지를 발행 때마다 자동 생성한다.

works/?w=ID는 정적 페이지라 카톡·페북 크롤러가 쿼리스트링별로 다른 og 태그를
못 본다. 그래서 작품마다 works/w/ID/index.html 스텁을 만들어 거기서만
작품 사진 기반 og:image를 노출하고, 실제 방문자는 works/?w=ID로 즉시
리다이렉트한다. 이미지는 data/works/<id>.json의 large 사진을 브랜드
배경(#0b0b0f) 1200x630 캔버스에 레터박스로 앉혀서 만든다.

data/works-index.json에 없는(비공개·삭제된) 작품의 스텁·og 이미지는
같이 정리한다.

사용법:
  python scripts/gen_work_share.py --all        # 현재 발행된 작품 전부
  python scripts/gen_work_share.py HD-2026-009  # 특정 작품만
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SITE_BASE = "https://yoonsunlee.github.io/shinhaedal"
CANVAS_SIZE = (1200, 630)
BG_COLOR = (11, 11, 15)  # site.css --bg: #0b0b0f
MARGIN_Y = 20  # 위아래 여백(px). 정사각/세로 작품 사진이 레터박스로 들어갈 때의 최소 여백.


def esc_attr(s):
    return (
        str(s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def first_line(s):
    return str(s or "").strip().split("\n", 1)[0].strip()


DESCRIPTION_LIMIT = 110  # 카톡·페북 모두 대략 150~200자에서 잘라버리니, 문장 중간에 끊기지 않도록 미리 짧게 자른다.


def truncate(s, limit=DESCRIPTION_LIMIT):
    s = str(s or "").strip()
    if len(s) <= limit:
        return s
    cut = s[:limit].rsplit(" ", 1)[0].rstrip(" .,;:—-")
    return cut + "…"


def load_detail(work_id):
    return json.loads((ROOT / "data" / "works" / f"{work_id}.json").read_text(encoding="utf-8"))


def gen_og_image(work_id, detail):
    src_path = ROOT / detail["images"]["large"]
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
    return out_path


STUB_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — 신해달</title>
<meta name="description" content="{description}">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="{title} — 신해달">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{site_base}/assets/works/{id}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{site_base}/works/w/{id}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} — 신해달">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{site_base}/assets/works/{id}/og.jpg">
<!-- 이 페이지는 공유 미리보기 전용 스텁이다(scripts/gen_work_share.py가 발행 때마다 생성).
     실제 작품 인터랙션은 works/?w={id} 하나뿐이라 canonical은 그쪽을 가리키고,
     og:url만 이 스텁 주소를 쓴다. -->
<link rel="canonical" href="{site_base}/works/?w={id}">
<link rel="icon" type="image/png" sizes="32x32" href="../../../favicon-32.png">
<meta http-equiv="refresh" content="0; url=../../?w={id}">
<style>
  body{{
    margin:0; min-height:100vh; background:#0b0b0f; color:#f5f0e6;
    font-family:'Noto Sans KR', sans-serif;
    display:flex; align-items:center; justify-content:center; text-align:center;
    padding:32px;
  }}
  a{{color:#c9a227;}}
</style>
</head>
<body>
  <p>작품 페이지로 이동 중입니다…<br>자동으로 이동하지 않으면 <a href="../../?w={id}">여기를 눌러주세요</a>.</p>
  <script>location.replace('../../?w={id}');</script>
</body>
</html>
"""


def gen_stub_html(work_id, detail):
    title = esc_attr(str(detail.get("title") or work_id).strip())
    description = esc_attr(truncate(first_line(detail.get("caption"))))
    html = STUB_TEMPLATE.format(title=title, description=description, id=work_id, site_base=SITE_BASE)
    out_path = ROOT / "works" / "w" / work_id / "index.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return out_path


def cleanup_stale(current_ids):
    stub_root = ROOT / "works" / "w"
    if stub_root.exists():
        for d in stub_root.iterdir():
            if d.is_dir() and d.name not in current_ids:
                shutil.rmtree(d)
                print(f"removed stale stub: {d.relative_to(ROOT)}")
    og_root = ROOT / "assets" / "works"
    if og_root.exists():
        for d in og_root.iterdir():
            og_file = d / "og.jpg"
            if d.is_dir() and d.name not in current_ids and og_file.exists():
                og_file.unlink()
                print(f"removed stale og image: {og_file.relative_to(ROOT)}")


def process(work_id):
    detail = load_detail(work_id)
    og_path = gen_og_image(work_id, detail)
    stub_path = gen_stub_html(work_id, detail)
    print(f"{work_id}: {og_path.relative_to(ROOT)}, {stub_path.relative_to(ROOT)}")


def main(argv):
    if len(argv) != 1:
        sys.exit("usage: python scripts/gen_work_share.py --all | <work-id>")
    if argv[0] == "--all":
        index = json.loads((ROOT / "data" / "works-index.json").read_text(encoding="utf-8"))
        ids = [r["id"] for r in index]
        for work_id in ids:
            process(work_id)
        cleanup_stale(set(ids))
    else:
        process(argv[0])


if __name__ == "__main__":
    main(sys.argv[1:])
