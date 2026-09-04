# shinhaedal.art — 홈페이지

신해달 작가 공식 홈페이지 (정적 사이트, GitHub Pages).
현재 배포 주소: https://yoonsunlee.github.io/shinhaedal/ (커스텀 도메인 연결 전)

## 아키텍처

```
해달아카이브 (Google Sheet + Apps Script, 별도 repo: Haedalarchive)
        │  관리자 토큰으로 전체 데이터 조회
        ▼
scripts/publish.py  ── 공개 whitelist만 추림, 이미지 3단계 WebP 생성
        │
        ▼
data/*.json, assets/works/*/  (이 repo에 커밋됨)
        │
        ▼
Home / Works / About / Press 등의 페이지가 이 정적 파일만 fetch
```

브라우저는 아카이브 API(Apps Script)를 직접 호출하지 않는다 — 전부 이 repo 안의
정적 JSON/이미지만 읽는다. 가격·판매여부·소장자 등 내부 필드는 `publish.py`의
whitelist 단계에서 아예 걸러지고, 애초에 이 repo로 넘어오지 않는다.

Publish는 `.github/workflows/publish.yml`이 실행한다. 트리거는 세 가지:
- 해달아카이브 admin 패널의 "🚀 홈페이지에 반영" 버튼 (`repository_dispatch`)
- Actions 탭에서 수동 실행 (`workflow_dispatch`)
- 매일 자정(UTC) 자동 실행 (`schedule`)

작품 수가 0건이거나 급감하면 publish 자체가 중단되고 기존 파일이 유지된다
(`scripts/publish.py`의 `validate_works()`). 전시/Press 데이터도 API 호출이
실패하면 빈 값으로 덮어쓰지 않고 마지막 정상본을 유지한다.

## 구조
```
index.html            Home — Recent Works / Now on View 자동 전환
about/                 About — 작가 소개, 학력, Selected Exhibitions
works/                 Works — 작품 아카이브, 전시별 필터, 작품 상세 모달
haedal/                IP — 얼빵해달/일월오봉단 세계관 (KO/EN)
press/                 Press — 매체 기사
contact/                Contact — 문의 폼 (mailto 연동)
data/                  publish.py가 생성하는 공개 정적 JSON
assets/works/<id>/     작품별 thumb/detail/large WebP + (있으면) audio.mp3
scripts/publish.py      Archive → Publish 스크립트
.github/workflows/     publish 자동화 워크플로
```

## 메뉴 구성
Home / About / Works / IP / Press / Brand Shop(외부 링크, 아이디어스) / Contact

## 원칙
- 작품·전시·Press 데이터는 해달아카이브에서만 관리한다 — 이 repo의 `data/*.json`을
  직접 편집하지 않는다(다음 자동 publish 때 덮어써짐).
- 디자인/카피는 이 repo에서 직접 관리한다.
- 민감정보(실거래가·소장자·결제방식 등)는 `publish.py`의 whitelist 단계에서
  차단되며, 애초에 이 repo에 존재하지 않는다.

## 남은 것
- 커스텀 도메인(shinhaedal.art) 연결 — 구매 후 진행 예정. 연결 시 6페이지 +
  `sitemap.xml`/`robots.txt`의 `og:url`/`canonical` 등을 `yoonsunlee.github.io/shinhaedal`
  에서 `shinhaedal.art`로 일괄 변경해야 함.
- Audio Guide — 우선순위 최후순위로 보류 중.
