/* =========================================================================
 * 南應大室研所大冒險 · 師資資料檔
 * -------------------------------------------------------------------------
 * 這是網站唯一需要定期維護的檔案。新增、修改老師或區域時只要改這裡。
 * 名單：本系研究所專任師資 8 位與兼任師資 4 位，研究領域由系上提供（2026-10）。
 * 其他資料來源（2026-10 擷取）：
 *   專任師資頁 https://id.tut.edu.tw/p/403-1067-1265.php?Lang=zh-tw
 *   兼任師資頁 https://id.tut.edu.tw/p/403-1067-1716.php?Lang=zh-tw
 *   兼任教師：另依系上提供的「114-2 擬新聘兼任教師名冊」「115-1 擬續聘兼任教師名冊」（2026-10）補充
 *             職稱、授課、學歷與經歷；名冊中的出生年月與證書字號屬個人資料，不放上網站
 *   徐灝：另參考銘傳大學建築系師資頁等公開資料
 *   吳宛蓉：照片由系上提供（2026-10）
 *
 * 欄位說明
 *   regions[]  奇幻大陸上的區域（研究領域）
 *     id       英文代號，faculty.region 會引用它
 *     name     區域名稱
 *     motto    一句話副標
 *     desc     區域介紹（顯示在圖鑑與飛抵時）
 *     color    區域主色（地形、角色衣服、介面標籤都會用到）
 *     angle    區域在地圖上的方位角（度，0 = 正北；王都固定在中心）
 *     field    任務採集場：name 名稱、angle 方位角、dist 離島中心距離（放在兩區之間沒有道路的荒野）
 *
 *   faculty[]  每位老師就是一位 NPC
 *     region   所屬區域 id
 *     adjunct  true 表示兼任老師（圖鑑與導師卡會標示「兼任」）
 *     cls      RPG 職業稱號（純屬趣味包裝，可自行修改）
 *     fields   研究領域 → 顯示為「專長技能」
 *     courses  授課科目 → 顯示為「傳授技能書」
 *     feats    證照 / 獲獎 / 代表經歷 → 顯示為「冒險紀錄」
 *     photo    照片路徑，放在 img/faculty/<id>.jpg（讀取失敗時會自動改用姓名頭像）
 *   edu、courses、feats、email、url、photo 沒有資料時可以省略，卡片會自動隱藏該欄
 *     lines    NPC 台詞（依研究專長撰寫的趣味對白，老師可自行修改）
 *     look     3D 人物外觀，參考老師照片：
 *                hair     short｜swept｜shoulder｜bob｜long｜wavy　hairColor 髮色
 *                glasses  round｜square｜sun（墨鏡）　hat beanie｜flatcap　hatColor
 *                top      shirt｜polo｜blazer｜sweater｜mandarin｜vneck｜sleeveless　topColor　inner 外套內搭色
 *                sleeves  long｜short　pants 褲子色　shoes 鞋子色（省略為深色）　earrings 耳環
 *                prop     招牌道具（對應 main.js 的 PROPS）
 * ========================================================================= */

window.WORLD = {
  title: "南應大室研所大冒險",
  subtitle: "台南應用科技大學 室內設計系碩士班 · 師資探險地圖",
  links: {
    admissions: "https://admissions.tut.edu.tw/",
    department: "https://id.tut.edu.tw/",
    master: "https://id.tut.edu.tw/p/412-1067-1479.php?Lang=zh-tw",
    facultyPage: "https://id.tut.edu.tw/p/403-1067-1265.php?Lang=zh-tw"
  },

  regions: [
    {
      id: "capital",
      name: "設計王都",
      motto: "所有冒險的起點",
      desc: "大陸中央的城邦，系主任坐鎮城中。這裡用社會網路分析與 AI 應用研究看見設計背後的人與資料，也把多年工程實戰淬鍊成室內設計實務研究，歡迎每一位新來的冒險者。",
      color: "#d9a441",
      angle: 0,
      field: { name: "王都近郊", angle: 262, dist: 40 }
    },
    {
      id: "forest",
      name: "運算之森",
      motto: "演算法長成的發光森林",
      desc: "樹木由程式碼生長，水晶裡流動著資料。這裡研究 AI 應用、設計運算與 AI 整合，讓設計師學會與 AI 一起思考。",
      color: "#3fc1c9",
      angle: 30,
      field: { name: "雜訊林地", angle: 345, dist: 88 }
    },
    {
      id: "valley",
      name: "環控風谷",
      motto: "看見空氣、材料與循環的峽谷",
      desc: "風車終日轉動，氣流在峽谷間可被看見，循環之環在谷地上空緩緩旋轉。這裡研究智慧生活與互動設計、室內空氣品質與環境診斷，並以循環設計策略與建材環境性能評估，打造健康又永續的室內環境。",
      color: "#7bb661",
      angle: 95,
      field: { name: "汙染高地", angle: 62, dist: 86 }
    },
    {
      id: "workshop",
      name: "匠人工坊",
      motto: "木構架與數位機具並肩運轉的工匠村",
      desc: "村裡的工坊日夜不停：數位製造的機械手臂精準切削，一旁的木構架一根根實際搭起。在這裡，構造要親手蓋出來才算數。",
      color: "#c8794a",
      angle: 160,
      field: { name: "木料堆置場", angle: 128, dist: 86 }
    },
    {
      id: "market",
      name: "創生市集",
      motto: "社區與產業一起長大的熱鬧市集",
      desc: "市集廣場上攤棚林立、燈串高掛，居民與店家在這裡一起營造生活。這裡研究社區總體營造與創新產業，也鑽研商業空間設計與設計公司經營管理，讓設計走進街區、創造價值。",
      color: "#5b8fd9",
      angle: 225,
      field: { name: "老街巷弄", angle: 193, dist: 86 }
    },
    {
      id: "plateau",
      name: "彩虹高原",
      motto: "美學與品牌的天空之地",
      desc: "高原上立著巨大的畫架與彩色石柱。這裡修練室內美學與風格，並研究品牌形象設計與永續策略，讓空間擁有打動人心的表情。",
      color: "#e05d8c",
      angle: 295,
      field: { name: "褪色草原", angle: 260, dist: 86 }
    }
  ],

  faculty: [
    {
      id: "huang-jiao-yi",
      name: "黃教益",
      title: "副教授兼系主任",
      region: "capital",
      cls: "王都城主 · 網絡占星師",
      edu: "國立成功大學創意產業研究所 博士",
      fields: ["社會網路分析", "AI 應用研究"],
      courses: ["建築資訊模型", "量化研究與學術寫作", "室內設計"],
      feats: ["室內設計系第九任系主任（113.02～迄今）", "本系專任副教授（103.08～迄今）"],
      email: "t60013@mail.tut.edu.tw",
      url: "https://reurl.cc/bENWo3",
      photo: "img/faculty/huang-jiao-yi.jpg",
      lines: ["歡迎來到設計王都！每一段人際連結，都是一張可以分析的網路。", "想知道誰影響了誰？社會網路分析會畫給你看。", "AI 不只是工具，配上好的研究方法，它能幫你看見設計背後的規律。"],
      look: { hair: "short", hairColor: "#9a9a96", glasses: "sun", top: "shirt", topColor: "#f4f4f0", sleeves: "short", pants: "#1f1f24", prop: "netOrb" }
    },
    {
      id: "feng-yi-ming",
      name: "馮一鳴",
      title: "專案助理教授",
      region: "capital",
      cls: "實戰工程統帥",
      edu: "亞洲大學數位媒體設計學系 博士",
      fields: ["室內設計實務研究"],
      courses: ["室內設計"],
      feats: ["曾任多家設計工程公司設計部經理、主任", "曾任嶺東科技大學專案助理教授"],
      email: "t60134@mail.tut.edu.tw",
      url: "https://id.tut.edu.tw/p/406-1067-60472,r1265.php?Lang=zh-tw",
      photo: "img/faculty/feng-yi-ming.jpg",
      lines: ["圖畫得漂亮還不夠，要蓋得出來才算數。", "工地現場是最好的教室，實務經驗也能變成研究。", "預算、工期、材料，設計師的每個決定都會在現場被檢驗。"],
      look: { hair: "shoulder", hairColor: "#2a2522", glasses: "square", top: "blazer", topColor: "#1d1d22", inner: "#3a3d44", sleeves: "long", pants: "#24242a", prop: "tape" }
    },
    {
      id: "lin-chieh-jen",
      name: "林傑仁",
      title: "副教授",
      region: "forest",
      cls: "生成術士",
      edu: "國立成功大學建築學 博士",
      fields: ["AI 應用研究", "設計運算"],
      courses: ["生成式人工智慧應用", "室內設計", "運算化設計"],
      feats: ["學術暨產學合作中心主任（112.08～115.07）", "本系專任副教授（100.08～迄今）"],
      email: "t60011@mail.tut.edu.tw",
      url: "https://reurl.cc/qNKG4n",
      photo: "img/faculty/lin-chieh-jen.jpg",
      lines: ["讓 AI 當你的設計夥伴，而不是取代你。", "一段程式，可以長出一百種空間方案。", "設計運算的關鍵，是把設計直覺寫成規則。"],
      look: { hair: "short", hairColor: "#1f1b19", glasses: "round", top: "polo", topColor: "#6e6f72", sleeves: "short", pants: "#2b2d33", prop: "holo" }
    },
    {
      id: "hsu-hao",
      name: "徐灝",
      title: "兼任助理教授級專業技術人員",
      adjunct: true,
      region: "forest",
      cls: "AI 整合術士",
      edu: "國立成功大學建築學系碩士班 碩士",
      fields: ["設計運算", "AI 整合研究"],
      courses: ["設計運算與 AI 整合應用"],
      feats: ["加號設計數位工程有限公司（HJPLUS）負責人（112.11～迄今）", "國立成功大學建築研究所 博士班（2023～）", "曾任高仲廷建築師事務所 3D & BIM 專員、薩摩亞商澤新建築顧問 助理建築師", "第五屆海峽建築新人獎 銀獎（2014）", "天華竹構建造大賽 優秀獎（2018）", "Autodesk Revit Certified Professional（2017）", "McNeel Rhinoceros 3D 原廠國際認證暨授權講師（2015）"],
      url: "https://arch.mcu.edu.tw/%e5%be%90%e7%81%9d-%e6%95%b8%e4%bd%8d%e5%85%bc%e4%bb%bb%e8%ac%9b%e5%b8%ab/",
      lines: ["節點接上節點，參數就會開始說話。", "把 AI 接進設計流程，從建模到出圖都能更聰明。", "設計運算不是炫技，是讓重複的事交給電腦。"],
      look: { hair: "swept", hairColor: "#16110f", glasses: "square", top: "blazer", topColor: "#1f2024", inner: "#7d7f85", sleeves: "long", pants: "#26272c", prop: "nodes" }
    },
    {
      id: "chen-nien-tsu",
      name: "陳念祖",
      title: "副教授兼校務發展中心主任",
      region: "valley",
      cls: "智域氣流術師",
      edu: "國立成功大學建築學系 博士",
      fields: ["智慧生活與互動設計", "室內空氣品質與環境診斷"],
      courses: ["室內設計", "表現技法", "室內設計專業製圖"],
      feats: ["計畫管理組組長（112.08～115.07）", "曾任成大祐生環控研究中心研究人員"],
      email: "t60099@mail.tut.edu.tw",
      url: "https://reurl.cc/eWWp9L",
      photo: "img/faculty/chen-nien-tsu.jpg",
      lines: ["看不見的空氣，決定了你在室內的每一口呼吸。", "溫度、濕度、二氧化碳，都是空間的健康指標。", "智慧生活不是堆科技，而是讓空間懂得回應人。"],
      look: { hair: "short", hairColor: "#1f1b19", glasses: "round", hat: "flatcap", hatColor: "#2b2b2e", top: "blazer", topColor: "#c9cbcf", inner: "#6f9fd6", sleeves: "long", pants: "#3e5a86", prop: "sensor" }
    },
    {
      id: "huang-kun-chih",
      name: "黃琨智",
      title: "助理教授兼總務處營繕組組長",
      region: "valley",
      cls: "循環煉金師",
      edu: "國立成功大學建築研究所 博士",
      fields: ["循環設計策略", "建材環境性能評估"],
      courses: ["室內設計", "材料與施工", "室內環境控制", "職場實習", "創新趨勢"],
      feats: ["空間設計學會研討會 優秀論文", "建築學會研究成果發表會 優秀論文獎", "ISO/IEC 17025 實驗室認證訓練合格", "丙級建築製圖技術士"],
      email: "t60111@mail.tut.edu.tw",
      url: "https://eportfolio.tut.edu.tw/blogself?id=91845DC665DF4D21962CFA3A7770FEC6",
      photo: "img/faculty/huang-kun-chih.jpg",
      lines: ["這塊材料的下一輩子，從設計的第一天就要想好。", "好建材不只看外觀，還要看它對環境的影響。", "循環設計，就是讓材料一直在路上，而不是在掩埋場。"],
      look: { hair: "swept", hairColor: "#5a3a26", glasses: "square", top: "shirt", topColor: "#2f6f7a", sleeves: "long", pants: "#2b2d33", prop: "samples" }
    },
    {
      id: "chiang-po-hung",
      name: "江博鴻",
      title: "助理教授",
      region: "workshop",
      cls: "數位鍛造師",
      edu: "淡江大學土木所建築組 博士",
      fields: ["數位製造"],
      courses: ["設計心理學", "室內設計", "室內設計專業製圖"],
      feats: ["裝潢木工乙級技術士", "曾任謝英俊、劉居立建築師事務所設計師"],
      email: "t60106@mail.tut.edu.tw",
      url: "https://reurl.cc/p5L3k4",
      photo: "img/faculty/chiang-po-hung.jpg",
      lines: ["從電腦裡的模型到手上的實物，只差一台機器的距離。", "雷射切割、CNC、3D 列印，數位製造讓想法馬上成形。", "先做出來，再修正，原型是最好的設計語言。"],
      look: { hair: "short", hairColor: "#1f1b19", glasses: "round", top: "shirt", topColor: "#3f5f86", sleeves: "long", pants: "#2b2d33", prop: "printer" }
    },
    {
      id: "chen-kuan-fan",
      name: "陳冠帆",
      title: "兼任副教授級專業技術人員",
      adjunct: true,
      region: "workshop",
      cls: "構築大匠",
      edu: "國立成功大學建築學系碩士班 碩士",
      fields: ["實構築", "木構造"],
      courses: ["實構築：竹木構造特論", "室內設計整合 BIM 特論"],
      feats: ["原型結構工程顧問有限公司 負責人（101.01～迄今）", "曾任日本構造設計集團 SDG 設計師", "上海世博會中國船舶館 結構負責人（2009）", "日本岡山縣觀光之塔 首獎（2006）", "2015 臺灣建築獎－雲林農博公園"],
      url: "https://id.tut.edu.tw/p/406-1067-51025,r1716.php?Lang=zh-tw",
      photo: "img/faculty/chen-kuan-fan.jpg",
      lines: ["構造要親手蓋過一次，才真正懂得力怎麼走。", "木構造的美，藏在每一個接頭裡。", "一比一實構築，是設計和結構最誠實的對話。"],
      look: { hair: "short", hairColor: "#1a1716", glasses: "round", top: "mandarin", topColor: "#2e2b29", sleeves: "short", pants: "#2b2d33", prop: "beam" }
    },
    {
      id: "chang-yi-fen",
      name: "張怡棻",
      title: "副教授",
      region: "market",
      cls: "聚落營造使",
      edu: "國立雲林科技大學設計學研究所 博士",
      fields: ["社區總體營造", "創新產業研究"],
      courses: ["室內設計"],
      feats: ["曾任樹德科技大學專任副教授", "曾任葉世宗建築師事務所專案設計師"],
      email: "t00359@mail.tut.edu.tw",
      url: "https://id.tut.edu.tw/p/406-1067-60471,r1265.php?Lang=zh-tw",
      photo: "img/faculty/chang-yi-fen.jpg",
      lines: ["社區的事，要大家一起來做才會長久。", "老街、老屋、老手藝，都可能是下一個創新產業的起點。", "設計走進社區，第一步是聽居民說故事。"],
      look: { hair: "shoulder", hairColor: "#1a1716", hat: "beanie", hatColor: "#2f5fd0", top: "sweater", topColor: "#2a4fc4", sleeves: "long", pants: "#2b2d33", prop: "map" }
    },
    {
      id: "hsu-lu-li",
      name: "許鹿麗",
      title: "兼任助理教授級專業技術人員",
      adjunct: true,
      region: "market",
      cls: "商域經營師",
      edu: "台南應用科技大學 學士",
      fields: ["商業空間特論", "設計公司經營管理"],
      courses: ["商業空間規劃與設計"],
      feats: ["深圳市白日夢創意設計事務所 設計總監（111.01～迄今）", "曾任梁志天設計有限公司、瓦第設計工程有限公司 室內設計師", "2023 美國 TITAN Property Awards 室內設計金獎", "2022 法國 NOVUM DESIGN AWARD 金獎", "2020 英國 International Hotel & Property Awards 亞太區公共區域大獎", "建築物室內設計乙級技術士"],
      email: "t60115@mail.tut.edu.tw",
      url: "https://id.tut.edu.tw/p/406-1067-46038,r1716.php?Lang=zh-tw",
      photo: "img/faculty/hsu-lu-li.jpg",
      lines: ["好的商業空間，會讓客人自己想走進來。", "設計公司也是一門生意，經營管理一樣要學。", "從品牌到動線，每一寸空間都在幫店家說話。"],
      look: { hair: "bob", hairColor: "#1a1716", top: "sleeveless", topColor: "#1c1c20", pants: "#1c1c20", earrings:  true, prop: "chart" }
    },
    {
      id: "lien-tang-hsuan",
      name: "連棠琁",
      title: "助理教授級專業技術人員",
      region: "plateau",
      cls: "紋章識別師",
      edu: "國立高雄師範大學視覺設計系研究所 MFA",
      fields: ["品牌形象設計與永續策略特論"],
      courses: ["品牌形象設計特論", "文化創意產業", "色彩計劃", "創新趨勢", "電腦設計表現"],
      feats: ["公共關係組組長（112.08～115.07）"],
      email: "te0063@mail.tut.edu.tw",
      url: "https://reurl.cc/ZNle5V",
      photo: "img/faculty/lien-tang-hsuan.jpg",
      lines: ["品牌形象是一種承諾，永續就是讓承諾說到做到。", "顏色、字體、標誌，都在替品牌說故事。", "好品牌要經得起時間，也要對得起環境。"],
      look: { hair: "wavy", hairColor: "#6b4128", top: "blazer", topColor: "#1d1d22", inner: "#e9e4dc", sleeves: "long", pants: "#1d1d22", prop: "emblem" }
    },
    {
      id: "wu-wan-jung",
      name: "吳宛蓉",
      title: "兼任講師",
      adjunct: true,
      region: "plateau",
      cls: "風格美學師",
      edu: "英國威爾斯大學（University of Wales）室內與生活設計 碩士、義大利 Domus Academy 室內與生活設計 碩士",
      fields: ["室內美學與風格"],
      courses: ["室內陳設與風格"],
      feats: ["暮空間室內設計工程有限公司 設計師（109.05～迄今）", "mmm 傢俱藝術研究 Blog 設計師（107.08～迄今）", "曾主持吳宛蓉室內生活設計工作室（105.01～109.07）", "曾任吳建森建築師事務所、禾築設計、清禾設計、傑西艾倫設計 設計師"],
      lines: ["風格不是複製，而是找到屬於空間的個性。", "光線、材質、色彩配對了，美感自然就出來。", "先決定想要的感覺，再挑家具和布料。"],
      photo: "img/faculty/wu-wan-jung.jpg",
      look: { hair: "bob", hairColor: "#2e1f18", top: "vneck", topColor: "#3b414d", sleeves: "short", pants: "#3b414d", shoes: "#b9bdc3", prop: "moodboard" }
    }
  ]
};
