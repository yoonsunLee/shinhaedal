# -*- coding: utf-8 -*-
"""영문 정적 페이지(/en/…)를 국문 페이지에서 만든다.

지금까지 영문은 같은 주소에서 JS로 글자만 바꿔 보여 줬다. 그래서 검색엔진은 영문을 따로 찾지
못했다. 국문 페이지 7개(홈·Works·About·Press·Contact·Privacy·IP)를 en/<같은 경로>/index.html 로
복사하면서
  · 각 페이지 I18N.en 사전을 data-i / data-i-aria / data-i-alt / data-i-ph 자리에 미리 채우고
  · <html lang="en">, 제목·설명·canonical·og:url을 영문 주소로 바꾸고
  · <base href="/works/">를 넣는다 — 스크립트·이미지·데이터의 상대 주소는 국문 폴더 기준 그대로 쓴다
  · 페이지 사이 링크는 /en/…으로, 미리 쓴 목록(GEN)은 영문 제목으로 쓴다
  · 국문·영문 짝을 hreflang으로 서로 알린다(국문 페이지 쪽 표시도 여기서 맞춘다)
영문 문구는 각 페이지 I18N.en 그대로다 — 여기서 새로 쓰지 않는다(설명 meta만 아래 EN_DESC).
en/ 아래 파일은 손으로 고치지 않는다: 국문 페이지를 고치고 이 스크립트를 다시 돌린다
(발행 때마다 gen_work_share.py --all 안에서도 돈다). I18N을 읽으려고 node를 쓴다.

  python scripts/build_en.py
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prerender_lists import blocks, fill_block  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://shinhaedal.com"
HOST = "shinhaedal.com"
PAGES = ["", "works/", "about/", "press/", "contact/", "privacy/", "copyright/", "ip/"]
INDEX_TITLE_EN = "Shin Haedal — Najeonchilgi Artist"  # index.html applyLang의 영문 제목과 같게


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"<br\s*/?>", " ", re.sub(r"<(?!br)[^>]+>", "", s or ""))).strip()


# 검색 결과에 보이는 설명. 국문 meta description을 옮긴 것이고, 페이지에 같은 뜻의 영문이 있으면 그 문장을 쓴다.
def en_desc(path, en):
    return {
        "": "Official website of Shin Haedal, an artist who translates the norms of law and society "
            "into the language of najeonchilgi.",
        "works/": strip_tags(en.get("page_sub")) + " Law, society and the individual, translated into najeonchilgi.",
        "about/": "About Shin Haedal, an artist who expresses the norms of law and society, and the stories "
                  "of the individuals who live within them, through najeonchilgi.",
        "press/": strip_tags(en.get("page_sub")),
        "contact/": "Contact Shin Haedal about artworks, exhibitions, collaborations and licensing.",
        "privacy/": "Privacy policy of the official website of the artist Shin Haedal.",
        "copyright/": "What you may do with the artworks, writing and characters of Shin Haedal, and what needs permission. Use for AI training is not permitted.",
        "ip/": strip_tags(en.get("hero_note")),  # IP 페이지 영문 그대로(작가 요청)
    }[path]


# ── 머리(head)에 넣는 것 ──
# 국문 페이지: ?lang=en으로 왔거나 전에 EN을 고른 사람은 영문 주소로 보낸다(브라우저 언어로 자동 전환은 하지 않는다).
# 옮겨 가는 동안 국문 화면이 번쩍이지 않게 가리고, 방문 통계는 세지 않는다(__SH_LANG_REDIRECT).
KO_ROUTE = ("<script>/*lang-route*/(function(){var s=location.search,m=/[?&]lang=(en|ko)(?=&|$)/.exec(s),l=m&&m[1];"
            "try{if(l==='ko')localStorage.setItem('site_lang','ko');else if(!l)l=localStorage.getItem('site_lang')}catch(e){}"
            "if(l!=='en')return;window.__SH_LANG_REDIRECT=1;document.documentElement.style.visibility='hidden';"
            "location.replace('/en'+location.pathname+s.replace(/([?&])lang=en(&|$)/,function(a,p,e){return e?p:''})+location.hash)})()</script>")
# 영문 페이지: ?lang=ko로 오면 국문 주소로(국문 쪽이 site_lang을 ko로 적는다)
EN_ROUTE = ("<script>/*lang-route*/(function(){var s=location.search;if(!/[?&]lang=ko(&|$)/.test(s))return;"
            "window.__SH_LANG_REDIRECT=1;document.documentElement.style.visibility='hidden';"
            "location.replace(location.pathname.replace(/^\\/en(?=\\/)/,'')+s+location.hash)})()</script>")
ROUTE_RE = re.compile(r"<script>/\*lang-route\*/.*?</script>")
ALT_RE = re.compile(r'(?:<link rel="alternate" hreflang="[^"]+" href="[^"]*">\n)+')


def alternates(path):
    return ('<link rel="alternate" hreflang="ko" href="%s/%s">\n'
            '<link rel="alternate" hreflang="en" href="%s/en/%s">\n'
            '<link rel="alternate" hreflang="x-default" href="%s/%s">\n' % (SITE, path, SITE, path, SITE, path))


def page_file(path):
    return ROOT / path / "index.html" if path else ROOT / "index.html"


def read(p):
    return p.read_bytes().decode("utf-8").replace("\r\n", "\n")


def write_keep_eol(p, text):
    """국문 페이지는 원래 줄바꿈 그대로 저장(바뀐 게 없으면 쓰지 않는다)."""
    raw = p.read_bytes()
    eol = "\r\n" if b"\r\n" in raw else "\n"
    new = text.replace("\n", eol).encode("utf-8")
    if new != raw:
        p.write_bytes(new)
        return True
    return False


def sub1(pattern, repl, text, what, flags=0):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        sys.exit("build_en: %s 을(를) 찾지 못했습니다" % what)
    return new


# ── 국문 페이지 머리 맞추기(없으면 넣고, 있으면 최신으로) ──
def sync_ko(text, path):
    prefix = "" if not path else "../"
    if ROUTE_RE.search(text):
        text = ROUTE_RE.sub(lambda _: KO_ROUTE, text, count=1)
    else:
        text = sub1(r'(<meta name="viewport"[^>]*>\n)', lambda m: m.group(1) + KO_ROUTE + "\n", text, path + " viewport meta")
    text = ALT_RE.sub("", text)
    text = sub1(r'(<link rel="canonical"[^>]*>\n)', lambda m: m.group(1) + alternates(path), text, path + " canonical")
    tag = '<script src="%sassets/lang.js"></script>\n' % prefix
    if tag not in text:
        text = sub1(r"</body>", lambda m: tag + m.group(0), text, path + " </body>")
    return text


# ── I18N 사전 읽기(node로 페이지의 객체 그대로 평가) ──
def js_object_at(src, start):
    i, depth, n = start, 0, len(src)
    while i < n:
        c = src[i]
        if c in "'\"`":
            q = c
            i += 1
            while i < n and src[i] != q:
                if src[i] == "\\":
                    i += 1
                i += 1
        elif src.startswith("//", i):
            i = src.index("\n", i)
        elif src.startswith("/*", i):
            i = src.index("*/", i) + 1
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1
    sys.exit("build_en: I18N 괄호 짝이 맞지 않습니다")


def read_i18n(text, where):
    m = re.search(r"(?:var|const|let)\s+I18N\s*=\s*\{", text)
    if not m:
        sys.exit("build_en: %s 에 I18N이 없습니다" % where)
    obj = js_object_at(text, m.end() - 1)
    try:
        out = subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(" + obj + "))"],
                             capture_output=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError) as ex:
        sys.exit("build_en: node로 %s I18N을 읽지 못했습니다 — %s" % (where, ex))
    return json.loads(out.decode("utf-8"))


# ── 태그 훑기(주석·<script>·<style> 안은 건너뜀) ──
TAG_RE = re.compile(r"<!--.*?-->|<(/?)([a-zA-Z][\w:-]*)((?:[^>\"']|\"[^\"]*\"|'[^']*')*?)(/?)>", re.S)
ATTR_RE = re.compile(r"""([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>"']+))?""")
RAW_TEXT = ("script", "style", "textarea", "title")


def scan(text, pos=0):
    while True:
        m = TAG_RE.search(text, pos)
        if not m:
            return
        pos = m.end()
        if m.group(0).startswith("<!--"):
            continue
        yield m
        if not m.group(1) and m.group(2).lower() in RAW_TEXT:
            end = re.compile(r"</%s\s*>" % m.group(2), re.I).search(text, pos)
            pos = end.start() if end else len(text)


def attrs_of(tag):
    """[(이름, 값 또는 None, 시작, 끝)] — 위치는 tag 문자열 안에서."""
    head = re.match(r"<[a-zA-Z][\w:-]*", tag).end()
    out = []
    for a in ATTR_RE.finditer(tag, head, len(tag) - 1):
        v = a.group(2)
        if v is not None and v[:1] in "\"'":
            v = v[1:-1]
        out.append((a.group(1).lower(), None if v is None else html.unescape(v), a.start(), a.end()))
    return out


def get_attr(tag, name):
    for n, v, _, _ in attrs_of(tag):
        if n == name:
            return "" if v is None else v
    return None


def set_attr(tag, name, value):
    """value: None=지우기, True=값 없는 속성(hidden), 문자열=값."""
    new = "" if value is None else (" " + name if value is True else ' %s="%s"' % (name, html.escape(value, quote=True)))
    for n, _, s, e in attrs_of(tag):
        if n == name:
            while s > 0 and tag[s - 1].isspace():
                s -= 1
            return tag[:s] + new + tag[e:]
    if value is None:
        return tag
    end = len(tag) - (2 if tag.endswith("/>") else 1)
    return tag[:end] + new + tag[end:]


def find_close(text, m):
    name, depth = m.group(2).lower(), 1
    for t in scan(text, m.end()):
        if t.group(2).lower() != name:
            continue
        if t.group(1):
            depth -= 1
        elif not t.group(4):
            depth += 1
        if depth == 0:
            return t
    return None


def apply_edits(text, edits):
    for s, e, new in sorted(edits, reverse=True):
        text = text[:s] + new + text[e:]
    return text


# ── 영문 페이지 만들기 ──
EXTRA = {  # 페이지 applyLang이 언어에 따라 켜고 끄는 것(id → hidden)
    "press/": {"enNote": False},
    "privacy/": {"ppKo": True, "ppEn": False},
    "copyright/": {"cpKo": True, "cpEn": False},
}
JS_SWAPS = {  # 페이지 스크립트의 국문 초기값 → 영문(없으면 조용히 넘어감: 국문 페이지 쪽 전환이 대신 보낸다)
    "": [("location.replace('works/' + location.search)", "location.replace('/en/works/' + location.search)"),
         ("location.href = 'works/?w='", "location.href = '/en/works/?w='")],
}


def en_href(href, path):
    if not href or href.startswith("#"):
        return None
    u = urlsplit(urljoin("%s/%s" % (SITE, path), href))
    if u.scheme not in ("http", "https") or u.netloc != HOST:
        return None
    p = re.sub(r"index\.html$", "", u.path)
    if p.lstrip("/") not in PAGES:
        return None
    return "/en" + p + ("?" + u.query if u.query else "") + ("#" + u.fragment if u.fragment else "")


def make_en(ko, path, en, gen):
    t = ko
    for name, inner in gen.items():
        t = fill_block(t, name, inner, "en/" + path)

    # 1) data-i 자리의 내용(innerHTML) — 바깥 요소가 먼저(applyLang 순서와 같게)
    edits, taken = [], []
    for m in scan(t):
        if m.group(1):
            continue
        key = get_attr(m.group(0), "data-i")
        if key is None or key not in en:
            continue
        if any(a <= m.start() < b for a, b in taken):
            continue
        close = find_close(t, m)
        if not close:
            sys.exit("build_en: %s data-i=%s 닫는 태그가 없습니다" % (path, key))
        edits.append((m.end(), close.start(), en[key]))
        taken.append((m.end(), close.start()))
    t = apply_edits(t, edits)

    # 2) 속성: aria·alt·placeholder, 페이지 사이 링크, 언어에 따라 켜고 끄는 것
    edits = []
    extra = EXTRA.get(path, {})
    for m in scan(t):
        if m.group(1):
            continue
        tag0 = tag = m.group(0)
        for src, dst in (("data-i-aria", "aria-label"), ("data-i-alt", "alt"), ("data-i-ph", "placeholder")):
            k = get_attr(tag, src)
            if k is not None and k in en:
                tag = set_attr(tag, dst, en[k])
        k = get_attr(tag, "data-i")
        if path == "ip/" and k is not None and k in en:  # IP는 빈 문구면 요소를 숨긴다
            style = re.sub(r"display\s*:\s*none\s*;?\s*", "", get_attr(tag, "style") or "").strip()
            if en[k] == "":
                style = ("display:none; " + style).strip()
            tag = set_attr(tag, "style", style or None)
        if m.group(2).lower() in ("a", "area"):
            h = en_href(get_attr(tag, "href"), path)
            if h:
                tag = set_attr(tag, "href", h)
        i = get_attr(tag, "id")
        if i in extra:
            tag = set_attr(tag, "hidden", True if extra[i] else None)
        if i in ("langKo", "langEn"):
            cls = [c for c in (get_attr(tag, "class") or "").split() if c != "on"]
            if i == "langEn":
                cls.append("on")
            tag = set_attr(tag, "class", " ".join(cls) or None)
        if m.group(2).lower() == "html":
            tag = set_attr(tag, "lang", "en")
        if tag != tag0:
            edits.append((m.start(), m.end(), tag))
    t = apply_edits(t, edits)

    # 3) 머리: 제목·설명·주소·base·전환 스크립트
    url = "%s/en/%s" % (SITE, path)
    title = en.get("page_title") or INDEX_TITLE_EN
    desc = en_desc(path, en)
    esc = lambda s: html.escape(s, quote=True)  # noqa: E731
    t = sub1(r"<title>.*?</title>", lambda m: "<title>%s</title>" % html.escape(title, quote=False), t, path + " <title>", re.S)
    t = sub1(r'<meta name="description" content="[^"]*">', lambda m: '<meta name="description" content="%s">' % esc(desc), t, path + " description")
    t = sub1(r'<meta property="og:title" content="[^"]*">', lambda m: '<meta property="og:title" content="%s">' % esc(title), t, path + " og:title")
    t = sub1(r'<meta property="og:description" content="[^"]*">', lambda m: '<meta property="og:description" content="%s">' % esc(desc), t, path + " og:description")
    t = sub1(r'<meta property="og:url" content="[^"]*">', lambda m: '<meta property="og:url" content="%s">' % url, t, path + " og:url")
    t = sub1(r'<link rel="canonical" href="[^"]*">', lambda m: '<link rel="canonical" href="%s">' % url, t, path + " canonical")
    t = sub1(r'(<meta charset="UTF-8">\n)', lambda m: m.group(1) + '<base href="/%s">\n' % path, t, path + " charset")
    t = ROUTE_RE.sub(lambda _: EN_ROUTE, t, count=1)

    # 4) 스크립트의 처음 언어 = 영문(저장된 선택·주소와 상관없이 이 주소는 영문)
    if path == "ip/":
        t = sub1(r"var initLang = null;", lambda m: "var initLang = 'en';", t, "ip initLang")
    else:
        t = sub1(r"var LANG = 'ko';", lambda m: "var LANG = 'en';", t, path + " LANG")
    for a, b in JS_SWAPS.get(path, []):
        t = t.replace(a, b)
    return t


def build():
    en_gen = None
    ko_new, en_new = {}, {}
    for path in PAGES:
        f = page_file(path)
        ko = sync_ko(read(f), path)
        en = read_i18n(ko, path or "index.html")["en"]
        if path == "press/":
            labels = {k: en[k] for k in ("press_link", "shop_link", "ex_link", "ko_flag")}
            en_gen = blocks("en", labels)
        ko_new[path] = ko
        en_new[path] = en
    # Press 영문 문구가 필요해 목록은 사전을 다 읽은 뒤 만든다(홈·Works 목록은 문구가 없다)
    out = {}
    for path in PAGES:
        rel = (path + "index.html") if path else "index.html"
        out[path] = make_en(ko_new[path], path, en_new[path], en_gen.get(rel, {}))

    changed = []
    for path in PAGES:
        if write_keep_eol(page_file(path), ko_new[path]):
            changed.append(path or "/")
        dst = ROOT / "en" / path / "index.html"
        dst.parent.mkdir(parents=True, exist_ok=True)
        data = out[path].encode("utf-8")
        if not dst.exists() or dst.read_bytes().replace(b"\r\n", b"\n") != data:
            dst.write_bytes(data)
            changed.append("en/" + path)
    print("영문 페이지: %s" % (", ".join(changed) if changed else "바뀐 것 없음"))
    return changed


if __name__ == "__main__":
    build()
