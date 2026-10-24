# CLAUDE.md — 南應大室研所大冒險

台南應用科技大學室內設計系碩士班招生用的 3D 互動網站。純靜態網站（無建置步驟），部署在 GitHub Pages。

## 回覆語言
與使用者溝通一律使用繁體中文（台灣用語）。程式註解也用繁體中文。

## 架構
- `index.html`：介面骨架；Three.js 0.170 以 importmap 從 jsDelivr 載入。
- `data/faculty.js`：`window.WORLD`，含 `regions`（6 個區域）與 `faculty`（12 位研究所導師：專任 8 位、兼任 4 位，兼任標 `adjunct: true`）。**內容修改只改這裡。**
- `data/worlds.js`：`window.WORLDS`，三個世界觀（`fantasy` 中古奇幻／`modern` 現代城鎮／`cyber` 賽博未來）的開場卡片文字、說明、各區名稱與介紹、職業稱號（`cls`）與小怪名稱的覆寫。老師、任務、題目三個世界共用。
- `data/quests.js`：`window.QUESTS`，12 位導師的兩階段任務（採集任務、「○○老師的試煉」小遊戲）的文字、題目、答案與知識小卡。題目改這裡，再執行 `node tools/quest-sheet.js` 重新產生審閱用的 `docs/quest-answers.md`（不要直接改 md）。小遊戲的專業內容要請老師審閱。
- `js/quests.js`：任務系統（`initQuests(api)`，在 `mergeStatic()` 之後建立）。進度存 localStorage `tutIdQuest.quests.v1`，每位導師 stage 0 未接／1 採集中／2 待試煉／3 已通過。採集場閒晃小怪（`SHAPES`）、採集戰流程（選難度、2D 小視窗、3D 採集場、結果）、試煉視窗 `#trial`、導師卡任務區塊、名牌任務記號、左上任務追蹤 `#qtrack`、圖鑑「任務與徽章」分頁與快速模式都在這裡。小遊戲用 `registerTrial(類型, fn)` 註冊，未註冊的顯示「製作中」；網址加 `?dev` 會出現「直接通過」測試鈕。`state.busy` 時角色不能動，`state.paused`（試煉）與導師卡開著時暫停 3D 渲染。
- `js/fight.js`：第一階段「採集戰」動作小遊戲。`createArena()` 是場地引擎（場地座標原點在採集場中心、半徑 `ARENA_R`），`GAMES` 有 12 個玩法（link、guard、denoise、nodes、sensor、recycle、trail、whack、escort、coins、paint、frame，對應 `data/quests.js` 各老師 `stage1.game.type`），每個玩法有 `setup`／`update`／`action`／`bot`（自動玩法）。`draw2D()` 是 2D 小視窗畫法。難度：簡易版被打到掉道具、撿回來即可；正常版 5 格體力，歸零失敗。簡易版與手機用 2D 小視窗（`#trial` 內），正常版在桌機進 3D 採集場（`js/fight3d.js` 畫，`#fight-hud` 資訊列，移動透過 main.js 的 `state.moveHook`）。
- `js/trials.js`：導師試煉小遊戲（`installTrials(registerTrial)`，由 main.js 呼叫）。每個小遊戲 `fn(容器, 試煉資料, { win })` 回傳清理函式，題目答案讀 `data/quests.js`。操作一律用點選（不用拖曳），滑鼠、觸控、鍵盤都能玩；窄螢幕要另外檢查版面。12 個都已完成：network、sequence、prompt、nodes、airflow、sorting、stack、bracing、matching、storeplan、spotbrand、moodboard。全部通過後可領「試煉合格證」（`js/quests.js` 的 `drawCertificate()` 用 canvas 畫，可填名字、下載 PNG，註明非正式學歷證明）。
- 世界觀：開場畫面選世界（`.world-pick`），選別的世界會帶 `?world=` 重新載入，背景直接換成該世界預覽；選擇存在 localStorage `tutIdQuest.world.v1`，`<html data-world>` 決定介面配色（`css/style.css` 末段的主題 token）。main.js 的 `ENV` 依世界換天空、海、光、地形色與各區 `STYLE`／`MOOD`；地標由 `WORLD_BUILDERS` 分派：奇幻用 main.js 的 `build<Region>()`，現代與未來在 `js/world-modern.js`、`js/world-cyber.js`（`<世界>_BUILDERS.<區域 id>(r, K)` 與全島植被 `scenery(pts, K)`，`K` 是 main.js 提供的工具箱）。未來世界的建築一律是未來主義／參數化自由形體：`fluidTower(K, H, rings, seg, section, n)` 以超橢圓斷面逐層生成外殼，`paramSection({ w, d, taper, bulge, freq, twist, sway, flare, waist, dome })` 調出扭轉塔、雙曲面塔、尖塔、圓頂；`tower()` 是自由形體高樓、`waveRoof()` 是波浪屋頂，外殼材質 `shellMat()`（白色板帶＋水平帶窗，夜裡亮起）。建築由三種演算法產生、依高度分派（`scenery()`；霓虹夜市各放一棟示範）：①最高層（含設計中樞）是旋轉樓板疊層塔（參考 MAD 的 Absolute Towers）：`fluidTower()` 斷面逐層扭轉，再用 `floorSlabs()` 每層外推樓板陽台、隔幾層種植栽，單棟用 `tower()`；②中高層是瘦高 Meta-ball（`metaballGeo()` 以 MarchingCubes 沿垂直軸疊一串漸小的球、底部加裙擺球，`blobBuilding()`）；③中低層是橫向斷面變形展館（參考 Heydar Aliyev Center，`aliyevGeo()`／`aliyevBuilding()`：沿水平長軸放半超橢圓拱形斷面，高度、深度、平面擺動與前傾沿長軸變形，兩端流入地面、一端隆起成往前捲的浪頭）。有機外殼材質 `blobMat(K, Standard, 'tall'|'aliyev')` 用著色器依正規化高度畫帶窗。量體斷面要夠粗（塔約高度的 1/4 以上），不要細長如蟲；大型建築用 `terraceGeo()` 加露台、`plantShrubs()` 種植栽；建築數量節制，空地以綠色闊葉樹與霓虹樹填補。建築最細處要比兩棵樹冠寬（約 6 公尺以上），比這更細的建築一律不要做；全城建築彼此至少相距 13。結構小物用 `metal()`、`concrete()`，不要用接近全黑的顏色，也不要再用方塊大樓。NPC 的區域識別（`worldGear`）、玩家服裝、小怪造型（quests.js 的 `skin()`）與 2D 採集場地面也依世界切換。新增區域時三個世界都要補地標。
- 日夜循環（main.js「日夜循環」段，在 `mergeStatic()` 之後）：現實 1 小時＝遊戲 1 天，跟著真實時鐘走；`?time=20` 或 `__quest.setHour(h)` 可指定時刻。`DN` 是各世界的黃昏／夜晚色票，`updateDayNight()` 移動太陽與月亮、星星、調整發光材質，`updateMood()` 再混入黃昏與夜色。發光材質會自動在夜裡變亮（每幀自己改亮度的材質不接管）；材質可用 `userData.day`／`userData.night` 指定白天與夜晚亮度（例如窗戶室內燈）。路燈、火把、霓虹柱用 `addLight(parent, x, y, z, color, { pool, flame, noHalo })` 登記（世界模組用 `K.addLight`），夜裡亮起光暈與地面光圈。小地圖角落 `#clock` 顯示遊戲時間，點它打開 `#time-panel`（0～23 時拉桿與白天／黃昏／夜晚按鈕），`#btn-daynight` 一鍵切換白天（12 時）與夜晚（21 時）；設定後時間繼續流動。
- `js/main.js`：ES module。主要段落依序為：地形高度函式 `terrainInfo()` → 地形網格 → NPC 站位 → 各區域地標 `build<Region>()` → 植被 → NPC → 玩家 → 控制（導覽 OrbitControls／探險第三人稱）→ 介面（導師卡、圖鑑、小地圖）→ 主迴圈。
- 地圖尺寸：島嶼半徑 `ISLAND_R` 150、區域中心距王都 `REGION_DIST` 80。改尺寸時一併檢查地形 `SIZE`、植被與岩石範圍、雲、`controls.maxDistance`、探險邊界、小地圖 `WORLD_HALF`。陰影由 `updateShadow()` 跟著鏡頭焦點走。
- 任務採集場：每區一塊（`faculty.js` 各區的 `field`），半徑 `FIELD_R`，放在兩區之間沒有道路的荒野；`terrainInfo()` 回傳 `fieldW`，植被與岩石會避開，小地圖畫虛線圈。
- 每個區域地標在 `regionCtx(r)` 的區域座標系中建構：local +z 永遠指向王都（訪客來的方向），NPC 站在 local v≈12 處面向訪客。
- `colliders` 陣列是探險模式的碰撞圓；`animators` 陣列是每幀更新函式。
- NPC：`buildNPC(f)` 依 `f.look` 組出 Q 版人物（`buildHair`／`buildHatLook`／`buildGlasses`／`buildTop`／`buildArm`），招牌道具在 `PROPS`（每個回傳每幀更新函式）。`updateNPCs()` 處理轉身、揮手、底部對話框 `#dialog`（輪播 `f.lines`）與拜訪特效；`updateMood()` 依鏡頭焦點把霧色與天光換成 `MOOD` 中的區域色調。
- 人物外觀參考老師照片。徐灝、吳宛蓉兩位老師的 3D 外觀已依使用者提供的照片調整，兩位老師的照片檔也已放入。
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
- 動畫用 `requestAnimationFrame` 的時間戳和 `performance.now()` 相減時要夾在 0 以上：手機上 rAF 給的時間戳可能比按下按鈕時還早，算出負值會讓陣列索引變成 −1 而卡住（許鹿麗試煉曾因此卡住）。
- 試煉版面要能承受手機系統字體放大：窄螢幕不要用固定位置的絕對定位排可點元素，改用格線或流動排版。
- 修改後用 `python3 -m http.server` 在本機開啟，桌機與手機寬度都要看過。

## 測試
`window.__quest` 暴露 `setMode`、`selectTeacher`、`goRegion` 等函式，方便用 Playwright 驅動截圖。
修改後執行 `node tools/smoke-test.js`（截圖存在 `dist/screens/`），全部通過再提交。三支測試腳本都可加 `WORLD=modern` 或 `WORLD=cyber` 測其他世界觀；改到場景或介面時三個世界都要跑。
改到採集戰（`js/fight.js`、`js/fight3d.js`）時執行 `node tools/play-fights.js`（`MOBILE=1` 手機、`MODE=3d` 正常版 3D 採集場），它會用每個玩法的 bot 先模擬再實際玩到結束；新增玩法要寫 `bot`。
改到試煉小遊戲或 `data/quests.js` 的題目時，再執行 `node tools/play-trials.js`（手機尺寸加 `MOBILE=1`），它會照答案自動玩完每個小遊戲，確認都能通關；新增小遊戲時要在這支腳本補上自動玩法。
