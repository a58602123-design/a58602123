# 金融危機11燈監控 — 使用說明（給鷹眼與後續協作者）

這份說明描述**目前實際怎麼跑**，不是重構後的理想流程。程式碼與歷史數字請保持原樣；有疑問先對照 `MANIFEST.md`。

## 這是什麼

「金融危機11燈監控」V1.1：用 FRED 公開序列計算 11 盞燈，綠=0、黃=1、紅=2，總分 0–22（0–3 正常、4–7 留意、8–12 警戒、13–22 危機）。每週日產出週報檔與三張圖，並更新同一頁 Page。

現行運作目錄（本機檔案，不是 Git）：

- 工作目錄：`/workspace/fred-11lights/`
- 共用查證區：`/workspace/shared-tasks/金融危機11燈/`
- 公開 Page：https://cursor.com/canvas/store-fe76b3a3-4ba3-4610-9ada-f66cf0953594/b01cc465-003e-46b7-acaa-a98437ab4a51

## 實際計分以哪份檔為準

以 `scripts/upgrade_v11_visuals.py` 為準（`compute_all()`、`score_l01`–`score_l11`、`NORMAL`）。

請不要用 README 或較舊的 `calc_v11.py` 當唯一依據。README 把 `calc_v11.py` 寫成計分腳本，但 2026-11-15 那次週報載入的是 `upgrade_v11_visuals.py`。V1.0 規格摘錄也不是現行規則。

改門檻或公式前，必須先與負責人確認；匯入 GitHub 時不要「整理」這些函式。

## 現行每週怎麼跑

排程約每週日台北時間 08:00 啟動，**直接讀寫上述目錄，沒有自動 Git 同步**。本週（2026-11-15）實際步驟：

1. 執行 `scripts/fetch_fred_11lights.sh`（當時位於 `/tmp/fetch_fred_11lights.sh`），用 `curl` 把 14 條序列抓到暫存目錄。不需要 API key。
2. 在工作目錄執行 `scripts/weekly_update_20261115.py`。它會：
   - 把暫存 CSV 複製到工作目錄與共用區 `原始數據/`（覆寫舊檔）；
   - 讀共用區上一週的 `週報/YYYY-MM-DD/summary.json` 與 `history_8w.json`；
   - 重算 11 燈，寫入新的 `週報/YYYY-MM-DD/`（`summary.json`、`lights.csv`、`history_8w.json`、`previous_summary.json`、三張 PNG）；
   - 同步寫回工作目錄的 summary／history／lights／圖。

腳本裡的路徑與日期是寫死的，例如：

- `ROOT = /workspace/fred-11lights`
- `SHARED = /workspace/shared-tasks/金融危機11燈`
- 本週暫存：`/tmp/fred-11lights-20261115`
- 對照週：`週報/2026-11-08`；產出週：`2026-11-15`

下週若沿用此驅動程式，需要改日期與暫存路徑（或另寫該週驅動程式），但**不要改計分函式**。`upgrade_v11_visuals.py`、`regen_charts_mobile.py` 若單獨當主程式跑，裡面也還寫死舊週日期；本週是當函式庫呼叫的。

圖表規格（手機大字，請沿用）：標題 40 pt、軸標 28、刻度／圖例／表格約 24–28，dpi 220，中文字型 Noto Sans CJK TC。

## 本包裝了什麼、沒裝什麼

有：現行腳本與抓取程式、README、依賴說明、2026-11-15 完整原始 CSV，以及 11-01、11-08、11-15 三週週報快照（含圖）。

沒有：11-01、11-08 當週的原始 FRED CSV（共用區原始數據每週覆寫，當時未另外存檔）。那兩週請以週報目錄內的 JSON／CSV／圖為準，不要為了「可重跑」而去編造或截補歷史序列。

## 依賴

見 `requirements.txt`：Python 3、matplotlib、numpy，以及 bash、curl、Noto Sans CJK 字型。

## 給鷹眼的重點

- 目前週報是腳本直接寫本機共用區，**不是靠 Git 版本控制產出**。即使之後有 GitHub 儲存庫，也不表示排程已改為 commit／push。
- 要核對規則或重算，請看 `upgrade_v11_visuals.py` 與各週 `data/週報/`，不要只看 README。
- 歷史分數與原始值以已存檔為準，缺的原始 CSV 就標明缺，不要補。
