# shinhaedal.art — 홈페이지

신해달 작가 공식 홈페이지 (정적 사이트, GitHub Pages).

## 구조
```
index.html            홈 (히어로 + Recent works — 아카이브 실시간 연동)
haedal/               얼빵해달 IP 세계관 페이지 (KO/EN)
haedal/assets/        Haedal 페이지 디자인 에셋
.github/workflows/    주 1회 데이터 동기화 로봇
scripts/              동기화 스크립트 (공개 필드 화이트리스트)
templates/            전시 시트 스키마 참고
```

## 최초 배포 (10분)
1. GitHub에서 새 repo 생성 (예: `shinhaedal-site`, Public)
2. 이 폴더 내용 전체 업로드 (Add file → Upload files, 폴더째 드래그)
3. Settings → Pages → Branch: `main`, 폴더: `/ (root)` → Save
4. 1~2분 후 `https://<계정명>.github.io/<repo명>/` 접속 확인

## 동기화 로봇 활성화 (선택, 5분)
지금 홈은 아카이브 API를 실시간으로 읽으므로 없어도 작동함.
Now 섹션(전시 모드) 구현 시 필요.
1. repo Settings → Secrets and variables → Actions → New repository secret
   - Name: `ARCHIVE_API_URL` / Value: 아카이브 Apps Script /exec URL
2. Actions 탭 → "Sync archive data" → Run workflow (첫 수동 실행)

## 아직 없는 것 (예정)
- Works 전체 페이지 (현재 메뉴의 Works는 홈 그리드로 이동)
- Press / About 페이지 (메뉴에 회색 "준비 중" 표시)
- Now 섹션 전시 모드 전환
- 커스텀 도메인 (shinhaedal.art — 구매 후 Settings → Pages → Custom domain)

## 원칙
- 작품·전시 데이터: 해달아카이브에서만 관리 (이 repo에서 수정 금지)
- 디자인 에셋: 이 repo에서 관리
- 민감정보(실거래가·소장자 등)는 API 단계에서 차단됨
