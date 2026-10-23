# CLAUDE.md — 南應大室研所大冒險

台南應用科技大學室內設計系碩士班招生用的 3D 互動網站。純靜態網站（無建置步驟），部署在 GitHub Pages。

## 回覆語言
與使用者溝通一律使用繁體中文（台灣用語）。程式註解也用繁體中文。

## 架構
- `index.html`：介面骨架；Three.js 0.170 以 importmap 從 jsDelivr 載入。
- `data/faculty.js`：`window.WORLD`，含 `regions`（6 個區域）與 `faculty`（12 位研究所導師：專任 8 位、兼任 4 位，兼任標 `adjunct: true`）。**內容修改只改這裡。**
- `data/quests.js`：`window.QUESTS`，12 位導師的兩階段任務（採集任務、「○○老師的試煉」小遊戲）的文字、題目、答案與知識小卡。題目改這裡，再執行 `node tools/quest-sheet.js` 重新產生審閱用的 `docs/quest-answers.md`（不要直接改 md）。小遊戲的專業內容要請老師審閱。
- `js/quests.js`：任務系統（`initQuests(api)`，在 `mergeStatic()` 之後建立）。進度存 localStorage `tutIdQuest.quests.v1`，每位導師 stage 0 未接／1 採集中／2 待試煉／3 已通過。採集場小怪（`SHAPES`）、淨化小遊戲 `#purify`、試煉視窗 `#trial`、導師卡任務區塊、名牌任務記號、左上任務追蹤 `#qtrack`、圖鑑「任務與徽章」分頁與快速模式都在這裡。小遊戲用 `registerTrial(類型, fn)` 註冊，未註冊的顯示「製作中」；網址加 `?dev` 會出現「直接通過」測試鈕。`state.busy` 時角色不能動，`state.paused`（試煉）與導師卡開著時暫停 3D 渲染。
- `js/trials.js`：導師試煉小遊戲（`installTrials(registerTrial)`，由 main.js 呼叫）。每個小遊戲 `fn(容器, 試煉資料, { win })` 回傳清理函式，題目答案讀 `data/quests.js`。操作一律用點選（不用拖曳），滑鼠、觸控、鍵盤都能玩；窄螢幕要另外檢查版面。已完成：network、sequence、prompt、nodes、airflow、sorting。
- `js/main.js`：ES module。主要段落依序為：地形高度函式 `terrainInfo()` → 地形網格 → NPC 站位 → 各區域地標 `build<Region>()` → 植被 → NPC → 玩家 → 控制（導覽 OrbitControls／探險第三人稱）→ 介面（導師卡、圖鑑、小地圖）→ 主迴圈。
- 地圖尺寸：島嶼半徑 `ISLAND_R` 150、區域中心距王都 `REGION_DIST` 80。改尺寸時一併檢查地形 `SIZE`、植被與岩石範圍、雲、`controls.maxDistance`、探險邊界、小地圖 `WORLD_HALF`。陰影由 `updateShadow()` 跟著鏡頭焦點走。
- 任務採集場：每區一塊（`faculty.js` 各區的 `field`），半徑 `FIELD_R`，放在兩區之間沒有道路的荒野；`terrainInfo()` 回傳 `fieldW`，植被與岩石會避開，小地圖畫虛線圈。
- 每個區域地標在 `regionCtx(r)` 的區域座標系中建構：local +z 永遠指向王都（訪客來的方向），NPC 站在 local v≈12 處面向訪客。
- `colliders` 陣列是探險模式的碰撞圓；`animators` 陣列是每幀更新函式。
- NPC：`buildNPC(f)` 依 `f.look` 組出 Q 版人物（`buildHair`／`buildHatLook`／`buildGlasses`／`buildTop`／`buildArm`），招牌道具在 `PROPS`（每個回傳每幀更新函式）。`updateNPCs()` 處理轉身、揮手、底部對話框 `#dialog`（輪播 `f.lines`）與拜訪特效；`updateMood()` 依鏡頭焦點把霧色與天光換成 `MOOD` 中的區域色調。
- 人物外觀參考老師照片；沒有照片的老師（目前徐灝、吳宛蓉）用中性外觀，等老師提供再改。
- 地標特效共用工具（在 `buildCapital` 前）：`canvasTex()` 用 canvas 畫貼圖、`drapedPlane()` 貼地形的平面配 `groundFX()` 著色器做地面特效、`playerLocal()` 取玩家在區域座標的位置。重的特效動畫開頭用 `camNear(r)` 判斷，鏡頭遠離該區就暫停。
- 材質：`mat(color, opts)` 產生快取的卡通材質（`TOON`，四階 `toonRamp`，會忽略 metalness／roughness）；`texMat('stone'|'tile'|'wood', color, repeat)` 是加上程式貼圖（`PATTERNS`）的版本。
- 效能：主迴圈前的 `mergeStatic()` 會把所有 animators 在幾個時間點跑一次，找出會動的物件，其餘靜態模型依「區域（或 NPC）＋材質」合併；整島視角約 700 次 draw call。**會動但不在 animators 裡、或動得很少的物件要用 `dyn(obj)` 標記**（例如 NPC 手臂、品牌牆標誌），否則會被合併而動不了。霧團是 `InstancedMesh`。新增模型時手機（`isTouch`）要減少粒子與數量。
- 音效：`sound`（Web Audio 即時合成，無音檔）。各區環境音隨 `updateMood()` 淡入淡出，`sound.sfx('card'|'reveal'|'visit')` 播互動音效。預設關閉，開關在小地圖角落（localStorage `tutIdQuest.sound.v1`）。
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
改到試煉小遊戲或 `data/quests.js` 的題目時，再執行 `node tools/play-trials.js`（手機尺寸加 `MOBILE=1`），它會照答案自動玩完每個小遊戲，確認都能通關；新增小遊戲時要在這支腳本補上自動玩法。
