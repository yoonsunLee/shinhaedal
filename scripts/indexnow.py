# -*- coding: utf-8 -*-
"""바뀐 페이지 주소를 IndexNow로 검색엔진에 알린다(Bing·네이버 등. 구글은 IndexNow를 받지 않는다).

  python scripts/indexnow.py <이전 커밋> <새 커밋>   두 커밋 사이에 바뀐 HTML만
  python scripts/indexnow.py --all                  사이트맵의 주소 전부(처음 한 번)

키 파일은 사이트 루트의 <키>.txt 다(내용이 키 자체). 키는 비밀값이 아니다 — 이 사이트 주소를
알리는 권한 확인용으로, 공개 경로에 있어야 검색엔진이 확인할 수 있다.
알리기에 실패해도 발행은 실패로 치지 않는다(검색엔진은 사이트맵으로도 결국 찾아온다).
"""
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = "shinhaedal.com"
SITE = "https://" + HOST
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",          # 참여 검색엔진(Bing 등)에 함께 전달된다
    "https://searchadvisor.naver.com/indexnow",   # 네이버에 직접도 보낸다
]


def find_key():
    for p in ROOT.glob("*.txt"):
        if re.fullmatch(r"[0-9a-f]{32}", p.stem) and p.read_text(encoding="utf-8").strip() == p.stem:
            return p.stem
    sys.exit("IndexNow 키 파일이 없습니다")


def url_for(path):
    """저장소 안 파일 경로 → 공개 주소. 페이지가 아니면 None."""
    if not path.endswith("index.html"):
        return None
    if path.startswith(("_", "templates/", "proto/")) or "/_" in path:
        return None
    d = path[: -len("index.html")]
    return SITE + "/" + d


def changed_urls(old, new):
    out = subprocess.run(["git", "diff", "--name-only", old, new], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.split()
    return sorted({u for u in (url_for(p) for p in out) if u})


def sitemap_urls():
    xml = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def submit(urls, key):
    body = json.dumps({"host": HOST, "key": key, "keyLocation": "%s/%s.txt" % (SITE, key),
                       "urlList": urls}).encode("utf-8")
    for ep in ENDPOINTS:
        req = urllib.request.Request(ep, data=body, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                print("%s → %d" % (ep, r.status))
        except urllib.error.HTTPError as e:
            print("%s → %d %s" % (ep, e.code, e.read()[:200].decode("utf-8", "replace")))
        except Exception as e:
            print("%s → 실패: %s" % (ep, e))


def main(argv):
    key = find_key()
    if argv == ["--all"]:
        urls = sitemap_urls()
    elif len(argv) == 2:
        urls = changed_urls(argv[0], argv[1])
    else:
        sys.exit(__doc__)
    if not urls:
        print("바뀐 페이지 없음 — 알리지 않음")
        return
    print("알릴 주소 %d개:\n  %s" % (len(urls), "\n  ".join(urls)))
    submit(urls[:10000], key)


if __name__ == "__main__":
    main(sys.argv[1:])
