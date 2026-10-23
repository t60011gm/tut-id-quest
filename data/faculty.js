/* =========================================================================
 * 南應大室研所大冒險 · 師資資料檔
 * -------------------------------------------------------------------------
 * 這是網站唯一需要定期維護的檔案。新增、修改老師或區域時只要改這裡。
 * 名單：本系研究所專任師資 8 位與兼任師資 4 位，研究領域由系上提供（2026-10）。
 * 其他資料來源（2026-10 擷取）：
 *   專任師資頁 https://id.tut.edu.tw/p/403-1067-1265.php?Lang=zh-tw
 *   兼任師資頁 https://id.tut.edu.tw/p/403-1067-1716.php?Lang=zh-tw
 *   徐灝：系網無資料，學經歷取自銘傳大學建築系師資頁等公開資料
 *   吳宛蓉：系網無資料、網路查無可靠來源，目前只列研究領域
 *
 * 欄位說明
 *   regions[]  奇幻大陸上的區域（研究領域）
 *     id       英文代號，faculty.region 會引用它
 *     name     區域名稱
 *     motto    一句話副標
 *     desc     區域介紹（顯示在圖鑑與飛抵時）
 *     color    區域主色（地形、角色衣服、介面標籤都會用到）
 *     angle    區域在地圖上的方位角（度，0 = 正北；王都固定在中心）
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
      angle: 0
    },
    {
      id: "forest",
      name: "運算之森",
      motto: "演算法長成的發光森林",
      desc: "樹木由程式碼生長，水晶裡流動著資料。這裡研究 AI 應用、設計運算與 AI 整合，讓設計師學會與 AI 一起思考。",
      color: "#3fc1c9",
      angle: 30
    },
    {
      id: "valley",
      name: "環控風谷",
      motto: "看見空氣、材料與循環的峽谷",
      desc: "風車終日轉動，氣流在峽谷間可被看見，循環之環在谷地上空緩緩旋轉。這裡研究智慧生活與互動設計、室內空氣品質與環境診斷，並以循環設計策略與建材環境性能評估，打造健康又永續的室內環境。",
      color: "#7bb661",
      angle: 95
    },
    {
      id: "workshop",
      name: "匠人工坊",
      motto: "木構架與數位機具並肩運轉的工匠村",
      desc: "村裡的工坊日夜不停：數位製造的機械手臂精準切削，一旁的木構架一根根實際搭起。在這裡，構造要親手蓋出來才算數。",
      color: "#c8794a",
      angle: 160
    },
    {
      id: "market",
      name: "創生市集",
      motto: "社區與產業一起長大的熱鬧市集",
      desc: "市集廣場上攤棚林立、燈串高掛，居民與店家在這裡一起營造生活。這裡研究社區總體營造與創新產業，也鑽研商業空間設計與設計公司經營管理，讓設計走進街區、創造價值。",
      color: "#5b8fd9",
      angle: 225
    },
    {
      id: "plateau",
      name: "彩虹高原",
      motto: "美學與品牌的天空之地",
      desc: "高原上立著巨大的畫架與彩色石柱。這裡修練室內美學與風格，並研究品牌形象設計與永續策略，讓空間擁有打動人心的表情。",
      color: "#e05d8c",
      angle: 295
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
      photo: "img/faculty/huang-jiao-yi.jpg"
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
      photo: "img/faculty/feng-yi-ming.jpg"
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
      photo: "img/faculty/lin-chieh-jen.jpg"
    },
    {
      id: "hsu-hao",
      name: "徐灝",
      title: "兼任教師",
      adjunct: true,
      region: "forest",
      cls: "AI 整合術士",
      edu: "國立成功大學建築研究所 碩士（設計、運算與數位製造組）",
      fields: ["設計運算", "AI 整合研究"],
      feats: ["國立成功大學建築研究所 博士班（2023～）", "HJPLUS 加號設計數位工程有限公司 負責人", "曾任黃聖吉建築師事務所 建築資訊主任", "McNeel Rhinoceros 3D 原廠授權講師"],
      url: "https://arch.mcu.edu.tw/%e5%be%90%e7%81%9d-%e6%95%b8%e4%bd%8d%e5%85%bc%e4%bb%bb%e8%ac%9b%e5%b8%ab/"
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
      photo: "img/faculty/chen-nien-tsu.jpg"
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
      photo: "img/faculty/huang-kun-chih.jpg"
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
      photo: "img/faculty/chiang-po-hung.jpg"
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
      courses: ["室內設計整合 BIM 特論"],
      feats: ["原型結構工程顧問有限公司 負責人（101.01～迄今）", "曾任日本構造設計集團 SDG 設計師", "上海世博會中國船舶館 結構負責人（2009）", "日本岡山縣觀光之塔 首獎（2006）", "2015 臺灣建築獎－雲林農博公園"],
      url: "https://id.tut.edu.tw/p/406-1067-51025,r1716.php?Lang=zh-tw",
      photo: "img/faculty/chen-kuan-fan.jpg"
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
      photo: "img/faculty/chang-yi-fen.jpg"
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
      feats: ["深圳市白日夢創意設計事務所 設計總監（111.01～迄今）", "曾任梁志天設計有限公司 室內設計師", "2023 美國 TITAN Property Awards 室內設計金獎", "2022 法國 NOVUM DESIGN AWARD 金獎", "建築物室內設計乙級技術士"],
      email: "t60115@mail.tut.edu.tw",
      url: "https://id.tut.edu.tw/p/406-1067-46038,r1716.php?Lang=zh-tw",
      photo: "img/faculty/hsu-lu-li.jpg"
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
      photo: "img/faculty/lien-tang-hsuan.jpg"
    },
    {
      id: "wu-wan-jung",
      name: "吳宛蓉",
      title: "兼任教師",
      adjunct: true,
      region: "plateau",
      cls: "風格美學師",
      fields: ["室內美學與風格"]
    }
  ]
};
