# -*- coding: utf-8 -*-
"""작품 목록·홈 Recent works·Press 목록을 HTML에 미리 써 넣는다.

지금까지 이 목록들은 브라우저가 JSON을 받아 JS로 그렸다. 그래서 원본 HTML에는
"불러오는 중…"만 있었고, 검색 로봇(특히 JS 실행이 약한 네이버)은 작품 링크도,
기사 목록도 보지 못했다. 발행 때 같은 마크업을 미리 써 두면 로봇은 바로 읽고,
사람에게는 JS가 같은 모양으로 다시 그리므로 화면은 그대로다.

HTML 파일 안의 표시 사이만 바꾼다:
    <!-- GEN:이름 -->  …여기가 바뀜…  <!-- /GEN:이름 -->
표시가 없거나 두 번 이상 있으면 발행을 멈춘다(엉뚱한 곳을 덮어쓰지 않도록).
국문 페이지에는 국문으로 쓰고, 영문 페이지(/en/…)용 영문 목록은 build_en.py가
blocks("en")으로 받아 간다.

  python scripts/prerender_lists.py      (gen_work_share.py --all 안에서도 불린다)
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOME_RECENT = 6  # 홈 Recent works 칸 수 — index.html의 ALL_WORKS.slice(0, 6)과 같아야 한다
SITE_BASE = "https://shinhaedal.com"
BRAND_SHOP_URL = "https://www.idus.com/v2/artist/b987fcad-fa10-4f28-a90d-8553dbaab0ad/product"


def e(s):
    return html.escape(str(s or ""), quote=True)


def load(*parts, default=None):
    p = ROOT.joinpath(*parts)
    if not p.exists() and default is not None:
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def primary_title(r, lang="ko"):
    ko = str(r.get("title") or "").strip()
    en = str(r.get("title_en") or "").strip()
    return (en or ko) if lang == "en" else (ko or en)


def size_label(v):
    v = str(v or "").strip()
    return v + " cm" if v and "cm" not in v.lower() else v


def works_tile(r, attr, lang="ko"):
    """works/index.html 의 tileHtml 과 같은 마크업(캡션 둘째 줄: 연도 · 크기)."""
    title = primary_title(r, lang)
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


def works_cells(rows, joined, attr_of, lang="ko"):
    """'두 폭 붙이기' 연작의 두 작품은 두 칸짜리 한 단위(.pair)로 — Selected에서만 쓴다."""
    html, i = [], 0
    while i < len(rows):
        r = rows[i]
        n = rows[i + 1] if i + 1 < len(rows) else None
        k = r.get("series_key")
        if (n and k and k in joined and n.get("series_key") == k
                and sum(1 for x in rows if x.get("series_key") == k) == 2):
            html.append('<div class="pair">%s%s</div>' % (works_tile(r, attr_of(r, i), lang), works_tile(n, attr_of(n, i + 1), lang)))
            i += 2
        else:
            html.append(works_tile(r, attr_of(r, i), lang))
            i += 1
    return "".join(html)


def work_tiles(rows, href_prefix, asset_base, lang="ko"):
    """index.html / works/index.html 의 renderWorkTiles 와 같은 마크업."""
    out = []
    for i, r in enumerate(rows):
        title = primary_title(r, lang)
        img = (asset_base + r["thumb"]) if r.get("thumb") else ""
        media = ('<img src="%s" alt="" loading="lazy" draggable="false" '
                 'onerror="this.style.visibility=\'hidden\'">' % e(img)) if img else ""
        out.append('<a class="tile" href="%sw/%s/" data-idx="%d" aria-label="%s">'
                   '<div class="tile-media">%s<div class="tile-sheen"></div></div>'
                   '<span class="tile-cap"><span class="tile-title">%s</span></span></a>'
                   % (href_prefix, e(r["id"]), i, e(title), media, e(title)))
    return "".join(out)


# ── Press: press/index.html 의 renderFeatured / renderRow 와 같은 마크업 ──
# 문구는 press/index.html 의 I18N과 같아야 한다(영문은 build_en.py가 그 I18N.en을 넘겨준다)
PRESS_LABELS = {"press_link": "기사 원문 보기 ↗", "shop_link": "브랜드 샵 바로가기 ↗",
                "ex_link": "전시 작품 보기 →", "ko_flag": ""}


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


def press_links(p, exhibitions, labels=PRESS_LABELS):
    shop = match_brand_shop(p)
    ex = None if shop else match_exhibition(p, exhibitions)
    links = []
    url = safe_url(p.get("url"))
    if url:
        links.append('<a class="press-link link-sub" href="%s" target="_blank" rel="noopener">%s</a>' % (e(url), e(labels["press_link"])))
    if shop:
        links.append('<a class="press-link link-sub" href="%s" target="_blank" rel="noopener">%s</a>' % (e(safe_url(shop)), e(labels["shop_link"])))
    elif ex:
        links.append('<a class="press-link link-go" href="../works/?ex=%s">%s</a>' % (e(ex["id"]), e(labels["ex_link"])))
    return "".join(links)


def press_text(p, lang, labels):
    """(매체명, 제목, 인용구, 한글 기사 표시) — press 화면의 outletFor / dekFor / langFlag 와 같은 규칙."""
    if lang != "en":
        return p.get("outlet"), p.get("title"), str(p.get("quote") or "").strip(), ""
    flag = "" if p.get("title_en") else '<span class="press-lang-flag">%s</span>' % e(labels["ko_flag"])
    return (p.get("outlet_en") or p.get("outlet"), p.get("title_en") or p.get("title"),
            str(p.get("quote_en") or "").strip(), flag)


def press_featured(p, exhibitions, lang="ko", labels=PRESS_LABELS):
    img = archive_img_url(p.get("image"))
    url = safe_url(p.get("url"))
    outlet, title, dek, flag = press_text(p, lang, labels)
    title = e(title)
    title_html = '<a href="%s" target="_blank" rel="noopener">%s</a>' % (e(url), title) if url else title
    media = ('<div class="press-feature-media"><img src="%s" alt="" onerror="onMediaError(this)"></div>' % e(img)) if img else ""
    return ('<div class="press-feature-grid%s" data-no="%s">%s<div class="press-feature-body">'
            '<p class="press-feature-meta"><span>%s</span><span class="dot"></span><span>%s</span></p>'
            '<h2 class="press-feature-title">%s%s</h2>%s'
            '<div class="press-feature-links">%s</div></div></div>'
            % ("" if img else " no-media", e(p.get("no")), media, e(outlet), e(p.get("date")), title_html, flag,
               ('<p class="press-feature-dek">%s</p>' % e(dek)) if dek else "", press_links(p, exhibitions, labels)))


def press_row(p, exhibitions, lang="ko", labels=PRESS_LABELS):
    img = archive_img_url(p.get("image"))
    outlet, title, dek, flag = press_text(p, lang, labels)
    media = ('<div class="press-row-media"><img src="%s" alt="" loading="lazy" onerror="onMediaError(this)"></div>' % e(img)) if img else ""
    return ('<article class="press-row%s" data-no="%s">%s<div class="press-row-text">'
            '<p class="press-row-meta"><span>%s</span><span class="dot"></span><span>%s</span></p>'
            '<h3 class="press-row-title">%s%s</h3>%s</div>'
            '<div class="press-row-links">%s</div></article>'
            % ("" if img else " no-media", e(p.get("no")), media, e(outlet), e(p.get("date")), e(title), flag,
               ('<p class="press-row-dek">%s</p>' % e(dek)) if dek else "", press_links(p, exhibitions, labels)))


# ── 검색엔진·AI가 읽는 구조화 데이터(JSON-LD) ──
# 사람 눈에는 안 보이지만, 검색엔진과 AI 답변은 이 값으로 "누가·무엇을·언제"를 읽는다.
# 국문 페이지와 영문 페이지가 각자 자기 주소를 쓰도록 여기서 언어별로 만든다.
ARTIST_ID = SITE_BASE + "/#artist"
ORG_ID = SITE_BASE + "/#haedaljagae"


def ld_script(obj):
    """<script>에 넣을 수 있게 JSON으로. </ 를 막아 스크립트가 일찍 닫히지 않게 한다."""
    return ('<script type="application/ld+json">%s</script>'
            % json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))


def home_url(lang):
    return SITE_BASE + ("/en/" if lang == "en" else "/")


def ld_home(lang):
    ko = lang != "en"
    person = {
        "@type": "Person",
        "@id": ARTIST_ID,
        "name": "신해달" if ko else "Shin Haedal",
        "alternateName": "Shin Haedal" if ko else "신해달",
        "url": home_url(lang),
        "mainEntityOfPage": home_url(lang),
        "image": SITE_BASE + "/about/assets/artist-profile-1.webp",
        "jobTitle": "나전칠기 아티스트" if ko else "Najeonchilgi Artist",
        "description": ("법과 사회의 규범, 그리고 그 안을 살아가는 개인의 이야기를 나전칠기의 언어로 옮기는 작가."
                        if ko else
                        "An artist who translates the norms of law and society, and the stories of the individuals "
                        "living within them, into the language of najeonchilgi."),
        "knowsAbout": (["나전칠기", "옻칠", "지식재산권법", "캐릭터 IP"] if ko else
                       ["Najeonchilgi", "Korean lacquer", "Intellectual property law", "Character IP"]),
        "alumniOf": [
            {"@type": "CollegeOrUniversity",
             "name": "중앙대학교 일반대학원 법학과" if ko else "Chung-Ang University, Graduate School of Law"},
            {"@type": "CollegeOrUniversity",
             "name": "단국대학교 법학과" if ko else "Dankook University, Department of Law"},
        ],
        "sameAs": ["https://www.instagram.com/haedal_space/", BRAND_SHOP_URL],
        "inLanguage": lang,
    }
    org = {
        "@type": "Organization",
        "@id": ORG_ID,
        "name": "해달자개" if ko else "Haedaljagae",
        "url": SITE_BASE + "/",
        "email": "contact@shinhaedal.com",
        "founder": {"@id": ARTIST_ID},
    }
    site = {
        "@type": "WebSite",
        "@id": SITE_BASE + "/#website",
        "url": home_url(lang),
        "name": "신해달 — 나전칠기 아티스트" if ko else "Shin Haedal — Najeonchilgi Artist",
        "inLanguage": lang,
        "publisher": {"@id": ORG_ID},
        "about": {"@id": ARTIST_ID},
    }
    return ld_script({"@context": "https://schema.org", "@graph": [person, org, site]})


def ld_about(lang, exhibitions):
    """전시 이력을 ExhibitionEvent로. 날짜가 있는 것만, 최근 것부터."""
    ko = lang != "en"
    rows = [x for x in exhibitions if x.get("start_date") and x.get("end_date")]
    rows = sorted(rows, key=lambda x: str(x.get("start_date")), reverse=True)
    out = []
    for x in rows:
        name = (x.get("title") if ko else (x.get("title_en") or x.get("title"))) or ""
        venue = (x.get("venue") if ko else (x.get("venue_en") or x.get("venue"))) or ""
        ev = {
            "@type": "ExhibitionEvent",
            "name": name,
            "startDate": x.get("start_date"),
            "endDate": x.get("end_date"),
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "performer": {"@id": ARTIST_ID},
            "organizer": {"@id": ORG_ID},
            "inLanguage": lang,
        }
        alt = (x.get("title_en") if ko else x.get("title"))
        if alt and alt != name:
            ev["alternateName"] = alt
        if venue:
            place = {"@type": "Place", "name": venue.split(",")[0].strip()}
            parts = [p.strip() for p in venue.split(",")]
            if len(parts) >= 2:
                addr = {"@type": "PostalAddress", "addressLocality": parts[1]}
                if len(parts) >= 3:
                    addr["addressCountry"] = "KR" if parts[2] in ("대한민국", "KR") else parts[2]
                place["address"] = addr
            if x.get("map_url"):
                place["hasMap"] = x["map_url"]
            ev["location"] = place
        if x.get("poster_url") and not str(x["poster_url"]).startswith("http"):
            ev["image"] = SITE_BASE + "/" + str(x["poster_url"]).lstrip("/")
        kind = (x.get("type") if ko else (x.get("type_en") or x.get("type"))) or ""
        if kind:
            ev["description"] = kind
        out.append(ev)
    if not out:
        return ""
    return ld_script({"@context": "https://schema.org", "@graph": out})


def fill_block(text, name, inner, where):
    """text 안의 GEN 표시 사이를 inner로 바꾼 새 text."""
    start, end = "<!-- GEN:%s -->" % name, "<!-- /GEN:%s -->" % name
    if text.count(start) != 1 or text.count(end) != 1:
        sys.exit("%s: GEN:%s 표시가 없거나 여러 개입니다 — 발행 중단" % (where, name))
    a = text.index(start) + len(start)
    b = text.index(end)
    return text[:a] + inner + text[b:]


def replace_block(path, name, inner):
    """표시 사이를 바꾸고, 파일이 실제로 바뀌었으면 True.
    파일의 원래 줄바꿈(CRLF/LF)을 그대로 지킨다 — 바꾸면 발행 때마다 파일 전체가 바뀐 것으로 커밋된다."""
    raw = path.read_bytes()
    eol = "\r\n" if b"\r\n" in raw else "\n"
    text = raw.decode("utf-8").replace("\r\n", "\n")
    new = fill_block(text, name, inner, path.relative_to(ROOT))
    if new != text:
        path.write_bytes(new.replace("\n", eol).encode("utf-8"))
        return True
    return False


def blocks(lang="ko", press_labels=PRESS_LABELS):
    """{"index.html": {"home-recent": …}, "works/index.html": {…}, "press/index.html": {…}} — 페이지별 GEN 블록 내용."""
    index = load("data", "works-index.json")
    exhibitions = load("data", "exhibitions.json", default=[])
    press = load("data", "press.json", default=[])
    press = sorted(press, key=lambda p: str(p.get("date") or ""), reverse=True)  # 최신 날짜순(press 화면과 같음)
    series = load("data", "series.json", default=[])
    joined = {r["key"] for r in series if r.get("joined")}
    page = load("data", "works-page.json", default={"selected": []})

    out = {"index.html": {"home-recent": work_tiles(index[:HOME_RECENT], "works/", "", lang),
                          "home-ld": ld_home(lang)},
           "about/index.html": {"about-ld": ld_about(lang, exhibitions)}}
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
    out["works/index.html"] = {
        "works-grid": "".join(works_tile(r, 'data-idx="%d"' % i, lang) for i, r in enumerate(index)),
        "works-selected": works_cells(sel, joined, lambda r, i: 'data-id="%s"' % e(r["id"]), lang),
    }
    if press:
        featured = next((p for p in press if p.get("featured")), press[0])
        rest = [p for p in press if p is not featured]
        out["press/index.html"] = {
            "press-feature": press_featured(featured, exhibitions, lang, press_labels),
            "press-list": "".join(press_row(p, exhibitions, lang, press_labels) for p in rest),
        }
    return out


def prerender():
    changed = []
    for rel, parts in blocks("ko").items():
        hit = False
        for name, inner in parts.items():
            hit = replace_block(ROOT / rel, name, inner) or hit
        if hit:
            changed.append(rel)
    print("미리 쓰기: %s" % (", ".join(changed) if changed else "바뀐 것 없음"))
    return changed


if __name__ == "__main__":
    prerender()
