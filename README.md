# 연차평가 보고서 그래프 생성기

엑셀 파일을 브라우저에서 읽거나 표에 직접 입력한 데이터로 보고서용 그래프를 생성하는 정적 웹앱입니다.
사용자 PC에 Python을 설치하지 않아도 GitHub Pages URL에서 바로 사용할 수 있습니다.

## 저장소 구조

```text
/
├─ index.html                 # GitHub Pages 진입점
├─ assets/
│  ├─ css/                    # 웹앱 스타일
│  └─ js/
│     ├─ core/                # 핵심 실행·입력 로직
│     ├─ charts/              # 그래프 생성·보정 로직
│     └─ studio/              # UI/Studio 보정 로직
├─ annualbase-sql/            # 연차평가 SQL 스키마 프로젝트
├─ excel-asset-converter/     # 물품취득원장 웹 변환 프로젝트
├─ keyloop/                   # KeyLoop 프로젝트
├─ legacy/
│  └─ python/Graph_2.py       # 기존 Python 그래프 생성기 보관본
└─ .github/workflows/         # Pages 및 빌드 자동화
```

## 사용 방법

1. 홈페이지에 접속합니다.
2. 직접 입력 표에 데이터를 넣거나 `.xlsx`, `.xls`, `.csv` 파일을 업로드합니다.
3. 데이터 출처, 시트, 그래프 종류를 선택합니다.
4. `그래프 생성`을 누릅니다.
5. 필요한 그래프만 체크해서 선택합니다.
6. JPG, PNG, SVG 중 원하는 형식과 출력 DPI를 입력해서 저장합니다.

직접 입력 표는 A1을 제목, B1 이후를 라벨, A2 이후를 항목명, 나머지 칸을 값으로 인식합니다.

## 배포

`.github/workflows/deploy-pages.yml`가 GitHub Pages 배포를 자동으로 수행합니다.
저장소의 **Settings > Pages**에서 Source가 **GitHub Actions**로 설정되어 있어야 합니다.

## 정리 원칙

- 루트에는 진입점과 프로젝트 폴더만 둡니다.
- 웹앱의 실행 파일은 `assets/` 아래에서 역할별로 관리합니다.
- 현재 배포에서 사용하지 않는 과거 Python 구현은 `legacy/`에 보관합니다.
- 기능 변경 없이 파일 위치만 정리하고, HTML 및 동적 로더 경로를 함께 갱신합니다.

## 개인정보

엑셀 파일과 직접 입력 데이터는 서버로 업로드하지 않고 사용자의 브라우저 안에서만 처리합니다.
