#!/usr/bin/env python3
"""Upgrade 11-lights audit pack: 當前/前一期/正常水準 + polished charts."""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.patches import FancyBboxPatch
import numpy as np

ROOT = Path("/workspace/fred-11lights")
WEEK = Path("/workspace/shared-tasks/金融危機11燈/週報/2026-11-01")
SHARED = Path("/workspace/shared-tasks/金融危機11燈")
os.chdir(ROOT)

# Chinese fonts
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
plt.rcParams["grid.linewidth"] = 0.8
plt.rcParams["axes.titleweight"] = "bold"

COLOR = {0: "綠", 1: "黃", 2: "紅"}
TONE = {0: "success", 1: "warning", 2: "danger"}
HEX = {0: "#1A7F37", 1: "#BF8700", 2: "#CF222E"}
HEX_SOFT = {0: "#DAFBE1", 1: "#FFF8C5", 2: "#FFEBE9"}
NAMES = {
    "L01": "殖利率曲線",
    "L02": "SOFR 利差",
    "L03": "Fed 流動性",
    "L04": "高收益債利差",
    "L05": "金融壓力",
    "L06": "VIX",
    "L07": "美元趨勢",
    "L08": "薩姆規則",
    "L09": "初領失業金",
    "L10": "實質薪資",
    "L11": "標普回撤",
}

# Normal level = green-band representative (documented)
NORMAL = {
    "L01": {
        "level": "+0.30%",
        "raw": 0.30,
        "note": "綠區代表值 +0.30%（門檻 >+0.20%；陡峭健康）",
    },
    "L02": {
        "level": "2.5 bps",
        "raw": 2.5,
        "note": "綠區中位 2.5 bps（門檻 <5 bps；資金面平靜）",
    },
    "L03": {
        "level": "$2.5B",
        "raw": 2.5,
        "note": "綠區中位 $2.5B（門檻 <$5B；貼現窗口低用量）",
    },
    "L04": {
        "level": "3.00%",
        "raw": 3.0,
        "note": "綠區代表值 3.00%（門檻 <4.5%；信用利差正常）",
    },
    "L05": {
        "level": "−0.50",
        "raw": -0.50,
        "note": "綠區代表值 −0.50（門檻 <0；壓力低於歷史均值）",
    },
    "L06": {
        "level": "15.0",
        "raw": 15.0,
        "note": "綠區代表值 15（門檻 <20；波動率溫和）",
    },
    "L07": {
        "level": "+0.50%",
        "raw": 0.50,
        "note": "綠區中位 +0.50%（門檻 <+1.0%；美元溫和）",
    },
    "L08": {
        "level": "0.15%",
        "raw": 0.15,
        "note": "綠區中位 0.15%（門檻 <0.30%；就業無衰退訊號）",
    },
    "L09": {
        "level": "+0.0%",
        "raw": 0.0,
        "note": "綠區健康端 +0%（門檻 <+10%；初領相對低點無惡化）",
    },
    "L10": {
        "level": "+1.00%",
        "raw": 1.00,
        "note": "綠區代表值 +1.00%（門檻 >+0.50%；實質時薪溫和成長）",
    },
    "L11": {
        "level": "0.0%",
        "raw": 0.0,
        "note": "綠區健康端 0%（門檻 <10%；接近高點無明顯回撤）",
    },
}


def load(path: str):
    rows = []
    with open(path) as f:
        r = csv.DictReader(f)
        col = [c for c in r.fieldnames if c != "observation_date"][0]
        for row in r:
            v = row[col]
            if v in ("", ".", None):
                continue
            rows.append((row["observation_date"], float(v)))
    return rows


def score_l01(v):
    return 0 if v > 0.20 else (1 if v >= 0 else 2)


def score_l02(sp):
    return 0 if sp < 5 else (1 if sp <= 15 else 2)


def score_l03(b):
    return 0 if b < 5 else (1 if b <= 25 else 2)


def score_l04(v):
    return 0 if v < 4.5 else (1 if v <= 6 else 2)


def score_l05(v):
    return 0 if v < 0 else (1 if v <= 1 else 2)


def score_l06(v):
    return 0 if v < 20 else (1 if v <= 30 else 2)


def score_l07(rise):
    return 0 if rise < 1.0 else (1 if rise <= 2.5 else 2)


def score_l08(v):
    return 0 if v < 0.3 else (1 if v < 0.5 else 2)


def score_l09(g):
    return 0 if g < 10 else (1 if g <= 20 else 2)


def score_l10(yoy):
    return 0 if yoy > 0.5 else (1 if yoy >= -0.5 else 2)


def score_l11(ddn):
    return 0 if ddn < 10 else (1 if ddn <= 20 else 2)


def fmt_pct(v, signed=True, digits=2):
    if signed:
        return f"{v:+.{digits}f}%"
    return f"{v:.{digits}f}%"


def band(total):
    if total <= 3:
        return "GREEN", "正常", "success"
    if total <= 7:
        return "YELLOW", "留意", "warning"
    if total <= 12:
        return "ORANGE", "警戒", "warning"
    return "RED", "危機", "danger"


def ma20_rise_series(dx):
    """Return list of (date, rise%, ma_t, ma0, ago_date) for each valid index."""
    ma = []
    for i in range(19, len(dx)):
        ma.append((dx[i][0], sum(x[1] for x in dx[i - 19 : i + 1]) / 20))
    out = []
    for i in range(20, len(ma)):
        mt, ma_t = ma[i]
        ma0 = ma[i - 20]
        rise = (ma_t / ma0[1] - 1) * 100
        out.append((mt, rise, ma_t, ma0[1], ma0[0]))
    return out


def claims_gap_series(ic):
    vals = [a[1] for a in ic]
    out = []
    for i in range(3, len(vals)):
        cur = sum(vals[i - 3 : i + 1]) / 4
        # prior ~26 weeks of ma4 ending before current
        start = max(3, i - 26)
        prior_mas = [sum(vals[j - 3 : j + 1]) / 4 for j in range(start, i)]
        if not prior_mas:
            continue
        low = min(prior_mas)
        g = (cur / low - 1) * 100
        out.append((ic[i][0], g, cur, low))
    return out


def sp500_dd_at(sp, end_idx):
    window = [a[1] for a in sp[max(0, end_idx - 251) : end_idx + 1]]
    peak = max(window)
    lastp = window[-1]
    return (1 - lastp / peak) * 100, peak, lastp


def compute_all():
    rows = []

    # L01 daily
    t10 = load("T10Y2Y.csv")
    for idx, label in [( -1, "current"), (-2, "prev")]:
        d, v = t10[idx]
        sc = score_l01(v)
        rows.append(("L01", label, d, v, fmt_pct(v), sc))

    # L02 daily SOFR-EFFR
    so = dict(load("SOFR.csv"))
    ef = dict(load("EFFR.csv"))
    common = sorted(set(so) & set(ef))
    for idx, label in [(-1, "current"), (-2, "prev")]:
        dd = common[idx]
        sp = (so[dd] - ef[dd]) * 100
        sc = score_l02(sp)
        rows.append(("L02", label, dd, sp, f"{sp:.1f} bps", sc))

    # L03 weekly Wed
    wl = load("WLCFLPCL.csv")
    for idx, label in [(-1, "current"), (-2, "prev")]:
        d, v = wl[idx]
        b = v / 1000
        sc = score_l03(b)
        rows.append(("L03", label, d, b, f"${b:.2f}B", sc))

    # L04 daily
    hy = load("BAMLH0A0HYM2.csv")
    for idx, label in [(-1, "current"), (-2, "prev")]:
        d, v = hy[idx]
        sc = score_l04(v)
        rows.append(("L04", label, d, v, f"{v:.2f}%", sc))

    # L05 weekly
    st = load("STLFSI4.csv")
    for idx, label in [(-1, "current"), (-2, "prev")]:
        d, v = st[idx]
        sc = score_l05(v)
        disp = f"{v:+.4f}".rstrip("0").rstrip(".")
        rows.append(("L05", label, d, v, disp, sc))

    # L06 daily
    vx = load("VIXCLS.csv")
    for idx, label in [(-1, "current"), (-2, "prev")]:
        d, v = vx[idx]
        sc = score_l06(v)
        rows.append(("L06", label, d, v, f"{v:.2f}", sc))

    # L07 MA20 20d rise (daily after enough history)
    dx = load("DTWEXAFEGS.csv")
    rises = ma20_rise_series(dx)
    for idx, label in [(-1, "current"), (-2, "prev")]:
        mt, rise, ma_t, ma0, ago = rises[idx]
        sc = score_l07(rise)
        rows.append(("L07", label, mt, rise, fmt_pct(rise), sc))

    # L08 monthly
    sahm = load("SAHMCURRENT.csv")
    for idx, label in [(-1, "current"), (-2, "prev")]:
        d, v = sahm[idx]
        sc = score_l08(v)
        rows.append(("L08", label, d, v, f"{v:.2f}%", sc))

    # L09 weekly claims
    ic = load("ICSA.csv")
    gaps = claims_gap_series(ic)
    for idx, label in [(-1, "current"), (-2, "prev")]:
        d, g, cur, low = gaps[idx]
        sc = score_l09(g)
        rows.append(("L09", label, d, g, f"{g:+.1f}%", sc))

    # L10 monthly real AHE YoY
    ahe = load("CES0500000003.csv")
    cpi = load("CPIAUCSL.csv")

    def ym(d):
        return d[:7]

    ahe_m = {ym(d): (d, v) for d, v in ahe}
    cpi_m = {ym(d): (d, v) for d, v in cpi}
    months = sorted(set(ahe_m) & set(cpi_m))
    real = [
        (max(ahe_m[m][0], cpi_m[m][0]), m, ahe_m[m][1] / cpi_m[m][1])
        for m in months
    ]
    idx_map = {m: i for i, (_, m, _) in enumerate(real)}
    yoy_series = []
    for i, (dt, m, rv) in enumerate(real):
        y, mo = int(m[:4]), int(m[5:7])
        m2 = f"{y-1:04d}-{mo:02d}"
        if m2 in idx_map:
            prev = real[idx_map[m2]][2]
            yoy_series.append((dt, m, (rv / prev - 1) * 100, rv, prev))
    for idx, label in [(-1, "current"), (-2, "prev")]:
        dt, m, yoy, rv, prev = yoy_series[idx]
        sc = score_l10(yoy)
        rows.append(("L10", label, dt, yoy, fmt_pct(yoy), sc))

    # L11 daily drawdown
    sp = load("SP500.csv")
    for end_i, label in [(len(sp) - 1, "current"), (len(sp) - 2, "prev")]:
        ddn, peak, lastp = sp500_dd_at(sp, end_i)
        sc = score_l11(ddn)
        rows.append(("L11", label, sp[end_i][0], ddn, f"{ddn:.1f}%", sc))

    # pivot
    by_id = {}
    for lid, label, d, raw, disp, sc in rows:
        by_id.setdefault(lid, {})[label] = dict(
            date=d, raw=raw, display=disp, score=sc, color=COLOR[sc], tone=TONE[sc]
        )

    lights = []
    for lid in [f"L{i:02d}" for i in range(1, 12)]:
        cur = by_id[lid]["current"]
        prev = by_id[lid]["prev"]
        n = NORMAL[lid]
        series_map = {
            "L01": "T10Y2Y",
            "L02": "SOFR−EFFR",
            "L03": "WLCFLPCL",
            "L04": "BAMLH0A0HYM2",
            "L05": "STLFSI4",
            "L06": "VIXCLS",
            "L07": "DTWEXAFEGS",
            "L08": "SAHMCURRENT",
            "L09": "ICSA",
            "L10": "CES0500000003/CPIAUCSL",
            "L11": "SP500",
        }
        if cur["color"] != prev["color"]:
            vs = f"{prev['color']}→{cur['color']}"
        else:
            vs = "→"
        lights.append(
            dict(
                id=lid,
                name=NAMES[lid],
                series=series_map[lid],
                date=cur["date"],
                prev_date=prev["date"],
                current_value=cur["display"],
                current_raw=cur["raw"],
                current_score=cur["score"],
                current_color=cur["color"],
                current_tone=cur["tone"],
                prev_value=prev["display"],
                prev_raw=prev["raw"],
                prev_score=prev["score"],
                prev_color=prev["color"],
                prev_tone=prev["tone"],
                normal_level=n["level"],
                normal_raw=n["raw"],
                normal_note=n["note"],
                vs_prev_period=vs,
                # aliases used by page
                display=cur["display"],
                color=cur["color"],
                score=cur["score"],
                tone=cur["tone"],
                raw=cur["raw"],
            )
        )
    return lights


def write_csv(lights, path: Path):
    cols = [
        "id",
        "name",
        "series",
        "date",
        "current_value",
        "current_score",
        "current_color",
        "prev_date",
        "prev_value",
        "prev_score",
        "prev_color",
        "normal_level",
        "normal_note",
        "vs_prev_period",
    ]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for L in lights:
            w.writerow({c: L.get(c, "") for c in cols})


def polish_style(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#D0D7DE")
    ax.spines["bottom"].set_color("#D0D7DE")
    ax.tick_params(colors="#57606A", labelsize=9)


def chart_lights(lights, total, band_zh, asof, out: Path):
    # sort severe first
    ordered = sorted(lights, key=lambda L: (-L["current_score"], L["id"]))
    labels = [f"{L['id']} {L['name']}" for L in ordered]
    scores = [L["current_score"] for L in ordered]
    colors = [HEX[s] for s in scores]
    values = [L["current_value"] for L in ordered]

    fig, ax = plt.subplots(figsize=(11, 7.2), dpi=220)
    y = np.arange(len(ordered))
    widths = [s if s > 0 else 0.14 for s in scores]
    stub_colors = [colors[i] if scores[i] > 0 else "#4AC26B" for i in range(len(scores))]
    bars = ax.barh(
        y,
        widths,
        color=stub_colors,
        height=0.62,
        edgecolor="white",
        linewidth=0.8,
        zorder=3,
    )
    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=10)
    ax.set_xlim(0, 2.35)
    ax.set_xticks([0, 1, 2])
    ax.set_xticklabels(["0 綠", "1 黃", "2 紅"], fontsize=9)
    ax.invert_yaxis()
    ax.set_xlabel("分數", fontsize=10, color="#57606A")
    ax.set_title(
        f"金融危機11燈 · 各燈分數｜總分 {total}/22 · {band_zh}\n資料截至 {asof}（台北時間）· V1.1",
        fontsize=13,
        pad=14,
        color="#1F2328",
    )
    for i, (bar, val, sc, w) in enumerate(zip(bars, values, scores, widths)):
        ax.text(
            w + 0.06,
            bar.get_y() + bar.get_height() / 2,
            f"{val}  ·  {COLOR[sc]}",
            va="center",
            ha="left",
            fontsize=9,
            color="#24292F",
            fontweight="medium",
        )
    # legend patches
    from matplotlib.patches import Patch

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
        fontsize=9,
    )
    polish_style(ax)
    ax.grid(axis="x", zorder=0)
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    fig.savefig(out, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_compare(lights, total, band_zh, asof, out: Path):
    """Panel A: score 當前 vs 前一期; Panel B: table 當前｜前一期｜正常水準."""
    fig = plt.figure(figsize=(12.5, 10.5), dpi=220)
    gs = fig.add_gridspec(2, 1, height_ratios=[1.05, 1.35], hspace=0.28)
    ax = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1])

    ordered = sorted(lights, key=lambda L: L["id"])
    labels = [L["id"] for L in ordered]
    cur_s = [L["current_score"] for L in ordered]
    prev_s = [L["prev_score"] for L in ordered]
    x = np.arange(len(ordered))
    w = 0.36
    b1 = ax.bar(
        x - w / 2,
        cur_s,
        w,
        label="當前分數",
        color="#0969DA",
        edgecolor="white",
        zorder=3,
    )
    b2 = ax.bar(
        x + w / 2,
        prev_s,
        w,
        label="前一期分數",
        color="#8C959F",
        edgecolor="white",
        zorder=3,
    )
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylim(0, 2.4)
    ax.set_yticks([0, 1, 2])
    ax.set_yticklabels(["0", "1", "2"])
    ax.set_ylabel("分數（0–2）", fontsize=10, color="#57606A")
    ax.set_title(
        f"當前 vs 前一期分數比較｜總分 {total}/22 · {band_zh}｜截至 {asof}",
        fontsize=12,
        pad=10,
        color="#1F2328",
    )
    ax.legend(loc="upper right", frameon=True, fancybox=True, edgecolor="#D0D7DE", fontsize=9)
    polish_style(ax)
    ax.grid(axis="y", zorder=0)
    ax.grid(axis="x", visible=False)

    # Panel B: table image
    ax2.axis("off")
    ax2.set_title(
        "各燈數值：當前｜前一期｜正常水準",
        fontsize=12,
        pad=8,
        color="#1F2328",
        fontweight="bold",
        loc="left",
    )
    # sort by severity for table readability — keep L01..L11 order for audit
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
        bbox=[0.0, 0.02, 1.0, 0.92],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(8.5)
    for (r, c), cell in table.get_celld().items():
        cell.set_edgecolor("#D0D7DE")
        cell.set_linewidth(0.6)
        if r == 0:
            cell.get_text().set_color("white")
            cell.get_text().set_fontweight("bold")
            cell.set_fontsize(9)
        elif c == 0:
            cell.get_text().set_ha("left")
            cell.PAD = 0.02
        cell.set_height(0.078)

    fig.suptitle(
        "金融危機11燈監控 V1.1 · 當前／前一期／正常水準",
        fontsize=14,
        fontweight="bold",
        color="#1F2328",
        y=0.98,
    )
    fig.savefig(out, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_trend(history, total, band_zh, asof, out: Path):
    fig, ax = plt.subplots(figsize=(11, 5.2), dpi=220)
    xs = [h["asof"][5:].replace("-", "/") for h in history]  # MM/DD
    ys = [h["total"] for h in history]
    # band shading
    ax.axhspan(0, 3.5, color="#DAFBE1", alpha=0.55, zorder=0, label="正常 0–3")
    ax.axhspan(3.5, 7.5, color="#FFF8C5", alpha=0.55, zorder=0, label="留意 4–7")
    ax.axhspan(7.5, 12.5, color="#FFEBE9", alpha=0.35, zorder=0, label="警戒 8–12")
    ax.plot(
        xs,
        ys,
        color="#0969DA",
        linewidth=2.4,
        marker="o",
        markersize=7,
        markerfacecolor="white",
        markeredgewidth=2,
        markeredgecolor="#0969DA",
        zorder=4,
        label="總分",
    )
    # emphasize last
    ax.scatter(
        [xs[-1]],
        [ys[-1]],
        s=160,
        color="#CF222E",
        zorder=5,
        edgecolors="white",
        linewidths=2,
    )
    ax.annotate(
        f"本週 {ys[-1]}",
        xy=(xs[-1], ys[-1]),
        xytext=(-36, 18),
        textcoords="offset points",
        fontsize=10,
        fontweight="bold",
        color="#CF222E",
        arrowprops=dict(arrowstyle="->", color="#CF222E", lw=1.2),
    )
    for x, y in zip(xs, ys):
        ax.text(x, y + 0.28, str(y), ha="center", va="bottom", fontsize=8, color="#57606A")
    ax.set_ylim(-0.3, 10)
    ax.set_ylabel("總分／22", fontsize=10, color="#57606A")
    ax.set_title(
        f"近 8 週總分走勢（V1.1）｜目前 {total}/22 · {band_zh}｜截至 {asof}",
        fontsize=12,
        pad=12,
        color="#1F2328",
    )
    ax.legend(loc="upper left", ncol=4, frameon=True, fancybox=True, edgecolor="#D0D7DE", fontsize=8)
    polish_style(ax)
    ax.grid(axis="y", zorder=1)
    ax.grid(axis="x", visible=False)
    fig.tight_layout()
    fig.savefig(out, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    lights = compute_all()
    total = sum(L["current_score"] for L in lights)
    be, bz, bt = band(total)
    asof = max(L["date"] for L in lights)
    report_date = "2026-11-01"

    # previous weekly snapshot for total compare (keep as given)
    prev_weekly = json.load(open(WEEK / "previous_summary.json"))
    prev_total = prev_weekly["total"]
    delta = total - prev_total

    # color changes vs previous comparable period (native freq)
    color_changes = []
    for L in lights:
        if L["current_color"] != L["prev_color"]:
            color_changes.append(
                f"{L['id']} {L['name']} {L['prev_color']}→{L['current_color']}（{L['prev_value']} → {L['current_value']}）"
            )
        L["vs_prev"] = L["vs_prev_period"]

    # also note weekly snapshot L07 change from old annualized red→黄 under V1.1
    weekly_changes = [
        "相對上週快照總分：6→5（−1）；上週快照 L07 為年化口徑紅燈，本週 V1.1 不年化為黃"
    ]

    history = json.load(open(ROOT / "history_v11_8w.json"))

    summary = dict(
        version="V1.1",
        asof=asof,
        report_date=report_date,
        total=total,
        adjusted=total,
        missing=0,
        band_en=be,
        band_zh=bz,
        band_tone=bt,
        lights=lights,
        weekly=True,
        previous=dict(
            asof=prev_weekly.get("asof"),
            report_date=prev_weekly.get("report_date"),
            total=prev_total,
            band_zh=prev_weekly.get("band_zh"),
            band_en=prev_weekly.get("band_en"),
            note="上週公布快照（含舊 L07 年化／舊 L10 季資料）；數值「前一期」改為各序列原生頻率上一筆",
        ),
        delta=delta,
        color_changes=color_changes,
        weekly_snapshot_note=weekly_changes,
        calibration=dict(
            L07="raw 20d MA20 rise %; G<1 Y1-2.5 R>2.5",
            L10="CES0500000003/CPIAUCSL YoY; G>0.5 Y-0.5..0.5 R<-0.5",
            L03="WLCFLPCL primary credit Wed level /1000 as $B",
            prev_period="各燈前一期＝該序列原生頻率上一觀察值（日／週／月），非僅上週快照",
            normal_level="綠區代表值或綠區中位，見各燈 normal_note",
        ),
    )

    # write sync
    for path in [
        ROOT / "summary.json",
        ROOT / "summary_2026-11-01_v11.json",
        WEEK / "summary.json",
    ]:
        json.dump(summary, open(path, "w"), ensure_ascii=False, indent=2)

    write_csv(lights, WEEK / "lights.csv")
    write_csv(lights, ROOT / "lights.csv")

    # charts
    chart_lights(lights, total, bz, asof, WEEK / "chart_lights.png")
    chart_compare(lights, total, bz, asof, WEEK / "chart_compare.png")
    chart_trend(history, total, bz, asof, WEEK / "chart_trend.png")
    # also copy charts to fred dir for convenience
    import shutil

    for name in ("chart_lights.png", "chart_compare.png", "chart_trend.png"):
        shutil.copy2(WEEK / name, ROOT / name)

    # print sample + paths
    print(
        json.dumps(
            {
                "total": total,
                "band": bz,
                "delta": delta,
                "asof": asof,
                "charts": [
                    str(WEEK / "chart_lights.png"),
                    str(WEEK / "chart_compare.png"),
                    str(WEEK / "chart_trend.png"),
                ],
                "csv": str(WEEK / "lights.csv"),
                "sample": [
                    {
                        k: lights[i][k]
                        for k in (
                            "id",
                            "name",
                            "current_value",
                            "current_score",
                            "current_color",
                            "prev_value",
                            "prev_score",
                            "prev_color",
                            "normal_level",
                        )
                    }
                    for i in (0, 1, 6, 9)
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
