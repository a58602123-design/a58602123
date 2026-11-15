#!/usr/bin/env python3
"""Regenerate 11-light charts with LARGE fonts for phone readability."""
from __future__ import annotations

import json
import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.patches import Patch
import numpy as np

ROOT = Path("/workspace/fred-11lights")
WEEK = Path("/workspace/shared-tasks/金融危機11燈/週報/2026-11-08")
os.chdir(ROOT)

for p in [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
]:
    if os.path.exists(p):
        fm.fontManager.addfont(p)

plt.rcParams["font.family"] = "Noto Sans CJK TC"
plt.rcParams["axes.unicode_minus"] = False
plt.rcParams["figure.facecolor"] = "#FAFBFC"
plt.rcParams["axes.facecolor"] = "#FFFFFF"
plt.rcParams["axes.edgecolor"] = "#D0D7DE"
plt.rcParams["axes.grid"] = True
plt.rcParams["grid.color"] = "#EEF1F4"
plt.rcParams["grid.linewidth"] = 1.1
plt.rcParams["axes.titleweight"] = "bold"

COLOR = {0: "綠", 1: "黃", 2: "紅"}
HEX = {0: "#1A7F37", 1: "#BF8700", 2: "#CF222E"}
HEX_SOFT = {0: "#DAFBE1", 1: "#FFF8C5", 2: "#FFEBE9"}

TITLE = 40
AXIS = 28
TICK = 26
LEGEND = 26
TABLE = 26
TABLE_HDR = 28
ANNOT = 24
DPI = 220


def polish(ax, labelsize=TICK):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#D0D7DE")
    ax.spines["bottom"].set_color("#D0D7DE")
    ax.tick_params(colors="#57606A", labelsize=labelsize, width=1.4, length=7)


def chart_lights(lights, total, band_zh, asof, out: Path):
    ordered = sorted(lights, key=lambda L: (-L["current_score"], L["id"]))
    labels = [f"{L['id']} {L['name']}" for L in ordered]
    scores = [L["current_score"] for L in ordered]
    colors = [HEX[s] for s in scores]
    values = [L["current_value"] for L in ordered]

    fig, ax = plt.subplots(figsize=(18, 16), dpi=DPI)
    y = np.arange(len(ordered))
    widths = [s if s > 0 else 0.20 for s in scores]
    stub = [colors[i] if scores[i] > 0 else "#4AC26B" for i in range(len(scores))]
    bars = ax.barh(
        y, widths, color=stub, height=0.70, edgecolor="white", linewidth=1.4, zorder=3
    )
    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=TICK)
    ax.set_xlim(0, 2.65)
    ax.set_xticks([0, 1, 2])
    ax.set_xticklabels(["0 綠", "1 黃", "2 紅"], fontsize=TICK)
    ax.invert_yaxis()
    ax.set_xlabel("分數", fontsize=AXIS, color="#57606A", labelpad=12)
    ax.set_title(
        f"金融危機11燈 · 各燈分數｜總分 {total}/22 · {band_zh}\n資料截至 {asof}（台北時間）· V1.1",
        fontsize=TITLE,
        pad=20,
        color="#1F2328",
    )
    for bar, val, sc, w in zip(bars, values, scores, widths):
        ax.text(
            w + 0.09,
            bar.get_y() + bar.get_height() / 2,
            f"{val}  ·  {COLOR[sc]}",
            va="center",
            ha="left",
            fontsize=ANNOT,
            color="#24292F",
        )
    ax.legend(
        handles=[
            Patch(facecolor=HEX[0], label="綠 0"),
            Patch(facecolor=HEX[1], label="黃 1"),
            Patch(facecolor=HEX[2], label="紅 2"),
        ],
        loc="lower right",
        frameon=True,
        fancybox=True,
        framealpha=0.95,
        edgecolor="#D0D7DE",
        fontsize=LEGEND,
    )
    polish(ax)
    ax.grid(axis="x", zorder=0)
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    fig.savefig(out, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_compare(lights, total, band_zh, asof, out: Path):
    # Tall phone-friendly canvas so table text stays large
    fig = plt.figure(figsize=(20, 26), dpi=DPI)
    gs = fig.add_gridspec(2, 1, height_ratios=[0.85, 1.65], hspace=0.18)
    ax = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1])

    ordered = sorted(lights, key=lambda L: L["id"])
    labels = [L["id"] for L in ordered]
    cur_s = [L["current_score"] for L in ordered]
    prev_s = [L["prev_score"] for L in ordered]
    x = np.arange(len(ordered))
    w = 0.38
    ax.bar(
        x - w / 2, cur_s, w, label="當前分數", color="#0969DA",
        edgecolor="white", linewidth=1.1, zorder=3,
    )
    ax.bar(
        x + w / 2, prev_s, w, label="前一期分數", color="#8C959F",
        edgecolor="white", linewidth=1.1, zorder=3,
    )
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=TICK)
    ax.set_ylim(0, 2.6)
    ax.set_yticks([0, 1, 2])
    ax.set_yticklabels(["0", "1", "2"], fontsize=TICK)
    ax.set_ylabel("分數（0–2）", fontsize=AXIS, color="#57606A", labelpad=12)
    ax.set_title(
        f"當前 vs 前一期分數比較｜總分 {total}/22 · {band_zh}｜截至 {asof}",
        fontsize=TITLE,
        pad=16,
        color="#1F2328",
    )
    ax.legend(
        loc="upper right", frameon=True, fancybox=True,
        edgecolor="#D0D7DE", fontsize=LEGEND,
    )
    polish(ax)
    ax.grid(axis="y", zorder=0)
    ax.grid(axis="x", visible=False)

    ax2.axis("off")
    ax2.set_title(
        "各燈數值：當前｜前一期｜正常水準",
        fontsize=TITLE,
        pad=14,
        color="#1F2328",
        fontweight="bold",
        loc="left",
    )
    cell_text = []
    cell_colors = []
    for L in ordered:
        cell_text.append(
            [
                f"{L['id']} {L['name']}",
                f"{L['current_value']}（{L['current_color']} {L['current_score']}）",
                f"{L['prev_value']}（{L['prev_color']} {L['prev_score']}）",
                L["normal_level"],
            ]
        )
        cell_colors.append(
            [
                "#F6F8FA",
                HEX_SOFT[L["current_score"]],
                HEX_SOFT[L["prev_score"]],
                "#EAF5FF",
            ]
        )
    table = ax2.table(
        cellText=cell_text,
        colLabels=["燈號", "當前", "前一期", "正常水準"],
        cellColours=cell_colors,
        colColours=["#24292F"] * 4,
        cellLoc="center",
        colLoc="center",
        loc="upper center",
        bbox=[0.0, 0.01, 1.0, 0.92],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(TABLE)
    for (r, c), cell in table.get_celld().items():
        cell.set_edgecolor("#D0D7DE")
        cell.set_linewidth(1.0)
        txt = cell.get_text()
        txt.set_fontsize(TABLE_HDR if r == 0 else TABLE)
        if r == 0:
            txt.set_color("white")
            txt.set_fontweight("bold")
        elif c == 0:
            txt.set_ha("left")
            cell.PAD = 0.04
        cell.set_height(0.082)

    fig.suptitle(
        "金融危機11燈監控 V1.1 · 當前／前一期／正常水準",
        fontsize=TITLE,
        fontweight="bold",
        color="#1F2328",
        y=0.988,
    )
    fig.savefig(out, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_trend(history, total, band_zh, asof, out: Path):
    fig, ax = plt.subplots(figsize=(18, 12.5), dpi=DPI)
    xs = [h["asof"][5:].replace("-", "/") for h in history]
    ys = [h["total"] for h in history]
    ax.axhspan(0, 3.5, color="#DAFBE1", alpha=0.55, zorder=0, label="正常 0–3")
    ax.axhspan(3.5, 7.5, color="#FFF8C5", alpha=0.55, zorder=0, label="留意 4–7")
    ax.axhspan(7.5, 12.5, color="#FFEBE9", alpha=0.35, zorder=0, label="警戒 8–12")
    ax.plot(
        xs, ys, color="#0969DA", linewidth=3.6, marker="o", markersize=13,
        markerfacecolor="white", markeredgewidth=3.0, markeredgecolor="#0969DA",
        zorder=4, label="總分",
    )
    ax.scatter(
        [xs[-1]], [ys[-1]], s=340, color="#CF222E", zorder=5,
        edgecolors="white", linewidths=2.6,
    )
    ax.annotate(
        f"本週 {ys[-1]}",
        xy=(xs[-1], ys[-1]),
        xytext=(-56, 32),
        textcoords="offset points",
        fontsize=ANNOT,
        fontweight="bold",
        color="#CF222E",
        arrowprops=dict(arrowstyle="->", color="#CF222E", lw=2.0),
    )
    for x, y in zip(xs, ys):
        ax.text(
            x, y + 0.38, str(y), ha="center", va="bottom",
            fontsize=TICK, color="#57606A",
        )
    ax.set_ylim(-0.5, 11.5)
    ax.set_ylabel("總分／22", fontsize=AXIS, color="#57606A", labelpad=12)
    ax.set_title(
        f"近 8 週總分走勢（V1.1）｜目前 {total}/22 · {band_zh}｜截至 {asof}",
        fontsize=TITLE,
        pad=18,
        color="#1F2328",
    )
    ax.legend(
        loc="upper left", ncol=4, frameon=True, fancybox=True,
        edgecolor="#D0D7DE", fontsize=LEGEND,
    )
    polish(ax)
    ax.grid(axis="y", zorder=1)
    ax.grid(axis="x", visible=False)
    fig.tight_layout()
    fig.savefig(out, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    summary = json.load(open(WEEK / "summary.json"))
    history_path = WEEK / "history_8w.json"
    if not history_path.exists():
        history_path = ROOT / "history_v11_8w.json"
    history = json.load(open(history_path))
    lights = summary["lights"]
    total = summary["total"]
    band_zh = summary["band_zh"]
    asof = summary["asof"]

    for name, fn in (
        ("chart_lights.png", lambda p: chart_lights(lights, total, band_zh, asof, p)),
        ("chart_compare.png", lambda p: chart_compare(lights, total, band_zh, asof, p)),
        ("chart_trend.png", lambda p: chart_trend(history, total, band_zh, asof, p)),
    ):
        week_p = WEEK / name
        fn(week_p)
        root_p = ROOT / name
        root_p.write_bytes(week_p.read_bytes())
        print(f"{week_p} ({week_p.stat().st_size})")
        print(f"{root_p} ({root_p.stat().st_size})")


if __name__ == "__main__":
    main()
