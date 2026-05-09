# 연차평가 보고서 그래프 생성기

엑셀 파일을 브라우저에서 읽어 보고서용 그래프를 생성하는 정적 웹앱입니다.
사용자 PC에 Python을 설치하지 않아도 GitHub Pages URL에서 바로 사용할 수 있습니다.

## 사용 방법

1. 홈페이지에 접속합니다.
2. `.xlsx`, `.xls`, `.csv` 파일을 업로드합니다.
3. 시트와 그래프 종류를 선택합니다.
4. 필요한 그래프만 체크해서 선택합니다.
5. JPG, PNG, SVG 중 원하는 형식과 출력 DPI를 입력해서 저장합니다.

## 배포

`.github/workflows/deploy-pages.yml`가 GitHub Pages 배포를 자동으로 수행합니다.
저장소의 Settings > Pages에서 Source가 GitHub Actions로 설정되어 있어야 합니다.

## 개인정보

엑셀 파일은 서버로 업로드하지 않고 사용자의 브라우저 안에서만 처리합니다.
