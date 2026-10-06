from __future__ import annotations

import argparse
import math
import re
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib import font_manager, patches
from matplotlib.colors import LinearSegmentedColormap


# ============================================================
# 1. 경로 및 기본 설정
# ============================================================

BASE_DIR = Path(r"E:/2026/연차평가 보고서/Graph")
DEFAULT_INPUT_FILE = BASE_DIR / "정신건강_2026.04.30..xlsx"
DEFAULT_OUTPUT_ROOT = BASE_DIR
DEFAULT_DPI = 800
DEFAULT_SAVE_FORMATS = ["png", "svg"]

FIGSIZE_STANDARD = (5.6, 3.6)
FIGSIZE_WIDE = (6.4, 3.6)
FIGSIZE_SQUARE = (4.6, 4.6)

FONT_CANDIDATES = [
    "Malgun Gothic",      # Windows
    "AppleGothic",       # macOS
    "NanumGothic",       # Linux
    "Noto Sans CJK KR",
]

# 보고서용 저채도 팔레트
PALETTE = [
    "#274C77", "#6096BA", "#A3CEF1", "#8B8C89",
    "#E7ECEF", "#D9A441", "#A44A3F", "#587B7F",
    "#6A4C93", "#2A9D8F", "#E76F51", "#264653",
]

HEATMAP_CMAP = LinearSegmentedColormap.from_list(
    "report_heatmap",
    ["#F7FBFF", "#D6E6F2", "#7AA6C2", "#274C77"],
)


# ============================================================
# 2. 데이터 모델
# ============================================================

@dataclass
class ChartData:
    sheet_name: str
    title: str
    labels: list[str]
    series: list[str]
    values: pd.DataFrame  # index=series, columns=labels, numeric


# ============================================================
# 3. 공통 유틸
# ============================================================

def setup_matplotlib() -> None:
    """한글 폰트, 기본 스타일 설정."""
    available = {font.name for font in font_manager.fontManager.ttflist}
    for font_name in FONT_CANDIDATES:
        if font_name in available:
            plt.rcParams["font.family"] = font_name
            break

    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "white"
    plt.rcParams["axes.facecolor"] = "white"
    plt.rcParams["axes.edgecolor"] = "#D0D0D0"
    plt.rcParams["axes.linewidth"] = 0.8
    plt.rcParams["xtick.color"] = "#333333"
    plt.rcParams["ytick.color"] = "#333333"
    plt.rcParams["text.color"] = "#222222"
    plt.rcParams["axes.titleweight"] = "bold"
    plt.rcParams["savefig.facecolor"] = "white"
    plt.rcParams["legend.frameon"] = False
    plt.ioff()


def is_nonempty(value: object) -> bool:
    if pd.isna(value):
        return False
    return str(value).strip() != ""


def clean_filename(text: object, max_len: int = 80) -> str:
    text = str(text).strip()
    text = re.sub(r"[\\/:*?\"<>|]", "_", text)
    text = re.sub(r"\s+", "_", text)
    return text[:max_len] or "untitled"


def wrap_label(text: object, width: int = 10) -> str:
    value = str(text)
    if len(value) <= width:
        return value
    return "\n".join(textwrap.wrap(value, width=width))


def to_numeric_value(value: object) -> float:
    if pd.isna(value):
        return np.nan
    text = str(value).strip()
    text = (
        text.replace(",", "")
        .replace("명", "")
        .replace("건", "")
        .replace("회", "")
        .replace("원", "")
        .replace("%", "")
    )
    match = re.search(r"-?\d+(\.\d+)?", text)
    if not match:
        return np.nan
    return float(match.group())


def ensure_positive(values: np.ndarray, min_value: float = 0.0) -> np.ndarray:
    arr = np.asarray(values, dtype=float)
    arr = np.nan_to_num(arr, nan=0.0)
    if min_value == 0.0:
        arr[arr < 0] = 0.0
    return arr


def add_clean_axes(ax, grid_axis: str | None = "y") -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    if grid_axis:
        ax.grid(axis=grid_axis, alpha=0.22, linewidth=0.7)
        ax.set_axisbelow(True)


def add_title(ax, data: ChartData, subtitle: str) -> None:
    ax.set_title(f"{data.title}\n{subtitle}", loc="left", fontsize=11, pad=10)


def add_source_note(fig, note: str = "2026 연차평가 보고서 정량자료 기준") -> None:
    fig.text(0.99, 0.01, note, ha="right", va="bottom", fontsize=6.5, color="#777777")


def save_fig(
    fig,
    output_root: Path,
    group: str,
    data: ChartData,
    variant_no: int,
    variant_name: str,
    dpi: int,
) -> list[Path]:
    folder = output_root / group.upper()
    folder.mkdir(parents=True, exist_ok=True)

    fig.tight_layout(pad=1.1)
    add_source_note(fig)

    saved_paths: list[Path] = []

    for fmt in DEFAULT_SAVE_FORMATS:
        filename = (
            f"{clean_filename(data.sheet_name)}_"
            f"{clean_filename(data.title)}_"
            f"{variant_no:02d}_{clean_filename(variant_name)}.{fmt}"
        )
        output_path = folder / filename

        if fmt.lower() == "png":
            fig.savefig(
                output_path,
                dpi=dpi,
                bbox_inches="tight",
                transparent=False,
            )
        else:
            fig.savefig(
                output_path,
                format=fmt,
                bbox_inches="tight",
                transparent=False,
            )

        saved_paths.append(output_path)

    plt.close(fig)
    return saved_paths

def get_color(index: int) -> str:
    return PALETTE[index % len(PALETTE)]


def matrix(data: ChartData) -> np.ndarray:
    return data.values.to_numpy(dtype=float)


def label_positions(data: ChartData) -> np.ndarray:
    return np.arange(len(data.labels), dtype=float)


def series_totals(data: ChartData) -> pd.Series:
    return data.values.sum(axis=1).sort_values(ascending=False)


def label_totals(data: ChartData) -> pd.Series:
    return data.values.sum(axis=0).sort_values(ascending=False)


def set_xlabels(ax, labels: Iterable[str], rotation: int = 0) -> None:
    labels_list = list(labels)
    ax.set_xticks(np.arange(len(labels_list)))
    ax.set_xticklabels([wrap_label(x) for x in labels_list], rotation=rotation, ha="center" if rotation == 0 else "right")


def safe_max(values: np.ndarray | pd.Series) -> float:
    arr = np.asarray(values, dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size == 0:
        return 1.0
    max_value = float(np.max(arr))
    return max(max_value, 1.0)


# ============================================================
# 4. 엑셀 읽기
# ============================================================

def read_chart_sheet(input_file: Path, sheet_name: str) -> ChartData:
    raw = pd.read_excel(input_file, sheet_name=sheet_name, header=None)
    raw = raw.dropna(how="all").dropna(axis=1, how="all")

    if raw.empty or raw.shape[1] < 2:
        raise ValueError(f"{sheet_name}: 그래프 생성에 필요한 최소 데이터가 없습니다.")

    title = str(raw.iat[0, 0]).strip() if is_nonempty(raw.iat[0, 0]) else sheet_name

    # 레이아웃 자동 판정
    # B0부터 레이블이 있으면 압축형, 아니면 B1부터 레이블을 찾음
    row0_label_count = sum(is_nonempty(x) for x in raw.iloc[0, 1:].tolist())
    row1_label_count = sum(is_nonempty(x) for x in raw.iloc[1, 1:].tolist()) if len(raw) > 1 else 0

    if row0_label_count > 0:
        label_row = 0
        data_start_row = 1
    elif row1_label_count > 0:
        label_row = 1
        data_start_row = 2
    else:
        raise ValueError(f"{sheet_name}: B열 이후 레이블 행을 찾지 못했습니다.")

    label_cols = [
        col_idx
        for col_idx in range(1, raw.shape[1])
        if is_nonempty(raw.iat[label_row, col_idx])
    ]

    labels = [str(raw.iat[label_row, col_idx]).strip() for col_idx in label_cols]

    rows = []
    series_names = []
    for row_idx in range(data_start_row, raw.shape[0]):
        series_name = raw.iat[row_idx, 0]
        row_values = [to_numeric_value(raw.iat[row_idx, col_idx]) for col_idx in label_cols]

        if not is_nonempty(series_name) and all(np.isnan(v) for v in row_values):
            continue

        if not is_nonempty(series_name):
            series_name = f"범례{len(series_names) + 1}"

        series_names.append(str(series_name).strip())
        rows.append(row_values)

    if not rows:
        raise ValueError(f"{sheet_name}: 값 데이터가 없습니다.")

    values = pd.DataFrame(rows, index=series_names, columns=labels)
    values = values.apply(pd.to_numeric, errors="coerce").fillna(0)

    # 완전 중복 범례명 방지
    if values.index.duplicated().any():
        new_index = []
        counter: dict[str, int] = {}
        for name in values.index:
            counter[name] = counter.get(name, 0) + 1
            new_index.append(name if counter[name] == 1 else f"{name}_{counter[name]}")
        values.index = new_index

    return ChartData(
        sheet_name=sheet_name,
        title=title,
        labels=list(values.columns),
        series=list(values.index),
        values=values,
    )


def read_workbook(input_file: Path, target_sheet: str | None = None) -> list[ChartData]:
    excel = pd.ExcelFile(input_file)
    sheet_names = [target_sheet] if target_sheet else excel.sheet_names

    result: list[ChartData] = []
    for sheet_name in sheet_names:
        if sheet_name not in excel.sheet_names:
            raise ValueError(f"시트를 찾을 수 없습니다: {sheet_name}")
        result.append(read_chart_sheet(input_file, sheet_name))
    return result


# ============================================================
# 5. BAR 4종
# ============================================================

def plot_bar_01_grouped(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)
    n_series = len(data.series)
    width = min(0.8 / max(n_series, 1), 0.22)

    for i, series in enumerate(data.series):
        offset = (i - (n_series - 1) / 2) * width
        ax.bar(x + offset, data.values.loc[series].values, width=width, label=series, color=get_color(i))

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "BAR 01 · 그룹형 막대그래프")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_bar_02_stacked(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)
    bottom = np.zeros(len(data.labels))

    for i, series in enumerate(data.series):
        values = data.values.loc[series].values
        ax.bar(x, values, bottom=bottom, label=series, color=get_color(i), width=0.55)
        bottom += values

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "BAR 02 · 누적 막대그래프")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_bar_03_horizontal_rank(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)
    totals = series_totals(data).sort_values()
    y = np.arange(len(totals))

    ax.barh(y, totals.values, color=[get_color(i) for i in range(len(totals))], height=0.52)
    ax.set_yticks(y)
    ax.set_yticklabels([wrap_label(x, 12) for x in totals.index])
    ax.set_xlabel("합계")
    add_title(ax, data, "BAR 03 · 범례별 순위형 가로막대")
    add_clean_axes(ax, grid_axis="x")

    for idx, value in enumerate(totals.values):
        ax.text(value, idx, f" {value:,.0f}", va="center", fontsize=7.5)

    return fig


def plot_bar_04_floating_column(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    totals = label_totals(data).sort_index()
    x = np.arange(len(totals))
    values = totals.values
    baseline = values.min() * 0.85 if values.min() > 0 else 0

    ax.bar(x, values - baseline, bottom=baseline, width=0.48, color=[get_color(i) for i in range(len(x))])
    set_xlabels(ax, totals.index, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "BAR 04 · 플로팅 컬럼형")
    add_clean_axes(ax)

    for idx, value in enumerate(values):
        ax.text(idx, value, f"{value:,.0f}", ha="center", va="bottom", fontsize=7.5)

    return fig


# ============================================================
# 6. LINE 4종
# ============================================================

def plot_line_01_basic(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)

    for i, series in enumerate(data.series):
        ax.plot(x, data.values.loc[series].values, marker="o", linewidth=1.8, label=series, color=get_color(i))

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "LINE 01 · 기본 추이선")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_line_02_smooth(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)

    for i, series in enumerate(data.series):
        y = data.values.loc[series].values.astype(float)
        if len(x) >= 3:
            dense_x = np.linspace(x.min(), x.max(), 120)
            dense_y = np.interp(dense_x, x, y)
            ax.plot(dense_x, dense_y, linewidth=2.0, label=series, color=get_color(i))
            ax.scatter(x, y, s=16, color=get_color(i))
        else:
            ax.plot(x, y, marker="o", linewidth=2.0, label=series, color=get_color(i))

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "LINE 02 · 스무딩형 추이선")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_line_03_step(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)

    for i, series in enumerate(data.series):
        ax.step(x, data.values.loc[series].values, where="mid", linewidth=2.0, label=series, color=get_color(i))
        ax.scatter(x, data.values.loc[series].values, s=14, color=get_color(i))

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "LINE 03 · 계단형 추이선")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_line_04_slope(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)
    if len(data.labels) >= 2:
        first_col = data.labels[0]
        last_col = data.labels[-1]
    else:
        first_col = last_col = data.labels[0]

    x = np.array([0, 1])
    for i, series in enumerate(data.series):
        y = np.array([data.values.loc[series, first_col], data.values.loc[series, last_col]], dtype=float)
        ax.plot(x, y, marker="o", linewidth=1.8, color=get_color(i))
        ax.text(-0.03, y[0], f"{series} {y[0]:,.0f}", ha="right", va="center", fontsize=7)
        ax.text(1.03, y[1], f"{y[1]:,.0f}", ha="left", va="center", fontsize=7)

    ax.set_xlim(-0.25, 1.25)
    ax.set_xticks([0, 1])
    ax.set_xticklabels([wrap_label(first_col), wrap_label(last_col)])
    ax.set_ylabel("값")
    add_title(ax, data, "LINE 04 · 슬로프 차트")
    add_clean_axes(ax)
    return fig


# ============================================================
# 7. AREA 4종
# ============================================================

def plot_area_01_basic(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)

    for i, series in enumerate(data.series):
        y = data.values.loc[series].values
        ax.fill_between(x, y, alpha=0.22, color=get_color(i))
        ax.plot(x, y, linewidth=1.8, color=get_color(i), label=series)

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "AREA 01 · 기본 면적그래프")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_area_02_stacked(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)
    y = matrix(data)

    ax.stackplot(x, y, labels=data.series, colors=[get_color(i) for i in range(len(data.series))], alpha=0.82)
    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "AREA 02 · 누적 면적그래프")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_area_03_stream(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)
    y = matrix(data)
    total = y.sum(axis=0)
    baseline = -total / 2

    ax.stackplot(x, y, baseline=baseline, labels=data.series, colors=[get_color(i) for i in range(len(data.series))], alpha=0.82)
    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "AREA 03 · 스트림형 면적그래프")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_area_04_percent(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)
    y = matrix(data)
    col_sum = y.sum(axis=0)
    col_sum[col_sum == 0] = 1
    percent = y / col_sum * 100

    ax.stackplot(x, percent, labels=data.series, colors=[get_color(i) for i in range(len(data.series))], alpha=0.82)
    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("비율(%)")
    ax.set_ylim(0, 100)
    add_title(ax, data, "AREA 04 · 100% 누적 면적그래프")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


# ============================================================
# 8. SCATTER 4종
# ============================================================

def plot_scatter_01_basic(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)

    for i, series in enumerate(data.series):
        y = data.values.loc[series].values
        ax.scatter(x, y, s=45, label=series, color=get_color(i), alpha=0.9)

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "SCATTER 01 · 기본 산점도")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_scatter_02_bubble(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)
    max_value = safe_max(matrix(data))

    for i, series in enumerate(data.series):
        y = data.values.loc[series].values
        sizes = 40 + (ensure_positive(y) / max_value) * 380
        ax.scatter(x, y, s=sizes, label=series, color=get_color(i), alpha=0.55, edgecolor="white", linewidth=0.5)

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "SCATTER 02 · 버블 산점도")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_scatter_03_connected(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)

    for i, series in enumerate(data.series):
        y = data.values.loc[series].values
        ax.plot(x, y, linewidth=0.8, color=get_color(i), alpha=0.65)
        ax.scatter(x, y, s=42, color=get_color(i), label=series)

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "SCATTER 03 · 연결형 산점도")
    add_clean_axes(ax)
    ax.legend(fontsize=7, loc="upper left", bbox_to_anchor=(1.01, 1))
    return fig


def plot_scatter_04_quadrant(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)

    if len(data.labels) >= 2:
        x_label, y_label = data.labels[0], data.labels[1]
        x = data.values[x_label].values.astype(float)
        y = data.values[y_label].values.astype(float)
    else:
        x_label, y_label = "순번", data.labels[0]
        x = np.arange(1, len(data.series) + 1)
        y = data.values[data.labels[0]].values.astype(float)

    x_med = np.median(x)
    y_med = np.median(y)

    ax.axvline(x_med, color="#B8B8B8", linewidth=0.9)
    ax.axhline(y_med, color="#B8B8B8", linewidth=0.9)

    for i, series in enumerate(data.series):
        ax.scatter(x[i], y[i], s=64, color=get_color(i), alpha=0.9)
        ax.text(x[i], y[i], f" {series}", fontsize=7, va="center")

    ax.set_xlabel(wrap_label(x_label))
    ax.set_ylabel(wrap_label(y_label))
    add_title(ax, data, "SCATTER 04 · 사분면 산점도")
    add_clean_axes(ax)
    return fig


# ============================================================
# 9. PIE 4종
# ============================================================

def _pie_values(data: ChartData) -> pd.Series:
    totals = series_totals(data)
    totals = totals[totals > 0]
    if totals.empty:
        totals = pd.Series([1], index=["데이터 없음"])
    return totals


def plot_pie_01_basic(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_SQUARE)
    totals = _pie_values(data)

    ax.pie(
        totals.values,
        labels=[wrap_label(x, 9) for x in totals.index],
        autopct="%1.1f%%",
        startangle=90,
        colors=[get_color(i) for i in range(len(totals))],
        textprops={"fontsize": 7},
    )
    ax.set_title(f"{data.title}\nPIE 01 · 기본 파이차트", loc="left", fontsize=11, weight="bold")
    return fig


def plot_pie_02_donut(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_SQUARE)
    totals = _pie_values(data)

    wedges, _ = ax.pie(
        totals.values,
        startangle=90,
        colors=[get_color(i) for i in range(len(totals))],
        wedgeprops={"width": 0.42, "edgecolor": "white"},
    )
    ax.text(0, 0, f"합계\n{totals.sum():,.0f}", ha="center", va="center", fontsize=12, weight="bold")
    ax.legend(wedges, totals.index, fontsize=7, loc="center left", bbox_to_anchor=(0.95, 0.5))
    ax.set_title(f"{data.title}\nPIE 02 · 도넛차트", loc="left", fontsize=11, weight="bold")
    return fig


def plot_pie_03_nested_donut(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_SQUARE)

    outer = _pie_values(data)
    inner = label_totals(data)
    inner = inner[inner > 0]
    if inner.empty:
        inner = pd.Series([1], index=["데이터 없음"])

    ax.pie(
        outer.values,
        radius=1.0,
        startangle=90,
        colors=[get_color(i) for i in range(len(outer))],
        wedgeprops={"width": 0.27, "edgecolor": "white"},
    )
    ax.pie(
        inner.values,
        radius=0.70,
        startangle=90,
        colors=[get_color(i + 4) for i in range(len(inner))],
        wedgeprops={"width": 0.27, "edgecolor": "white"},
    )

    ax.text(0, 0, "범례\n레이블", ha="center", va="center", fontsize=10, weight="bold")
    ax.set_title(f"{data.title}\nPIE 03 · 이중 도넛차트", loc="left", fontsize=11, weight="bold")
    return fig


def plot_pie_04_rose(data: ChartData) -> plt.Figure:
    fig = plt.figure(figsize=FIGSIZE_SQUARE)
    ax = fig.add_subplot(111, polar=True)

    totals = _pie_values(data)
    values = totals.values.astype(float)
    angles = np.linspace(0, 2 * np.pi, len(values), endpoint=False)
    width = 2 * np.pi / len(values) * 0.82
    radius = np.sqrt(values / safe_max(values))

    ax.bar(angles, radius, width=width, color=[get_color(i) for i in range(len(values))], alpha=0.85)
    ax.set_xticks(angles)
    ax.set_xticklabels([wrap_label(x, 8) for x in totals.index], fontsize=7)
    ax.set_yticklabels([])
    ax.grid(alpha=0.2)
    ax.set_title(f"{data.title}\nPIE 04 · 로즈형 파이차트", loc="left", fontsize=11, weight="bold", pad=20)
    return fig


# ============================================================
# 10. HEATMAP 4종
# ============================================================

def plot_heatmap_01_matrix(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    arr = matrix(data)

    im = ax.imshow(arr, aspect="auto", cmap=HEATMAP_CMAP)
    ax.set_xticks(np.arange(len(data.labels)))
    ax.set_xticklabels([wrap_label(x, 8) for x in data.labels])
    ax.set_yticks(np.arange(len(data.series)))
    ax.set_yticklabels([wrap_label(x, 10) for x in data.series])
    add_title(ax, data, "HEATMAP 01 · 매트릭스 히트맵")
    fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02)
    return fig


def plot_heatmap_02_annotated(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    arr = matrix(data)

    im = ax.imshow(arr, aspect="auto", cmap=HEATMAP_CMAP)
    ax.set_xticks(np.arange(len(data.labels)))
    ax.set_xticklabels([wrap_label(x, 8) for x in data.labels])
    ax.set_yticks(np.arange(len(data.series)))
    ax.set_yticklabels([wrap_label(x, 10) for x in data.series])

    threshold = np.nanmax(arr) * 0.55 if arr.size else 0
    for row in range(arr.shape[0]):
        for col in range(arr.shape[1]):
            color = "white" if arr[row, col] > threshold else "#222222"
            ax.text(col, row, f"{arr[row, col]:,.0f}", ha="center", va="center", fontsize=6.5, color=color)

    add_title(ax, data, "HEATMAP 02 · 숫자 표기 히트맵")
    fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02)
    return fig


def plot_heatmap_03_one_dimensional(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    totals = label_totals(data).sort_index()
    arr = totals.values.reshape(1, -1)

    im = ax.imshow(arr, aspect="auto", cmap=HEATMAP_CMAP)
    ax.set_yticks([])
    ax.set_xticks(np.arange(len(totals)))
    ax.set_xticklabels([wrap_label(x, 8) for x in totals.index])
    for idx, value in enumerate(totals.values):
        ax.text(idx, 0, f"{value:,.0f}", ha="center", va="center", fontsize=7)

    add_title(ax, data, "HEATMAP 03 · 1차원 히트맵")
    fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02)
    return fig


def plot_heatmap_04_normalized(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    arr = matrix(data)
    row_max = arr.max(axis=1, keepdims=True)
    row_max[row_max == 0] = 1
    normalized = arr / row_max * 100

    im = ax.imshow(normalized, aspect="auto", cmap=HEATMAP_CMAP, vmin=0, vmax=100)
    ax.set_xticks(np.arange(len(data.labels)))
    ax.set_xticklabels([wrap_label(x, 8) for x in data.labels])
    ax.set_yticks(np.arange(len(data.series)))
    ax.set_yticklabels([wrap_label(x, 10) for x in data.series])
    add_title(ax, data, "HEATMAP 04 · 행 기준 정규화 히트맵")
    fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02)
    return fig


# ============================================================
# 11. RANGE 4종
# ============================================================

def plot_range_01_series_minmax(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)
    mins = data.values.min(axis=1)
    maxs = data.values.max(axis=1)
    y = np.arange(len(data.series))

    for i, series in enumerate(data.series):
        ax.plot([mins[series], maxs[series]], [i, i], linewidth=4, color=get_color(i), alpha=0.75)
        ax.scatter([mins[series], maxs[series]], [i, i], s=36, color=get_color(i), edgecolor="white", zorder=3)
        ax.text(maxs[series], i, f" {maxs[series]:,.0f}", va="center", fontsize=7)

    ax.set_yticks(y)
    ax.set_yticklabels([wrap_label(x, 11) for x in data.series])
    ax.set_xlabel("최소~최대")
    add_title(ax, data, "RANGE 01 · 범례별 최소-최대 범위")
    add_clean_axes(ax, grid_axis="x")
    return fig


def plot_range_02_dumbbell_first_last(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)

    first = data.labels[0]
    last = data.labels[-1] if len(data.labels) > 1 else data.labels[0]
    y = np.arange(len(data.series))

    for i, series in enumerate(data.series):
        x1 = data.values.loc[series, first]
        x2 = data.values.loc[series, last]
        ax.plot([x1, x2], [i, i], color="#B8B8B8", linewidth=2.2)
        ax.scatter(x1, i, s=34, color=get_color(0), label=first if i == 0 else None)
        ax.scatter(x2, i, s=34, color=get_color(1), label=last if i == 0 else None)

    ax.set_yticks(y)
    ax.set_yticklabels([wrap_label(x, 11) for x in data.series])
    ax.set_xlabel("값")
    add_title(ax, data, "RANGE 02 · 시작-종료 덤벨 범위")
    add_clean_axes(ax, grid_axis="x")
    ax.legend(fontsize=7)
    return fig


def plot_range_03_label_minmax(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    mins = data.values.min(axis=0)
    maxs = data.values.max(axis=0)
    x = np.arange(len(data.labels))

    for i, label in enumerate(data.labels):
        ax.plot([i, i], [mins[label], maxs[label]], linewidth=5, color=get_color(i), alpha=0.75)
        ax.scatter(i, mins[label], s=28, color=get_color(i), edgecolor="white")
        ax.scatter(i, maxs[label], s=28, color=get_color(i), edgecolor="white")
        ax.text(i, maxs[label], f"{maxs[label]:,.0f}", ha="center", va="bottom", fontsize=7)

    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("최소~최대")
    add_title(ax, data, "RANGE 03 · 레이블별 세로 범위")
    add_clean_axes(ax)
    return fig


def plot_range_04_band(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    x = label_positions(data)
    mins = data.values.min(axis=0).values
    maxs = data.values.max(axis=0).values
    means = data.values.mean(axis=0).values

    ax.fill_between(x, mins, maxs, color=get_color(1), alpha=0.26, label="최소~최대")
    ax.plot(x, means, color=get_color(0), linewidth=2.0, marker="o", label="평균")
    set_xlabels(ax, data.labels, rotation=0)
    ax.set_ylabel("값")
    add_title(ax, data, "RANGE 04 · 범위 밴드 차트")
    add_clean_axes(ax)
    ax.legend(fontsize=7)
    return fig


# ============================================================
# 12. ICON 4종
# ============================================================

def plot_icon_01_solar_system_planets(data: ChartData) -> plt.Figure:
    """Solar System planets 스타일의 원형 버블 차트 (항목 기준)."""
    fig, ax = plt.subplots(figsize=(7.2, 4.8))

    # 범례 기준 -> 항목 기준으로 변경
    totals = label_totals(data).sort_values(ascending=False)

    if totals.empty:
        totals = pd.Series([1.0], index=["데이터 없음"])

    labels = list(totals.index)
    values = totals.values.astype(float)
    max_value = safe_max(values)

    max_radius = 4.2
    min_radius = 0.35
    radii = min_radius + np.sqrt(values / max_value) * (max_radius - min_radius)

    # 원 그리기
    for i, (name, value, radius) in enumerate(zip(labels, values, radii)):
        circle = plt.Circle(
            (0, radius),
            radius,
            facecolor=get_color(i),
            edgecolor="#4A4A4A",
            linewidth=0.6,
            alpha=0.30,
            zorder=1 + i,
        )
        ax.add_patch(circle)

    biggest = max(radii)

    # 라벨 위치 계산 (겹침 방지)
    raw_y = [2 * r for r in radii]
    adjusted_y = raw_y[:]
    min_gap = biggest * 0.10

    for i in range(1, len(adjusted_y)):
        if adjusted_y[i - 1] - adjusted_y[i] < min_gap:
            adjusted_y[i] = adjusted_y[i - 1] - min_gap

    label_x = biggest * 1.08

    for i, (name, value, radius, y_text) in enumerate(zip(labels, values, radii, adjusted_y)):
        y_anchor = 2 * radius

        # 연결선
        ax.plot(
            [0, label_x - biggest * 0.04],
            [y_anchor, y_text],
            color="#7A7A7A",
            linewidth=0.8,
            zorder=20,
        )

        # 라벨 + 값
        ax.text(
            label_x,
            y_text,
            f"{name} ({value:,.0f})",
            ha="left",
            va="center",
            fontsize=8,
            zorder=30,
        )

    ax.set_xlim(-biggest * 1.20, biggest * 1.70)
    ax.set_ylim(0, max(adjusted_y) + biggest * 0.18)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(
        f"{data.title}\nICON 01 · Solar System planets 스타일 버블 차트",
        loc="left",
        fontsize=11,
        weight="bold",
    )

    return fig


def plot_icon_02_proportional_symbols(data: ChartData) -> plt.Figure:
    import matplotlib.gridspec as gridspec

    # --------------------------------------------------
    # 1) 데이터 준비
    # --------------------------------------------------
    df = data.values.copy()

    if df.empty:
        df = pd.DataFrame([[1.0]], index=["데이터 없음"], columns=["항목1"])

    def sort_key(x):
        sx = str(x)
        try:
            return (0, int(sx))
        except Exception:
            return (1, sx)

    year_order = sorted(df.index.tolist(), key=sort_key)   # 2023, 2024, 2025 순
    item_names = list(df.columns)

    item_colors = {item: get_color(i) for i, item in enumerate(item_names)}

    # --------------------------------------------------
    # 2) figure / layout
    #    왼쪽: 본 그래프
    #    오른쪽: 범례 영역
    # --------------------------------------------------
    fig = plt.figure(figsize=(10.2, 5.4))
    gs = gridspec.GridSpec(
        nrows=1,
        ncols=2,
        width_ratios=[5.2, 1.25],
        wspace=0.08,
        figure=fig,
    )

    ax = fig.add_subplot(gs[0, 0])

    right_gs = gs[0, 1].subgridspec(
        nrows=2,
        ncols=1,
        height_ratios=[1.2, 1.0],
        hspace=0.28,
    )
    size_ax = fig.add_subplot(right_gs[0, 0])
    item_ax = fig.add_subplot(right_gs[1, 0])

    # --------------------------------------------------
    # 3) 모든 셀(연도 x 항목)을 점으로 펼치기
    # --------------------------------------------------
    records = []

    if len(item_names) == 1:
        offsets = [0.0]
    else:
        offsets = np.linspace(-0.18, 0.18, len(item_names))

    for y_idx, year in enumerate(year_order):
        for item_idx, item in enumerate(item_names):
            value = float(df.loc[year, item])
            records.append(
                {
                    "year": str(year),
                    "item": str(item),
                    "value": value,
                    "y_base": y_idx,
                    "y": y_idx + offsets[item_idx],
                    "color": item_colors[item],
                }
            )

    plot_df = pd.DataFrame(records)

    # --------------------------------------------------
    # 4) 크기 스케일 (People 기준: 1 ~ 최대값)
    # --------------------------------------------------
    max_value = max(float(plot_df["value"].max()), 1.0)
    min_size = 70
    max_size = 2300

    def scale_size(v: float) -> float:
        # 값 0 또는 1도 너무 작지 않게
        if max_value <= 1:
            return min_size
        v = max(v, 1.0)
        return min_size + np.sqrt((v - 1.0) / (max_value - 1.0)) * (max_size - min_size)

    plot_df["size"] = plot_df["value"].apply(scale_size)

    # --------------------------------------------------
    # 5) 본 그래프
    # --------------------------------------------------
    ax.scatter(
        plot_df["value"],
        plot_df["y"],
        s=plot_df["size"],
        c=plot_df["color"],
        alpha=0.82,
        edgecolor="white",
        linewidth=0.9,
        zorder=3,
        clip_on=False,
    )

    x_min = float(plot_df["value"].min())
    x_max = float(plot_df["value"].max())
    x_span = max(x_max - x_min, 1.0)

    # 값 라벨
    for _, row in plot_df.iterrows():
        ax.text(
            row["value"] + x_span * 0.010,
            row["y"],
            f"{row['value']:,.0f}",
            ha="left",
            va="center",
            fontsize=7.2,
            color="#333333",
        )

    # y축: 2023, 2024, 2025 위에서 아래로
    ax.set_yticks(np.arange(len(year_order)))
    ax.set_yticklabels([str(y) for y in year_order])
    ax.invert_yaxis()

    ax.set_xlabel("합계")
    add_title(ax, data, "ICON 02 · 비례 심벌 차트")
    add_clean_axes(ax, grid_axis="x")

    # 범례 영역 침범 안 하도록 x축 여백 최소화
    ax.set_xlim(max(0, x_min - x_span * 0.06), x_max + x_span * 0.04)
    ax.set_ylim(len(year_order) - 0.5, -0.5)

    # --------------------------------------------------
    # 6) 심벌 크기 범례 (우측 상단)
    # --------------------------------------------------
    size_ax.axis("off")
    size_ax.text(
        0.00, 1.02,
        "심벌 크기\n(People)",
        ha="left",
        va="bottom",
        fontsize=10,
        weight="bold",
        color="#222222",
    )

    # 1 ~ 최대값 기준
    if max_value <= 4:
        size_levels = [1, max_value]
    else:
        size_levels = [
            1,
            round(max_value * 0.33),
            round(max_value * 0.66),
            round(max_value),
        ]

    # 중복 제거
    uniq = []
    for v in size_levels:
        v = max(1, int(v))
        if v not in uniq:
            uniq.append(v)
    size_levels = uniq

    # 큰 원이 위쪽
    y_positions = np.linspace(0.78, 0.18, len(size_levels))

    for value, ypos in zip(size_levels[::-1], y_positions):
        bubble_size = scale_size(value) * 0.42
        size_ax.scatter(
            0.18,
            ypos,
            s=bubble_size,
            facecolors="none",
            edgecolors="#7A7A7A",
            linewidths=1.2,
            alpha=0.95,
        )
        size_ax.text(
            0.52,
            ypos,
            f"{int(value):,}",
            ha="left",
            va="center",
            fontsize=9,
            color="#333333",
            fontweight="bold",
        )

    size_ax.set_xlim(0, 1)
    size_ax.set_ylim(0, 1)

    # --------------------------------------------------
    # 7) 항목 범례 (우측 하단)
    # --------------------------------------------------
    item_ax.axis("off")
    item_ax.text(
        0.00, 1.02,
        "항목",
        ha="left",
        va="bottom",
        fontsize=10,
        weight="bold",
        color="#222222",
    )

    if len(item_names) > 0:
        item_y = np.linspace(0.82, max(0.20, 0.82 - (len(item_names) - 1) * 0.16), len(item_names))
    else:
        item_y = []

    for item, ypos in zip(item_names, item_y):
        item_ax.scatter(
            0.10,
            ypos,
            s=120,
            color=item_colors[item],
            edgecolors="none",
        )
        item_ax.text(
            0.24,
            ypos,
            str(item),
            ha="left",
            va="center",
            fontsize=9,
            color="#333333",
        )

    item_ax.set_xlim(0, 1)
    item_ax.set_ylim(0, 1)

    return fig


def plot_icon_03_waffle(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_SQUARE)
    totals = _pie_values(data)
    total_sum = totals.sum()
    shares = np.round(totals / total_sum * 100).astype(int)
    diff = 100 - shares.sum()
    if len(shares) > 0:
        shares.iloc[0] += diff

    colors = []
    labels = []
    for i, (name, count) in enumerate(shares.items()):
        colors.extend([get_color(i)] * max(int(count), 0))
        labels.append(f"{name}: {totals[name] / total_sum * 100:.1f}%")
    colors = (colors + ["#F0F0F0"] * 100)[:100]

    for idx in range(100):
        row = idx // 10
        col = idx % 10
        ax.add_patch(patches.Rectangle((col, 9 - row), 0.82, 0.82, color=colors[idx]))

    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.legend(
        handles=[patches.Patch(color=get_color(i), label=label) for i, label in enumerate(labels)],
        fontsize=7,
        loc="center left",
        bbox_to_anchor=(1.0, 0.5),
    )
    ax.set_title(f"{data.title}\nICON 03 · 와플 아이콘 차트", loc="left", fontsize=11, weight="bold")
    return fig


def plot_icon_04_radial_chart(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=(6.4, 4.2))

    # 기존 파이 기준값 사용
    totals = _pie_values(data).sort_values(ascending=False)
    totals = totals[totals > 0]

    if totals.empty:
        totals = pd.Series([1.0], index=["데이터 없음"])

    chart_labels = list(totals.index)
    chart_values = totals.values.astype(float)
    total_sum = float(np.sum(chart_values))

    if total_sum == 0:
        chart_labels = ["데이터 없음"]
        chart_values = np.array([1.0])
        total_sum = 1.0

    n = len(chart_values)

    # 파랑 계열 색상
    if n == 1:
        chart_colors = ["#6096BA"]
    else:
        color_positions = np.linspace(0.40, 0.85, n)
        chart_colors = [plt.cm.Blues(pos) for pos in color_positions]

    radius = 1.0
    inner_radius = 0.42
    ring_width = radius - inner_radius

    # 위쪽 반원(0~180도)
    current_angle = 180.0

    legend_handles = []
    legend_labels = []

    for label, value, color in zip(chart_labels, chart_values, chart_colors):
        extent = 180.0 * (value / total_sum)

        theta1 = current_angle - extent
        theta2 = current_angle

        wedge = patches.Wedge(
            center=(0, 0),
            r=radius,
            theta1=theta1,
            theta2=theta2,
            width=ring_width,
            facecolor=color,
            edgecolor="white",
            linewidth=2.0,
        )
        ax.add_patch(wedge)

        pct = value / total_sum * 100

        # 퍼센트 라벨: 너무 작은 조각은 겹침 방지 위해 생략
        if pct >= 6 or n <= 4:
            mid_angle = np.deg2rad((theta1 + theta2) / 2)
            text_r = inner_radius + ring_width * 0.52
            ax.text(
                text_r * np.cos(mid_angle),
                text_r * np.sin(mid_angle),
                f"{pct:.0f}%",
                ha="center",
                va="center",
                fontsize=8,
                color="white",
                weight="bold",
            )

        legend_handles.append(
            patches.Patch(facecolor=color, edgecolor="none")
        )
        legend_labels.append(f"{label} ({pct:.0f}%)")

        current_angle -= extent

    # 가운데 원: 아래쪽까지 다 보이게 전체 원 그림
    gap = 0.06
    
    inner_circle = plt.Circle(
        (0, 0),
        inner_radius - gap,
        facecolor="#F2F2F2",
        edgecolor="none",
        zorder=0,
        clip_on=False,
    )
    ax.add_patch(inner_circle)

    # 상단 설명
    ax.text(
        -1.08,
        1.10,
        f"% of values ({n})",
        ha="left",
        va="bottom",
        fontsize=8,
        color="#222222",
    )

    # 우측 범례
    ax.legend(
        legend_handles,
        legend_labels,
        loc="center left",
        bbox_to_anchor=(1.02, 0.45),
        frameon=False,
        fontsize=7.5,
        title="범례",
        title_fontsize=8,
        labelspacing=1.0,
        borderaxespad=0.0,
        handlelength=1.2,
    )

    # 우측 범례 공간 확보
    fig.subplots_adjust(right=0.80)

    # 아래쪽 안쪽 원까지 보이도록 ylim 여유 확보
    ax.set_xlim(-1.15, 1.15)
    ax.set_ylim(-(inner_radius + 0.12), radius + 0.15)
    ax.set_aspect("equal")
    ax.axis("off")

    ax.set_title(
        f"{data.title}\nPIE 04 · 반원 도넛 차트",
        loc="left",
        fontsize=11,
        weight="bold",
    )

    return fig


# ============================================================
# 13. TREEMAP 4종
# ============================================================

def _binary_treemap(labels: list[str], values: list[float], x: float, y: float, w: float, h: float) -> list[tuple[float, float, float, float, str, float]]:
    """외부 패키지 없이 동작하는 간단한 이진 분할 트리맵."""
    items = [(label, max(float(value), 0.0)) for label, value in zip(labels, values) if float(value) > 0]
    if not items:
        return [(x, y, w, h, "데이터 없음", 1.0)]

    if len(items) == 1:
        label, value = items[0]
        return [(x, y, w, h, label, value)]

    total = sum(value for _, value in items)
    half = total / 2
    acc = 0.0
    split_idx = 0

    for idx, (_, value) in enumerate(items):
        if acc + value <= half or idx == 0:
            acc += value
            split_idx = idx + 1
        else:
            break

    left = items[:split_idx]
    right = items[split_idx:]

    if not right:
        left = items[:-1]
        right = items[-1:]
        acc = sum(value for _, value in left)

    if w >= h:
        w_left = w * (acc / total)
        return (
            _binary_treemap([i[0] for i in left], [i[1] for i in left], x, y, w_left, h)
            + _binary_treemap([i[0] for i in right], [i[1] for i in right], x + w_left, y, w - w_left, h)
        )

    h_top = h * (acc / total)
    return (
        _binary_treemap([i[0] for i in left], [i[1] for i in left], x, y, w, h_top)
        + _binary_treemap([i[0] for i in right], [i[1] for i in right], x, y + h_top, w, h - h_top)
    )


def _draw_treemap(ax, labels: list[str], values: list[float], title: str) -> None:
    order = np.argsort(values)[::-1]
    labels = [labels[i] for i in order]
    values = [float(values[i]) for i in order]

    rects = _binary_treemap(labels, values, 0, 0, 100, 60)
    max_value = safe_max(np.array([r[5] for r in rects]))

    for i, (x, y, w, h, label, value) in enumerate(rects):
        alpha = 0.45 + 0.45 * (value / max_value)
        rect = patches.Rectangle((x, y), w, h, facecolor=get_color(i), edgecolor="white", linewidth=1.0, alpha=alpha)
        ax.add_patch(rect)
        if w * h > 120:
            ax.text(
                x + w / 2,
                y + h / 2,
                f"{wrap_label(label, 9)}\n{value:,.0f}",
                ha="center",
                va="center",
                fontsize=7,
                color="#111111",
            )

    ax.set_xlim(0, 100)
    ax.set_ylim(0, 60)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, loc="left", fontsize=11, weight="bold")


def plot_treemap_01_series(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    totals = series_totals(data)
    _draw_treemap(ax, list(totals.index), list(totals.values), f"{data.title}\nTREEMAP 01 · 범례별 트리맵")
    return fig


def plot_treemap_02_label(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    totals = label_totals(data)
    _draw_treemap(ax, list(totals.index), list(totals.values), f"{data.title}\nTREEMAP 02 · 레이블별 트리맵")
    return fig


def plot_treemap_03_cell(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    labels = []
    values = []
    for series in data.series:
        for label in data.labels:
            value = float(data.values.loc[series, label])
            if value > 0:
                labels.append(f"{series}-{label}")
                values.append(value)

    if not labels:
        labels, values = ["데이터 없음"], [1.0]

    _draw_treemap(ax, labels, values, f"{data.title}\nTREEMAP 03 · 세부 셀 트리맵")
    return fig


def plot_treemap_04_topn(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    totals = series_totals(data).head(8)
    etc = series_totals(data).iloc[8:].sum()
    if etc > 0:
        totals.loc["기타"] = etc

    _draw_treemap(ax, list(totals.index), list(totals.values), f"{data.title}\nTREEMAP 04 · 상위 항목 중심 트리맵")
    return fig


# ============================================================
# 14. DOT 4종
# ============================================================

def plot_dot_01_series(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)
    totals = series_totals(data).sort_values()
    y = np.arange(len(totals))

    ax.scatter(totals.values, y, s=52, color=[get_color(i) for i in range(len(totals))])
    ax.hlines(y, 0, totals.values, color="#D0D0D0", linewidth=1.0)
    ax.set_yticks(y)
    ax.set_yticklabels([wrap_label(x, 11) for x in totals.index])
    ax.set_xlabel("합계")
    add_title(ax, data, "DOT 01 · 범례별 도트 플롯")
    add_clean_axes(ax, grid_axis="x")
    return fig


def plot_dot_02_matrix(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    max_value = safe_max(matrix(data))

    for row, series in enumerate(data.series):
        for col, label in enumerate(data.labels):
            value = float(data.values.loc[series, label])
            size = 25 + ensure_positive(np.array([value]))[0] / max_value * 220
            ax.scatter(col, row, s=size, color=get_color(row), alpha=0.72, edgecolor="white")

    ax.set_xticks(np.arange(len(data.labels)))
    ax.set_xticklabels([wrap_label(x, 8) for x in data.labels])
    ax.set_yticks(np.arange(len(data.series)))
    ax.set_yticklabels([wrap_label(x, 10) for x in data.series])
    ax.invert_yaxis()
    add_title(ax, data, "DOT 02 · 도트 매트릭스")
    add_clean_axes(ax, grid_axis=None)
    return fig


def plot_dot_03_dumbbell(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)

    first = data.labels[0]
    last = data.labels[-1] if len(data.labels) > 1 else data.labels[0]
    y = np.arange(len(data.series))

    for i, series in enumerate(data.series):
        x1 = float(data.values.loc[series, first])
        x2 = float(data.values.loc[series, last])
        ax.plot([x1, x2], [i, i], color="#D0D0D0", linewidth=1.4)
        ax.scatter(x1, i, s=44, color=get_color(0), label=first if i == 0 else None)
        ax.scatter(x2, i, s=44, color=get_color(1), label=last if i == 0 else None)

    ax.set_yticks(y)
    ax.set_yticklabels([wrap_label(x, 11) for x in data.series])
    ax.set_xlabel("값")
    add_title(ax, data, "DOT 03 · 연결 도트 플롯")
    add_clean_axes(ax, grid_axis="x")
    ax.legend(fontsize=7)
    return fig


def plot_dot_04_label_rank(data: ChartData) -> plt.Figure:
    fig, ax = plt.subplots(figsize=FIGSIZE_STANDARD)
    totals = label_totals(data).sort_values()
    y = np.arange(len(totals))

    ax.scatter(totals.values, y, s=56, color=[get_color(i) for i in range(len(totals))])
    for idx, value in enumerate(totals.values):
        ax.text(value, idx, f" {value:,.0f}", va="center", fontsize=7)
    ax.set_yticks(y)
    ax.set_yticklabels([wrap_label(x, 11) for x in totals.index])
    ax.set_xlabel("합계")
    add_title(ax, data, "DOT 04 · 레이블 순위 도트 플롯")
    add_clean_axes(ax, grid_axis="x")
    return fig


# ============================================================
# 15. 생성 엔진
# ============================================================

CHARTS: dict[str, list[tuple[str, Callable[[ChartData], plt.Figure]]]] = {
    "BAR": [
        ("grouped_bar", plot_bar_01_grouped),
        ("stacked_bar", plot_bar_02_stacked),
        ("horizontal_rank_bar", plot_bar_03_horizontal_rank),
        ("floating_column", plot_bar_04_floating_column),
    ],
    "LINE": [
        ("basic_line", plot_line_01_basic),
        ("smooth_line", plot_line_02_smooth),
        ("step_line", plot_line_03_step),
        ("slope_chart", plot_line_04_slope),
    ],
    "AREA": [
        ("basic_area", plot_area_01_basic),
        ("stacked_area", plot_area_02_stacked),
        ("stream_area", plot_area_03_stream),
        ("percent_area", plot_area_04_percent),
    ],
    "SCATTER": [
        ("basic_scatter", plot_scatter_01_basic),
        ("bubble_scatter", plot_scatter_02_bubble),
        ("connected_scatter", plot_scatter_03_connected),
        ("quadrant_scatter", plot_scatter_04_quadrant),
    ],
    "PIE": [
        ("basic_pie", plot_pie_01_basic),
        ("donut", plot_pie_02_donut),
        ("nested_donut", plot_pie_03_nested_donut),
        ("rose_pie", plot_pie_04_rose),
    ],
    "HEATMAP": [
        ("matrix_heatmap", plot_heatmap_01_matrix),
        ("annotated_heatmap", plot_heatmap_02_annotated),
        ("one_dimensional_heatmap", plot_heatmap_03_one_dimensional),
        ("normalized_heatmap", plot_heatmap_04_normalized),
    ],
    "RANGE": [
        ("series_minmax_range", plot_range_01_series_minmax),
        ("first_last_dumbbell", plot_range_02_dumbbell_first_last),
        ("label_minmax_range", plot_range_03_label_minmax),
        ("range_band", plot_range_04_band),
    ],
    "ICON": [
        ("solar_system_planets", plot_icon_01_solar_system_planets),
        ("proportional_symbols", plot_icon_02_proportional_symbols),
        ("waffle_icon", plot_icon_03_waffle),
        ("radial_chart", plot_icon_04_radial_chart),
    ],
    "TREEMAP": [
        ("series_treemap", plot_treemap_01_series),
        ("label_treemap", plot_treemap_02_label),
        ("cell_treemap", plot_treemap_03_cell),
        ("topn_treemap", plot_treemap_04_topn),
    ],
    "DOT": [
        ("series_dot", plot_dot_01_series),
        ("dot_matrix", plot_dot_02_matrix),
        ("connected_dot", plot_dot_03_dumbbell),
        ("label_rank_dot", plot_dot_04_label_rank),
    ],
}


def generate_all_graphs(input_file: Path, output_root: Path, dpi: int, sheet: str | None = None) -> list[Path]:
    setup_matplotlib()

    if not input_file.exists():
        raise FileNotFoundError(f"입력 파일을 찾을 수 없습니다: {input_file}")

    datasets = read_workbook(input_file, target_sheet=sheet)
    saved_files: list[Path] = []

    for data in datasets:
        print(f"[처리] sheet={data.sheet_name}, title={data.title}, series={len(data.series)}, labels={len(data.labels)}")

        for group, chart_specs in CHARTS.items():
            for variant_no, (variant_name, plot_func) in enumerate(chart_specs, start=1):
                try:
                    fig = plot_func(data)
                    saved_list = save_fig(fig, output_root, group, data, variant_no, variant_name, dpi)
                    saved_files.extend(saved_list)
                    for saved in saved_list:
                        print(f"  - 저장: {saved}")
                except Exception as exc:
                    print(f"  - 실패: {group} {variant_no:02d} {variant_name}: {exc}")

    return saved_files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="2026 연차평가 보고서 그래프 일괄 생성")
    parser.add_argument("--input", default=str(DEFAULT_INPUT_FILE), help="입력 엑셀 파일 경로")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_ROOT), help="그래프 저장 기준 폴더")
    parser.add_argument("--dpi", type=int, default=DEFAULT_DPI, help="PNG 등 래스터 이미지 저장 시 사용할 DPI")
    parser.add_argument("--sheet", default=None, help="특정 시트만 처리할 경우 시트명 입력")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_file = Path(args.input)
    output_root = Path(args.output)

    saved_files = generate_all_graphs(
        input_file=input_file,
        output_root=output_root,
        dpi=args.dpi,
        sheet=args.sheet,
    )

    print("\n완료")
    print(f"입력 파일: {input_file}")
    print(f"저장 기준 폴더: {output_root}")
    print(f"DPI: {args.dpi}")
    print(f"생성 파일 수: {len(saved_files)}개")


if __name__ == "__main__":
    main()
