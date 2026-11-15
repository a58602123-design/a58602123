# 金融危機11燈 — 給鷹眼的使用說明

先看結論：週報是本機 Python 寫檔與 `shutil.copy2` 做出來的。計分規則在 `scripts/upgrade_v11_visuals.py`。這個 GitHub 目錄是 2026-11-15 的匯入快照。排程不會讀 GitHub，也不會自動同步。

## 只要查已公布的週報

打開 `data/週報/YYYY-MM-DD/`：

- `summary.json`：總分、區間、各燈當前值與前一期
- `lights.csv`：同一組查證欄位
- `history_8w.json`：近 8 個資料日的總分與 11 燈分數
- `previous_summary.json`：寫入該週時保留的上一份摘要
- `chart_lights.png`、`chart_compare.png`、`chart_trend.png`：已畫好的圖

2026-11-15 的原始序列在 `data/原始數據/`。2026-11-01 與 2026-11-08 沒有對應的原始 CSV，也沒有當初 `fetch_fred_11lights.sh` 印出的 OK/FAIL 日誌。那兩週以週報目錄裡的檔案為準。

## 兩條路徑不要混在一起

### 1. 既有的絕對路徑驅動（生產機上的那條）

`scripts/weekly_update_20261115.py` 服務的是這些路徑，不是本儲存庫：

- 工作目錄：`/workspace/fred-11lights`
- 共用區：`/workspace/shared-tasks/金融危機11燈`
- 抓取暫存：`/tmp/fred-11lights-20261115`
- 計分與繪圖檔必須位於工作目錄內，檔名為 `upgrade_v11_visuals.py`、`regen_charts_mobile.py`

它會 `copy2` CSV、覆寫共用區 `原始數據/`、寫入 `週報/2026-11-15/`，並把摘要與圖寫回工作目錄。日期也寫死在這一週。下一次週報若仍用這支程式，要另備該週的驅動或改日期與暫存路徑；計分函式維持原樣。

本儲存庫根目錄沒有 `/workspace/fred-11lights`。在根目錄直接執行下面三支，會在載入時失敗，不會產出週報：

```bash
python3 financial-11lights/scripts/upgrade_v11_visuals.py
python3 financial-11lights/scripts/weekly_update_20261115.py
python3 financial-11lights/scripts/regen_charts_mobile.py
```

2026-11-15 於本環境實測，三者退出碼都是 1，原因都是找不到 `/workspace/fred-11lights`（weekly 則是找不到該目錄下的 `upgrade_v11_visuals.py`）。失敗後該目錄仍不存在。詳情在 [VALIDATION.md](VALIDATION.md)。

若生產機上那些目錄已經存在，單獨執行 `upgrade_v11_visuals.py` 會按寫死的 2026-11-01 路徑寫檔，單獨執行 `regen_charts_mobile.py` 會按寫死的 2026-11-08 路徑畫圖。那不是「從 GitHub 跑一週」的做法。

`scripts/fetch_fred_11lights.sh` 會連到 `https://fred.stlouisfed.org/graph/fredgraph.csv`，並把 CSV 寫進 `/tmp/fred-11lights-20261115`。這次匯入沒有執行它。語法檢查是 `bash -n financial-11lights/scripts/fetch_fred_11lights.sh`（退出碼 0），這只檢查腳本文字。

`scripts/calc_v11.py` 標為舊版、本週未執行。不要把它的輸出寫進 `data/週報/`。它的 `main()` 會在目前工作目錄寫 summary。

### 2. 可攜重算（只核對 2026-11-15 快照）

下面的指令在儲存庫根目錄執行（該目錄要能看到 `financial-11lights/`）。它把 14 個 CSV 與計分腳本複製到系統暫存目錄，只改暫存複本開頭的三行路徑，呼叫 `compute_all()` 與 `write_csv()`，再和 `data/週報/2026-11-15/` 比對。

它不連線、不呼叫 `main()`、不寫回週報、不建立 `/workspace/fred-11lights`。倉庫裡的 `upgrade_v11_visuals.py` 維持原件。

需要 Python 3、`matplotlib`、`numpy`。這次核對的環境是 Python 3.12.3、matplotlib 3.11.2、numpy 2.5.4。`requirements.txt` 註記的生產機是 Python 3.13，版本沒有鎖定。畫圖用的 Noto Sans CJK 字型不是這段重算的前提；這段也不重畫圖。

```bash
python3 - << 'PY'
import json, shutil, sys, tempfile
from importlib.machinery import SourceFileLoader
from pathlib import Path

repo = Path.cwd()
pkg = repo / "financial-11lights"
src_py = pkg / "scripts" / "upgrade_v11_visuals.py"
raw = pkg / "data" / "原始數據"
snap_dir = pkg / "data" / "週報" / "2026-11-15"
if not src_py.is_file() or not snap_dir.is_dir():
    sys.exit("請在儲存庫根目錄執行，且 financial-11lights 已存在")

old = '''ROOT = Path("/workspace/fred-11lights")
WEEK = Path("/workspace/shared-tasks/金融危機11燈/週報/2026-11-01")
SHARED = Path("/workspace/shared-tasks/金融危機11燈")
os.chdir(ROOT)
'''

base = Path(tempfile.mkdtemp(prefix="f11-replay-"))
csvdir = base / "csv"
outdir = base / "out"
csvdir.mkdir()
outdir.mkdir()
for p in sorted(raw.glob("*.csv")):
    shutil.copy2(p, csvdir / p.name)
text = src_py.read_text()
if old not in text:
    sys.exit("計分腳本開頭路徑與預期不同，已停止（沒有改倉庫裡的檔案）")
patched = base / "upgrade_v11_visuals_replay.py"
patched.write_text(text.replace(old, f'''ROOT = Path({str(csvdir)!r})
WEEK = Path({str(outdir)!r})
SHARED = Path({str(base)!r})
os.chdir(ROOT)
''', 1))
mod = SourceFileLoader("upgrade_v11_visuals_replay", str(patched)).load_module()
lights = mod.compute_all()
mod.write_csv(lights, outdir / "lights.csv")
snap = json.loads((snap_dir / "summary.json").read_text())
by = {L["id"]: L for L in snap["lights"]}
keys = [
    "name", "series", "date", "prev_date",
    "current_value", "current_raw", "current_score", "current_color", "current_tone",
    "prev_value", "prev_raw", "prev_score", "prev_color", "prev_tone",
    "normal_level", "normal_raw", "normal_note", "vs_prev_period",
    "display", "color", "score", "tone", "raw",
]
bad = []
for L in lights:
    S = by[L["id"]]
    for k in keys:
        if L.get(k) != S.get(k):
            bad.append((L["id"], k, L.get(k), S.get(k)))
csv_equal = (outdir / "lights.csv").read_bytes() == (snap_dir / "lights.csv").read_bytes()
total = sum(L["score"] for L in lights)
print("temp", base)
print("lights", len(lights), "field_mismatches", len(bad), "csv_bytes_equal", csv_equal)
print("total", total, "snapshot_total", snap["total"], "asof", max(L["date"] for L in lights))
if bad or not csv_equal or total != snap["total"]:
    print(bad[:20])
    sys.exit(1)
print("MATCH 2026-11-15 snapshot")
PY
```

成功時最後一行是 `MATCH 2026-11-15 snapshot`，退出碼 0。`compute_all()` 的 `vs_prev_period` 是該序列原生頻率的上一筆。`summary.json` 裡的 `vs_prev` 與 `color_changes` 是驅動程式拿上一週快照再寫的，上面這段比對不含 `vs_prev`；該項的核對寫在 VALIDATION。

## 依賴

見 `requirements.txt`。抓取腳本另外需要 bash 與 curl。圖若要在生產機上按原程式重畫，還要這兩個字型檔存在：

- `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`
- `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc`

本匯入沒有重畫，也沒有改圖內的字級。

## 這份說明改了什麼

`provenance/as-imported/README.md` 與 `provenance/as-imported/USAGE.md` 是匯入包裡的原文。原文 README 把 `calc_v11.py` 標成計分腳本；原文 USAGE 寫每週會一併更新 Page。現行腳本沒有載入 `calc_v11.py`，也沒有寫入 Canvas。SHA256 對得起來的是那兩份原文，見 VALIDATION。
