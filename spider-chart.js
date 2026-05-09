(function () {
  if (typeof window.chartSpecs !== "function") return;

  const palette = ["#274C77", "#6096BA", "#A3CEF1", "#8B8C89", "#D9A441", "#A44A3F", "#587B7F", "#6A4C93", "#2A9D8F", "#E76F51", "#264653", "#B56576"];
  const previousChartSpecs = window.chartSpecs;

  window.chartSpecs = function spiderChartSpecs() {
    const specs = previousChartSpecs();
    if (specs.some((item) => item.group === "ADVANCED" && item.label === "스파이더 차트")) return specs;
    return [...specs, { group: "ADVANCED", number: 27, label: "스파이더 차트", build: spiderChart }];
  };

  function color(index) { return palette[index % palette.length]; }
  function safeMax(values) { const finite = values.filter((value) => Number.isFinite(value)); return Math.max(...finite, 1); }

  function spiderChart(data) {
    const theta = [...data.labels, data.labels[0]];
    const max = safeMax(data.values.flat());
    return {
      traces: data.series.slice(0, 8).map((series, i) => ({
        type: "scatterpolar",
        mode: "lines+markers",
        r: [...data.values[i], data.values[i][0]],
        theta,
        fill: "toself",
        name: series,
        line: { color: color(i), width: 2 },
        marker: { size: 5, color: color(i) },
        opacity: 0.42,
      })),
      layout: {
        polar: {
          bgcolor: "#fbfdff",
          radialaxis: { visible: true, range: [0, max * 1.08], gridcolor: "#d9e1ea", linecolor: "#b9c7d5", tickfont: { size: 10, color: "#647084" } },
          angularaxis: { gridcolor: "#d9e1ea", linecolor: "#b9c7d5", tickfont: { size: 11, color: "#1c2430" } },
        },
        legend: { orientation: "h", y: -0.18, x: 0 },
      },
    };
  }
}());
