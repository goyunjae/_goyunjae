# AnnualBase SQL Reference

연차평가 자료를 관리하기 위한 개인용 SQL 데이터 모델 문서입니다.

이 저장소에는 원본 보고서, 증빙자료, 실제 DB 파일을 포함하지 않습니다.  
공유 대상은 테이블 구조와 조회 예시뿐입니다.

## 포함 범위

- Access/SQL 기반 테이블 구조
- 보고서, 목차, 내용, 성과지표, 예산, 증빙의 관계 설명
- 조회용 SQL 예시
- AnnualBase 로컬 사용 흐름

## 제외 범위

- `annual_eval.accdb`
- 연도별 원본 자료
- HWPX/PDF/Excel 증빙 파일
- 보고서 본문 전문
- 개인정보 또는 내부 평가자료

## 기본 흐름

1. 자료 파일은 로컬 PC의 연도별 폴더에 보관합니다.
2. AnnualBase가 로컬 DB에 파일 위치와 목차 정보를 등록합니다.
3. GitHub에는 DB 구조와 조회 SQL만 공유합니다.

## 주요 테이블

| Table | Purpose |
| --- | --- |
| `institutions` | 기관/대학 정보 |
| `annual_reports` | 연도별 평가 보고서 |
| `report_files` | 로컬 파일 위치 색인 |
| `report_sections` | 보고서 목차 구조 |
| `content_items` | 본문 요약 및 핵심 내용 |
| `performance_indicators` | 성과지표 수치 |
| `budget_items` | 예산 및 집행 실적 |
| `evidence_files` | 증빙 파일 색인 |
| `content_evidence_links` | 내용과 증빙의 연결 |
| `import_logs` | 자동 스캔/가져오기 기록 |

## SQL 보기

- [schema.sql](schema.sql): 테이블 구조
- [queries.sql](queries.sql): 자주 쓰는 조회 쿼리
- [docs/data-model.md](docs/data-model.md): 테이블 관계 설명
