# 匯入核對紀錄

日期：2026-11-15。核對機器的儲存庫根目錄是這份 Git checkout（此環境為 `/workspace`）。生產用的 `/workspace/fred-11lights` 與 `/workspace/shared-tasks` 在這台機器上不存在。下列指令都在儲存庫根目錄執行，除非另註工作目錄。

Git 歷史從這次匯入提交開始。沒有把本機在匯入前的修改回寫成更早的提交。

## 壓縮檔

環境裡的附件檔名是 `financial-11lights-import_45ec.zip`。

```text
323b1f80360376e741a4f290e15cd7572c20c1b0a262a08a2e0ef7893cfeb8c6  financial-11lights-import_45ec.zip
```

`unzip -l` 列出 45 個檔案，未壓縮合計 6,084,440 bytes。沒有抓取日誌、沒有 2026-11-01 或 2026-11-08 的原始 CSV、沒有 `__pycache__`。

## SHA256SUMS

在解壓目錄執行 `sha256sum -c SHA256SUMS`：44 個檔案 OK，唯一失敗是清單自己。

| 項目 | 值 |
|---|---|
| 清單內自列雜湊 | `fcadf105d05b4dda382db3f445b4d2503e1fb081cb2313218dce461a2ee129c7` |
| 檔案實際 SHA256 | `5fcb593d936a0841cde795e0efbbe854f6c6b7f77bc945cc4620b6ee57273596` |

清單含有自己的一行，該行與檔案內容對不上。其餘條目在原解壓目錄全部符合。

放進儲存庫之後，`README.md` 與 `USAGE.md` 已改寫。清單上這兩個路徑的雜湊改對 `provenance/as-imported/` 裡的原件。以 Python 重算的結果：`checked_ok=44`，唯一不符仍是 `./SHA256SUMS` 自己。程式、`requirements.txt`、`MANIFEST.md`、全部 CSV、三週 JSON／CSV／PNG 與清單一致，並與解壓原件 `cmp` 相同。

## 語法

位元組碼寫到暫存目錄，避免在資料夾裡留下 `__pycache__`：

```bash
PYTHONPYCACHEPREFIX=/tmp/f11-pyc python3 -m py_compile \
  financial-11lights/scripts/calc_v11.py \
  financial-11lights/scripts/upgrade_v11_visuals.py \
  financial-11lights/scripts/regen_charts_mobile.py \
  financial-11lights/scripts/weekly_update_20261115.py
bash -n financial-11lights/scripts/fetch_fred_11lights.sh
```

兩條退出碼都是 0。`py_compile` 只編譯，沒有執行 `os.chdir`。`bash -n` 沒有連線，也沒有建立 `/tmp/fred-11lights-20261115`。

## 未改路徑的腳本

```bash
python3 financial-11lights/scripts/upgrade_v11_visuals.py
python3 financial-11lights/scripts/weekly_update_20261115.py
python3 financial-11lights/scripts/regen_charts_mobile.py
```

退出碼都是 1。

- `upgrade_v11_visuals.py` 第 22 行 `os.chdir(ROOT)`：`FileNotFoundError: /workspace/fred-11lights`
- `regen_charts_mobile.py` 第 19 行同樣失敗
- `weekly_update_20261115.py` 第 22 行載入 `/workspace/fred-11lights/upgrade_v11_visuals.py` 失敗

跑完之後 `/workspace/fred-11lights`、`/workspace/shared-tasks`、`/tmp/fred-11lights-20261115` 仍然不存在。不能把這三支當成可在儲存庫根目錄直接跑的週報命令。

## 2026-11-15 可攜重算

指令就是 [USAGE.md](USAGE.md) 裡的那段。環境：Python 3.12.3、matplotlib 3.11.2、numpy 2.5.4。`requirements.txt` 寫的生產機是 Python 3.13；這次不是在 3.13 上重跑。

暫存複本只替換開頭三行路徑。倉庫內 `upgrade_v11_visuals.py` 之後與解壓原件 `cmp` 仍相同。

```text
temp /tmp/f11-replay-6rmbjrp7
lights 11 field_mismatches 0 csv_bytes_equal True
total 3 snapshot_total 3 asof 2026-11-13
MATCH 2026-11-15 snapshot
```

退出碼 0。比對欄位含名稱、序列、日期、當前／前一期的顯示值、原始值、分數、顏色、tone、綠區代表值、`vs_prev_period`，以及 `display`／`color`／`score`／`raw`。`lights.csv` 與快照位元組相同（1777 bytes）。

`summary.json` 的 `vs_prev` 與 `color_changes` 不是 `compute_all()` 寫的。另用 11-08 `summary.json` 的顏色與顯示值，依 `weekly_update_20261115.py` 的比較方式組字串，得到：

```text
L06 VIX 黃→綠（28.18 → 18.70）
L07 美元趨勢 黃→綠（+1.64% → +0.69%）
```

與 11-15 `summary.json` 的 `color_changes` 相同。沒有執行 `weekly_update_20261115.py`，因此沒有寫入生產路徑。

## 週報之間的內部一致性

以解析後的 JSON 比較，不是只看檔名。

| 檢查 | 結果 |
|---|---|
| 11-08 `previous_summary.json` 與 11-01 `summary.json` | 位元組相同（9554 bytes） |
| 11-15 `previous_summary.json` 與 11-08 `summary.json` | 內容相同；11-08 檔尾多一個換行（9332 vs 9331 bytes） |
| 11-15 `previous` | asof 2026-11-06、report_date 2026-11-08、總分 5、留意；`delta` −2 |
| 11-08 `previous` | asof 2026-10-30、report_date 2026-11-01、總分 5、留意；`delta` 0 |
| `history_8w.json` 長度 | 三週都是 8 列 |
| 11-08 相對 11-01 | 去掉 2026-09-11，加上 2026-11-06。`h08[:-1] == h01[1:]` |
| 11-15 相對 11-08 | 去掉 2026-09-18，加上 2026-11-13。`h15[:-1] == h08[1:]` |
| 11-15 最後一列 | asof 2026-11-13、總分 3、分數 `[0,0,1,0,0,0,0,0,0,2,0]`，與重算的 11 燈分數相同 |
| 11-15 各燈別名 | `score`／`color`／`display`／`raw` 與 `current_*` 一致，總分 3 |

這與驅動程式「附上新列再留下最後 8 列」的寫法相符。11-01 的 `previous_summary.json` 是 `report_date` 2026-10-31、總分 6、英文燈名，L07 的 `formula` 為 `(MA20_t / MA20_{t-20}) - 1) × (252/20) × 100`。沒有用 11-15 的 CSV 重算這份對照。

## 舊模組 calc_v11.py

在暫存目錄放入 14 個 CSV 後，只呼叫 `compute()`，沒有呼叫 `main()`。該目錄沒有產生 `summary.json`。

當期的 id、date、display、score、color 與 11-15 快照 11 盞都相同，總分 3。這個模組沒有前一期與正常水準欄位。`weekly_update_20261115.py` 的原始碼沒有出現 `calc_v11`。L09 低點視窗的寫法與 `upgrade_v11_visuals.py` 不同；這批完整序列上的當期結果相同，不能當成它就是本週執行的計分程式。

## 圖檔

九張 PNG 都以 Pillow 開啟並 `verify()`。三週的像素尺寸相同：

| 檔 | 尺寸 | 模式 |
|---|---|---|
| `chart_lights.png` | 3938×3498 | RGBA |
| `chart_compare.png` | 3659×5066 | RGBA |
| `chart_trend.png` | 3938×2728 | RGBA |

11-15 的 `chart_lights.png` 中繼資料：`dpi` 約 219.9894，`Software` 為 `Matplotlib version3.11.2`。尺寸與 `regen_charts_mobile.py` 的大畫布、dpi 220 相符。沒有呼叫繪圖函式，也沒有覆蓋 PNG。

這台機器沒有腳本寫死的字型：

- `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`
- `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc`

因此沒有做「重畫後與原圖位元組比較」。

## 原始 CSV 最後一列

這是直接讀 `data/原始數據/`，不是抓取日誌。列數含表頭。

| 檔案 | 列數 | 最後一列 |
|---|---|---|
| BAMLH0A0HYM2.csv | 794 | 2026-11-12,3.20 |
| CES0500000003.csv | 249 | 2026-10-01,38.00 |
| CPIAUCSL.csv | 959 | 2026-10-01,337.476 |
| DTWEXAFEGS.csv | 5441 | 2026-11-06,114.8642 |
| EFFR.csv | 6880 | 2026-11-12,3.88 |
| ICSA.csv | 3124 | 2026-11-07,200000 |
| LES1252881600Q.csv | 192 | 2026-07-01,370 |
| SAHMCURRENT.csv | 933 | 2026-10-01,0.00 |
| SOFR.csv | 2249 | 2026-11-12,3.90 |
| SP500.csv | 2611 | 2026-11-13,7561.67 |
| STLFSI4.csv | 1716 | 2026-11-06,-0.4918 |
| T10Y2Y.csv | 13165 | 2026-11-13,0.27 |
| VIXCLS.csv | 9619 | 2026-11-12,18.70 |
| WLCFLPCL.csv | 1249 | 2026-11-11,9268 |

`LES1252881600Q.csv` 只出現在抓取腳本的系列清單。`compute_all()` 沒有開啟它。

## 沒有做的事

- 沒有執行 `fetch_fred_11lights.sh`，沒有連到 FRED，沒有用新下載的資料替換快照。
- 沒有補造 2026-11-01、2026-11-08 的原始 CSV，也沒有原始抓取日誌可附。
- 沒有改 `score_l01`–`score_l11`、`NORMAL`、歷史數字或圖的像素。
- 沒有新增排程 workflow，沒有改長輩版網站、既有 CI、Canvas 或生產目錄。
- 沒有在 Python 3.13 上重跑。分數一致只涵蓋這次的 2026-11-15 快照與上述環境。
