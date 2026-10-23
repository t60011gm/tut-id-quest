# CLAUDE.md — 南應大室研所大冒險

台南應用科技大學室內設計系碩士班招生用的 3D 互動網站。純靜態網站（無建置步驟），部署在 GitHub Pages。

## 回覆語言
與使用者溝通一律使用繁體中文（台灣用語）。程式註解也用繁體中文。

## 架構
- `index.html`：介面骨架；Three.js 0.170 以 importmap 從 jsDelivr 載入。
- `data/faculty.js`：`window.WORLD`，含 `regions`（6 個區域）與 `faculty`（12 位研究所導師：專任 8 位、兼任 4 位，兼任標 `adjunct: true`）。**內容修改只改這裡。**
- `js/main.js`：ES module。主要段落依序為：地形高度函式 `terrainInfo()` → 地形網格 → NPC 站位 → 各區域地標 `build<Region>()` → 植被 → NPC → 玩家 → 控制（導覽 OrbitControls／探險第三人稱）→ 介面（導師卡、圖鑑、小地圖）→ 主迴圈。
- 每個區域地標在 `regionCtx(r)` 的區域座標系中建構：local +z 永遠指向王都（訪客來的方向），NPC 站在 local v≈12 處面向訪客。
- `colliders` 陣列是探險模式的碰撞圓；`animators` 陣列是每幀更新函式。
- 白霧：`explored` Set（localStorage `tutIdQuest.explored.v1`）記錄已探索區域，王都預設已探索。`buildFog(r)` 建霧、`reveal(r)` 驅散並播放消散動畫、`applyFogState()` 同步名牌與旗幟。迷霧中的導師在圖鑑顯示為「？？？」，小地圖也會遮住。
- `css/style.css`：單一深色主題，所有顏色來自 `:root` token。導師卡是羊皮紙風格（淺底深字），其他 HUD 是深藍底黃銅邊。

## 慣例
- 不要捏造老師的資料。專長、課程、經歷必須來自系上提供的名單、系網「專任師資」「兼任師資」頁面、可查證的公開資料，或老師本人提供；查不到就留空，不要編。RPG 職業稱號（`cls`）是趣味包裝，可以改。
- 新增區域時要同時：在 `faculty.js` 加區域、在 `main.js` 的 `STYLE` 表補一筆場景設定，並寫一個 `BUILDERS` 函式。
- 老師照片放在本地 `img/faculty/<id>.jpg`，不要再改回連結系網圖片。
- 修改 `css/`、`js/`、`data/` 後，把 `index.html` 裡 `?v=` 的版本號加一，否則訪客瀏覽器可能讀到快取的舊檔。
- 保持手機可用：觸控裝置會降低地形解析度、樹木數量與陰影貼圖大小（`isTouch`）。
- 修改後用 `python3 -m http.server` 在本機開啟，桌機與手機寬度都要看過。

## 測試
`window.__quest` 暴露 `setMode`、`selectTeacher`、`goRegion` 等函式，方便用 Playwright 驅動截圖。
修改後執行 `node tools/smoke-test.js`（截圖存在 `dist/screens/`），全部通過再提交。
