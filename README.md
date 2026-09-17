# shinhaedal.com — 홈페이지

신해달 작가 공식 홈페이지 (정적 사이트, GitHub Pages).
배포 주소: https://shinhaedal.com/ (보조 도메인 shinhaedal.art는 .com으로 전달, 옛 주소 yoonsunlee.github.io/shinhaedal/은 GitHub이 자동으로 새 주소로 넘김)

## 아키텍처

```
해달아카이브 (Supabase Postgres, admin.html은 별도 repo: Haedalarchive)
        │  admin.html의 "🚀 홈페이지에 반영" 버튼 → Supabase Edge Function(publish)
        │  → 서버 측에서 GitHub repository_dispatch 호출 (service_role 키는 브라우저에 노출 안 됨)
        ▼
scripts/publish_sb.py  ── 공개 whitelist만 추림, 이미지 3단계 WebP 생성.
        │                  홈 영상은 원본 하나로 PC용(faststart 리먹스)·
        │                  모바일용(저해상도 재인코딩)·포스터(프레임 추출)를
        │                  자동 생성(작가가 모바일용을 따로 만들 필요 없음)
        ▼
data/*.json, assets/works/*/, assets/home-video/*/  (이 repo에 커밋됨)
        │
        ▼
Home / Works / About / Press 등의 페이지가 이 정적 파일만 fetch
```

브라우저는 Supabase나 아카이브 admin API를 직접 호출하지 않는다 — 전부 이 repo 안의
정적 JSON/이미지만 읽는다. 가격·판매여부·소장자 등 내부 필드는 `publish_sb.py`의
whitelist 단계에서 아예 걸러지고, 애초에 이 repo로 넘어오지 않는다.

Publish는 `.github/workflows/publish.yml`이 실행한다. 트리거는 세 가지:
- 해달아카이브 admin 패널의 "🚀 홈페이지에 반영" 버튼 (`repository_dispatch`)
- Actions 탭에서 수동 실행 (`workflow_dispatch`)
- 매일 자정(UTC) 자동 실행 (`schedule`)

작품 수가 0건이거나 직전 발행의 절반 미만으로 급감하면(직전 4건 이상일 때), 전시가
0건이거나 Press가 0건으로 바뀌면 publish 자체가 중단되고 기존 파일이 유지된다
(워크플로의 "Sanity check before commit" 단계). 일부러 대량 비공개·삭제한 경우에는
Actions 탭에서 "Publish archive data"를 수동 실행하며 `allow_shrink`를 체크하면 된다.
작품·전시·Press 모두 아카이브의 `publish_web`이 true인 항목만 발행된다. 홈 영상은 0건이어도
정상(이미지 히어로로 자동 폴백)이라 개수로는 안 막고, 대신 공개(public)인데
영상 파일이 비어있는 깨진 상태만 막는다.

영상 하나 처리(ffmpeg)가 실패해도 다른 영상·작품·전시·Press 발행까지 막히지
않는다(그 영상만 건너뛰고 다음 발행 때 재시도됨). ffmpeg 호출에는 timeout이
걸려 있고 워크플로 자체에도 `timeout-minutes`가 있어, 영상 파일이 손상돼도
무한정 매달리지 않는다.

## 구조
```
index.html            Home — Recent Works / Now on View 자동 전환, 홈 영상 히어로
about/                 About — 작가 소개, 학력, Selected Exhibitions
works/                 Works — 작품 아카이브, 전시별 필터, 작품 상세 모달
works/w/<id>/          작품 개별 페이지(검색·공유용 정적 HTML). gen_work_share.py가 발행 때 생성
ip/                    IP — 얼빵해달/일월오봉단 세계관 (KO/EN, 별도 CSS/JS)
press/                 Press — 매체 기사
contact/                Contact — 문의 폼 (mailto 연동)
data/                  publish_sb.py가 생성하는 공개 정적 JSON
                       (works/*.json, works-index.json, exhibitions.json,
                        press.json, home-videos.json)
assets/works/<id>/     작품별 thumb/detail/large WebP + (있으면) audio.mp3
assets/home-video/<id>/  홈 영상별 video.mp4/video_mobile.mp4/poster.webp
scripts/publish_sb.py   Archive(Supabase) → Publish 스크립트
scripts/gen_work_share.py  작품 개별 페이지 + 공유용 og.jpg + sitemap.xml 생성
.github/workflows/     publish 자동화 워크플로
```

## 메뉴 구성
Home / About / Works / IP / Press / Brand Shop(외부 링크, 아이디어스) / Contact

## 원칙
- 작품·전시·Press 데이터는 해달아카이브에서만 관리한다 — 이 repo의 `data/*.json`을
  직접 편집하지 않는다(다음 자동 publish 때 덮어써짐). `works/w/*`와 `sitemap.xml`도
  발행 때 다시 만들어지므로 모양을 바꾸려면 `scripts/gen_work_share.py`와
  `assets/work-page.css`를 고친다.
- 디자인/카피는 이 repo에서 직접 관리한다.
- 민감정보(실거래가·소장자·결제방식 등)는 `publish_sb.py`의 whitelist 단계에서
  차단되며, 애초에 이 repo에 존재하지 않는다.

## 남은 것
- Audio Guide — 우선순위 최후순위로 보류 중.
