# -*- coding: utf-8 -*-
"""해달아카이브(Supabase) → shinhaedal.art 발행

기존 publish.py의 Supabase 버전. 출력물의 모양은 그대로 유지해서
홈페이지 코드를 건드리지 않는다.

  python3 publish_sb.py            평소 발행 (이미지까지 생성)
  python3 publish_sb.py --data-only  JSON만 만든다 (이미지 처리 생략)
  python3 publish_sb.py --dry-run <출력폴더>  기존 산출물과 대조용

환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
import json, os, re, shutil, subprocess, sys, urllib.parse, urllib.request

API = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
if not API or not KEY:
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다.")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
ASSETS_DIR = os.path.join(ROOT, "assets", "works")

IMG_TIERS = {"thumb": 560, "detail": 1600, "large": 2400}

# 전시 유형은 DB에 코드로 있고 홈페이지는 한국어를 쓴다.
EX_TYPE_KO = {"solo": "개인전", "group": "단체전", "curated": "기획전",
              "art_fair": "아트페어", "special": "특별전", "popup": "팝업"}


def sb(path):
    req = urllib.request.Request(
        API + "/rest/v1/" + path,
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY,
                 "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def s(v):
    return "" if v is None else str(v).strip()


def fmt_ex_line(ex):
    """작품 상세에 보이는 전시 이력 한 줄.
    예전엔 손으로 쓴 자유텍스트였고 축약·중복·누락이 있었다.
    이제 전시 DB에서 만들어 표기를 통일한다(작가 결정 2026-09-05)."""
    start = s(ex.get("start_date")).replace("-", ".")
    end = s(ex.get("end_date"))[5:].replace("-", ".")
    venue = s(ex.get("venue_ko"))
    return "%s – %s  %s%s" % (start, end, s(ex.get("title_ko")),
                              (", " + venue) if venue else "")


# ── 이미지 ────────────────────────────────────────────────────────────
def fetch_image_bytes(image_file):
    """기존 사진은 Google Drive, 새로 올린 사진은 Supabase Storage에 있다."""
    v = s(image_file)
    if not v:
        return None
    if v.startswith("sb:"):
        req = urllib.request.Request(
            API + "/storage/v1/object/artwork-masters/" + urllib.parse.quote(v[3:]),
            headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    fid = v[6:] if v.startswith("drive:") else None
    if not fid:
        m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?id=)([\w-]+)", v)
        fid = m.group(1) if m else None
    if not fid:
        return None
    import requests
    resp = requests.get("https://drive.google.com/uc?export=download&id=" + fid,
                        timeout=120, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    return resp.content


def make_image_tiers(no, image_file, out_root):
    from io import BytesIO
    from PIL import Image, ImageCms, ImageOps
    raw = fetch_image_bytes(image_file)
    if not raw:
        return {}
    im = Image.open(BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    icc = im.info.get("icc_profile")
    if icc:
        try:
            im = ImageCms.profileToProfile(
                im, ImageCms.ImageCmsProfile(BytesIO(icc)),
                ImageCms.createProfile("sRGB"), outputMode="RGB")
        except Exception:
            pass
    out_dir = os.path.join(out_root, no)
    os.makedirs(out_dir, exist_ok=True)
    w0, h0 = im.size
    paths = {}
    for tier, max_edge in IMG_TIERS.items():
        scale = min(1.0, max_edge / max(w0, h0))
        im2 = im.resize((max(1, int(w0 * scale)), max(1, int(h0 * scale))),
                        Image.LANCZOS) if scale < 1.0 else im
        quality = 90 if tier == "large" else (80 if tier == "thumb" else 85)
        im2.save(os.path.join(out_dir, tier + ".webp"), "WEBP", quality=quality)
        paths[tier] = "assets/works/%s/%s.webp" % (no, tier)
    return paths


def make_audio(no, audio_master, out_root):
    raw = fetch_image_bytes(audio_master)   # 같은 규칙(drive:/sb:)을 쓴다
    if not raw:
        return None
    out_dir = os.path.join(out_root, no)
    os.makedirs(out_dir, exist_ok=True)
    srcp = os.path.join(out_dir, "_src_audio")
    mp3 = os.path.join(out_dir, "audio.mp3")
    with open(srcp, "wb") as f:
        f.write(raw)
    subprocess.run(["ffmpeg", "-y", "-i", srcp, "-ac", "1", "-b:a", "96k", mp3],
                   check=True, capture_output=True)
    os.remove(srcp)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", mp3],
        check=True, capture_output=True, text=True)
    return {"src": "assets/works/%s/audio.mp3" % no,
            "duration": round(float(probe.stdout.strip()))}


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)


ID_RE = re.compile(r"^[A-Z]+-(\d{4})-(\d+)$", re.I)


def sort_key(r):
    m = ID_RE.match(s(r.get("work_no")))
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def main():
    args = sys.argv[1:]
    data_only = "--data-only" in args
    dry = None
    if "--dry-run" in args:
        dry = args[args.index("--dry-run") + 1]
        data_only = True

    data_dir = os.path.join(dry, "data") if dry else DATA_DIR
    assets_dir = os.path.join(dry, "assets", "works") if dry else ASSETS_DIR

    works = sb("works?select=*&publish_web=eq.true&deleted_at=is.null")
    exhibitions = sb("exhibitions?select=*&deleted_at=is.null")
    links = sb("exhibition_works?select=exhibition_id,work_id")
    press = sb("press?select=*&deleted_at=is.null")

    if not works:
        sys.exit("공개 작품이 0건 — 반영 중단")

    ex_by_id = {e["id"]: e for e in exhibitions}
    ex_of_work = {}
    for l in links:
        ex_of_work.setdefault(l["work_id"], []).append(ex_by_id.get(l["exhibition_id"]))

    works.sort(key=sort_key, reverse=True)

    index_entries = []
    for w in works:
        no = s(w["work_no"])
        mine = [e for e in ex_of_work.get(w["id"], []) if e]
        mine.sort(key=lambda e: s(e.get("start_date")), reverse=True)

        if data_only:
            images, audio = {}, None
        else:
            print("처리 중: " + no)
            images = make_image_tiers(no, w.get("image_file"), assets_dir)
            audio = make_audio(no, w.get("audio_master"), assets_dir)

        year = w.get("year")
        detail = {
            "no": no,
            "title": s(w.get("title_ko")),
            "caption": s(w.get("caption_ko")),
            "material": s(w.get("material_ko")),
            "size": s(w.get("size_text")),
            "year": year if isinstance(year, int) else s(year),
            "exhibitions": "\n".join(fmt_ex_line(e) for e in mine),
            "title_en": s(w.get("title_en")),
            "caption_en": s(w.get("caption_en")),
            "material_en": s(w.get("material_en")),
            "images": images,
            "audio": audio,
        }
        if audio:
            detail["transcript_ko"] = s(w.get("transcript_ko"))
            detail["transcript_en"] = s(w.get("transcript_en"))
        write_json(os.path.join(data_dir, "works", no + ".json"), detail)

        index_entries.append({
            "id": no,
            "title": detail["title"],
            "title_en": detail["title_en"],
            "year": detail["year"],
            "thumb": images.get("thumb", ""),
            "has_audio": bool(audio),
        })

    write_json(os.path.join(data_dir, "works-index.json"), index_entries)
    print("works-index.json: %d건" % len(index_entries))

    # 전시: 홈페이지는 여전히 work_nos 문자열을 읽으므로 관계에서 되만들어 준다.
    no_by_id = {w["id"]: s(w["work_no"]) for w in works}
    members = {}
    for l in links:
        n = no_by_id.get(l["work_id"])
        if n:
            members.setdefault(l["exhibition_id"], []).append(n)
    ex_out = []
    for e in sorted(exhibitions, key=lambda x: s(x.get("exhibition_no"))):
        ex_out.append({
            "id": s(e.get("exhibition_no")),
            "title": s(e.get("title_ko")),
            "venue": s(e.get("venue_ko")),
            "start_date": s(e.get("start_date")),
            "end_date": s(e.get("end_date")),
            "work_nos": ",".join(sorted(members.get(e["id"], []))),
            "docent_url": s(e.get("docent_url")),
            "type": EX_TYPE_KO.get(s(e.get("type")), s(e.get("type"))),
            "note_public": s(e.get("note_public_ko")),
            "title_en": s(e.get("title_en")),
            "venue_en": s(e.get("venue_en")),
        })
    write_json(os.path.join(data_dir, "exhibitions.json"), ex_out)
    print("exhibitions.json: %d건" % len(ex_out))

    press_out = []
    for p in sorted(press, key=lambda x: s(x.get("press_no"))):
        press_out.append({
            "no": s(p.get("press_no")),
            "outlet": s(p.get("outlet_ko")),
            "date": s(p.get("published_date")),
            "title": s(p.get("title_ko")),
            "url": s(p.get("url")),
            "quote": s(p.get("quote_ko")),
            "image": s(p.get("image_source_url")),
            "title_en": s(p.get("title_en")),
            "quote_en": s(p.get("quote_en")),
            "note_public": s(p.get("byline")),
        })
    write_json(os.path.join(data_dir, "press.json"), press_out)
    print("press.json: %d건" % len(press_out))

    if not dry and not data_only:
        current = {s(w["work_no"]) for w in works}
        wd = os.path.join(data_dir, "works")
        if os.path.isdir(wd):
            for name in os.listdir(wd):
                if name.endswith(".json") and name[:-5] not in current:
                    os.remove(os.path.join(wd, name))
                    print("orphan 정리: data/works/" + name)
        if os.path.isdir(assets_dir):
            for name in os.listdir(assets_dir):
                if name not in current:
                    shutil.rmtree(os.path.join(assets_dir, name))
                    print("orphan 정리: assets/works/%s/" % name)


if __name__ == "__main__":
    main()
