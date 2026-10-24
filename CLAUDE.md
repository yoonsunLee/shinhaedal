# CLAUDE.md — shinhaedal.com (공개 홈페이지)

이 파일은 Claude가 이 저장소에서 작업할 때 먼저 읽는 안내다. 구조·발행 흐름은 README.md에 있으니 함께 읽는다.
(이 저장소는 GitHub Pages로 그대로 공개된다 — 이 파일도 공개되므로 비밀번호·키·내부 주소 등은 적지 않는다.)

## 누구와 일하나
- 신해달 작가(나전칠기 작가, 법학·지식재산권 배경)의 사이트. 요청은 운영을 돕는 사용자가 한국어로 전한다.
- **답은 한국어로, 쉬운 말로.** 개발 용어(파일명·함수명·PR 내부 사정)는 꼭 필요할 때만. 결과 → 이유 → 다음 할 일 순서.
- 관리 화면(어드민)은 별도 저장소 `yoonsunLee/Haedalarchive`(admin.html + 카페24 PHP). 같은 일이 두 저장소에 걸치면 둘 다 고친다.

## 일하는 규칙 (사용자와 합의한 것)
- **PR은 Claude가 직접 만들고 직접 합친다**(squash). 브랜치는 세션이 지정한 브랜치를 쓴다.
- **디자인을 바꾸는 일은 시안 화면(PC·모바일 캡처)을 먼저 보여 주고, 좋다고 할 때만 반영한다.**
  (2026-10 홈 하단을 묻지 않고 바꿨다가 바로 되돌린 일이 있다.)
- 문구·데이터처럼 요청이 분명한 것은 바로 반영하고 화면으로 확인한 뒤 합친다.
- 사용자가 "검토·제안"만 청하면 제안까지만 한다. 고르기를 기다릴 때는 선택지를 짧게, 추천 하나를 분명히.
- 같은 후보를 다시 늘어놓지 않는다(단어·문구 제안 때 특히). 기존 맥락(다른 캐릭터·페이지)을 먼저 보고 제안한다.
- 앱이 띄우는 "추천 다음 질문"은 Claude가 한 말이 아니다 — 사용자가 물으면 그렇게 설명한다.

## 고칠 때 지켜야 할 생성 규칙
- `en/` 은 직접 고치지 않는다. 국문 페이지(와 그 안 `I18N.en`)를 고친 뒤 `python3 scripts/build_en.py` 로 다시 만들어 같이 커밋한다.
  국문 페이지 목록은 build_en.py 의 `PAGES`. 새 페이지를 만들면 `PAGES`, `assets/lang.js` 의 PAGES, sitemap 도 함께.
- `works/w/<id>/` 와 `sitemap.xml` 은 발행 때 `scripts/gen_work_share.py` 가 다시 만든다 → 모양은 `PAGE_TEMPLATE`/`assets/work-page.css` 에서 고친다
  (작품 페이지 HTML을 손으로 고쳤다면 템플릿에도 똑같이). 실행에는 Pillow 필요. sitemap 을 통째로 다시 만들면 lastmod 가 전부 바뀌니 필요한 줄만 고친다.
- `data/*.json` 은 어드민 발행이 덮어쓴다 — 직접 고치지 않는다.
- `<!-- GEN:... -->` 블록은 `scripts/prerender_lists.py` 가 채운다.
- 같은 머리·메뉴·푸터가 국문 페이지 9개 + 작품 페이지 틀(gen_work_share.py) + 404 에 복사돼 있다. 공통 마크업을 바꾸면 전부(스크립트로 일괄) 바꾸고 빠진 곳이 없는지 grep 으로 확인한다.
- IP 페이지(`ip/`)는 `assets/site.css` 를 읽지 않는다. 공통 규칙(푸터 등)은 `ip/ip-story.css` 에도 같이 고친다.

## 디자인 규칙
- 글꼴: Black Han Sans(제목) · Noto Sans KR(본문) · Space Mono(라벨·작은 영문). 새 글꼴(명조 등)·외부 폰트 CDN 쓰지 않는다(글꼴은 직접 올려 씀).
- 화살표: `→` 사이트 안 이동, `↗` 바깥 사이트. 화살표 모양은 `assets/fonts/sh-arrows.woff2`(fonts.css 맨 끝 @font-face)가 선 아이콘으로 바꿔 그린다 — 글자는 그대로 두면 된다.
  (`scripts/make_arrow_font.py` 로 다시 만든다.)
- 링크: `.link-go`(→, 사이트 안, 강조색) / `.link-sub`(↗, 바깥·보조, 밑줄).
  중요한 이동 하나만 테두리 버튼(홈 '만나러 가기' 방식: 올리면 차오르고 화살표 4px) — 홈 하단 두 줄, IP '협업 문의', Contact 보내기. 모든 링크를 버튼으로 만들지 않는다.
- 메뉴: About | CV | Works | IP | Press | Contact | KO/EN | 인스타 | 샵(상점 아이콘, 물결 차양).
- 푸터: 1줄 `© SHIN HAEDAL All rights reserved. | 인스타·샵 아이콘`, 2줄 `처리방침·이용안내 | BACK TO TOP ↑`. 아주 좁은 폰에서만 3줄.
- 움직임은 작가가 고른 시안대로 맞춰져 있다(페이지 디졸브, 들어올 때 올라오기, 작품 창 사진 앱식, IP 벽·숲길·수영·문장 밝아지기 등). 새 움직임도 시안 먼저.
- 영문 표기: 현대사회스포츠센터 = **Hyundae Social Sports Center**(회원카드 그림 속 HYUNDAI 는 그대로 둔다). 얼빵해달은 **it**, 직업은 **Shell Delivery Worker**. 학두루미 = Sky Guard, 솔직사슴 = 나무꾼/Woodcutter.

## 통계(방문 수집)
- `assets/stats.js` — `RULES`(클릭 이름), `ZONES`(페이지별 구역). 새 구역·버튼을 만들면 여기에 더하고,
  어드민 `admin.html` 의 `ST_BTN`/`ST_ZONE` 라벨과 (새 페이지면) 카페24 `hosting/stats/collect.php` 의 페이지 목록도 함께 고친다.
- 방문은 "실제로 본 사람"만 센다(스크롤·머묾 등 참여 조건). 자동화 브라우저(`navigator.webdriver`)는 세지 않으니 테스트할 땐 그 값을 가린다.
- 시험할 때 수집이 안 되는 이유는 보통 셋: localhost 주소, user agent 의 `Headless`, `navigator.webdriver`.
  → 보통 Chrome user agent·`locale:'ko-KR'` 로 열고, `webdriver` 를 가리고, `/assets/stats.js` 를 localhost 검사만 뺀 사본으로 route 해서 보낸 내용을 가로채 본다(`window.__SH_STATS_ENDPOINT` 로 받을 주소 바꿈).
- 구역 이름·클릭 이름은 collect.php 가 형식만 검사한다 — 새 구역을 더해도 카페24 파일은 다시 올릴 필요 없다(새 '페이지'일 때만 필요).
- 같은 사이트 안 링크는 바깥 링크(`out`)로 세지 않는다(`outKind`).

## 확인하는 법
- 로컬: 저장소 루트에서 `python3 -m http.server 8765` → Playwright
  (`import pw from '/opt/node-tools/node_modules/playwright/index.js'`, CommonJS라 default import, Chromium은 미리 설치됨).
  PC 1280~1440, 태블릿 820, 폰 390·375·320 을 본다. 가로 스크롤이 생기지 않는지 확인.
- 별빛 배경은 화면 고정 캔버스라 fullPage 캡처에서는 띠처럼 끊겨 보인다 — 실제 화면 문제 아님.
- 작업 환경에서 shinhaedal.com 에 직접 접속이 막혀 있을 수 있다 → 배포 여부는 GitHub Actions(pages 배포) 기록으로 확인한다.
- 커밋 전: `node --check` 로 바꾼 JS 확인, build_en.py 결과를 함께 커밋.

## 진행 중·보류
- (없음)
