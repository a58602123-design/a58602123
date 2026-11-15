# 金融危機11燈監控 — 匯入包清單

打包時間：2026-11-15（台北時間，UTC+8）
本包用途：供後續把現況匯入 GitHub。這是本機檔案打包，**未改動運作中的目錄、未使用 Git、未呼叫遠端 API、未重構程式**。

## 必須遵守的維護規則

1. **計分必須保持與現況完全一致。** 門檻、公式、綠區代表值（`NORMAL`）以 `scripts/upgrade_v11_visuals.py` 為準，整理進版控時不得改寫、簡化或「順便修正」。
2. **歷史資料不得臆造或回填。** 週報快照、CSV、圖檔只保留實際存在的檔案。2026-11-01 與 2026-11-08 的原始 FRED CSV 未被週報目錄存檔，且共用區 `原始數據/` 每週覆寫，本包**沒有**那兩週的原始序列，請勿自行補製。
3. **入庫不等於改為 Git 產檔。** 現行週日排程仍是直接讀寫本機檔案系統（`/workspace/fred-11lights/` 與 `/workspace/shared-tasks/金融危機11燈/`），**沒有自動 Git 同步**。在維運流程明確改寫之前，不要假設 push／pull 會更新週報。

## 原始位置

| 本包路徑 | 原始位置 | 說明 |
|---|---|---|
| `README.md` | `/workspace/shared-tasks/金融危機11燈/README.md` | 共用區說明，內容未改 |
| `scripts/weekly_update_20261115.py` | `/workspace/fred-11lights/weekly_update_20261115.py` | **本週實際驅動程式**（僅存在工作目錄） |
| `scripts/upgrade_v11_visuals.py` | `/workspace/fred-11lights/upgrade_v11_visuals.py` | **實際計分與 lights.csv 欄位定義**。共用區有一份位元組相同的副本，本包只收一份 |
| `scripts/regen_charts_mobile.py` | `/workspace/fred-11lights/regen_charts_mobile.py` | 本週實際繪圖（大字手機版；僅存在工作目錄） |
| `scripts/calc_v11.py` | `/workspace/fred-11lights/calc_v11.py` | README 所稱「計分腳本」；本週驅動程式未載入。共用區有相同副本，本包只收一份 |
| `scripts/fetch_fred_11lights.sh` | `/tmp/fetch_fred_11lights.sh` | 2026-11-15 使用的 FRED 抓取腳本，原本只在 `/tmp`，未進共用區或工作目錄 |
| `data/原始數據/*.csv` | `/workspace/shared-tasks/金融危機11燈/原始數據/` | 2026-11-15 抓取的 14 條 FRED 序列。與當時 `/tmp/fred-11lights-20261115/`、工作目錄同名 CSV 內容相同，本包只收一份 |
| `data/週報/2026-11-01/` | `/workspace/shared-tasks/金融危機11燈/週報/2026-11-01/` | 該週 summary、lights.csv、history_8w.json、previous_summary.json、三張圖 |
| `data/週報/2026-11-08/` | `/workspace/shared-tasks/金融危機11燈/週報/2026-11-08/` | 同上 |
| `data/週報/2026-11-15/` | `/workspace/shared-tasks/金融危機11燈/週報/2026-11-15/` | 同上。工作目錄的 summary／圖／lights／history 與此週內容重複，已省略 |

工作目錄另有與週報 `summary.json` 內容相同的 `summary_2026-11-01_v11.json`、`summary_2026-11-08_v11.json`、`summary_2026-11-15_v11.json`，以及與 `history_8w.json` 相同的 `history_v11_8w.json`，均未重複收錄。

## README 與實際計分的落差

- 共用區 `README.md` 將 `calc_v11.py` 標為「計分腳本」，並摘要 V1.1 規則（綠=0、黃=1、紅=2；總分 0–22；0–3 正常／4–7 留意／8–12 警戒／13–22 危機；L07 不年化 20 日 MA 漲幅；L10 = CES0500000003／CPIAUCSL YoY）。摘要方向與 V1.1 相符。
- **2026-11-15 實際執行路徑：** `weekly_update_20261115.py` 以 `SourceFileLoader` 載入 `upgrade_v11_visuals.py` 的 `compute_all()`、`write_csv()`，再載入 `regen_charts_mobile.py` 畫圖。它**沒有**引用 `calc_v11.py`。
- 完整門檻與綠區代表值寫在 `upgrade_v11_visuals.py`（`score_l01`–`score_l11`、`NORMAL`）。`calc_v11.py` 有相近門檻，但沒有「當前／前一期／正常水準」欄位，不是本週產檔所用實作。
- `upgrade_v11_visuals.py` 若直接當主程式執行，內部寫死週報日期為 2026-11-01；`regen_charts_mobile.py` 模組層寫死 2026-11-08。本週是把它們當函式庫呼叫並傳入輸出路徑，進版控時請保持原樣，不要為了「通用化」改邏輯。
- 箱內另有 `/workspace/gemini-金融危機11燈-V1.txt`（較早的 V1.0 規格摘錄，L07 年化、L03／L10 序列與現行不同），**不是**現行運算規則，本包未收入。

## 現行排程與讀寫方式（至打包時仍是如此）

週日例行（約台北時間 08:00）仍直接操作本機檔案，沒有 Git 提交或遠端同步步驟：

1. 用 `fetch_fred_11lights.sh` 以 `curl` 從 `https://fred.stlouisfed.org/graph/fredgraph.csv?id=系列` 抓到暫存目錄（本週為 `/tmp/fred-11lights-20261115`）。無需 FRED API key。
2. `weekly_update_20261115.py` 以 `shutil.copy2` 把 CSV 複製到工作目錄與共用區 `原始數據/`（每次覆寫）。
3. 讀共用區「上一週」的 `summary.json`、`history_8w.json` 做對照，重算後寫入新的 `週報/YYYY-MM-DD/`，並同步工作目錄的 summary／history／lights／圖檔。
4. 公開 Page（canvas `b01cc465-003e-46b7-acaa-a98437ab4a51`）與聊天週報是另外更新，不在本包檔案之內。

兩個運作目錄都**不在任何 Git worktree 內**，沒有提交歷史。本包只是把現況打成匯入用檔案，不會讓現行排程自動改走 Git。

## 未納入與原因

- `__pycache__/`、`WLCFOCL_search.html`：快取或查詢殘件，與再製無關。
- 工作目錄與共用區的重複腳本、重複 CSV、重複圖檔：已各留一份。
- `/workspace/fred-11lights/w1/`：較早的截短序列與 2026-10 試算（L07 仍為年化口徑），無法核對為 11-01 或 11-08 週報所用原始輸入，故不收。請勿把它當成那兩週的原始數據。
- 工作目錄 `summary_2026-10-31_*.json`：非本次指定的三個週報快照；11-01 的 `previous_summary.json` 已保留對照。
- 金鑰、憑證、token：檢查過納入的腳本與資料，未發現這類內容；抓取腳本使用公開 FRED 圖表 CSV 網址。

## 再製範圍（請據實，不要補資料）

- **2026-11-15：** 有完整原始 CSV、驅動程式、計分／繪圖腳本、週報產出，可用現有檔案核對（腳本路徑仍寫死為本機運作路徑）。
- **2026-11-01、2026-11-08：** 有當週 `summary.json`、`lights.csv`、`history_8w.json`、`previous_summary.json` 與三張圖，可核對已公布結果；**沒有**當週原始 FRED CSV，因此無法在不另抓資料、且不改寫歷史的前提下，從原始序列重跑那兩週。
