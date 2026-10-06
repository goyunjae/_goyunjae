# Web Tools

GitHub Pages에서 사용하는 웹 도구를 **프로그램 단위 폴더**로 분리한 저장소입니다.

## 실행 주소

- 그래프 생성기: https://goyunjae.github.io/_goyunjae/graph/
- 엑셀 수정기: https://goyunjae.github.io/_goyunjae/excel/
- 프로그램 선택 화면: https://goyunjae.github.io/_goyunjae/

## 저장소 구조

```text
/
├─ index.html                 # 프로그램 선택 화면
├─ graph/                     # 웹 그래프 생성 프로그램
│  ├─ index.html
│  ├─ assets/
│  ├─ legacy/
│  └─ README.md
├─ excel/                     # 간단한 Excel 수정/변환 프로그램
│  ├─ index.html
│  ├─ app.js
│  ├─ styles.css
│  └─ README.md
├─ annualbase-sql/            # 보조 SQL 자료
├─ keyloop/                   # 별도 개발 프로젝트
└─ .github/workflows/         # 배포/빌드 자동화
```

## 관리 원칙

- 사용자 기능은 `graph/`, `excel/`처럼 **프로그램별 폴더**에 둡니다.
- 각 프로그램 폴더 안에 `index.html`을 두어 폴더명이 접속 주소가 되도록 합니다.
- 루트 `index.html`은 프로그램 선택 화면만 담당합니다.
- GitHub Pages는 저장소 전체를 배포하므로 각 프로그램은 독립 URL로 접근할 수 있습니다.
