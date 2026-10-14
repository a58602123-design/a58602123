# 雲林一鍵搭車｜長輩版 v3

免費、免登入的手機網頁 App (PWA)，可安裝到 iPhone、Android 主畫面。

## 長輩使用方法
首頁只要按：**🚄 高鐵回家** 或 **🏠 出門搭高鐵**。系統顯示大字時間、車次、虎尾轉乘站點，並提供 **🔊 再聽一次** 國語播報。

## 免費部署：Vercel Hobby
1. 開啟 https://vercel.com/new，使用免費 Hobby 帳戶登入。
2. 往下找到 **Import Git Repository**，首次使用要先授權 GitHub。
3. 選擇 **a58602123-design/a58602123**，按 **Import → Deploy**。框架選 **Other**，Root Directory 保持根目錄，Build Command 留白。
4. 部署完開啟 `*.vercel.app` 網址，將網址分享給其他手機。首頁的「家人設定／分享」也可複製分享網址。

## 重要限制
- 班次來源：公路局**表定起站時刻**；途中站、轉乘抵達時間是 **估算**，不是 GPS 即時到站或保證一定趕得上。
- 若公路局連線失敗、沒找到轉乘班次，App 顯示 **「無法確認」**，不會把舊資料當成最新資訊。
- 國定假日、臨時停駛等情況必須向業者確認；跨站轉乘預留至少15分鐘。
- 官方公車動態：https://ebus.yunlin.gov.tw/driving-map
- 不會要求付款、收集定位或身分資料；語音朗讀依賴手機瀏覽器內建語音。

## 測試
`node --test tests/schedule.test.js`。已用 iPhone 390px、Android 360px 手機視窗模擬點擊與大字佈局。線上官方站牌資料在正式部署後仍需驗證。

## 技術
靜態 `index.html` + `api/schedule.js` (Vercel Node.js Serverless Function)，使用原生 Web Speech API，不使用付費第三方服務。
