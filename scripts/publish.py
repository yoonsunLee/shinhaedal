# -*- coding: utf-8 -*-
"""
해달아카이브 -> shinhaedal.art 발행 스크립트 (Archive -> Publish -> Website)

기존 sync_data.py를 대체한다. 브라우저가 더 이상 아카이브 API를 직접 호출하지 않도록,
여기서 전체(관리자 토큰) 데이터를 한 번 받아 공개 whitelist만 골라 정적 파일로 만든다.

만드는 것:
  data/works-index.json      Works 목록용 최소 정보
  data/works/<no>.json       작품별 상세 (whitelist 필드만)
  data/exhibitions.json      전시 목록 (원래도 전체 공개 설계)
  data/press.json            Press 목록 (원래도 전체 공개 설계)
  assets/works/<no>/thumb.webp / detail.webp / large.webp
  assets/works/<no>/audio.mp3   (audio_master가 있을 때만)

데이터 검증 실패 시 exit 1 -> 기존 파일 유지 (사이트는 마지막 정상본으로 계속 운영).
"""
import json, os, re, sys, subprocess, urllib.request, urllib.parse, datetime
import requests
from PIL import Image
from io import BytesIO

API = os.environ.get("ARCHIVE_API", "").strip()
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()
if not API or not ADMIN_TOKEN:
    sys.exit("ARCHIVE_API / ADMIN_TOKEN secret이 설정되지 않았습니다.")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
ASSETS_DIR = os.path.join(ROOT, "assets", "works")

# ── 공개 규칙 ──────────────────────────────────────────────
EXCLUDE_PREFIX_RE = re.compile(r"^ER", re.I)
# 아트토이 3종 중복 레코드 중 대표 1개만 공개 (제목 매칭 대신 ID 고정 — 제목이 바뀌어도 안전)
EXCLUDE_IDS = {"HD-2026-013", "HD-2026-014"}  # HD-2026-012가 대표로 남음

# 공개 whitelist — price/sold/discount/actual_price/payment/sale_date/delivery_date/
# channel/owner/note/qty/sold_qty 등 내부 필드는 절대 포함하지 않는다.
PUBLIC_FIELDS = ["no", "title", "caption", "material", "size", "year", "exhibitions"]
AUDIO_FIELDS = ["audio_master", "transcript_ko", "transcript_en"]  # 시트에 컬럼이 없으면 빈 값으로 처리됨

EXHIBITION_FIELDS = ["id", "title", "venue", "start_date", "end_date", "work_nos", "docent_url", "type", "note_public"]
PRESS_FIELDS = ["no", "outlet", "date", "title", "url", "quote", "image", "note"]

IMG_TIERS = {"thumb": 700, "detail": 1600, "large": 2400}


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "haedal-publish-bot"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_admin_works():
    data = fetch_json(API + "?action=list&token=" + urllib.parse.quote(ADMIN_TOKEN) + "&t=" + str(int(datetime.datetime.now().timestamp())))
    if not data.get("ok"):
        raise ValueError("admin fetch 실패: " + str(data.get("error")))
    return data.get("rows", [])


def fetch_sheet(sheet, fields):
    data = fetch_json(API + "?sheet=" + sheet + "&t=" + str(int(datetime.datetime.now().timestamp())))
    if not data.get("ok"):
        raise ValueError(f"{sheet} fetch 실패: " + str(data.get("error")))
    rows = data.get("rows", [])
    return [{k: str(r.get(k, "") or "").strip() for k in fields} for r in rows if str(r.get("title", "")).strip()]


def drive_id(value):
    v = str(value or "").strip()
    if v.startswith("drive:"):
        return v[6:]
    m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?id=)([\w-]+)", v)
    return m.group(1) if m else None


def download_drive_file(file_id):
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    resp = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    return resp.content


def make_image_tiers(no, image_field):
    fid = drive_id(image_field)
    if not fid:
        return {}
    raw = download_drive_file(fid)
    im = Image.open(BytesIO(raw))
    im = im.convert("RGB") if im.mode not in ("RGB", "RGBA") else im
    out_dir = os.path.join(ASSETS_DIR, no)
    os.makedirs(out_dir, exist_ok=True)
    paths = {}
    w0, h0 = im.size
    for tier, max_edge in IMG_TIERS.items():
        scale = min(1.0, max_edge / max(w0, h0))
        if scale < 1.0:
            im2 = im.resize((max(1, int(w0 * scale)), max(1, int(h0 * scale))), Image.LANCZOS)
        else:
            im2 = im
        rel = f"assets/works/{no}/{tier}.webp"
        im2.save(os.path.join(out_dir, f"{tier}.webp"), "WEBP", quality=85 if tier != "large" else 90)
        paths[tier] = rel
    return paths


def make_audio(no, audio_field):
    fid = drive_id(audio_field)
    if not fid:
        return None
    raw = download_drive_file(fid)
    out_dir = os.path.join(ASSETS_DIR, no)
    os.makedirs(out_dir, exist_ok=True)
    src_path = os.path.join(out_dir, "_src_audio")
    mp3_path = os.path.join(out_dir, "audio.mp3")
    with open(src_path, "wb") as f:
        f.write(raw)
    subprocess.run(
        ["ffmpeg", "-y", "-i", src_path, "-ac", "1", "-b:a", "96k", mp3_path],
        check=True, capture_output=True,
    )
    os.remove(src_path)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", mp3_path],
        check=True, capture_output=True, text=True,
    )
    duration = round(float(probe.stdout.strip()))
    return {"src": f"assets/works/{no}/audio.mp3", "duration": duration}


def validate_works(rows):
    if len(rows) == 0:
        raise ValueError("작품 데이터가 0건 — 반영 중단")
    missing = [r for r in rows if not r.get("no") or not r.get("title")]
    if len(missing) > len(rows) * 0.3:
        raise ValueError(f"작품번호/작품명 누락이 {len(missing)}건 — 시트 구조 변경 의심, 반영 중단")
    prev_path = os.path.join(DATA_DIR, "works-index.json")
    if os.path.exists(prev_path):
        try:
            prev = json.load(open(prev_path, encoding="utf-8"))
            if len(prev) >= 4 and len(rows) < len(prev) * 0.5:
                raise ValueError(f"작품 수 급감({len(prev)}→{len(rows)}) — 반영 중단, 의도한 삭제라면 수동 실행으로 확인")
        except ValueError:
            raise
        except Exception:
            pass


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)


def main():
    admin_rows = fetch_admin_works()
    works = []
    for r in admin_rows:
        no = str(r.get("no", "")).strip()
        if not no or EXCLUDE_PREFIX_RE.match(no) or no in EXCLUDE_IDS:
            continue
        works.append(r)

    validate_works(works)

    index_entries = []
    for r in works:
        no = r["no"]
        print(f"처리 중: {no}")
        images = make_image_tiers(no, r.get("image"))
        audio = make_audio(no, r.get("audio_master"))

        title_full = str(r.get("title", "")).strip()
        title_ko, _, title_en = title_full.partition("\n")

        detail = {k: str(r.get(k, "") or "").strip() for k in PUBLIC_FIELDS}
        detail["year"] = int(detail["year"]) if detail["year"].isdigit() else detail["year"]
        detail["images"] = images
        detail["audio"] = audio
        if audio:
            detail["transcript_ko"] = str(r.get("transcript_ko", "") or "").strip()
            detail["transcript_en"] = str(r.get("transcript_en", "") or "").strip()

        write_json(os.path.join(DATA_DIR, "works", f"{no}.json"), detail)

        index_entries.append({
            "id": no,
            "title": title_ko,
            "title_en": title_en,
            "year": detail["year"],
            "thumb": images.get("thumb", ""),
            "has_audio": bool(audio),
        })

    write_json(os.path.join(DATA_DIR, "works-index.json"), index_entries)
    print(f"works-index.json: {len(index_entries)}건")

    try:
        exhibitions = fetch_sheet("exhibitions", EXHIBITION_FIELDS)
    except Exception as e:
        print(f"전시 시트 읽기 실패({e}) — 전시 없음으로 처리")
        exhibitions = []
    write_json(os.path.join(DATA_DIR, "exhibitions.json"), exhibitions)
    print(f"exhibitions.json: {len(exhibitions)}건")

    try:
        press = fetch_sheet("press", PRESS_FIELDS)
    except Exception as e:
        print(f"Press 시트 읽기 실패({e}) — Press 없음으로 처리")
        press = []
    write_json(os.path.join(DATA_DIR, "press.json"), press)
    print(f"press.json: {len(press)}건")


if __name__ == "__main__":
    main()
