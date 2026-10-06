const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf8");

const localScripts = [...indexHtml.matchAll(/<script[^>]+src="\.\/([^"?]+)(?:\?[^"]*)?"/g)]
  .map((match) => path.join(root, match[1]));
const localCss = [...indexHtml.matchAll(/<link[^>]+href="\.\/([^"?]+)(?:\?[^"]*)?"/g)]
  .map((match) => path.join(root, match[1]));

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}

for (const file of [...localScripts, ...localCss]) {
  assert(fs.existsSync(file), `Missing local asset: ${path.relative(root, file)}`);
}

for (const file of localScripts) {
  const code = fs.readFileSync(file, "utf8");
  try {
    new Function(code);
  } catch (error) {
    failures.push(`Syntax error in ${path.relative(root, file)}: ${error.message}`);
  }
}

const obsolete = [
  "auto-refresh.js", "studio-final.js", "studio-hotfix.js", "studio-layout.js",
  "flourish-flow.js", "map-polish.js", "map-color-fix.js", "treemap-fix.js",
  "toss-polish.js", "cleanup-polish.js", "ui-detail-fix.js"
];
for (const name of obsolete) {
  assert(!indexHtml.includes(name), `Legacy UI script is still loaded: ${name}`);
}

function fakeElement() {
  return {
    value: "", disabled: false, textContent: "", innerHTML: "", children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {}, dataset: {},
    addEventListener() {}, removeEventListener() {}, appendChild() {},
    insertAdjacentHTML() {}, insertAdjacentElement() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
  };
}

const documentMock = {
  querySelector() { return fakeElement(); },
  querySelectorAll() { return []; },
  createElement() { return fakeElement(); },
  addEventListener() {},
  dispatchEvent() {},
};

const windowMock = {
  addEventListener() {},
  dispatchEvent() {},
  CustomEvent: function CustomEvent() {},
};

const chartScriptOrder = [
  "assets/js/core/app.js",
  "assets/js/charts/advanced-charts.js",
  "assets/js/charts/polish-charts.js",
  "assets/js/charts/spider-chart.js",
  "assets/js/charts/chart-type-polish.js",
  "assets/js/charts/premium-polish.js",
  "assets/js/charts/science-charts.js",
  "assets/js/charts/precision-map.js",
];

const appCode = fs.readFileSync(path.join(root, chartScriptOrder[0]), "utf8");
new Function("window", "document", "Plotly", "XLSX",
  appCode + "\nwindow.chartSpecs=chartSpecs; window.renderCharts=renderCharts; window.updateSummary=updateSummary;"
)(windowMock, documentMock, {}, {});

for (const relative of chartScriptOrder.slice(1)) {
  const code = fs.readFileSync(path.join(root, relative), "utf8");
  new Function("window", "document", code)(windowMock, documentMock);
}

assert(typeof windowMock.chartSpecs === "function", "chartSpecs registry was not created.");
const specs = windowMock.chartSpecs();
const groups = new Set(specs.map((spec) => spec.group));
assert(specs.length >= 35, `Unexpectedly low chart count: ${specs.length}`);
assert(groups.has("GEO"), "GEO chart group is missing.");
assert(groups.has("ANALYSIS"), "ANALYSIS chart group is missing.");
assert(windowMock.G2PrecisionMap && typeof windowMock.G2PrecisionMap.haversineKm === "function", "Precision Map API missing.");
if (windowMock.G2PrecisionMap) {
  const seoulBusan = windowMock.G2PrecisionMap.haversineKm(37.5665, 126.9780, 35.1796, 129.0756);
  assert(seoulBusan > 300 && seoulBusan < 350, `Unexpected Seoul-Busan geodesic distance: ${seoulBusan}`);

  const strict = windowMock.G2PrecisionMap.resolveStationsStrict({
    labels: ["서울", "UNKNOWN_PLACE"],
    values: [[10, 20]],
  });
  assert(strict.stations.length === 1, "Strict GEO resolver should keep only known coordinates.");
  assert(strict.missing.length === 1 && strict.missing[0] === "UNKNOWN_PLACE", "Strict GEO resolver should report missing coordinates.");

  // User workflow: coordinates refer to row/series names such as A사업/B사업/C사업.
  windowMock.G2ScienceSettings.stationText = [
    "A사업,37.5665,126.978",
    "B사업,35.1796,129.0756",
    "C사업,35.8714,128.6014",
  ].join("\n");
  const rowMatched = windowMock.G2PrecisionMap.resolveStationsStrict({
    labels: ["2024", "2025", "2026"],
    series: ["A사업", "B사업", "C사업"],
    values: [[120,145,170],[90,110,132],[60,72,95]],
  });
  assert(rowMatched.dimension === "series", "GEO should select row/series names when coordinates match rows.");
  assert(rowMatched.stations.length === 3, "GEO row coordinate matching should resolve all three businesses.");
  assert(rowMatched.stations.map((s) => s.name).join(",") === "A사업,B사업,C사업", "GEO row coordinate names mismatch.");
  assert(Math.abs(rowMatched.stations[0].lat - 37.5665) < 1e-9, "A사업 latitude mismatch.");
  assert(rowMatched.stations[0].value === 435, "A사업 value should be the row total.");
}

const cases = [
  {
    name: "normal",
    data: {
      sheetName: "test", title: "Normal",
      labels: ["서울", "부산", "대전", "광주"],
      series: ["A", "B", "C", "D", "E"],
      values: [[10,20,15,18],[12,19,17,21],[20,10,22,12],[18,12,19,14],[30,25,28,27]],
    },
  },
  {
    name: "small",
    data: { sheetName: "small", title: "Small", labels: ["2025", "2026"], series: ["A", "B"], values: [[10,12],[8,15]] },
  },
  {
    name: "negative",
    data: { sheetName: "negative", title: "Negative", labels: ["Q1","Q2","Q3","Q4"], series: ["A","B","C"], values: [[10,-5,8,-2],[-4,12,-6,14],[3,5,7,9]] },
  },
  {
    name: "long-labels",
    data: {
      sheetName: "long", title: "Long labels",
      labels: Array.from({ length: 14 }, (_, i) => `Category ${i + 1} long label`),
      series: ["Alpha","Beta","Gamma","Delta"],
      values: Array.from({ length: 4 }, (_, r) => Array.from({ length: 14 }, (_, c) => (r + 1) * (c + 2) + ((c % 3) - 1) * 4)),
    },
  },
  {
    name: "constant",
    data: { sheetName: "constant", title: "Constant", labels: ["V1","V2","V3"], series: ["S1","S2","S3","S4"], values: [[5,5,5],[5,5,5],[5,5,5],[5,5,5]] },
  },
];

for (const testCase of cases) {
  for (const spec of specs) {
    try {
      const chart = spec.build(testCase.data);
      assert(chart && Array.isArray(chart.traces) && chart.layout, `${testCase.name}: invalid chart object for ${spec.group}/${spec.label}`);
      const serialized = JSON.stringify(chart);
      assert(!serialized.includes('"NaN"'), `${testCase.name}: NaN label in ${spec.group}/${spec.label}`);
      assert(!serialized.includes('"Infinity"') && !serialized.includes('"-Infinity"'), `${testCase.name}: infinite label in ${spec.group}/${spec.label}`);
    } catch (error) {
      failures.push(`${testCase.name}: ${spec.group}/${spec.label} threw ${error.message}`);
    }
  }
}

assert(windowMock.G2Science && typeof windowMock.G2Science.pca === "function", "G2Science API missing.");
if (windowMock.G2Science) {
  const sample = cases[0].data;
  const pca = windowMock.G2Science.pca(sample.values, sample.series, sample.labels);
  assert(pca.scores.length === sample.series.length, "PCA score row count mismatch.");
  assert(pca.scores.flat().every(Number.isFinite), "PCA contains non-finite scores.");
  assert(pca.loadings.flat().every(Number.isFinite), "PCA contains non-finite loadings.");
  assert(pca.explained.every((value) => Number.isFinite(value) && value >= 0), "PCA explained variance is invalid.");

  const stations = windowMock.G2Science.resolveStations(sample);
  const projected = windowMock.G2Science.projectStations(stations);
  const field = windowMock.G2Science.distanceField(projected, 24, 10);
  assert(field.z.length === 24 && field.z.every((row) => row.length === 24), "Distance contour grid dimensions are invalid.");
  assert(field.z.flat().every(Number.isFinite), "Distance contour contains non-finite values.");
}

if (failures.length) {
  console.error("\nGraph smoke test FAILED");
  failures.forEach((message) => console.error("- " + message));
  process.exit(1);
}

console.log("Graph smoke test passed.");
console.log(`Validated ${specs.length} chart specifications across ${cases.length} datasets.`);
console.log("Groups:", [...groups].join(", "));
