# 金融危機11燈監控（共用查證資料）

負責人：風向球(總經)
規格：V1.1（L07 不年化 20 日 MA 漲幅；L10 = CES0500000003/CPIAUCSL YoY）
Page：https://cursor.com/canvas/store-fe76b3a3-4ba3-4610-9ada-f66cf0953594/b01cc465-003e-46b7-acaa-a98437ab4a51

## 目錄
- `週報/YYYY-MM-DD/`：當週 `summary.json`、`lights.csv`、`history_8w.json`、圖檔、上次對照
- `原始數據/`：當次抓取的 FRED CSV（可重算查證）
- `calc_v11.py`：計分腳本

## 計分
綠=0 黃=1 紅=2；總分 0–22；0–3 正常／4–7 留意／8–12 警戒／13–22 危機

## 查證欄位（V1.1 視覺升級）
每週 `週報/YYYY-MM-DD/lights.csv` 含：
- current_*（當前觀察）
- prev_*（該序列原生頻率上一筆：日／週／月）
- normal_level / normal_note（綠區代表值或中位）
圖表：`chart_lights.png`、`chart_compare.png`、`chart_trend.png`（dpi≥200）
