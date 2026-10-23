/* =========================================================================
 * 南應室研大陸 · 師資資料檔
 * -------------------------------------------------------------------------
 * 這是網站唯一需要定期維護的檔案。新增、修改老師或區域時只要改這裡。
 * 資料來源：台南應用科技大學室內設計系「專任師資」頁面
 *   https://id.tut.edu.tw/p/403-1067-1265.php?Lang=zh-tw （2026-10 擷取）
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
 *     cls      RPG 職業稱號（純屬趣味包裝，可自行修改）
 *     fields   研究領域 → 顯示為「專長技能」
 *     courses  授課科目 → 顯示為「傳授技能書」
 *     feats    證照 / 獲獎 / 代表經歷 → 顯示為「冒險紀錄」
 *     photo    照片網址（讀取失敗時會自動改用姓名頭像）
 * ========================================================================= */

window.WORLD = {
  title: "南應室研大陸",
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
      desc: "大陸中央的城邦，室內設計的核心技藝在這裡傳承：從空間設計基礎、設計思考，到建築資訊模型與實務專案。系主任坐鎮城中，歡迎每一位新來的冒險者。",
      color: "#d9a441",
      angle: 0
    },
    {
      id: "forest",
      name: "運算之森",
      motto: "演算法長成的發光森林",
      desc: "樹木由程式碼生長，水晶裡流動著資料。這裡研究生成式人工智慧、運算化設計、電腦輔助設計與數位製作，讓設計師學會與 AI 一起思考。",
      color: "#3fc1c9",
      angle: 30
    },
    {
      id: "valley",
      name: "環控風谷",
      motto: "看見空氣、聲音與光的峽谷",
      desc: "風車終日轉動，氣流在峽谷間可被看見。這裡的學者以數值模擬、室內空氣品質、建築聲學與綠建材試驗，打造健康舒適的室內環境。",
      color: "#7bb661",
      angle: 95
    },
    {
      id: "workshop",
      name: "匠人工坊",
      motto: "木屑與刨花飄香的工匠村",
      desc: "村裡的工坊日夜不停：細木作、家具設計、構造與材料。理論與手感在這裡相遇，每一件作品都經得起觸摸。",
      color: "#c8794a",
      angle: 160
    },
    {
      id: "ruins",
      name: "古城遺跡",
      motto: "沉睡著空間記憶的古老城址",
      desc: "傾頹的柱廊與城門訴說著歷史。這裡探究設計史、文化資產保存、聚落再生、都市理論與客家研究，從過去找到未來設計的線索。",
      color: "#9a8cc2",
      angle: 225
    },
    {
      id: "plateau",
      name: "彩虹高原",
      motto: "色彩與圖像的天空之地",
      desc: "高原上立著巨大的畫架與彩色石柱。這裡修練繪畫、色彩計劃、藝術創作與品牌視覺識別，讓空間擁有打動人心的表情。",
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
      cls: "王都城主 · 建築資訊騎士",
      edu: "國立成功大學創意產業研究所 博士",
      fields: ["建築與室內設計", "BIM 建築資訊模型", "SEM 結構方程模型"],
      courses: ["建築資訊模型", "量化研究與學術寫作", "室內設計"],
      feats: ["室內設計系第九任系主任（113.02～迄今）", "本系專任副教授（103.08～迄今）"],
      email: "t60013@mail.tut.edu.tw",
      url: "https://reurl.cc/bENWo3",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/403/m/mczh-tw400x400_small37592_509910450337.jpg"
    },
    {
      id: "chang-yi-fen",
      name: "張怡棻",
      title: "副教授",
      region: "capital",
      cls: "王都設計導師",
      edu: "國立雲林科技大學設計學研究所 博士",
      fields: ["室內設計"],
      courses: ["室內設計"],
      feats: ["曾任樹德科技大學專任副教授", "曾任葉世宗建築師事務所專案設計師"],
      email: "t00359@mail.tut.edu.tw",
      url: "https://id.tut.edu.tw/p/406-1067-60471,r1265.php?Lang=zh-tw",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/818/m/mczh-tw400x400_small60471_609259077454.jpg"
    },
    {
      id: "feng-yi-ming",
      name: "馮一鳴",
      title: "專案助理教授",
      region: "capital",
      cls: "實戰工程統帥",
      edu: "亞洲大學數位媒體設計學系 博士",
      fields: ["室內設計"],
      courses: ["室內設計"],
      feats: ["曾任多家設計工程公司設計部經理、主任", "曾任嶺東科技大學專案助理教授"],
      email: "t60134@mail.tut.edu.tw",
      url: "https://id.tut.edu.tw/p/406-1067-60472,r1265.php?Lang=zh-tw",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/666/m/mczh-tw400x400_small60472_883406309849.jpg"
    },
    {
      id: "hsu-hung-hsin",
      name: "徐宏鑫",
      title: "講師",
      region: "capital",
      cls: "設計思考賢者",
      edu: "國立成功大學建築研究所 碩士",
      fields: ["建築設計", "室內設計", "設計思考", "基本設計"],
      courses: ["室內設計", "空間設計基礎", "設計思考概論"],
      feats: ["本系專任講師（80.08～迄今）", "曾任多家建築師事務所設計師"],
      email: "t60005@mail.tut.edu.tw",
      url: "https://reurl.cc/kE8vrx",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/331/m/mczh-tw400x400_small37584_829654697871.jpg"
    },
    {
      id: "lin-chieh-jen",
      name: "林傑仁",
      title: "副教授",
      region: "forest",
      cls: "生成術士",
      edu: "國立成功大學建築學 博士",
      fields: ["建築與室內設計", "生成式人工智慧", "電腦輔助設計", "運算化設計", "數位製作"],
      courses: ["生成式人工智慧應用", "室內設計", "運算化設計"],
      feats: ["學術暨產學合作中心主任（112.08～115.07）", "本系專任副教授（100.08～迄今）"],
      email: "t60011@mail.tut.edu.tw",
      url: "https://reurl.cc/qNKG4n",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/786/m/mczh-tw400x400_small37591_202678250380.png"
    },
    {
      id: "chen-nien-tsu",
      name: "陳念祖",
      title: "副教授兼校務發展中心主任",
      region: "valley",
      cls: "氣流術師",
      edu: "國立成功大學建築學系 博士",
      fields: ["數值模擬 CFD", "IAQ 室內空氣品質", "環境診斷與改善", "智慧生活設計", "建築及室內設計"],
      courses: ["室內設計", "表現技法", "室內設計專業製圖"],
      feats: ["計畫管理組組長（112.08～115.07）", "曾任成大祐生環控研究中心研究人員"],
      email: "t60099@mail.tut.edu.tw",
      url: "https://reurl.cc/eWWp9L",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/867/m/mczh-tw400x400_small37589_541228049999.jpeg"
    },
    {
      id: "huang-kun-chih",
      name: "黃琨智",
      title: "助理教授兼總務處營繕組組長",
      region: "valley",
      cls: "環境煉金師",
      edu: "國立成功大學建築研究所 博士",
      fields: ["建築環境控制", "IAQ 室內空氣品質", "綠建材試驗", "建築聲學模擬", "室內設計"],
      courses: ["室內設計", "材料與施工", "室內環境控制", "職場實習", "創新趨勢"],
      feats: ["空間設計學會研討會 優秀論文", "建築學會研究成果發表會 優秀論文獎", "ISO/IEC 17025 實驗室認證訓練合格", "丙級建築製圖技術士"],
      email: "t60111@mail.tut.edu.tw",
      url: "https://eportfolio.tut.edu.tw/blogself?id=91845DC665DF4D21962CFA3A7770FEC6",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/544/m/mczh-tw400x400_small41812_586925899424.jpg"
    },
    {
      id: "chiang-po-hung",
      name: "江博鴻",
      title: "助理教授",
      region: "workshop",
      cls: "細木匠師",
      edu: "淡江大學土木所建築組 博士",
      fields: ["細木作", "建築設計理論", "建築論述"],
      courses: ["設計心理學", "室內設計", "室內設計專業製圖"],
      feats: ["裝潢木工乙級技術士", "曾任謝英俊、劉居立建築師事務所設計師"],
      email: "t60106@mail.tut.edu.tw",
      url: "https://reurl.cc/p5L3k4",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/718/m/mczh-tw400x400_small37590_924808050594.jpg"
    },
    {
      id: "chen-wan-yi",
      name: "陳宛宜",
      title: "講師",
      region: "workshop",
      cls: "家具工藝師",
      edu: "New York School of Interior Design MFA",
      fields: ["家具設計", "室內設計"],
      courses: ["形式原理與設計", "家具設計", "室內設計"],
      feats: ["曾任喬治黑羊設計設計師", "曾任建典精密設計顧問"],
      email: "t60062@mail.tut.edu.tw",
      url: "https://reurl.cc/LXX42X",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/174/m/mczh-tw400x400_small37586_15899950703.jpeg"
    },
    {
      id: "chang-tsai-chuan",
      name: "張彩娟",
      title: "助理教授",
      region: "ruins",
      cls: "史詩守護者",
      edu: "美國芝加哥藝術學院藝術研究所 碩士",
      fields: ["設計史", "文化資產保存", "室內設計"],
      courses: ["室內設計史", "室內設計", "設計方法"],
      feats: ["本系專任助理教授（98.02～迄今）"],
      email: "t60010@mail.tut.edu.tw",
      url: "https://reurl.cc/jRR3Dq",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/622/m/mczh-tw400x400_small37580_740596050491.jpg"
    },
    {
      id: "huang-shu-li",
      name: "黃淑俐",
      title: "專案助理教授級專業技術人員",
      region: "ruins",
      cls: "城市考古者",
      edu: "國立臺北大學都市計劃研究所 博士候選人",
      fields: ["後殖民都市理論", "聚落再生", "使用者行為學", "建築計畫", "室內設計"],
      courses: ["傢飾設計實務", "室內設計", "室內設計專業製圖", "色彩計劃"],
      feats: ["建築物室內裝修工程管理乙級技術士", "曾任蔡佳峯建築師事務所空間規劃設計師"],
      email: "t60077@mail.tut.edu.tw",
      url: "https://www.facebook.com/profile.php?id=1455051288",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/56/m/mczh-tw400x400_small38155_900532850661.jpg"
    },
    {
      id: "liu-chia-chen",
      name: "劉嘉珍",
      title: "講師",
      region: "ruins",
      cls: "客庄探路人",
      edu: "國立成功大學建築研究所設計組 碩士",
      fields: ["建築設計", "室內設計", "設計方法", "客家研究"],
      courses: ["室內設計", "材料與施工", "創新趨勢", "估價與契約"],
      feats: ["曾任建築師事務所設計總監、設計經理", "曾任空間設計公司負責人"],
      email: "t60130@mail.tut.edu.tw",
      url: "https://id.tut.edu.tw/p/406-1067-57537,r1265.php?Lang=zh-tw",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/163/m/mczh-tw400x400_small57537_888007463547.jpg"
    },
    {
      id: "chen-hung-chi",
      name: "陳宏基",
      title: "助理教授",
      region: "plateau",
      cls: "彩繪大師",
      edu: "美國喬治亞州莎芬娜藝術學院 藝術碩士",
      fields: ["繪畫", "設計素描", "水彩", "油畫", "藝術創作", "色彩計劃"],
      courses: ["設計素描", "水彩", "油畫", "藝術創作", "色彩計劃"],
      feats: ["曾任高雄市立美術館典藏組助理研究員"],
      email: "t60026@mail.tut.edu.tw",
      url: "https://reurl.cc/aaa8QX",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/184/m/mczh-tw400x400_small37594_91034050529.jpeg"
    },
    {
      id: "lien-tang-hsuan",
      name: "連棠琁",
      title: "助理教授級專業技術人員",
      region: "plateau",
      cls: "紋章識別師",
      edu: "國立高雄師範大學視覺設計系研究所 MFA",
      fields: ["視覺形象設計感質研究", "VIS 形象識別系統", "品牌設計與管理"],
      courses: ["品牌形象設計特論", "文化創意產業", "色彩計劃", "創新趨勢", "電腦設計表現"],
      feats: ["公共關係組組長（112.08～115.07）"],
      email: "te0063@mail.tut.edu.tw",
      url: "https://reurl.cc/ZNle5V",
      photo: "https://id.tut.edu.tw/var/file/67/1067/pictures/107/m/mczh-tw400x400_small54009_195673152254.jpg"
    }
  ]
};
