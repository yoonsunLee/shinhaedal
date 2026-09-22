# -*- coding: utf-8 -*-
"""작품 목록·홈 Recent works·Press 목록을 HTML에 미리 써 넣는다.

지금까지 이 목록들은 브라우저가 JSON을 받아 JS로 그렸다. 그래서 원본 HTML에는
"불러오는 중…"만 있었고, 검색 로봇(특히 JS 실행이 약한 네이버)은 작품 링크도,
기사 목록도 보지 못했다. 발행 때 같은 마크업을 미리 써 두면 로봇은 바로 읽고,
사람에게는 JS가 같은 모양으로 다시 그리므로 화면은 그대로다.

HTML 파일 안의 표시 사이만 바꾼다:
    <!-- GEN:이름 -->  …여기가 바뀜…  <!-- /GEN:이름 -->
표시가 없거나 두 번 이상 있으면 발행을 멈춘다(엉뚱한 곳을 덮어쓰지 않도록).
국문 화면 기준으로 쓴다. 영문으로 보는 사람에게는 JS가 영문으로 다시 그린다.

  python scripts/prerender_lists.py      (gen_work_share.py --all 안에서도 불린다)
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOME_RECENT = 6  # 홈 Recent works 칸 수 — index.html의 ALL_WORKS.slice(0, 6)과 같아야 한다
BRAND_SHOP_URL = "https://www.idus.com/v2/artist/b987fcad-fa10-4f28-a90d-8553dbaab0ad/product"


def e(s):
    return html.escape(str(s or ""), quote=True)


def load(*parts, default=None):
    p = ROOT.joinpath(*parts)
    if not p.exists() and default is not None:
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def primary_title(r):
    ko = str(r.get("title") or "").strip()
    return ko or str(r.get("title_en") or "").strip()


def size_label(v):
    v = str(v or "").strip()
    return v + " cm" if v and "cm" not in v.lower() else v


def works_tile(r, attr):
    """works/index.html 의 tileHtml 과 같은 마크업(캡션 둘째 줄: 연도 · 크기)."""
    title = primary_title(r)
    img = ("../" + r["thumb"]) if r.get("thumb") else ""
    dims = (' width="%s" height="%s"' % (r["tw"], r["th"])) if r.get("tw") and r.get("th") else ""
    media = ('<img src="%s"%s alt="" loading="lazy" draggable="false" '
             'onerror="this.style.visibility=\'hidden\'">' % (e(img), dims)) if img else ""
    size = size_label(r.get("size"))
    meta = e(r.get("year") or "") + (('<span class="sep"> · </span><span class="sz">%s</span>' % e(size)) if size else "")
    return ('<a class="tile" href="w/%s/" %s aria-label="%s"><div class="tile-media">%s<div class="tile-sheen"></div></div>'
            '<span class="tile-cap"><span class="tile-title">%s</span><span class="tile-meta">%s</span></span></a>'
            % (e(r["id"]), attr, e(title), media, e(title), meta))


def series_sort_key(r):
    o = r.get("series_order")
    return (o is None, o if o is not None else 0, str(r["id"]))


def works_cells(rows, joined, attr_of):
    """'두 폭 붙이기' 연작의 두 작품은 두 칸짜리 한 단위(.pair)로 — Selected에서만 쓴다."""
    html, i = [], 0
    while i < len(rows):
        r = rows[i]
        n = rows[i + 1] if i + 1 < len(rows) else None
        k = r.get("series_key")
        if (n and k and k in joined and n.get("series_key") == k
                and sum(1 for x in rows if x.get("series_key") == k) == 2):
            html.append('<div class="pair">%s%s</div>' % (works_tile(r, attr_of(r, i)), works_tile(n, attr_of(n, i + 1))))
            i += 2
        else:
            html.append(works_tile(r, attr_of(r, i)))
            i += 1
    return "".join(html)


def work_tiles(rows, href_prefix, asset_base):
    """index.html / works/index.html 의 renderWorkTiles 와 같은 마크업."""
    out = []
    for i, r in enumerate(rows):
        title = primary_title(r)
        img = (asset_base + r["thumb"]) if r.get("thumb") else ""
        media = ('<img src="%s" alt="" loading="lazy" draggable="false" '
                 'onerror="this.style.visibility=\'hidden\'">' % e(img)) if img else ""
        out.append('<a class="tile" href="%sw/%s/" data-idx="%d" aria-label="%s">'
                   '<div class="tile-media">%s<div class="tile-sheen"></div></div>'
                   '<span class="tile-cap"><span class="tile-title">%s</span></span></a>'
                   % (href_prefix, e(r["id"]), i, e(title), media, e(title)))
    return "".join(out)


# ── Press: press/index.html 의 renderFeatured / renderRow 와 같은 마크업 ──
def archive_img_url(v, size=900):
    v = str(v or "").strip()
    if not v:
        return ""
    if v.startswith("drive:"):
        return "https://drive.google.com/thumbnail?id=%s&sz=w%d" % (v[6:], size)
    m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|thumbnail\?id=)([\w-]+)", v)
    if m:
        return "https://drive.google.com/thumbnail?id=%s&sz=w%d" % (m.group(1), size)
    return v if re.match(r"^https?://", v) else ""


def safe_url(v):
    return v if re.match(r"^https://", str(v or "").strip(), re.I) else ""


def match_brand_shop(p):
    if p.get("link_type"):
        return BRAND_SHOP_URL if p["link_type"] == "brand_shop" else None
    return BRAND_SHOP_URL if "해달자개" in str(p.get("title") or "") else None


def match_exhibition(p, exhibitions):
    if p.get("link_type"):
        if p["link_type"] != "exhibition" or not p.get("linked_exhibition_id"):
            return None
        return next((x for x in exhibitions if x.get("id") == p["linked_exhibition_id"]), None)
    title = str(p.get("title") or "")
    for x in exhibitions:
        t = re.sub(r"\s*(단체전|개인전|아트페어)$", "", str(x.get("title") or "")).strip()
        if t and t in title:
            return x
    return None


def press_links(p, exhibitions):
    shop = match_brand_shop(p)
    ex = None if shop else match_exhibition(p, exhibitions)
    links = []
    url = safe_url(p.get("url"))
    if url:
        links.append('<a class="press-link link-sub" href="%s" target="_blank" rel="noopener">기사 원문 보기 ↗</a>' % e(url))
    if shop:
        links.append('<a class="press-link link-sub" href="%s" target="_blank" rel="noopener">브랜드 샵 바로가기 ↗</a>' % e(safe_url(shop)))
    elif ex:
        links.append('<a class="press-link link-go" href="../works/?ex=%s">전시 작품 보기 →</a>' % e(ex["id"]))
    return "".join(links)


def press_featured(p, exhibitions):
    img = archive_img_url(p.get("image"))
    url = safe_url(p.get("url"))
    title = e(p.get("title"))
    title_html = '<a href="%s" target="_blank" rel="noopener">%s</a>' % (e(url), title) if url else title
    dek = str(p.get("quote") or "").strip()
    media = ('<div class="press-feature-media"><img src="%s" alt="" onerror="onMediaError(this)"></div>' % e(img)) if img else ""
    return ('<div class="press-feature-grid%s" data-no="%s">%s<div class="press-feature-body">'
            '<p class="press-feature-meta"><span>%s</span><span class="dot"></span><span>%s</span></p>'
            '<h2 class="press-feature-title">%s</h2>%s'
            '<div class="press-feature-links">%s</div></div></div>'
            % ("" if img else " no-media", e(p.get("no")), media, e(p.get("outlet")), e(p.get("date")), title_html,
               ('<p class="press-feature-dek">%s</p>' % e(dek)) if dek else "", press_links(p, exhibitions)))


def press_row(p, exhibitions):
    img = archive_img_url(p.get("image"))
    dek = str(p.get("quote") or "").strip()
    media = ('<div class="press-row-media"><img src="%s" alt="" loading="lazy" onerror="onMediaError(this)"></div>' % e(img)) if img else ""
    return ('<article class="press-row%s" data-no="%s">%s<div class="press-row-text">'
            '<p class="press-row-meta"><span>%s</span><span class="dot"></span><span>%s</span></p>'
            '<h3 class="press-row-title">%s</h3>%s</div>'
            '<div class="press-row-links">%s</div></article>'
            % ("" if img else " no-media", e(p.get("no")), media, e(p.get("outlet")), e(p.get("date")), e(p.get("title")),
               ('<p class="press-row-dek">%s</p>' % e(dek)) if dek else "", press_links(p, exhibitions)))


def replace_block(path, name, inner):
    """표시 사이를 바꾸고, 파일이 실제로 바뀌었으면 True.
    파일의 원래 줄바꿈(CRLF/LF)을 그대로 지킨다 — 바꾸면 발행 때마다 파일 전체가 바뀐 것으로 커밋된다."""
    raw = path.read_bytes()
    eol = "\r\n" if b"\r\n" in raw else "\n"
    text = raw.decode("utf-8").replace("\r\n", "\n")
    start, end = "<!-- GEN:%s -->" % name, "<!-- /GEN:%s -->" % name
    if text.count(start) != 1 or text.count(end) != 1:
        sys.exit("%s: GEN:%s 표시가 없거나 여러 개입니다 — 발행 중단" % (path.relative_to(ROOT), name))
    a = text.index(start) + len(start)
    b = text.index(end)
    new = text[:a] + inner + text[b:]
    if new != text:
        path.write_bytes(new.replace("\n", eol).encode("utf-8"))
        return True
    return False


def prerender():
    index = load("data", "works-index.json")
    exhibitions = load("data", "exhibitions.json", default=[])
    press = load("data", "press.json", default=[])
    press = sorted(press, key=lambda p: str(p.get("date") or ""), reverse=True)  # 최신 날짜순(press 화면과 같음)
    series = load("data", "series.json", default=[])
    joined = {r["key"] for r in series if r.get("joined")}
    page = load("data", "works-page.json", default={"selected": []})

    changed = []
    if replace_block(ROOT / "index.html", "home-recent", work_tiles(index[:HOME_RECENT], "works/", "")):
        changed.append("index.html")
    by_id = {w["id"]: w for w in index}
    sel, added = [], set()
    for wid in page.get("selected") or []:
        w = by_id.get(wid)
        if not w or w["id"] in added:
            continue
        k = w.get("series_key")
        group = sorted([x for x in index if x.get("series_key") == k], key=series_sort_key) if k in joined else [w]
        if k in joined and len(group) != 2:
            group = [w]
        for x in group:
            if x["id"] not in added:
                added.add(x["id"])
                sel.append(x)
    # All works: 연작도 한 점씩(두 폭으로 붙이는 건 Selected에 넣었을 때만 — 작가 결정 2026-09-22)
    a = replace_block(ROOT / "works" / "index.html", "works-grid",
                      "".join(works_tile(r, 'data-idx="%d"' % i) for i, r in enumerate(index)))
    b = replace_block(ROOT / "works" / "index.html", "works-selected",
                      works_cells(sel, joined, lambda r, i: 'data-id="%s"' % e(r["id"])))
    if a or b:
        changed.append("works/index.html")
    if press:
        featured = next((p for p in press if p.get("featured")), press[0])
        rest = [p for p in press if p is not featured]
        a = replace_block(ROOT / "press" / "index.html", "press-feature", press_featured(featured, exhibitions))
        b = replace_block(ROOT / "press" / "index.html", "press-list", "".join(press_row(p, exhibitions) for p in rest))
        if a or b:
            changed.append("press/index.html")
    print("미리 쓰기: %s" % (", ".join(changed) if changed else "바뀐 것 없음"))
    return changed


if __name__ == "__main__":
    prerender()
