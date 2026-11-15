#!/usr/bin/env python3
"""金融危機11燈 V1.1 週報 2026-11-15 驅動程式。"""
from __future__ import annotations

import json
import os
import shutil
from datetime import datetime
from importlib.machinery import SourceFileLoader
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path("/workspace/fred-11lights")
SHARED = Path("/workspace/shared-tasks/金融危機11燈")
RAW_IN = Path("/tmp/fred-11lights-20261115")
PREV_WEEK = SHARED / "週報" / "2026-11-08"
REPORT_DATE = "2026-11-15"
WEEK = SHARED / "週報" / REPORT_DATE
RAW_OUT = SHARED / "原始數據"
TZ = ZoneInfo("Asia/Taipei")

upgrade = SourceFileLoader("upgrade_v11_visuals", str(ROOT / "upgrade_v11_visuals.py")).load_module()
charts = SourceFileLoader("regen_charts_mobile", str(ROOT / "regen_charts_mobile.py")).load_module()


def band(total):
    if total <= 3:
        return "GREEN", "正常", "success"
    if total <= 7:
        return "YELLOW", "留意", "warning"
    if total <= 12:
        return "ORANGE", "警戒", "warning"
    return "RED", "危機", "danger"


def copy_raw():
    WEEK.mkdir(parents=True, exist_ok=True)
    RAW_OUT.mkdir(parents=True, exist_ok=True)
    files = list(RAW_IN.glob("*.csv"))
    for src in files:
        shutil.copy2(src, ROOT / src.name)
        shutil.copy2(src, RAW_OUT / src.name)
    print("copied", len(files), "CSVs")


def main():
    now = datetime.now(TZ)
    print("run_at=" + now.strftime("%Y-%m-%d %H:%M:%S %Z"))
    copy_raw()
    os.chdir(ROOT)

    prev = json.loads((PREV_WEEK / "summary.json").read_text())
    hist = json.loads((PREV_WEEK / "history_8w.json").read_text())

    lights = upgrade.compute_all()
    total = sum(L["score"] for L in lights)
    be, bz, bt = band(total)
    asof = max(L["date"] for L in lights)

    pc = {L["id"]: L["color"] for L in prev["lights"]}
    pd = {L["id"]: L["display"] for L in prev["lights"]}
    changes = []
    for L in lights:
        if pc.get(L["id"]) and pc[L["id"]] != L["color"]:
            changes.append(
                L["id"] + " " + L["name"] + " " + pc[L["id"]] + "→" + L["color"]
                + "（" + pd.get(L["id"], "?") + " → " + L["display"] + "）"
            )
            L["vs_prev"] = pc[L["id"]] + "→" + L["color"]
        else:
            L["vs_prev"] = "→"

    prev_total = prev["total"]
    delta = total - prev_total
    previous = dict(
        asof=prev.get("asof"),
        report_date=prev.get("report_date"),
        total=prev_total,
        band_zh=prev.get("band_zh"),
        band_en=prev.get("band_en"),
    )

    summary = dict(
        version="V1.1",
        asof=asof,
        report_date=REPORT_DATE,
        total=total,
        adjusted=total,
        missing=0,
        band_en=be,
        band_zh=bz,
        band_tone=bt,
        lights=lights,
        weekly=True,
        previous=previous,
        delta=delta,
        color_changes=changes,
        calibration=dict(
            L07="raw 20d MA20 rise %; G<1 Y1-2.5 R>2.5",
            L10="CES0500000003/CPIAUCSL YoY; G>0.5 Y-0.5..0.5 R<-0.5",
            L03="WLCFLPCL primary credit Wed level /1000 as $B",
            prev_period="各燈前一期＝該序列原生頻率上一觀察值（日／週／月），非僅上週快照",
            normal_level="綠區代表值或綠區中位，見各燈 normal_note",
        ),
        generated_at=now.strftime("%Y-%m-%d %H:%M:%S %Z"),
    )

    new_hist_row = dict(asof=asof, total=total, lights=[L["score"] for L in lights])
    hist_asofs = [h["asof"] for h in hist]
    if asof in hist_asofs:
        hist[hist_asofs.index(asof)] = new_hist_row
    else:
        hist.append(new_hist_row)
        hist = hist[-8:]

    (WEEK / "previous_summary.json").write_text(
        json.dumps(prev, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (WEEK / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (WEEK / "history_8w.json").write_text(
        json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    upgrade.write_csv(lights, WEEK / "lights.csv")

    (ROOT / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ROOT / ("summary_" + REPORT_DATE + "_v11.json")).write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ROOT / "history_8w.json").write_text(
        json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ROOT / "history_v11_8w.json").write_text(
        json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    upgrade.write_csv(lights, ROOT / "lights.csv")

    for name, fn in (
        ("chart_lights.png", lambda p: charts.chart_lights(lights, total, bz, asof, p)),
        ("chart_compare.png", lambda p: charts.chart_compare(lights, total, bz, asof, p)),
        ("chart_trend.png", lambda p: charts.chart_trend(hist, total, bz, asof, p)),
    ):
        week_p = WEEK / name
        fn(week_p)
        (ROOT / name).write_bytes(week_p.read_bytes())
        print(str(week_p), week_p.stat().st_size)

    brief = {
        "total": total,
        "band": bz,
        "delta": delta,
        "changes": changes,
        "asof": asof,
        "report_date": REPORT_DATE,
        "lights": [
            {
                "id": L["id"],
                "name": L["name"],
                "current": L["current_value"],
                "score": L["score"],
                "color": L["color"],
                "date": L["date"],
                "prev": L["prev_value"],
                "prev_date": L["prev_date"],
                "prev_color": L["prev_color"],
                "vs_period": L["vs_prev_period"],
                "vs_week": L["vs_prev"],
                "normal": L["normal_level"],
            }
            for L in lights
        ],
        "history": hist,
    }
    print(json.dumps(brief, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
