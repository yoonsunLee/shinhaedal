"""공개 작품마다 개별 작품 페이지 + 공유용 og:image를 만들고 sitemap.xml을 갱신한다.

works/?w=ID(작품 창)는 자바스크립트로 그려져 검색엔진과 카톡·페북 크롤러가 작품별 내용을
읽지 못한다. 그래서 발행 때마다 작품마다 works/w/ID/index.html을 정적 HTML로 만든다.
제목·사진·재료·크기·캡션·전시 이력이 HTML에 그대로 들어 있어 검색에 잡히고, 공유 링크도
이 페이지로 열린다. 페이지 안의 '작품 뷰어로 보기'가 기존 작품 창(works/?w=ID)으로 이어진다.

og 이미지는 data/works/<id>.json의 large 사진을 브랜드 배경(#0b0b0f) 1200x630 캔버스에
레터박스로 앉혀서 만든다. data/works-index.json에 없는(비공개·삭제된) 작품의 페이지·og
이미지는 같이 정리한다.

사용법:
  python scripts/gen_work_share.py --all        # 현재 발행된 작품 전부 + 목록 미리 쓰기 + sitemap.xml
  python scripts/gen_work_share.py HD-2026-009  # 특정 작품만 (sitemap은 건드리지 않음)
"""
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
from html import escape
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prerender_lists import prerender  # noqa: E402
import build_en  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE_BASE = "https://shinhaedal.com"
CANVAS_SIZE = (1200, 630)
BG_COLOR = (11, 11, 15)  # site.css --bg: #0b0b0f
MARGIN_Y = 20  # 위아래 여백(px). 정사각/세로 작품 사진이 레터박스로 들어갈 때의 최소 여백.
DESCRIPTION_LIMIT = 110  # 카톡·페북 모두 대략 150~200자에서 잘라버리니, 문장 중간에 끊기지 않도록 미리 짧게 자른다.
SHOP_URL = "https://www.idus.com/v2/artist/b987fcad-fa10-4f28-a90d-8553dbaab0ad/product"
STATIC_PAGES = [("", "1.0"), ("works/", "0.9"), ("about/", "0.7"), ("ip/", "0.7"), ("press/", "0.6"), ("contact/", "0.6"), ("privacy/", "0.3"), ("copyright/", "0.3")]


def e(s):
    return escape(str(s if s is not None else ""), quote=True)


def clean(s):
    return str(s or "").replace("\r", "\n").replace("", "\n").strip()


def first_line(s):
    return clean(s).split("\n", 1)[0].strip()


def truncate(s, limit=DESCRIPTION_LIMIT):
    s = str(s or "").strip()
    if len(s) <= limit:
        return s
    cut = s[:limit].rsplit(" ", 1)[0].rstrip(" .,;:—-")
    return cut + "…"


def load_json(*parts):
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


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


def bi(ko, en, tag="span"):
    """한/영 두 문구를 모두 HTML에 넣고, 화면에서는 html[lang]에 맞는 쪽만 보인다(work-page.css)."""
    ko, en = str(ko or "").strip(), str(en or "").strip() or str(ko or "").strip()
    if ko == en:
        return f"<{tag}>{e(ko)}</{tag}>"
    return f'<{tag} class="t-ko">{e(ko)}</{tag}><{tag} class="t-en" lang="en">{e(en)}</{tag}>'


def exhibition_lines(work_no, detail, exhibitions, today):
    rows = [x for x in exhibitions if work_no in [s.strip() for s in str(x.get("work_nos") or "").split(",")]]
    if not rows:
        # exhibitions.json에 연결이 안 된 옛 기록 대비 폴백(국문만 있음)
        return [(False, line.strip(), line.strip()) for line in clean(detail.get("exhibitions")).split("\n") if line.strip()]

    def fmt(x, lang):
        title = (x.get("title_en") or x.get("title")) if lang == "en" else x.get("title")
        venue = (x.get("venue_en") or x.get("venue")) if lang == "en" else x.get("venue")
        dates = f"{str(x.get('start_date') or '').replace('-', '.')} – {str(x.get('end_date') or '').replace('-', '.')}"
        return f"{dates}  {title}, {venue}"

    upcoming = sorted([x for x in rows if str(x.get("start_date") or "") > today], key=lambda x: x.get("start_date") or "")
    past = sorted([x for x in rows if str(x.get("start_date") or "") <= today], key=lambda x: x.get("start_date") or "", reverse=True)
    return [(True, fmt(x, "ko"), fmt(x, "en")) for x in upcoming] + [(False, fmt(x, "ko"), fmt(x, "en")) for x in past]


def image_size(rel_path):
    try:
        with Image.open(ROOT / rel_path) as im:
            return im.size
    except Exception:
        return None


PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="ko" data-title-ko="{page_title_ko}" data-title-en="{page_title_en}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
(function(){{
  try{{
    var p = new URLSearchParams(location.search).get('lang');
    var l = (p === 'en' || p === 'ko') ? p : (localStorage.getItem('site_lang') === 'en' ? 'en' : 'ko');
    document.documentElement.lang = l;
  }}catch(err){{}}
}})();
</script>
<title>{page_title_ko}</title>
<meta name="description" content="{description}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="SHIN HAEDAL">
<meta property="og:title" content="{share_title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{site_base}/assets/works/{id}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{site_base}/works/w/{id}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{share_title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{site_base}/assets/works/{id}/og.jpg">
<link rel="canonical" href="{site_base}/works/w/{id}/">
<link rel="icon" type="image/png" sizes="32x32" href="../../../favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../../../favicon-16.png">
<link rel="apple-touch-icon" href="../../../apple-touch-icon.png">
<link rel="stylesheet" href="../../../assets/fonts.css">
<link rel="stylesheet" href="../../../assets/site.css">
<link rel="stylesheet" href="../../../assets/work-page.css">
<script type="application/ld+json">{jsonld}</script>
</head>
<body>
<script src="../../../assets/starfield.js"></script>
<!-- scripts/gen_work_share.py가 발행 때마다 생성하는 파일. 직접 고치면 다음 발행 때 덮어써진다. -->

<nav>
  <div class="logo-block">
    <a class="logo" href="../../../"><span class="logo-c">ⓒ</span><span class="logo-name">SHIN HAEDAL</span></a>
    <span class="logo-tag">{logo_tag}</span>
  </div>
  <div class="nav-icons">
    <ul class="nav-menu">
      <li><a href="../../../">Home</a></li>
      <li><a href="../../../about/">About</a></li>
      <li><a href="../../" class="on" aria-current="page">Works</a></li>
      <li><a href="../../../ip/">IP</a></li>
      <li><a href="../../../press/">Press</a></li>
      <li><a href="{shop_url}" target="_blank" rel="noopener">Brand Shop</a></li>
      <li><a href="../../../contact/">Contact</a></li>
    </ul>
    <div class="lang" role="group" aria-label="Language">
      <button id="langKo" class="on">KO</button>
      <span class="lang-sep" aria-hidden="true">/</span>
      <button id="langEn">EN</button>
    </div>
    <a class="icon-btn" aria-label="Instagram" href="https://www.instagram.com/haedal_space/" target="_blank" rel="noopener">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/></svg>
    </a>
    <button class="icon-btn menu-btn" id="btnMenu" aria-label="Menu" aria-expanded="false">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 6H17M3 10H17M3 14H17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
    </button>
  </div>

  <div class="nav-backdrop" id="navBackdrop"></div>
  <div class="nav-overlay" id="navOverlay">
    <button class="icon-btn overlay-close" id="btnMenuClose" aria-label="Close">✕</button>
    <nav class="overlay-links">
      <a href="../../../">Home</a>
      <a href="../../../about/">About</a>
      <a href="../../">Works</a>
      <a href="../../../ip/">IP</a>
      <a href="../../../press/">Press</a>
      <a href="{shop_url}" target="_blank" rel="noopener">Brand Shop</a>
      <a href="../../../contact/">Contact</a>
      <a href="https://www.instagram.com/haedal_space/" target="_blank" rel="noopener" class="overlay-ig">Instagram ↗</a>
    </nav>
  </div>
</nav>

<main class="wp">
  <a class="wp-back" href="../../">{back_label}</a>

  <article class="wp-work">
    <figure class="wp-media">
      <img src="../../../{main_img}"{main_dims} alt="{alt}" fetchpriority="high" draggable="false">
    </figure>
    <div class="wp-info">
      <div>
        <h1 class="wp-title">{title_primary}</h1>
        {title_secondary}
      </div>
      <p class="wp-spec">{spec}</p>
      {caption}
      {exhibitions}
      <div class="wp-actions">
        <a class="wp-action" href="../../?w={id_q}">{viewer_label}</a>
        <a class="wp-action wp-action--accent" href="../../../contact/?type=artwork&amp;work={id_q}">{ask_label}</a>
      </div>
    </div>
  </article>
{photos}{series}
  <div class="wp-pager" role="navigation" aria-label="Other works">
{pager}
  </div>
</main>

<footer>
  <span>© SHIN HAEDAL &nbsp;&nbsp;&nbsp;&nbsp; All rights reserved.<a class="ft-privacy" href="../../../privacy/"><span class="ft-ko">개인정보 처리방침</span><span class="ft-en">Privacy Policy</span></a><a class="ft-privacy" href="../../../copyright/"><span class="ft-ko">저작권·이용 안내</span><span class="ft-en">Copyright &amp; Use</span></a></span>
  <a href="#">BACK TO TOP ↑</a>
</footer>

<script src="../../../assets/work-page.js"></script>
<script src="../../../assets/stats.js"></script>
<script src="../../../assets/site.js"></script>
<script src="../../../assets/nav-glide.js"></script>
</body>
</html>
"""


def render_page(meta, detail, index, exhibitions, today):
    wid = meta["id"]
    title_ko = clean(detail.get("title") or meta.get("title") or wid)
    title_en = clean(detail.get("title_en") or meta.get("title_en"))

    size = str(detail.get("size") if detail.get("size") is not None else "").strip()
    if size and "cm" not in size.lower():
        size += " cm"
    year = str(detail.get("year") or "").strip()
    spec_ko = " · ".join(x for x in [clean(detail.get("material")), size, year] if x)
    spec_en = " · ".join(x for x in [clean(detail.get("material_en")) or clean(detail.get("material")), size, year] if x)

    caption_ko = clean(detail.get("caption"))
    caption_en = clean(detail.get("caption_en")) or caption_ko
    caption_html = f'<p class="wp-caption">{bi(caption_ko, caption_en)}</p>' if caption_ko else ""

    lines = exhibition_lines(detail.get("no") or wid, detail, exhibitions, today)
    if lines:
        items = "".join(
            f'<li>{bi(("[예정] " if up else "") + ko, ("[Upcoming] " if up else "") + en)}</li>' for up, ko, en in lines
        )
        exhibitions_html = f'<section class="wp-ex"><h2>{bi("전시 이력", "Exhibitions")}</h2><ul>{items}</ul></section>'
    else:
        exhibitions_html = ""

    photos = detail.get("photos") or []
    if photos:
        figs = []
        for p in photos:
            src = p.get("detail") or p.get("large") or p.get("thumb")
            if not src:
                continue
            dims = image_size(src)
            dim_attr = f' width="{dims[0]}" height="{dims[1]}"' if dims else ""
            cap_ko, cap_en = clean(p.get("caption")), clean(p.get("caption_en"))
            figcap = f"<figcaption>{bi(cap_ko, cap_en)}</figcaption>" if cap_ko else ""
            figs.append(
                f'      <figure><img src="../../../{e(src)}"{dim_attr} alt="{e(p.get("alt") or cap_ko or title_ko)}" loading="lazy" decoding="async" draggable="false">{figcap}</figure>'
            )
        photos_html = (
            f'\n  <section class="wp-photos"><h2>{bi("작업 사진", "Details")}</h2>\n    <div class="wp-photo-grid">\n'
            + "\n".join(figs)
            + "\n    </div>\n  </section>"
        ) if figs else ""
    else:
        photos_html = ""

    series_key = meta.get("series_key")
    siblings = [w for w in index if series_key and w.get("series_key") == series_key and w["id"] != wid]
    if siblings:
        cards = "".join(
            f'<a class="wp-series-item" href="../{e(s["id"])}/"><img src="../../../{e(s["thumb"])}" alt="" loading="lazy" draggable="false">'
            f'{bi(s.get("title"), s.get("title_en"))}</a>'
            for s in siblings if s.get("thumb")
        )
        series_html = f'\n  <section class="wp-series"><h2>{bi("같은 시리즈", "Same series")}</h2><div class="wp-series-list">{cards}</div></section>'
    else:
        series_html = ""

    pos = next(i for i, w in enumerate(index) if w["id"] == wid)
    pager = []
    if pos > 0:
        p = index[pos - 1]
        pager.append(f'    <a class="wp-prev" href="../{e(p["id"])}/"><span class="lab">{bi("← 이전 작품", "← Previous")}</span><span class="ttl">{bi(p.get("title"), p.get("title_en"))}</span></a>')
    if pos < len(index) - 1:
        n = index[pos + 1]
        pager.append(f'    <a class="wp-next" href="../{e(n["id"])}/"><span class="lab">{bi("다음 작품 →", "Next →")}</span><span class="ttl">{bi(n.get("title"), n.get("title_en"))}</span></a>')

    main_img = detail["images"].get("large") or detail["images"].get("detail")
    dims = image_size(main_img)
    url = f"{SITE_BASE}/works/w/{wid}/"
    art = {
        "@type": "VisualArtwork",
        "@id": url,
        "name": title_ko,
        "url": url,
        "image": [f"{SITE_BASE}/{main_img}", f"{SITE_BASE}/assets/works/{wid}/og.jpg"],
        "thumbnailUrl": f"{SITE_BASE}/assets/works/{wid}/thumb.webp",
        "creator": {"@type": "Person", "@id": f"{SITE_BASE}/#artist", "name": "신해달",
                    "alternateName": "Shin Haedal", "url": f"{SITE_BASE}/"},
        "artform": "Najeonchilgi",
        "creditText": "© SHIN HAEDAL",
        "copyrightHolder": {"@id": f"{SITE_BASE}/#artist"},
        "acquireLicensePage": f"{SITE_BASE}/copyright/",   # 저작권·이용 안내로 보낸다
        "inLanguage": "ko",
    }
    # 크기: "38 × 38"처럼 두 수일 때만 쓴다(세 수는 어느 쪽이 깊이인지 자료에 없다)
    nums = re.findall(r"[\d.]+", str(meta.get("size") or ""))
    if len(nums) == 2:
        art["width"] = {"@type": "QuantitativeValue", "value": float(nums[0]), "unitCode": "CMT"}
        art["height"] = {"@type": "QuantitativeValue", "value": float(nums[1]), "unitCode": "CMT"}
    crumbs = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE_BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Works", "item": f"{SITE_BASE}/works/"},
            {"@type": "ListItem", "position": 3, "name": title_ko, "item": url},
        ],
    }
    jsonld = {"@context": "https://schema.org", "@graph": [art, crumbs]}
    if title_en:
        art["alternateName"] = title_en
    if caption_ko:
        art["description"] = caption_ko
    if detail.get("material"):
        art["artMedium"] = clean(detail.get("material"))
    if year:
        art["dateCreated"] = year
    jsonld_text = json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")

    return PAGE_TEMPLATE.format(
        id=e(wid),
        id_q=e(wid),
        site_base=SITE_BASE,
        shop_url=e(SHOP_URL),
        page_title_ko=e(f"{title_ko} — 신해달 나전칠기 아티스트"),
        page_title_en=e(f"{title_en or title_ko} — Shin Haedal, Najeonchilgi Artist"),
        share_title=e(f"{title_ko} — 신해달"),
        description=e(truncate(first_line(caption_ko))),
        jsonld=jsonld_text,
        logo_tag=bi("나전칠기 아티스트", "Najeonchilgi Artist"),
        back_label=bi("← 모든 작품", "← All works"),
        main_img=e(main_img),
        main_dims=f' width="{dims[0]}" height="{dims[1]}"' if dims else "",
        alt=e(title_ko),
        title_primary=bi(title_ko, title_en),
        title_secondary=(f'<p class="wp-title-sub">{bi(title_en, title_ko)}</p>' if title_en and title_en != title_ko else ""),
        spec=bi(spec_ko, spec_en),
        caption=caption_html,
        exhibitions=exhibitions_html,
        viewer_label=bi("작품 뷰어로 보기", "Open in viewer"),
        ask_label=bi("이 작품에 대해 문의하기 →", "Ask about this work →"),
        photos=photos_html,
        series=series_html,
        pager="\n".join(pager),
    )


def gen_page(meta, index, exhibitions, today):
    wid = meta["id"]
    detail = load_json("data", "works", f"{wid}.json")
    og_path = gen_og_image(wid, detail)
    out_path = ROOT / "works" / "w" / wid / "index.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render_page(meta, detail, index, exhibitions, today), encoding="utf-8", newline="\n")
    print(f"{wid}: {og_path.relative_to(ROOT)}, {out_path.relative_to(ROOT)}")


LASTMOD_FILE = ROOT / "data" / "lastmod.json"


def _page_file(path):
    return ROOT / path / "index.html" if path else ROOT / "index.html"


def _content_hash(f):
    # 줄바꿈 차이는 내용 변화가 아니다
    return hashlib.sha256(f.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:16]


def _git_date(f):
    """git에 기록된 마지막 수정일. 커밋되지 않은 내용 변경이 있으면(방금 만들거나 고친 파일) None → 오늘."""
    try:
        dirty = subprocess.run(["git", "diff", "--ignore-cr-at-eol", "--quiet", "HEAD", "--", str(f)], cwd=ROOT,
                               capture_output=True, timeout=30).returncode != 0
        tracked = subprocess.run(["git", "ls-files", "--error-unmatch", "--", str(f)], cwd=ROOT,
                                 capture_output=True, timeout=30).returncode == 0
        if dirty or not tracked:
            return None
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", str(f)], cwd=ROOT,
                             capture_output=True, text=True, timeout=30).stdout.strip()
        return out or None
    except Exception:
        return None


def lastmod_dates(paths, today):
    """페이지 내용이 실제로 바뀐 날만 lastmod를 올린다.
    매일 자동 발행 때마다 전부 오늘 날짜로 올리면 검색엔진이 이 값을 믿지 않게 된다.
    처음 보는 페이지는 git 기록의 마지막 수정일(없으면 오늘)."""
    try:
        old = json.loads(LASTMOD_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        old = {}
    new = {}
    for path in paths:
        f = _page_file(path)
        if not f.exists():
            continue
        h = _content_hash(f)
        prev = old.get(path)
        if prev and prev.get("hash") == h:
            date = prev["date"]
        elif prev:
            date = today
        else:
            date = _git_date(f) or today
        new[path] = {"hash": h, "date": date}
    if new != old:
        LASTMOD_FILE.write_text(json.dumps(new, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
                                encoding="utf-8", newline="\n")
    return {k: v["date"] for k, v in new.items()}


def write_sitemap(index, today):
    pages = [(path, prio) for path, prio in STATIC_PAGES]
    # 영문 페이지(build_en.py가 만든 en/…) — 국문·영문 짝은 xhtml:link로 서로 알린다
    en_of = {path: "en/" + path for path, _ in STATIC_PAGES if _page_file("en/" + path).exists()}
    pages += [(en_of[path], prio) for path, prio in STATIC_PAGES if path in en_of]
    pages += [(f"works/w/{w['id']}/", "0.8") for w in index]
    dates = lastmod_dates([p for p, _ in pages], today)
    alt = {}
    for ko, en in en_of.items():
        links = "".join(f'<xhtml:link rel="alternate" hreflang="{lang}" href="{SITE_BASE}/{p}"/>'
                        for lang, p in (("ko", ko), ("en", en), ("x-default", ko)))
        alt[ko] = alt[en] = links
    urls = [(f"{SITE_BASE}/{path}", prio, dates.get(path), alt.get(path, "")) for path, prio in pages]
    body = "\n".join(
        f"  <url><loc>{e(loc)}</loc>" + (f"<lastmod>{d}</lastmod>" if d else "") + f"<priority>{prio}</priority>{links}</url>"
        for loc, prio, d, links in urls)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
           f'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n{body}\n</urlset>\n')
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8", newline="\n")
    print(f"sitemap.xml: {len(urls)} URLs")


def cleanup_stale(current_ids):
    page_root = ROOT / "works" / "w"
    if page_root.exists():
        for d in page_root.iterdir():
            if d.is_dir() and d.name not in current_ids:
                shutil.rmtree(d)
                print(f"removed stale page: {d.relative_to(ROOT)}")
    og_root = ROOT / "assets" / "works"
    if og_root.exists():
        for d in og_root.iterdir():
            og_file = d / "og.jpg"
            if d.is_dir() and d.name not in current_ids and og_file.exists():
                og_file.unlink()
                print(f"removed stale og image: {og_file.relative_to(ROOT)}")


def main(argv):
    if len(argv) != 1:
        sys.exit("usage: python scripts/gen_work_share.py --all | <work-id>")
    index = load_json("data", "works-index.json")
    try:
        exhibitions = load_json("data", "exhibitions.json")
    except FileNotFoundError:
        exhibitions = []
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d")
    if argv[0] == "--all":
        for meta in index:
            gen_page(meta, index, exhibitions, today)
        cleanup_stale({w["id"] for w in index})
        prerender()  # 작품 목록·홈 Recent·Press를 HTML에 미리 쓰기(검색 로봇용)
        # 영문 페이지(en/…)를 방금 쓴 국문 페이지로 다시 만든다. 실패해도 국문 발행은 막지 않는다
        # (영문은 지난번 것이 그대로 남는다) — Actions 화면에 경고로 보인다.
        try:
            build_en.build()
        except (Exception, SystemExit) as ex:
            print(f"::warning::영문 페이지(en/) 만들기 실패 — 지난번 영문 페이지 유지: {ex}")
        write_sitemap(index, today)
    else:
        meta = next((w for w in index if w["id"] == argv[0]), None)
        if not meta:
            sys.exit(f"{argv[0]}: data/works-index.json에 없는 작품")
        gen_page(meta, index, exhibitions, today)


if __name__ == "__main__":
    main(sys.argv[1:])
