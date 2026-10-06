# G2 Figure Studio · 그래프 생성기

Excel 파일 또는 직접 입력 데이터를 이용해 **논문·보고서용 피규어**를 생성하는 브라우저 기반 도구입니다.

## 접속 주소

https://goyunjae.github.io/_goyunjae/graph/

## 주요 기능

- `.xlsx`, `.xls`, `.csv` 업로드
- 직접 입력 Grid Data
- 막대, 선, 면적, 산점, 파이, 히트맵, 범위, 트리맵 등 기본 그래프
- 선택 그래프별 Figure editor
- 10종 색상 팔레트와 제목·폰트·범례·라벨·선·마커·그리드 수정
- PNG/JPG/SVG 및 DPI 지정 저장

### 공간 분석

`GEO` 그룹에 다음 기능이 포함됩니다.

1. **관측점 버블 지도**
2. **정점 기준 거리 링**  
   지정한 관측점에서 25 km, 50 km, 100 km처럼 복수 반경을 표시합니다.
3. **거리 등고선 (km)**  
   관측점 좌표를 지역 평면 좌표(km)로 근사 투영한 뒤, 각 격자점에서 가장 가까운 관측점까지의 거리를 계산해 등고선으로 표시합니다.
4. **최근접 관측점 영역**  
   각 위치를 가장 가까운 관측점으로 분류해 Voronoi형 영역을 자동 구분합니다.

관측점 좌표는 Figure editor에서 다음 형식으로 입력합니다.

```text
서울,37.5665,126.9780
부산,35.1796,129.0756
대전,36.3504,127.3845
```

> 거리 등고선은 지역 단위 시각화를 위한 근사 거리장입니다. 정밀 측량·법정 거리 산정에는 GIS의 적절한 투영좌표계와 측지 연산을 사용해야 합니다.

### 통계 분석

`ANALYSIS` 그룹에 다음 기능이 포함됩니다.

- **PCA 점수 · 자동 영역**: 변수별 표준화 후 PCA를 수행하고, PC1-PC2 공간에서 k-means 군집 및 convex hull 영역을 표시합니다.
- **PCA 바이플롯**: 관측치 점수와 변수 loading을 함께 표시합니다.
- **상관행렬**: 변수 간 Pearson 상관계수를 히트맵으로 표시합니다.

PCA에서는 **행(A2 이후)이 관측치**, **열(B1 이후)이 변수**로 해석됩니다.

## UI 구조

```text
graph/
├─ index.html
├─ assets/
│  ├─ css/
│  │  ├─ styles.css
│  │  ├─ design-polish.css
│  │  └─ studio-v2.css
│  └─ js/
│     ├─ core/
│     ├─ charts/
│     │  └─ science-charts.js
│     └─ studio/
│        └─ studio-v2.js
└─ legacy/
```

Studio v2는 기존에 여러 스크립트가 동시에 DOM을 감시하고 패널을 덮어쓰던 구조를 제거하고, 선택된 그래프 하나에 대해서만 편집을 적용하도록 구성합니다.

## 개인정보

Excel 파일과 직접 입력 데이터는 서버로 업로드하지 않고 사용자의 브라우저 안에서 처리합니다.


## 색상 편집

Figure editor에서 논문 피규어용 색상 프리셋을 색상칩으로 선택할 수 있습니다.

- 색각 안전
- 논문 기본
- Muted
- High contrast
- Viridis
- Gray / Blue / Red / Green / Purple scale
- 단색 Black / Navy / Blue / Red / Green

프리셋 적용 후 **Individual colors**에서 범례 또는 항목별 색상칩을 눌러 개별 색을 직접 변경할 수 있습니다. 파이/트리맵/단일 막대처럼 한 trace 안에 여러 항목이 있는 그래프는 항목별 색상 편집을 제공합니다. 히트맵·등고선처럼 연속형 색상 스케일을 사용하는 그래프는 팔레트 세트가 전체 색상 스케일에 적용됩니다.


## Object Manager

Grapher의 Object Manager / Property Manager 흐름을 참고해 그래프 내부 개체를 직접 선택하고 색상을 편집할 수 있습니다.

- 시리즈/레이어를 선택하면 해당 선·마커·채움 기본색을 변경합니다.
- Bar / Waterfall / Funnel은 막대·단계별 색상을 개별 변경할 수 있습니다.
- Scatter / Bubble / Geo marker는 점별 색상을 개별 변경할 수 있습니다.
- Pie / Treemap / Sunburst는 조각·영역별 색상을 개별 변경할 수 있습니다.
- 그래프의 막대/점/조각을 직접 클릭하면 해당 개체가 Objects 목록에서 자동 선택됩니다.
- Objects 목록에서 개체를 선택한 뒤 Color를 눌러 색상을 직접 지정할 수도 있습니다.
- Reset을 누르면 해당 개체의 수동 색상만 해제하고 현재 팔레트 색으로 돌아갑니다.

Heatmap, Contour, Choropleth처럼 연속형 스케일을 사용하는 레이어는 개별 셀 대신 Publication palette로 전체 색상 스케일을 관리합니다.


## Property Manager UI

오른쪽 Figure editor는 Grapher의 Property Manager 방식처럼 접이식 섹션으로 구성됩니다.

- Layout
- Colors
- Objects
- Marks
- GEO · Contour 또는 PCA · Groups

Objects에서 특정 plot 또는 point를 선택하면 내부에 Plot / Symbol / Labels / Line / Fill 속성이 각각 접이식으로 표시됩니다.

## GEO 값 보간 등고선

참고 이미지처럼 불규칙하게 배치된 관측점 값을 기준으로 등고선을 생성할 수 있도록 **IDW(Inverse Distance Weighting)** 기반 값 보간 등고선을 추가했습니다.

조절 가능한 항목:
- contour interval
- contour minimum / maximum
- IDW power
- grid resolution
- outer padding
- contour line color
- line width
- smoothing

Interval이 작을수록 등고선 간격이 촘촘해집니다. IDW power를 높이면 가까운 관측점의 영향이 더 강해집니다.

## PCA 그룹 표시

PCA score plot은 k-means로 그룹을 자동 구분한 뒤 각 그룹을 공분산 기반 파스텔 타원으로 감싸 표시합니다. 그룹 수와 타원 크기(σ)를 Figure editor에서 조절할 수 있습니다.
