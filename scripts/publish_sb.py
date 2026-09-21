# -*- coding: utf-8 -*-
"""해달아카이브(Supabase) → shinhaedal.com 발행

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
HOME_VIDEO_ASSETS_DIR = os.path.join(ROOT, "assets", "home-video")

IMG_TIERS = {"thumb": 560, "detail": 1600, "large": 2400}

# 전시 유형은 DB에 코드로 있고 홈페이지는 한국어/영어를 각각 쓴다.
EX_TYPE_KO = {"solo": "개인전", "group": "단체전", "curated": "기획전",
              "art_fair": "아트페어", "special": "특별전", "popup": "팝업"}
EX_TYPE_EN = {"solo": "Solo Exhibition", "group": "Group Exhibition", "curated": "Curated Exhibition",
              "art_fair": "Art Fair", "special": "Special Exhibition", "popup": "Pop-up"}


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
    import requests
    if fid:
        resp = requests.get("https://drive.google.com/uc?export=download&id=" + fid,
                            timeout=120, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        return resp.content
    if re.match(r"^https?://", v):
        resp = requests.get(v, timeout=120, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        return resp.content
    return None


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


def make_photo_tiers(no, idx, image_file, out_root):
    """작품 상세 화면용 추가 사진(대표 이미지와 별개). photo0, photo1... 폴더에 같은 3단계 크기로 만든다."""
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
    tag = "photo%d" % idx
    out_dir = os.path.join(out_root, no, tag)
    os.makedirs(out_dir, exist_ok=True)
    w0, h0 = im.size
    paths = {}
    for tier, max_edge in IMG_TIERS.items():
        scale = min(1.0, max_edge / max(w0, h0))
        im2 = im.resize((max(1, int(w0 * scale)), max(1, int(h0 * scale))),
                        Image.LANCZOS) if scale < 1.0 else im
        quality = 90 if tier == "large" else (80 if tier == "thumb" else 85)
        im2.save(os.path.join(out_dir, tier + ".webp"), "WEBP", quality=quality)
        paths[tier] = "assets/works/%s/%s/%s.webp" % (no, tag, tier)
    return paths


def make_media_thumb(no, idx, thumb_file, out_root):
    """영상/인스타그램 링크에 직접 올린 썸네일(선택). 단일 크기면 충분하다."""
    from io import BytesIO
    from PIL import Image, ImageOps
    raw = fetch_image_bytes(thumb_file)
    if not raw:
        return ""
    im = Image.open(BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    out_dir = os.path.join(out_root, no)
    os.makedirs(out_dir, exist_ok=True)
    w0, h0 = im.size
    max_edge = 640
    scale = min(1.0, max_edge / max(w0, h0))
    if scale < 1.0:
        im = im.resize((max(1, int(w0 * scale)), max(1, int(h0 * scale))), Image.LANCZOS)
    fname = "media%d.webp" % idx
    im.save(os.path.join(out_dir, fname), "WEBP", quality=82)
    return "assets/works/%s/%s" % (no, fname)


def make_poster(ex_id, poster_ref, assets_root):
    """전시 포스터: Storage(sb:) 비공개 버킷 원본을 홈페이지가 바로 쓸 수 있는 정적 webp로 만든다."""
    from io import BytesIO
    from PIL import Image, ImageOps
    raw = fetch_image_bytes(poster_ref)
    if not raw:
        return ""
    im = Image.open(BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    out_dir = os.path.join(assets_root, "exhibitions", ex_id)
    os.makedirs(out_dir, exist_ok=True)
    w0, h0 = im.size
    max_edge = 1600
    scale = min(1.0, max_edge / max(w0, h0))
    if scale < 1.0:
        im = im.resize((max(1, int(w0 * scale)), max(1, int(h0 * scale))), Image.LANCZOS)
    im.save(os.path.join(out_dir, "poster.webp"), "WEBP", quality=85)
    return "assets/exhibitions/%s/poster.webp" % ex_id


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
                   check=True, capture_output=True, timeout=120)
    os.remove(srcp)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", mp3],
        check=True, capture_output=True, text=True, timeout=60)
    return {"src": "assets/works/%s/audio.mp3" % no,
            "duration": round(float(probe.stdout.strip()))}


# 인코딩 방식이 바뀌면 이 값을 올린다 → 모든 홈 영상을 다음 발행 때 다시 만든다.
VIDEO_PIPELINE = "2026-09-22"
VIDEO_MAX_SECONDS = 20
HDR_TRANSFERS = {"smpte2084", "arib-std-b67"}  # PQ(HDR10·돌비비전 호환), HLG — 폰 기본 HDR 영상


def _probe_video(path):
    """길이(초)와 HDR 전송 특성(PQ면 'smpte2084', HLG면 'arib-std-b67', 아니면 '')."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=color_transfer:format=duration", "-of", "json", path],
            check=True, capture_output=True, timeout=60).stdout
        info = json.loads(out.decode("utf-8") or "{}")
        dur = float((info.get("format") or {}).get("duration") or 0) or None
        trc = ((info.get("streams") or [{}])[0].get("color_transfer") or "").lower()
        return dur, (trc if trc in HDR_TRANSFERS else "")
    except Exception:
        return None, ""


def _encode(src, out, width, crf, maxrate, hdr):
    """웹용 H.264(8bit·BT.709·무음·faststart). 원본을 그대로 복사하지 않는다 —
    폰 기본값(HEVC·HDR·4K·오디오)이 그대로 공개되고, 파일이 커져 발행 전체가 멈출 수 있어서."""
    scale = "scale='min(%d,iw)':-2" % width
    bufsize = "%dM" % (int(maxrate.rstrip("M")) * 2)

    def run(vf):
        subprocess.run(
            ["ffmpeg", "-y", "-i", src, "-t", str(VIDEO_MAX_SECONDS), "-an", "-sn", "-dn",
             "-map_metadata", "-1", "-vf", vf, "-fpsmax", "30",
             "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
             "-maxrate", maxrate, "-bufsize", bufsize,
             "-pix_fmt", "yuv420p", "-profile:v", "high",
             "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
             "-movflags", "+faststart", out],
            check=True, capture_output=True, timeout=600)

    if hdr:
        # HDR을 그대로 8bit로 내리면 색이 바래 보인다 → SDR로 톤매핑.
        # 러너의 ffmpeg에 zscale이 없거나 원본 태그가 이상하면 톤매핑 없이라도 만든다(영상이 빠지는 것보다 낫다).
        try:
            run("zscale=tin=%s:pin=bt2020:min=bt2020nc:t=linear:npl=100,format=gbrpf32le,"
                "zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,%s" % (hdr, scale))
            return
        except subprocess.CalledProcessError:
            print("  HDR 변환 실패 — 변환 없이 인코딩합니다(색이 조금 바랠 수 있음)")
    run(scale)


def make_video(vid, video_master, out_root):
    """홈 영상 하나: 마스터 원본 하나만 받아서 PC용·모바일용·포스터를 자동으로 만든다.
    작가가 모바일용을 따로 준비할 필요가 없게 하는 게 목적(2026-09-14 결정).

    - 원본이 같고(업로드 경로가 같음) 인코딩 방식도 같으면 이전 결과를 그대로 쓴다.
      매일 자동 발행 때마다 다시 인코딩해 같은 영상이 저장소에 또 커밋되는 일을 막는다.
    - 20초를 넘는 부분은 잘라 낸다(홈 히어로 루프는 8~15초 권장)."""
    out_dir = os.path.join(out_root, vid)
    pc_out = os.path.join(out_dir, "video.mp4")
    poster_out = os.path.join(out_dir, "poster.webp")
    mobile_out = os.path.join(out_dir, "video_mobile.mp4")
    stamp = os.path.join(out_dir, "source.txt")
    key = "%s|%s" % (VIDEO_PIPELINE, s(video_master))
    result = {
        "video": "assets/home-video/%s/video.mp4" % vid,
        "video_mobile": "assets/home-video/%s/video_mobile.mp4" % vid,
        "poster": "assets/home-video/%s/poster.webp" % vid,
        "poster_mobile": "",
    }
    if all(os.path.exists(p) for p in (pc_out, poster_out, mobile_out, stamp)):
        with open(stamp, encoding="utf-8") as f:
            if f.read().strip() == key:
                print("  같은 원본 — 이전 결과 재사용")
                return result

    raw = fetch_image_bytes(video_master)
    if not raw:
        return None
    os.makedirs(out_dir, exist_ok=True)
    src = os.path.join(out_dir, "_src_video")
    with open(src, "wb") as f:
        f.write(raw)
    try:
        dur, hdr = _probe_video(src)
        if dur and dur > VIDEO_MAX_SECONDS:
            print("  %.1f초 — 앞 %d초만 씁니다" % (dur, VIDEO_MAX_SECONDS))
        if hdr:
            print("  HDR 원본 — SDR로 변환합니다(폰 설정에서 HDR 영상을 끄고 찍는 게 가장 좋습니다)")
        # PC용: 1920폭 이하, 화질 기준(CRF 20) + 최대 8Mbps. 빛이 움직이는 자개 영상 기준 12초에 8~10MB 안팎
        _encode(src, pc_out, 1920, 20, "8M", hdr)
        # 모바일용: 1080폭 이하, CRF 23 + 최대 4Mbps (예전 720폭·CRF 26은 타일이 뭉개졌다)
        _encode(src, mobile_out, 1080, 23, "4M", hdr)
        # 포스터: 완성된 PC용의 첫 프레임 — 재생이 시작될 때 포스터에서 영상으로 튀지 않도록 루프 시작과 같은 장면
        subprocess.run(["ffmpeg", "-y", "-i", pc_out, "-frames:v", "1", "-quality", "85", poster_out],
                       check=True, capture_output=True, timeout=60)
        for label, p in (("PC", pc_out), ("모바일", mobile_out)):
            mb = os.path.getsize(p) / 1e6
            print("  %s용 %.1fMB%s" % (label, mb, " — 큽니다. 더 짧게 또는 움직임을 느리게 찍어 주세요" if mb > 20 else ""))
        with open(stamp, "w", encoding="utf-8") as f:
            f.write(key + "\n")
    except Exception:
        # 하나라도 실패하면 절반만 만들어진 산출물을 남기지 않는다
        for p in (pc_out, poster_out, mobile_out, stamp):
            if os.path.exists(p):
                os.remove(p)
        raise
    finally:
        if os.path.exists(src):
            os.remove(src)
    return result


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)


def prune_work_assets(no, out_root, photo_count, has_audio, media_names):
    """작품은 그대로 공개돼 있는데 그 안의 상세사진·오디오·영상 썸네일만 빠진 경우,
    예전에 만들어 둔 파일이 주소로는 계속 열린다. 이번 발행에서 쓰지 않는 것만 지운다.
    og.jpg처럼 다른 단계(공유 페이지 생성)가 만든 파일은 건드리지 않는다."""
    d = os.path.join(out_root, no)
    if not os.path.isdir(d):
        return
    for name in sorted(os.listdir(d)):
        p = os.path.join(d, name)
        m = re.match(r"^photo(\d+)$", name)
        if m and os.path.isdir(p) and int(m.group(1)) >= photo_count:
            shutil.rmtree(p, ignore_errors=True)
            print("정리: assets/works/%s/%s/" % (no, name))
        elif name == "audio.mp3" and not has_audio:
            os.remove(p)
            print("정리: assets/works/%s/audio.mp3" % no)
        elif re.match(r"^media\d+\.webp$", name) and name not in media_names:
            os.remove(p)
            print("정리: assets/works/%s/%s" % (no, name))


def _remove_orphan(path, label):
    # 정리 대상 폴더엔 원래 작품/전시/영상별 하위 디렉터리만 있어야 하지만,
    # 테스트 등으로 낱개 파일이 섞여 들어가면 shutil.rmtree가 NotADirectoryError로 죽는다.
    if os.path.isdir(path):
        shutil.rmtree(path)
        print("orphan 정리: %s/" % label)
    elif os.path.exists(path):
        os.remove(path)
        print("orphan 정리(파일): %s" % label)


ID_RE = re.compile(r"^[A-Z]+-(\d{4})-(\d+)$", re.I)


def sort_key(r):
    m = ID_RE.match(s(r.get("work_no")))
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


YOUTUBE_ID_RE = re.compile(r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{6,})")


def youtube_id(url):
    m = YOUTUBE_ID_RE.search(s(url))
    return m.group(1) if m else None


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
    exhibitions = sb("exhibitions?select=*&publish_web=eq.true&deleted_at=is.null")
    links = sb("exhibition_works?select=exhibition_id,work_id")
    press = sb("press?select=*&publish_web=eq.true&deleted_at=is.null")
    all_photos = sb("work_photos?select=*&is_public=eq.true&order=sort_order")
    try:
        home_videos = sb("home_videos?select=*&is_public=eq.true&deleted_at=is.null&order=sort_order")
    except Exception as e:
        # 표가 아직 없을 때만(Phase 2 도입 전) 조용히 건너뛴다.
        # 통신·권한 오류까지 '영상 0개'로 발행하면 멀쩡한 영상이 지워지므로 여기서 멈춘다.
        msg = str(e)
        if "404" in msg or "PGRST205" in msg or "does not exist" in msg:
            print("home_videos 조회 건너뜀(표가 없으면 정상): %s" % e)
            home_videos = []
        else:
            sys.exit("home_videos 조회 실패 — 기존 영상을 지우지 않도록 반영을 멈춥니다: %s" % e)
    all_media = sb("work_media_links?select=*&is_public=eq.true&order=sort_order")

    if not works:
        sys.exit("공개 작품이 0건 — 반영 중단")

    ex_by_id = {e["id"]: e for e in exhibitions}
    ex_of_work = {}
    for l in links:
        ex_of_work.setdefault(l["work_id"], []).append(ex_by_id.get(l["exhibition_id"]))

    photos_of_work = {}
    for p in all_photos:
        photos_of_work.setdefault(p["work_id"], []).append(p)
    media_of_work = {}
    for m in all_media:
        media_of_work.setdefault(m["work_id"], []).append(m)

    works.sort(key=sort_key, reverse=True)

    index_entries = []
    for w in works:
        no = s(w["work_no"])
        mine = [e for e in ex_of_work.get(w["id"], []) if e]
        mine.sort(key=lambda e: s(e.get("start_date")), reverse=True)

        my_photos = sorted(photos_of_work.get(w["id"], []), key=lambda r: r.get("sort_order") or 0)
        my_media = sorted(media_of_work.get(w["id"], []), key=lambda r: r.get("sort_order") or 0)

        if data_only:
            images, audio = {}, None
            photos, media = [], []
        else:
            print("처리 중: " + no)
            images = make_image_tiers(no, w.get("image_file"), assets_dir)
            audio = make_audio(no, w.get("audio_master"), assets_dir) if w.get("docent_enabled") else None

            photos = []
            for i, p in enumerate(my_photos):
                tiers = make_photo_tiers(no, i, p.get("image_file"), assets_dir)
                if not tiers:
                    continue
                photos.append({
                    "thumb": tiers.get("thumb", ""), "detail": tiers.get("detail", ""),
                    "large": tiers.get("large", ""),
                    "caption": s(p.get("caption_ko")), "caption_en": s(p.get("caption_en")),
                    "alt": s(p.get("alt_text")),
                })

            media = []
            for i, m in enumerate(my_media):
                url = s(m.get("url"))
                if not url:
                    continue
                thumb = make_media_thumb(no, i, m.get("thumb_file"), assets_dir) if s(m.get("thumb_file")) else ""
                if not thumb:
                    yid = youtube_id(url)
                    if yid:
                        thumb = "https://i.ytimg.com/vi/%s/hqdefault.jpg" % yid
                media.append({
                    "platform": s(m.get("platform")), "url": url, "thumb": thumb,
                    "title": s(m.get("title_ko")), "title_en": s(m.get("title_en")),
                    "duration": m.get("duration_seconds"),
                })

            # 이번에 쓰지 않는 예전 상세사진·오디오·썸네일 파일 정리
            prune_work_assets(
                no, assets_dir, len(my_photos), bool(audio),
                {"media%d.webp" % i for i, m in enumerate(my_media) if s(m.get("thumb_file"))},
            )

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
        if photos:
            detail["photos"] = photos
        if media:
            detail["media"] = media
        write_json(os.path.join(data_dir, "works", no + ".json"), detail)

        index_entries.append({
            "id": no,
            "title": detail["title"],
            "title_en": detail["title_en"],
            "year": detail["year"],
            "thumb": images.get("thumb", ""),
            "has_audio": bool(audio),
            "series_key": s(w.get("series_key")),
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
    ex_assets_root = os.path.dirname(assets_dir)
    ex_out = []
    for e in sorted(exhibitions, key=lambda x: s(x.get("exhibition_no"))):
        ex_id = s(e.get("exhibition_no"))
        poster_asset = ""
        if not data_only and s(e.get("poster_url")):
            print("포스터 처리 중: " + ex_id)
            poster_asset = make_poster(ex_id, e.get("poster_url"), ex_assets_root)
        ex_out.append({
            "id": ex_id,
            "title": s(e.get("title_ko")),
            "venue": s(e.get("venue_ko")),
            "start_date": s(e.get("start_date")),
            "end_date": s(e.get("end_date")),
            "work_nos": ",".join(sorted(members.get(e["id"], []))),
            "type": EX_TYPE_KO.get(s(e.get("type")), s(e.get("type"))),
            "type_en": EX_TYPE_EN.get(s(e.get("type")), s(e.get("type"))),
            "note_public": s(e.get("note_public_ko")),
            "title_en": s(e.get("title_en")),
            "venue_en": s(e.get("venue_en")),
            "poster_url": poster_asset,
            "map_url": s(e.get("map_url")),
            "featured_work_nos": s(e.get("featured_work_nos")),
            "about_selected": bool(e.get("about_selected")),
        })
    write_json(os.path.join(data_dir, "exhibitions.json"), ex_out)
    print("exhibitions.json: %d건" % len(ex_out))

    press_out = []
    for p in sorted(press, key=lambda x: s(x.get("press_no"))):
        link_type = s(p.get("link_type"))
        linked_ex = ex_by_id.get(p.get("linked_exhibition_id")) if link_type == "exhibition" else None
        press_out.append({
            "no": s(p.get("press_no")),
            "outlet": s(p.get("outlet_ko")),
            "outlet_en": s(p.get("outlet_en")),  # 열이 아직 없으면 빈 값
            "date": s(p.get("published_date")),
            "title": s(p.get("title_ko")),
            "url": s(p.get("url")),
            "quote": s(p.get("quote_ko")),
            "image": s(p.get("image_source_url")),
            "title_en": s(p.get("title_en")),
            "quote_en": s(p.get("quote_en")),
            "note_public": s(p.get("byline")),
            "link_type": link_type,
            "linked_exhibition_id": s(linked_ex.get("exhibition_no")) if linked_ex else "",
            "featured": s(p.get("type")) == "feature",
        })
    write_json(os.path.join(data_dir, "press.json"), press_out)
    print("press.json: %d건" % len(press_out))

    hv_no_by_id = {w["id"]: s(w["work_no"]) for w in works}
    hv_assets_dir = os.path.join(os.path.dirname(assets_dir), "home-video")
    hv_out = []
    for v in home_videos[:3]:  # 홈페이지는 최대 3개까지만 쓴다
        vid = s(v.get("id"))
        if not vid:
            continue
        media = {"video": "", "video_mobile": "", "poster": "", "poster_mobile": ""}
        if not data_only and s(v.get("video_master")):
            print("영상 처리 중: " + (s(v.get("name")) or vid))
            try:
                made = make_video(vid, v.get("video_master"), hv_assets_dir)
            except Exception as e:
                # 영상 하나가 깨졌다고 작품·전시·Press 발행까지 전부 막으면 안 된다.
                # 이 영상만 건너뛰고(다음 발행 때 다시 시도됨) 나머지는 정상 진행한다.
                print("영상 처리 실패, 이 영상은 건너뜀(%s): %s" % (vid, e))
                continue
            if made:
                media = made
        hv_out.append({
            "id": vid,
            "name": s(v.get("name")),
            "public": True,  # is_public=eq.true로 이미 걸러서 가져왔으니 여기 온 건 전부 공개
            "order": v.get("sort_order") or 0,
            "video": media["video"],
            "video_mobile": media["video_mobile"],
            "poster": media["poster"],
            "poster_mobile": media["poster_mobile"],
            "work_no": hv_no_by_id.get(s(v.get("work_id")), ""),
            "bg_color": s(v.get("bg_color")) or "#000000",
            "ui_theme": s(v.get("ui_theme")) or "dark",
            "mobile_image_fallback": bool(v.get("mobile_image_fallback")),
        })
    write_json(os.path.join(data_dir, "home-videos.json"), hv_out)
    print("home-videos.json: %d건" % len(hv_out))

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
                    _remove_orphan(os.path.join(assets_dir, name), "assets/works/%s" % name)
        current_ex = {s(e.get("exhibition_no")) for e in exhibitions}
        ex_assets_dir = os.path.join(ex_assets_root, "exhibitions")
        if os.path.isdir(ex_assets_dir):
            for name in os.listdir(ex_assets_dir):
                if name not in current_ex:
                    _remove_orphan(os.path.join(ex_assets_dir, name), "assets/exhibitions/%s" % name)
        current_hv = {s(v["id"]) for v in hv_out}
        if os.path.isdir(hv_assets_dir):
            for name in os.listdir(hv_assets_dir):
                if name not in current_hv:
                    _remove_orphan(os.path.join(hv_assets_dir, name), "assets/home-video/%s" % name)


if __name__ == "__main__":
    main()
