(function () {
  'use strict';

  if (typeof window.chartSpecs !== 'function') return;

  const previousSpecs = window.chartSpecs;
  const PASTELS = [
    '#9EC5E6', '#F2B8B5', '#B7D7B0', '#C9B7DD',
    '#F4D49A', '#A8D8D8', '#E6B8C8', '#B8C6D9',
    '#C7D8A6', '#E7C3A8', '#B8D4C7', '#D8C2E8'
  ];

  const DEFAULT_COORDS = new Map([
    ['서울', [37.5665, 126.9780]], ['부산', [35.1796, 129.0756]], ['대구', [35.8714, 128.6014]],
    ['인천', [37.4563, 126.7052]], ['광주', [35.1595, 126.8526]], ['대전', [36.3504, 127.3845]],
    ['울산', [35.5384, 129.3114]], ['세종', [36.4800, 127.2890]], ['전북', [35.7175, 127.1530]],
    ['전남', [34.8679, 126.9910]], ['충북', [36.8000, 127.7000]], ['충남', [36.5184, 126.8000]],
    ['경북', [36.4919, 128.8889]], ['경남', [35.4606, 128.2132]], ['강원', [37.8228, 128.1555]],
    ['제주', [33.4996, 126.5312]],
    ['seoul', [37.5665, 126.9780]], ['busan', [35.1796, 129.0756]], ['daegu', [35.8714, 128.6014]],
    ['incheon', [37.4563, 126.7052]], ['gwangju', [35.1595, 126.8526]], ['daejeon', [36.3504, 127.3845]],
    ['ulsan', [35.5384, 129.3114]], ['jeju', [33.4996, 126.5312]],
  ].map(([name, coord]) => [normalize(name), coord]));

  window.G2ScienceSettings = window.G2ScienceSettings || {};
  Object.assign(window.G2ScienceSettings, {
    mapStyle: window.G2ScienceSettings.mapStyle || 'carto-voyager',
    mapZoom: window.G2ScienceSettings.mapZoom ?? null,
    mapBearing: window.G2ScienceSettings.mapBearing ?? 0,
    mapPitch: window.G2ScienceSettings.mapPitch ?? 0,
  });

  window.chartSpecs = function precisionMapSpecs() {
    const base = previousSpecs().filter((item) => item.group !== 'GEO');
    return [
      ...base,
      spec('GEO', 1, '정밀 관측점 지도', preciseBubbleMap),
      spec('GEO', 2, '정밀 거리 링', preciseDistanceRings),
      spec('GEO', 3, '정밀 값 보간 등고선', preciseValueContour),
      spec('GEO', 4, '정밀 거리 등고선', preciseDistanceContour),
      spec('GEO', 5, '정밀 최근접 영역', preciseVoronoiRegions),
    ];
  };

  window.G2PrecisionMap = {
    haversineKm,
    resolveStationsStrict,
    geodesicCircle,
    buildGeoGrid,
    marchingContours,
    voronoiCells,
  };

  function spec(group, number, label, build) {
    return { group, number, label, build };
  }

  function preciseBubbleMap(data) {
    const resolved = resolveStationsStrict(data);
    if (!resolved.stations.length) return mapNoData(resolved);
    const values = resolved.stations.map((station) => station.value);
    const maxValue = Math.max(...values.map((v) => Math.max(0, v)), 1);
    return {
      traces: [{
        type: 'scattermap',
        mode: 'markers+text',
        lon: resolved.stations.map((s) => s.lon),
        lat: resolved.stations.map((s) => s.lat),
        text: resolved.stations.map((s) => s.name),
        textposition: 'top center',
        customdata: resolved.stations.map((s) => [s.name, s.value, s.lat, s.lon]),
        marker: {
          size: values.map((v) => 9 + 24 * Math.sqrt(Math.max(v, 0) / maxValue)),
          color: values,
          colorscale: [[0, '#EEF6FB'], [0.45, '#B9D8EA'], [1, '#82B5D2']],
          showscale: true,
          colorbar: { title: { text: '값' }, thickness: 11, len: 0.6 },
          opacity: 0.9,
        },
        hovertemplate: '<b>%{customdata[0]}</b><br>값 %{customdata[1]:,.2f}<br>위도 %{customdata[2]:.6f}<br>경도 %{customdata[3]:.6f}<extra></extra>',
        name: '관측점',
      }],
      layout: mapLayout(resolved.stations, 18, resolved.missing),
    };
  }

  function preciseDistanceRings(data) {
    const resolved = resolveStationsStrict(data);
    if (!resolved.stations.length) return mapNoData(resolved);
    const settings = window.G2ScienceSettings || {};
    const rings = sanitizePositiveList(settings.ringDistances, [25, 50, 100]);
    const traces = [];

    resolved.stations.forEach((station, stationIndex) => {
      rings.forEach((km, ringIndex) => {
        const circle = geodesicCircle(station.lat, station.lon, km, 180);
        traces.push({
          type: 'scattermap',
          mode: 'lines',
          lon: circle.map((p) => p.lon),
          lat: circle.map((p) => p.lat),
          name: `${km} km`,
          showlegend: stationIndex === 0,
          legendgroup: `ring-${ringIndex}`,
          line: {
            color: rgba(PASTELS[ringIndex % PASTELS.length], 0.92),
            width: ringIndex === rings.length - 1 ? 2 : 1.3,
          },
          hoverinfo: 'skip',
        });
      });
    });

    traces.push(stationMarkerTrace(resolved.stations));
    return {
      traces,
      layout: {
        ...mapLayout(resolved.stations, Math.max(...rings) + 8, resolved.missing),
        legend: { orientation: 'h', x: 0, y: -0.04, font: { size: 10 } },
      },
    };
  }

  function preciseValueContour(data) {
    const resolved = resolveStationsStrict(data);
    if (resolved.stations.length < 2) return mapNoData(resolved, '값 보간 등고선에는 좌표가 있는 관측점이 2개 이상 필요합니다.');
    const settings = window.G2ScienceSettings || {};
    const step = clampNumber(settings.contourInterval, 10, 0.1, 100000);
    const power = clampNumber(settings.contourPower, 2, 0.25, 8);
    const resolution = Math.round(clampNumber(settings.contourResolution, 96, 36, 180));
    const padding = clampNumber(settings.contourPadding, 28, 0, 5000);
    const lineWidth = clampNumber(settings.contourLineWidth, 1.35, 0.4, 6);
    const lineColor = validHex(settings.contourLineColor, '#D99080');

    const grid = buildGeoGrid(
      resolved.stations,
      resolved.stations.map((s) => s.value),
      resolution,
      padding,
      (lat, lon, station) => haversineKm(lat, lon, station.lat, station.lon),
      power
    );
    const minValue = Math.min(...grid.z.flat());
    const maxValue = Math.max(...grid.z.flat());
    const requestedMin = nullableFinite(settings.contourMin);
    const requestedMax = nullableFinite(settings.contourMax);
    const start = requestedMin == null ? Math.floor(minValue / step) * step : requestedMin;
    const endRaw = requestedMax == null ? Math.ceil(maxValue / step) * step : requestedMax;
    const end = Math.max(start + step, endRaw);
    const levels = contourLevels(start, end, step, 32);
    const contours = marchingContours(grid, levels);
    const lineTrace = contourLineTrace(contours, lineColor, lineWidth, '보간 등고선', '값');
    const labelTrace = contourLabelTrace(contours, lineColor);

    return {
      traces: [lineTrace, labelTrace, stationMarkerTrace(resolved.stations, true)],
      layout: mapLayout(resolved.stations, padding, resolved.missing, {
        note: `IDW · Haversine 거리 · p=${power} · interval ${step}`,
      }),
    };
  }

  function preciseDistanceContour(data) {
    const resolved = resolveStationsStrict(data);
    if (!resolved.stations.length) return mapNoData(resolved);
    const settings = window.G2ScienceSettings || {};
    const step = clampNumber(settings.contourInterval, 10, 0.5, 5000);
    const resolution = Math.round(clampNumber(settings.contourResolution, 96, 36, 180));
    const padding = Math.max(clampNumber(settings.contourPadding, 28, 0, 5000), step * 2);
    const lineWidth = clampNumber(settings.contourLineWidth, 1.35, 0.4, 6);
    const lineColor = validHex(settings.contourLineColor, '#93A9C4');

    const grid = buildDistanceGrid(resolved.stations, resolution, padding);
    const maxDistance = Math.max(...grid.z.flat());
    const start = step;
    const end = Math.max(step * 2, Math.ceil(maxDistance / step) * step);
    const levels = contourLevels(start, end, step, 32);
    const contours = marchingContours(grid, levels);

    return {
      traces: [
        contourLineTrace(contours, lineColor, lineWidth, '거리 등고선', 'km'),
        contourLabelTrace(contours, lineColor, ' km'),
        stationMarkerTrace(resolved.stations),
      ],
      layout: mapLayout(resolved.stations, padding, resolved.missing, {
        note: `최근접 관측점까지의 Haversine 거리 · interval ${step} km`,
      }),
    };
  }

  function preciseVoronoiRegions(data) {
    const resolved = resolveStationsStrict(data);
    if (!resolved.stations.length) return mapNoData(resolved);
    const padding = clampNumber(window.G2ScienceSettings?.contourPadding, 28, 8, 1000);
    const cells = voronoiCells(resolved.stations, padding);
    const traces = [];

    cells.forEach((cell, index) => {
      if (cell.polygon.length < 3) return;
      const coords = cell.polygon.map((point) => inverseLocalProject(point.x, point.y, cell.projection));
      traces.push({
        type: 'scattermap',
        mode: 'lines',
        lon: [...coords.map((p) => p.lon), coords[0].lon],
        lat: [...coords.map((p) => p.lat), coords[0].lat],
        fill: 'toself',
        fillcolor: rgba(PASTELS[index % PASTELS.length], 0.28),
        line: { color: rgba(darken(PASTELS[index % PASTELS.length], 0.2), 0.78), width: 1.2 },
        name: cell.station.name,
        hovertemplate: `<b>${escapeHtml(cell.station.name)}</b><br>최근접 관측점 영역<extra></extra>`,
      });
    });

    traces.push(stationMarkerTrace(resolved.stations));
    return {
      traces,
      layout: {
        ...mapLayout(resolved.stations, padding, resolved.missing, {
          note: '최근접 관측점 기준 Voronoi 영역 · 지역 평면 투영 후 위·경도로 역변환',
        }),
        showlegend: false,
      },
    };
  }

  function resolveStationsStrict(data) {
    const settings = window.G2ScienceSettings || {};
    const custom = parseStationText(settings.stationText || '');
    const totals = labelTotals(data);
    const stations = [];
    const missing = [];

    (data.labels || []).forEach((label, index) => {
      const key = normalize(label);
      const customCoord = custom.get(key);
      const fallback = DEFAULT_COORDS.get(key);
      const coord = customCoord || (fallback ? { lat: fallback[0], lon: fallback[1] } : null);
      if (!coord) {
        missing.push(String(label));
        return;
      }
      if (!isValidLatLon(coord.lat, coord.lon)) {
        missing.push(String(label));
        return;
      }
      stations.push({
        name: String(label),
        lat: Number(coord.lat),
        lon: Number(coord.lon),
        value: Number(totals[index]) || 0,
        sourceIndex: index,
      });
    });

    return { stations, missing };
  }

  function parseStationText(text) {
    const map = new Map();
    String(text).split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      const parts = line.split(',').map((v) => v.trim());
      if (parts.length < 3) return;
      const name = parts[0];
      const lat = Number(parts[1]);
      const lon = Number(parts[2]);
      if (name && isValidLatLon(lat, lon)) map.set(normalize(name), { lat, lon });
    });
    return map;
  }

  function stationMarkerTrace(stations, showValues = false) {
    return {
      type: 'scattermap',
      mode: 'markers+text',
      lon: stations.map((s) => s.lon),
      lat: stations.map((s) => s.lat),
      text: stations.map((s) => showValues ? formatValue(s.value) : s.name),
      textposition: 'top center',
      customdata: stations.map((s) => [s.name, s.value, s.lat, s.lon]),
      marker: {
        size: 9,
        color: '#DFA0AF',
        opacity: 0.96,
      },
      hovertemplate: '<b>%{customdata[0]}</b><br>값 %{customdata[1]:,.2f}<br>%{customdata[2]:.6f}, %{customdata[3]:.6f}<extra></extra>',
      name: '관측점',
      showlegend: false,
    };
  }

  function mapLayout(stations, paddingKm = 20, missing = [], options = {}) {
    const settings = window.G2ScienceSettings || {};
    const style = settings.mapStyle || 'carto-voyager';
    const center = stationCenter(stations);
    const autoZoom = estimateMapZoom(stations, paddingKm);
    const requestedZoom = nullableFinite(settings.mapZoom);
    const map = {
      style,
      center,
      zoom: requestedZoom == null ? autoZoom : clampNumber(requestedZoom, autoZoom, 0, 20),
      bearing: clampNumber(settings.mapBearing, 0, -180, 180),
      pitch: clampNumber(settings.mapPitch, 0, 0, 60),
    };

    const annotations = [];
    if (missing.length) {
      annotations.push({
        xref: 'paper', yref: 'paper', x: 0, y: 1.02, xanchor: 'left', yanchor: 'bottom',
        text: `좌표 없음: ${missing.slice(0, 5).map(escapeHtml).join(', ')}${missing.length > 5 ? ` 외 ${missing.length - 5}개` : ''}`,
        showarrow: false,
        font: { size: 9, color: '#B45309' },
        bgcolor: 'rgba(255,251,235,0.88)',
        bordercolor: 'rgba(245,158,11,0.25)',
        borderwidth: 1,
        borderpad: 3,
      });
    }
    if (options.note) {
      annotations.push({
        xref: 'paper', yref: 'paper', x: 1, y: -0.03, xanchor: 'right', yanchor: 'top',
        text: escapeHtml(options.note),
        showarrow: false,
        font: { size: 9, color: '#64748B' },
      });
    }

    return {
      map,
      margin: { l: 14, r: 14, t: missing.length ? 76 : 58, b: options.note ? 46 : 24 },
      annotations,
      showlegend: true,
      uirevision: 'g2-map-precision',
    };
  }

  function mapNoData(resolved, message = 'GEO 데이터에 사용할 정확한 좌표가 없습니다. Station coordinates에 이름,위도,경도를 입력하세요.') {
    const missingText = resolved?.missing?.length ? `<br><span style="font-size:10px">좌표 없음: ${resolved.missing.map(escapeHtml).join(', ')}</span>` : '';
    return {
      traces: [{
        type: 'scattermap',
        mode: 'markers',
        lon: [127.8],
        lat: [36.2],
        marker: { size: 1, opacity: 0 },
        hoverinfo: 'skip',
        showlegend: false,
      }],
      layout: {
        map: { style: window.G2ScienceSettings?.mapStyle || 'carto-voyager', center: { lat: 36.2, lon: 127.8 }, zoom: 5.2 },
        margin: { l: 20, r: 20, t: 60, b: 30 },
        annotations: [{
          xref: 'paper', yref: 'paper', x: 0.5, y: 0.5,
          text: message + missingText,
          showarrow: false,
          align: 'center',
          font: { size: 12, color: '#64748B' },
          bgcolor: 'rgba(255,255,255,0.9)',
        }],
      },
    };
  }

  function buildGeoGrid(stations, values, resolution, paddingKm, distanceFn, power = 2) {
    const bounds = geoBounds(stations, paddingKm);
    const lon = linspace(bounds.minLon, bounds.maxLon, resolution);
    const lat = linspace(bounds.minLat, bounds.maxLat, resolution);
    const safeValues = stations.map((_, i) => Number(values[i]) || 0);
    const z = lat.map((yy) => lon.map((xx) => {
      let weighted = 0;
      let weights = 0;
      for (let i = 0; i < stations.length; i += 1) {
        const distance = distanceFn(yy, xx, stations[i]);
        if (distance < 0.001) return safeValues[i];
        const weight = 1 / Math.pow(Math.max(distance, 0.001), power);
        weighted += weight * safeValues[i];
        weights += weight;
      }
      return weights ? weighted / weights : 0;
    }));
    return { x: lon, y: lat, z, bounds };
  }

  function buildDistanceGrid(stations, resolution, paddingKm) {
    const bounds = geoBounds(stations, paddingKm);
    const lon = linspace(bounds.minLon, bounds.maxLon, resolution);
    const lat = linspace(bounds.minLat, bounds.maxLat, resolution);
    const z = lat.map((yy) => lon.map((xx) =>
      Math.min(...stations.map((station) => haversineKm(yy, xx, station.lat, station.lon)))
    ));
    return { x: lon, y: lat, z, bounds };
  }

  function marchingContours(grid, levels) {
    return levels.map((level) => {
      const lon = [];
      const lat = [];
      let labelPoint = null;

      for (let j = 0; j < grid.y.length - 1; j += 1) {
        for (let i = 0; i < grid.x.length - 1; i += 1) {
          const corners = [
            { x: grid.x[i], y: grid.y[j], v: grid.z[j][i] },
            { x: grid.x[i + 1], y: grid.y[j], v: grid.z[j][i + 1] },
            { x: grid.x[i + 1], y: grid.y[j + 1], v: grid.z[j + 1][i + 1] },
            { x: grid.x[i], y: grid.y[j + 1], v: grid.z[j + 1][i] },
          ];
          const intersections = [];
          const edges = [[0,1], [1,2], [2,3], [3,0]];
          edges.forEach(([a, b]) => {
            const p = interpolateEdge(corners[a], corners[b], level);
            if (p) intersections.push(p);
          });

          if (intersections.length === 2) {
            appendSegment(lon, lat, intersections[0], intersections[1]);
            if (!labelPoint) labelPoint = midpoint(intersections[0], intersections[1]);
          } else if (intersections.length === 4) {
            const centerValue = (corners[0].v + corners[1].v + corners[2].v + corners[3].v) / 4;
            const pairs = centerValue >= level
              ? [[intersections[0], intersections[3]], [intersections[1], intersections[2]]]
              : [[intersections[0], intersections[1]], [intersections[2], intersections[3]]];
            pairs.forEach(([a, b]) => {
              appendSegment(lon, lat, a, b);
              if (!labelPoint) labelPoint = midpoint(a, b);
            });
          }
        }
      }

      return { level, lon, lat, labelPoint };
    }).filter((item) => item.lon.length > 0);
  }

  function contourLineTrace(contours, color, width, name, unit) {
    const lon = [];
    const lat = [];
    const customdata = [];
    contours.forEach((contour) => {
      contour.lon.forEach((value, index) => {
        lon.push(value);
        lat.push(contour.lat[index]);
        customdata.push(value == null ? null : contour.level);
      });
    });
    return {
      type: 'scattermap',
      mode: 'lines',
      lon, lat, customdata,
      line: { color, width },
      name,
      hovertemplate: `${unit === 'km' ? '거리' : '값'} %{customdata:.2f}${unit === 'km' ? ' km' : ''}<extra></extra>`,
      showlegend: false,
      connectgaps: false,
    };
  }

  function contourLabelTrace(contours, color, suffix = '') {
    const labels = contours.filter((item) => item.labelPoint);
    return {
      type: 'scattermap',
      mode: 'text',
      lon: labels.map((item) => item.labelPoint.x),
      lat: labels.map((item) => item.labelPoint.y),
      text: labels.map((item) => `${formatValue(item.level)}${suffix}`),
      textfont: { size: 9, color },
      hoverinfo: 'skip',
      showlegend: false,
    };
  }

  function interpolateEdge(a, b, level) {
    const da = a.v - level;
    const db = b.v - level;
    if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
    if (da === 0 && db === 0) return null;
    if ((da < 0 && db < 0) || (da > 0 && db > 0)) return null;
    const denom = b.v - a.v;
    if (Math.abs(denom) < 1e-12) return null;
    const t = (level - a.v) / denom;
    if (t < 0 || t > 1) return null;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  function appendSegment(lon, lat, a, b) {
    lon.push(a.x, b.x, null);
    lat.push(a.y, b.y, null);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function contourLevels(start, end, step, maxLevels) {
    const levels = [];
    if (!(step > 0)) return levels;
    for (let value = start; value <= end + step * 0.25 && levels.length < maxLevels; value += step) {
      levels.push(Number(value.toFixed(10)));
    }
    return levels;
  }

  function voronoiCells(stations, paddingKm) {
    const projection = localProjection(stations);
    const points = stations.map((station) => ({
      station,
      ...forwardLocalProject(station.lat, station.lon, projection),
    }));
    const bounds = projectedBounds(points, paddingKm);

    return points.map((site, siteIndex) => {
      let polygon = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ];

      points.forEach((other, otherIndex) => {
        if (siteIndex === otherIndex || !polygon.length) return;
        const a = 2 * (other.x - site.x);
        const b = 2 * (other.y - site.y);
        const c = other.x * other.x + other.y * other.y - site.x * site.x - site.y * site.y;
        polygon = clipPolygonHalfPlane(polygon, a, b, c);
      });

      return { station: site.station, polygon, projection };
    });
  }

  function clipPolygonHalfPlane(polygon, a, b, c) {
    const out = [];
    if (!polygon.length) return out;
    const inside = (p) => a * p.x + b * p.y <= c + 1e-9;
    const intersection = (p1, p2) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const denom = a * dx + b * dy;
      if (Math.abs(denom) < 1e-12) return { ...p1 };
      const t = (c - a * p1.x - b * p1.y) / denom;
      return { x: p1.x + t * dx, y: p1.y + t * dy };
    };

    for (let i = 0; i < polygon.length; i += 1) {
      const current = polygon[i];
      const previous = polygon[(i + polygon.length - 1) % polygon.length];
      const currentInside = inside(current);
      const previousInside = inside(previous);
      if (currentInside) {
        if (!previousInside) out.push(intersection(previous, current));
        out.push(current);
      } else if (previousInside) {
        out.push(intersection(previous, current));
      }
    }
    return out;
  }

  function localProjection(stations) {
    const lat0 = stations.reduce((sum, p) => sum + p.lat, 0) / stations.length;
    const lon0 = stations.reduce((sum, p) => sum + p.lon, 0) / stations.length;
    return {
      lat0,
      lon0,
      kmLat: 110.574,
      kmLon: Math.max(1e-6, 111.320 * Math.cos(lat0 * Math.PI / 180)),
    };
  }

  function forwardLocalProject(lat, lon, projection) {
    return {
      x: (lon - projection.lon0) * projection.kmLon,
      y: (lat - projection.lat0) * projection.kmLat,
    };
  }

  function inverseLocalProject(x, y, projection) {
    return {
      lat: projection.lat0 + y / projection.kmLat,
      lon: projection.lon0 + x / projection.kmLon,
    };
  }

  function projectedBounds(points, paddingKm) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - paddingKm;
    const maxX = Math.max(...xs) + paddingKm;
    const minY = Math.min(...ys) - paddingKm;
    const maxY = Math.max(...ys) + paddingKm;
    return { minX, maxX, minY, maxY };
  }

  function geoBounds(stations, paddingKm) {
    const lats = stations.map((p) => p.lat);
    const lons = stations.map((p) => p.lon);
    const meanLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const latPad = paddingKm / 110.574;
    const lonPad = paddingKm / Math.max(20, 111.320 * Math.cos(meanLat * Math.PI / 180));
    return {
      minLat: Math.min(...lats) - latPad,
      maxLat: Math.max(...lats) + latPad,
      minLon: Math.min(...lons) - lonPad,
      maxLon: Math.max(...lons) + lonPad,
    };
  }

  function stationCenter(stations) {
    return {
      lat: stations.reduce((sum, s) => sum + s.lat, 0) / stations.length,
      lon: stations.reduce((sum, s) => sum + s.lon, 0) / stations.length,
    };
  }

  function estimateMapZoom(stations, paddingKm) {
    const bounds = geoBounds(stations, paddingKm);
    const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.002);
    const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.002);
    const zoomLon = Math.log2(360 / lonSpan);
    const zoomLat = Math.log2(170 / latSpan);
    return Math.max(1, Math.min(18, Math.min(zoomLon, zoomLat) - 0.65));
  }

  function geodesicCircle(lat, lon, radiusKm, segments = 180) {
    const R = 6371.0088;
    const phi1 = lat * Math.PI / 180;
    const lambda1 = lon * Math.PI / 180;
    const delta = radiusKm / R;
    return Array.from({ length: segments + 1 }, (_, i) => {
      const theta = 2 * Math.PI * i / segments;
      const phi2 = Math.asin(
        Math.sin(phi1) * Math.cos(delta) +
        Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
      );
      const lambda2 = lambda1 + Math.atan2(
        Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
        Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
      );
      return {
        lat: phi2 * 180 / Math.PI,
        lon: ((lambda2 * 180 / Math.PI + 540) % 360) - 180,
      };
    });
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0088;
    const toRad = Math.PI / 180;
    const phi1 = lat1 * toRad;
    const phi2 = lat2 * toRad;
    const dPhi = (lat2 - lat1) * toRad;
    const dLambda = (lon2 - lon1) * toRad;
    const a = Math.sin(dPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  function labelTotals(data) {
    return (data.labels || []).map((_, i) =>
      (data.values || []).reduce((sum, row) => sum + (Number(row[i]) || 0), 0)
    );
  }

  function sanitizePositiveList(values, fallback) {
    const list = Array.isArray(values) ? values : String(values || '').split(/[;,\s]+/);
    const parsed = list.map(Number).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    return parsed.length ? parsed : fallback.slice();
  }

  function linspace(a, b, n) {
    if (n <= 1) return [a];
    const step = (b - a) / (n - 1);
    return Array.from({ length: n }, (_, i) => a + step * i);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidLatLon(lat, lon) {
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) &&
      Number(lat) >= -90 && Number(lat) <= 90 &&
      Number(lon) >= -180 && Number(lon) <= 180;
  }

  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function nullableFinite(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function validHex(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback;
  }

  function formatValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) : '';
  }

  function rgba(hex, alpha) {
    const raw = String(hex || '').replace('#', '');
    const n = parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function darken(hex, amount) {
    const raw = validHex(hex, '#64748B').slice(1);
    const n = parseInt(raw, 16);
    const factor = Math.max(0, Math.min(1, 1 - amount));
    const rgb = [
      Math.round(((n >> 16) & 255) * factor),
      Math.round(((n >> 8) & 255) * factor),
      Math.round((n & 255) * factor),
    ];
    return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}());
