(function () {
  'use strict';

  if (typeof window.chartSpecs !== 'function') return;

  const previousSpecs = window.chartSpecs;
  const COLORS = [
    '#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#F0E442', '#000000',
    '#7C3AED', '#0F766E', '#BE123C', '#475569'
  ];
  const DEFAULT_STATIONS = [
    ['서울', 37.5665, 126.9780], ['부산', 35.1796, 129.0756], ['대구', 35.8714, 128.6014],
    ['인천', 37.4563, 126.7052], ['광주', 35.1595, 126.8526], ['대전', 36.3504, 127.3845],
    ['울산', 35.5384, 129.3114], ['세종', 36.4800, 127.2890], ['전북', 35.7175, 127.1530],
    ['전남', 34.8679, 126.9910], ['충북', 36.8000, 127.7000], ['충남', 36.5184, 126.8000],
    ['경북', 36.4919, 128.8889], ['경남', 35.4606, 128.2132], ['강원', 37.8228, 128.1555],
    ['제주', 33.4996, 126.5312]
  ];
  const COORDS = new Map();
  DEFAULT_STATIONS.forEach(([name, lat, lon]) => COORDS.set(normalize(name), { name, lat, lon }));
  [['seoul',37.5665,126.9780],['busan',35.1796,129.0756],['daegu',35.8714,128.6014],['incheon',37.4563,126.7052],['gwangju',35.1595,126.8526],['daejeon',36.3504,127.3845],['ulsan',35.5384,129.3114],['jeju',33.4996,126.5312]].forEach(([name,lat,lon]) => COORDS.set(name,{name,lat,lon}));

  window.G2ScienceSettings = window.G2ScienceSettings || {
    stationText: DEFAULT_STATIONS.slice(0, 8).map(([n, lat, lon]) => `${n},${lat},${lon}`).join('\n'),
    ringDistances: [25, 50, 100],
    contourInterval: 25,
    regionCount: 3,
  };

  window.chartSpecs = function scienceChartSpecs() {
    const base = previousSpecs().filter((item) => item.group !== 'GEO' && item.group !== 'ANALYSIS');
    return [
      ...base,
      spec('GEO', 1, '관측점 버블 지도', geoBubbleMap),
      spec('GEO', 2, '정점 기준 거리 링', geoDistanceRings),
      spec('GEO', 3, '거리 등고선 (km)', distanceContour),
      spec('GEO', 4, '최근접 관측점 영역', nearestStationRegions),
      spec('ANALYSIS', 1, 'PCA 점수 · 자동 영역', pcaClusterPlot),
      spec('ANALYSIS', 2, 'PCA 바이플롯', pcaBiplot),
      spec('ANALYSIS', 3, '상관행렬', correlationHeatmap),
    ];
  };

  window.G2Science = {
    pca,
    kmeans,
    convexHull,
    projectStations,
    distanceField,
    resolveStations,
  };

  function spec(group, number, label, build) { return { group, number, label, build }; }

  function geoBubbleMap(data) {
    const stations = resolveStations(data);
    const values = labelTotals(data);
    const maxValue = Math.max(...values, 1);
    const range = geoRange(stations);
    return {
      traces: [{
        type: 'scattergeo', mode: 'markers+text',
        lon: stations.map((s) => s.lon), lat: stations.map((s) => s.lat),
        text: stations.map((s, i) => s.name), textposition: 'top center',
        customdata: values,
        marker: {
          size: values.map((v) => 10 + 26 * Math.sqrt(Math.max(v, 0) / maxValue)),
          color: values,
          colorscale: [[0, '#DCEAF7'], [0.45, '#56B4E9'], [1, '#005B96']],
          showscale: true,
          colorbar: { title: { text: '값' }, thickness: 12, len: 0.65 },
          opacity: 0.88,
          line: { color: '#ffffff', width: 1.2 },
        },
        hovertemplate: '<b>%{text}</b><br>값 %{customdata:,.2f}<br>%{lat:.4f}, %{lon:.4f}<extra></extra>',
      }],
      layout: geoLayout(range),
    };
  }

  function geoDistanceRings(data) {
    const stations = resolveStations(data);
    const settings = window.G2ScienceSettings || {};
    const rings = sanitizePositiveList(settings.ringDistances, [25, 50, 100]);
    const traces = [];
    stations.forEach((station, stationIndex) => {
      rings.forEach((km, ringIndex) => {
        const circle = geodesicCircle(station.lat, station.lon, km, 96);
        traces.push({
          type: 'scattergeo', mode: 'lines',
          lon: circle.map((p) => p.lon), lat: circle.map((p) => p.lat),
          name: `${station.name} ${km} km`, showlegend: stationIndex === 0,
          legendgroup: `ring-${ringIndex}`,
          line: { color: rgba(COLORS[ringIndex % COLORS.length], 0.72), width: ringIndex === rings.length - 1 ? 1.8 : 1.1, dash: ringIndex % 2 ? 'dot' : 'solid' },
          hoverinfo: 'skip',
        });
      });
    });
    traces.push({
      type: 'scattergeo', mode: 'markers+text',
      lon: stations.map((s) => s.lon), lat: stations.map((s) => s.lat), text: stations.map((s) => s.name),
      textposition: 'top center', name: '관측점',
      marker: { size: 9, color: '#111827', line: { color: '#fff', width: 1.3 } },
      hovertemplate: '<b>%{text}</b><br>%{lat:.4f}, %{lon:.4f}<extra></extra>',
    });
    const range = geoRange(stations, Math.max(...rings));
    const layout = geoLayout(range);
    layout.legend = { orientation: 'h', x: 0, y: -0.08, font: { size: 10 } };
    return { traces, layout };
  }

  function distanceContour(data) {
    const stations = resolveStations(data);
    const projected = projectStations(stations);
    const settings = window.G2ScienceSettings || {};
    const step = clampNumber(settings.contourInterval, 25, 1, 10000);
    const field = distanceField(projected, 76, step * 2);
    const maxDistance = Math.max(...field.z.flat());
    const contourEnd = Math.max(step * 2, Math.ceil(maxDistance / step) * step);
    return {
      traces: [
        {
          type: 'contour', x: field.x, y: field.y, z: field.z,
          autocontour: false,
          contours: { start: step, end: contourEnd, size: step, coloring: 'lines', showlabels: true, labelfont: { size: 10, color: '#334155' } },
          line: { width: 1.4, smoothing: 0.7 },
          colorscale: [[0, '#DCEAF7'], [0.5, '#4C78A8'], [1, '#7A3E9D']],
          showscale: false,
          hovertemplate: '최근접 거리 %{z:.1f} km<extra></extra>',
        },
        {
          type: 'scatter', mode: 'markers+text', x: projected.points.map((p) => p.x), y: projected.points.map((p) => p.y),
          text: projected.points.map((p) => p.name), textposition: 'top center',
          marker: { size: 9, color: '#111827', line: { color: '#fff', width: 1.2 } },
          name: '관측점', hovertemplate: '<b>%{text}</b><br>x %{x:.1f} km<br>y %{y:.1f} km<extra></extra>',
        }
      ],
      layout: {
        xaxis: { title: '동서 거리 (km)', zeroline: false, scaleanchor: 'y', scaleratio: 1 },
        yaxis: { title: '남북 거리 (km)', zeroline: false },
        showlegend: false,
        annotations: [{ xref: 'paper', yref: 'paper', x: 1, y: -0.14, xanchor: 'right', showarrow: false, text: `등고 간격 ${step} km · 최근접 정점 거리장`, font: { size: 10, color: '#64748B' } }],
      }
    };
  }

  function nearestStationRegions(data) {
    const stations = resolveStations(data);
    const projected = projectStations(stations);
    const field = nearestRegionField(projected, 84, 20);
    const colorscale = discreteColorscale(projected.points.length);
    return {
      traces: [
        {
          type: 'heatmap', x: field.x, y: field.y, z: field.region,
          colorscale, showscale: false, opacity: 0.30, hoverinfo: 'skip', zsmooth: false,
        },
        {
          type: 'scatter', mode: 'markers+text', x: projected.points.map((p) => p.x), y: projected.points.map((p) => p.y),
          text: projected.points.map((p) => p.name), textposition: 'top center',
          marker: { size: 10, color: projected.points.map((_, i) => COLORS[i % COLORS.length]), line: { color: '#fff', width: 1.2 } },
          hovertemplate: '<b>%{text}</b><extra></extra>', name: '관측점'
        }
      ],
      layout: {
        xaxis: { title: '동서 거리 (km)', zeroline: false, scaleanchor: 'y', scaleratio: 1 },
        yaxis: { title: '남북 거리 (km)', zeroline: false },
        showlegend: false,
        annotations: [{ xref: 'paper', yref: 'paper', x: 1, y: -0.14, xanchor: 'right', showarrow: false, text: '최근접 관측점 기준 자동 영역 (Voronoi형)', font: { size: 10, color: '#64748B' } }],
      }
    };
  }

  function pcaClusterPlot(data) {
    const result = pca(data.values, data.series, data.labels);
    if (result.scores.length < 2) return noDataChart('PCA에는 최소 2개 관측치가 필요합니다.');
    const requested = clampNumber(window.G2ScienceSettings?.regionCount, 3, 2, 6);
    const k = Math.min(requested, result.scores.length);
    const cluster = kmeans(result.scores, k);
    const traces = [];
    for (let c = 0; c < k; c += 1) {
      const points = result.scores.map((p, i) => ({ x: p[0], y: p[1], i })).filter((_, idx) => cluster.labels[idx] === c);
      if (points.length >= 3) {
        const hull = convexHull(points);
        traces.push({
          type: 'scatter', mode: 'lines', x: [...hull.map((p) => p.x), hull[0].x], y: [...hull.map((p) => p.y), hull[0].y],
          fill: 'toself', fillcolor: rgba(COLORS[c], 0.12), line: { color: rgba(COLORS[c], 0.55), width: 1.2 },
          hoverinfo: 'skip', showlegend: false,
        });
      }
      const ids = result.scores.map((_, i) => i).filter((i) => cluster.labels[i] === c);
      traces.push({
        type: 'scatter', mode: 'markers+text', name: `영역 ${c + 1}`,
        x: ids.map((i) => result.scores[i][0]), y: ids.map((i) => result.scores[i][1]), text: ids.map((i) => result.names[i]),
        textposition: 'top center', marker: { size: 10, color: COLORS[c], line: { color: '#fff', width: 1.2 } },
        customdata: ids.map((i) => result.names[i]), hovertemplate: '<b>%{customdata}</b><br>PC1 %{x:.3f}<br>PC2 %{y:.3f}<extra></extra>',
      });
    }
    return {
      traces,
      layout: {
        xaxis: { title: `PC1 (${pct(result.explained[0])})`, zeroline: true, zerolinecolor: '#94A3B8', zerolinewidth: 1 },
        yaxis: { title: `PC2 (${pct(result.explained[1])})`, zeroline: true, zerolinecolor: '#94A3B8', zerolinewidth: 1 },
        legend: { orientation: 'h', y: -0.18 },
        annotations: [{ xref: 'paper', yref: 'paper', x: 1, y: 1.06, xanchor: 'right', showarrow: false, text: `표준화 PCA · k-means ${k}개 영역`, font: { size: 10, color: '#64748B' } }],
      }
    };
  }

  function pcaBiplot(data) {
    const result = pca(data.values, data.series, data.labels);
    if (result.scores.length < 2) return noDataChart('PCA에는 최소 2개 관측치가 필요합니다.');
    const maxScore = Math.max(1e-9, ...result.scores.flat().map((v) => Math.abs(v)));
    const maxLoading = Math.max(1e-9, ...result.loadings.flat().map((v) => Math.abs(v)));
    const scale = maxScore / maxLoading * 0.72;
    const shapes = [];
    const annotations = [];
    result.featureNames.forEach((name, i) => {
      const x = result.loadings[i][0] * scale;
      const y = result.loadings[i][1] * scale;
      shapes.push({ type: 'line', x0: 0, y0: 0, x1: x, y1: y, line: { color: '#D55E00', width: 1.5 } });
      annotations.push({ x, y, text: name, showarrow: true, ax: -x * 7, ay: y * 7, arrowcolor: '#D55E00', arrowwidth: 1, font: { size: 10, color: '#9A3412' } });
    });
    return {
      traces: [{
        type: 'scatter', mode: 'markers+text', x: result.scores.map((p) => p[0]), y: result.scores.map((p) => p[1]),
        text: result.names, textposition: 'top center',
        marker: { size: 10, color: '#0072B2', line: { color: '#fff', width: 1.2 } },
        hovertemplate: '<b>%{text}</b><br>PC1 %{x:.3f}<br>PC2 %{y:.3f}<extra></extra>', name: '관측치'
      }],
      layout: {
        xaxis: { title: `PC1 (${pct(result.explained[0])})`, zeroline: true, zerolinecolor: '#94A3B8' },
        yaxis: { title: `PC2 (${pct(result.explained[1])})`, zeroline: true, zerolinecolor: '#94A3B8' },
        shapes, annotations, showlegend: false,
      }
    };
  }

  function correlationHeatmap(data) {
    const matrix = transpose(data.values);
    const features = data.labels.slice();
    const corr = features.map((_, i) => features.map((__, j) => pearson(matrix[i], matrix[j])));
    return {
      traces: [{
        type: 'heatmap', x: features, y: features, z: corr, zmin: -1, zmax: 1, zmid: 0,
        colorscale: [[0, '#2166AC'], [0.5, '#F7F7F7'], [1, '#B2182B']],
        text: corr.map((row) => row.map((v) => v.toFixed(2))), texttemplate: '%{text}', textfont: { size: 10 },
        colorbar: { title: { text: 'r' }, thickness: 12 }, hovertemplate: '%{y} × %{x}<br>r = %{z:.3f}<extra></extra>'
      }],
      layout: { xaxis: { tickangle: -35 }, yaxis: { autorange: 'reversed' }, margin: { l: 92, b: 92 } }
    };
  }

  function noDataChart(message) {
    return { traces: [], layout: { annotations: [{ x: 0.5, y: 0.5, xref: 'paper', yref: 'paper', text: message, showarrow: false, font: { size: 13, color: '#64748B' } }] } };
  }

  function pca(values, names, featureNames) {
    const matrix = values.map((row) => row.map((v) => Number(v) || 0));
    if (!matrix.length || !matrix[0]?.length) return { scores: [], loadings: [], explained: [0, 0], names: [], featureNames: [] };
    const standardized = standardize(matrix);
    const covariance = covarianceMatrix(standardized);
    const totalVar = covariance.reduce((sum, row, i) => sum + row[i], 0) || 1;
    const e1 = powerEigen(covariance, null);
    const deflated = deflate(covariance, e1.vector, e1.value);
    const e2 = powerEigen(deflated, e1.vector);
    const scores = standardized.map((row) => [dot(row, e1.vector), dot(row, e2.vector)]);
    const loadings = featureNames.map((_, i) => [e1.vector[i] * Math.sqrt(Math.max(e1.value, 0)), e2.vector[i] * Math.sqrt(Math.max(e2.value, 0))]);
    return {
      scores, loadings, explained: [Math.max(e1.value, 0) / totalVar, Math.max(e2.value, 0) / totalVar],
      names: names.slice(), featureNames: featureNames.slice(),
    };
  }

  function standardize(matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    const means = Array(cols).fill(0);
    const sds = Array(cols).fill(0);
    for (let j = 0; j < cols; j += 1) {
      means[j] = matrix.reduce((s, row) => s + row[j], 0) / rows;
      const denom = Math.max(rows - 1, 1);
      sds[j] = Math.sqrt(matrix.reduce((s, row) => s + (row[j] - means[j]) ** 2, 0) / denom) || 1;
    }
    return matrix.map((row) => row.map((v, j) => (v - means[j]) / sds[j]));
  }

  function covarianceMatrix(matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    const denom = Math.max(rows - 1, 1);
    return Array.from({ length: cols }, (_, i) => Array.from({ length: cols }, (_, j) => matrix.reduce((s, row) => s + row[i] * row[j], 0) / denom));
  }

  function powerEigen(matrix, orthogonalTo) {
    const n = matrix.length;
    let v = Array.from({ length: n }, (_, i) => Math.sin((i + 1) * 1.618) + 0.5);
    v = orthogonalize(normalizeVec(v), orthogonalTo);
    for (let iter = 0; iter < 160; iter += 1) {
      let next = matVec(matrix, v);
      next = orthogonalize(next, orthogonalTo);
      const norm = Math.sqrt(dot(next, next));
      if (norm < 1e-12) break;
      next = next.map((x) => x / norm);
      const delta = Math.sqrt(next.reduce((s, x, i) => s + (x - v[i]) ** 2, 0));
      v = next;
      if (delta < 1e-10) break;
    }
    const mv = matVec(matrix, v);
    return { vector: v, value: dot(v, mv) };
  }

  function orthogonalize(v, against) {
    if (!against) return normalizeVec(v);
    const projection = dot(v, against);
    return normalizeVec(v.map((x, i) => x - projection * against[i]));
  }
  function normalizeVec(v) { const n = Math.sqrt(dot(v, v)) || 1; return v.map((x) => x / n); }
  function deflate(matrix, vector, value) { return matrix.map((row, i) => row.map((x, j) => x - value * vector[i] * vector[j])); }
  function matVec(matrix, vector) { return matrix.map((row) => dot(row, vector)); }
  function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }

  function kmeans(points, k) {
    if (!points.length) return { labels: [], centers: [] };
    const centers = deterministicSeeds(points, k).map((p) => p.slice());
    let labels = Array(points.length).fill(0);
    for (let iter = 0; iter < 60; iter += 1) {
      const nextLabels = points.map((p) => nearestCenter(p, centers));
      const changed = nextLabels.some((v, i) => v !== labels[i]);
      labels = nextLabels;
      const sums = Array.from({ length: k }, () => [0, 0, 0]);
      points.forEach((p, i) => { const c = labels[i]; sums[c][0] += p[0]; sums[c][1] += p[1]; sums[c][2] += 1; });
      sums.forEach((s, c) => { if (s[2]) centers[c] = [s[0] / s[2], s[1] / s[2]]; });
      if (!changed && iter > 0) break;
    }
    return { labels, centers };
  }

  function deterministicSeeds(points, k) {
    const seeds = [points.reduce((best, p) => (p[0] < best[0] ? p : best), points[0])];
    while (seeds.length < k) {
      let candidate = points[0], bestDistance = -1;
      points.forEach((p) => {
        const d = Math.min(...seeds.map((s) => squaredDistance(p, s)));
        if (d > bestDistance) { bestDistance = d; candidate = p; }
      });
      seeds.push(candidate);
    }
    return seeds;
  }
  function nearestCenter(p, centers) { let best = 0, d0 = Infinity; centers.forEach((c, i) => { const d = squaredDistance(p, c); if (d < d0) { d0 = d; best = i; } }); return best; }
  function squaredDistance(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }

  function convexHull(points) {
    if (points.length <= 2) return points.slice();
    const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    sorted.forEach((p) => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); });
    const upper = [];
    [...sorted].reverse().forEach((p) => { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); });
    lower.pop(); upper.pop(); return lower.concat(upper);
  }

  function resolveStations(data) {
    const settings = window.G2ScienceSettings || {};
    const custom = parseStationText(settings.stationText || '');
    const labels = data.labels || [];
    return labels.map((name, index) => {
      const key = normalize(name);
      const found = custom.get(key) || COORDS.get(key);
      if (found) return { name: String(name), lat: found.lat, lon: found.lon };
      const angle = index * 2.399963;
      const radius = 0.75 + 0.35 * Math.sqrt(index + 1);
      return { name: String(name), lat: 36.2 + Math.sin(angle) * radius, lon: 127.7 + Math.cos(angle) * radius * 1.3 };
    });
  }

  function parseStationText(text) {
    const map = new Map();
    String(text).split(/\r?\n/).forEach((line) => {
      const [name, latText, lonText] = line.split(',').map((v) => v?.trim());
      const lat = Number(latText), lon = Number(lonText);
      if (name && Number.isFinite(lat) && Number.isFinite(lon)) map.set(normalize(name), { name, lat, lon });
    });
    return map;
  }

  function projectStations(stations) {
    const lat0 = stations.reduce((s, p) => s + p.lat, 0) / Math.max(stations.length, 1);
    const lon0 = stations.reduce((s, p) => s + p.lon, 0) / Math.max(stations.length, 1);
    const kmLat = 110.574;
    const kmLon = 111.320 * Math.cos(lat0 * Math.PI / 180);
    const points = stations.map((p) => ({ ...p, x: (p.lon - lon0) * kmLon, y: (p.lat - lat0) * kmLat }));
    return { lat0, lon0, kmLat, kmLon, points };
  }

  function distanceField(projected, resolution = 72, padding = 20) {
    const bounds = projectedBounds(projected.points, padding);
    const x = linspace(bounds.minX, bounds.maxX, resolution);
    const y = linspace(bounds.minY, bounds.maxY, resolution);
    const z = y.map((yy) => x.map((xx) => Math.min(...projected.points.map((p) => Math.hypot(xx - p.x, yy - p.y)))));
    return { x, y, z };
  }

  function nearestRegionField(projected, resolution = 80, padding = 20) {
    const bounds = projectedBounds(projected.points, padding);
    const x = linspace(bounds.minX, bounds.maxX, resolution);
    const y = linspace(bounds.minY, bounds.maxY, resolution);
    const region = y.map((yy) => x.map((xx) => {
      let best = 0, bestD = Infinity;
      projected.points.forEach((p, i) => { const d = (xx - p.x) ** 2 + (yy - p.y) ** 2; if (d < bestD) { bestD = d; best = i; } });
      return best;
    }));
    return { x, y, region };
  }

  function projectedBounds(points, padding) {
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.max(maxX - minX, 1), height = Math.max(maxY - minY, 1);
    const pad = Math.max(padding, Math.max(width, height) * 0.12);
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
  }

  function geodesicCircle(lat, lon, radiusKm, segments) {
    const R = 6371.0088, phi1 = lat * Math.PI / 180, lambda1 = lon * Math.PI / 180, delta = radiusKm / R;
    return Array.from({ length: segments + 1 }, (_, i) => {
      const theta = 2 * Math.PI * i / segments;
      const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
      const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
      return { lat: phi2 * 180 / Math.PI, lon: ((lambda2 * 180 / Math.PI + 540) % 360) - 180 };
    });
  }

  function geoRange(stations, extraKm = 0) {
    const lats = stations.map((p) => p.lat), lons = stations.map((p) => p.lon);
    const meanLat = lats.reduce((a,b)=>a+b,0)/Math.max(lats.length,1);
    const latPad = Math.max(0.7, extraKm / 110.574, (Math.max(...lats)-Math.min(...lats))*0.18);
    const lonPad = Math.max(0.9, extraKm / Math.max(111.32*Math.cos(meanLat*Math.PI/180),20), (Math.max(...lons)-Math.min(...lons))*0.18);
    return { lat: [Math.min(...lats)-latPad, Math.max(...lats)+latPad], lon: [Math.min(...lons)-lonPad, Math.max(...lons)+lonPad] };
  }

  function geoLayout(range) {
    return {
      geo: {
        projection: { type: 'mercator' },
        showframe: false, showcoastlines: true, coastlinecolor: '#94A3B8', coastlinewidth: 0.8,
        showcountries: true, countrycolor: '#CBD5E1', countrywidth: 0.7,
        showland: true, landcolor: '#F8FAFC', showocean: true, oceancolor: '#EFF6FF',
        showlakes: true, lakecolor: '#EFF6FF', bgcolor: '#FFFFFF',
        lataxis: { range: range.lat, showgrid: true, gridcolor: '#E2E8F0', dtick: 1 },
        lonaxis: { range: range.lon, showgrid: true, gridcolor: '#E2E8F0', dtick: 1 },
      },
      margin: { l: 28, r: 28, t: 64, b: 52 },
    };
  }

  function labelTotals(data) { return data.labels.map((_, i) => data.values.reduce((s, row) => s + (Number(row[i]) || 0), 0)); }
  function normalize(value) { return String(value || '').trim().toLowerCase(); }
  function linspace(a, b, n) { if (n <= 1) return [a]; const step = (b - a) / (n - 1); return Array.from({ length: n }, (_, i) => a + step * i); }
  function transpose(matrix) { return matrix[0].map((_, i) => matrix.map((row) => Number(row[i]) || 0)); }
  function pearson(a, b) {
    const n = Math.min(a.length, b.length); if (n < 2) return 0;
    const ma = a.slice(0,n).reduce((s,v)=>s+v,0)/n, mb = b.slice(0,n).reduce((s,v)=>s+v,0)/n;
    let num=0, da=0, db=0;
    for(let i=0;i<n;i+=1){ const xa=a[i]-ma, xb=b[i]-mb; num+=xa*xb; da+=xa*xa; db+=xb*xb; }
    return da && db ? num/Math.sqrt(da*db) : 0;
  }
  function pct(v) { return `${(100 * (Number(v) || 0)).toFixed(1)}%`; }
  function clampNumber(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
  function sanitizePositiveList(values, fallback) {
    const parsed = (Array.isArray(values) ? values : String(values || '').split(/[;,\s]+/)).map(Number).filter((v) => Number.isFinite(v) && v > 0).sort((a,b)=>a-b);
    return parsed.length ? parsed : fallback.slice();
  }
  function rgba(hex, alpha) {
    const h = String(hex).replace('#',''); const value = h.length === 3 ? h.split('').map((x)=>x+x).join('') : h;
    const n = parseInt(value,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
  }
  function discreteColorscale(n) {
    if (n <= 1) return [[0, COLORS[0]], [1, COLORS[0]]];
    const scale=[]; for(let i=0;i<n;i+=1){ const a=i/n, b=(i+1)/n; const color=COLORS[i%COLORS.length]; scale.push([a,color],[Math.min(1,b-1e-6),color]); } return scale;
  }
}());
