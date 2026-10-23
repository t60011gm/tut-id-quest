# 南應大室研所大冒險 · 南應大室內設計系碩士班師資探險地圖

一個 3D 奇幻 RPG 風格的互動網站，作為台南應用科技大學室內設計系碩士班的招生宣傳。
學生在大陸上探險，拜訪 6 個區域裡的 14 位導師，認識每位老師的研究專長、授課與經歷。

## 玩法

| 模式 | 操作 |
|---|---|
| 導覽模式（預設） | 拖曳旋轉、滾輪縮放、右鍵平移；點區域旗幟或導師名牌，鏡頭飛過去並打開導師卡 |
| 探險模式 | WASD／方向鍵移動、Shift 奔跑、拖曳轉視角、靠近導師按 E 對話；手機用左下搖桿與「對話」鈕 |

- **導師圖鑑**：可依區域篩選，或搜尋專長、課程關鍵字（例如「AI」「木作」「色彩」）。
- **白霧**：除了設計王都，其他五個區域一開始都被白霧籠罩，導師身分在圖鑑中也顯示為「？？？」。點區域旗幟、在探險模式走近、或把鏡頭拉近該區，迷霧就會散去。
- **進度**：拜訪過的導師與探索過的區域都會記在瀏覽者自己的瀏覽器；14 位全部拜訪後出現報考連結。
- **重新開始冒險**：圖鑑最下方的連結會清除進度並重新籠罩白霧（按兩次確認），適合招生攤位換下一位訪客時使用。
- **小地圖**：點區域可快速前往（探險模式下是傳送）。
- **分享單一導師**：網址加上 `#老師代號`，例如 `index.html#lin-chieh-jen`，按「開始冒險」後會直接飛到該導師。

## 檔案結構

```
index.html          頁面骨架與介面
css/style.css       介面樣式
js/main.js          3D 場景、角色、控制與互動（Three.js 0.170，經 CDN 載入）
data/faculty.js     ★ 師資與區域資料，日常維護只需要改這個檔案
img/faculty/        老師照片（檔名是老師代號，例如 lin-chieh-jen.jpg）
img/og.jpg          分享到 LINE／Facebook 時的預覽圖（1200×630）
tools/build-single.py  把整站打包成單一 HTML（預覽或寄送用，非必要）
tools/smoke-test.js    冒煙測試：桌機與手機各跑一次主要流程並截圖
```

## 更新師資資料

打開 `data/faculty.js`：

- **修改老師**：直接改對應物件的欄位（`fields` 專長、`courses` 授課、`feats` 經歷證照…）。
- **新增老師**：複製一個物件，給新的 `id`（英文小寫加連字號），`region` 填所屬區域的 id。NPC 會自動排在該區域。
  照片存成 `img/faculty/<id>.jpg`（建議 400×400），`photo` 填這個路徑。
- **調整區域**：`regions` 陣列中的 `name`、`motto`、`desc`、`color` 都可以改；`angle` 是方位角（0 = 正北）。
  新增區域需要在 `js/main.js` 的 `STYLE` 表補一筆場景設定，並在 `BUILDERS` 加一個地標建構函式，否則該區域只會有空地。

資料原始出處：本系網站「專任師資」頁面 <https://id.tut.edu.tw/p/403-1067-1265.php?Lang=zh-tw>。

## 本機預覽

ES 模組不能用 `file://` 直接開啟，請在資料夾內啟動一個本機伺服器：

```bash
python3 -m http.server 8000
# 瀏覽 http://localhost:8000
```

## 部署到 GitHub Pages

1. 把這個資料夾推到 GitHub repo 的 `main` 分支。
2. Repo → **Settings → Pages** → Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾 `/ (root)`。
3. 約一分鐘後網站會出現在 `https://<帳號>.github.io/<repo 名稱>/`。

網站是純靜態檔案，也可以直接放到學校主機的任何網頁目錄。

## 測試

```bash
node tools/smoke-test.js     # 需要 Playwright 與 python3；截圖存到 dist/screens/
```

會檢查：迷霧中的導師能打開導師卡、照片載入、導師卡的鍵盤操作（Tab 不跑出卡片、Esc 關閉）、圖鑑開關，以及沒有 console 錯誤。

## 已知限制

- 分享預覽圖的網址寫死為 GitHub Pages 位址（`index.html` 的 `og:url`、`og:image`）；若改放學校主機，請一併修改。
- 需要支援 WebGL 的瀏覽器（近五年的 Chrome、Edge、Safari、Firefox 都可以）。
