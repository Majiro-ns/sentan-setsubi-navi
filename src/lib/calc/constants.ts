// 減価率テーブル（耐用年数3〜20年）— 設計書§4.2
export const DEPRECIATION_RATES: Record<number, number> = {
  3: 0.536,   4: 0.438,   5: 0.369,   6: 0.319,
  7: 0.280,   8: 0.250,   9: 0.226,  10: 0.206,
  11: 0.189,  12: 0.175,  13: 0.162,  14: 0.152,
  15: 0.142,  16: 0.134,  17: 0.127,  18: 0.120,
  19: 0.114,  20: 0.109,
};

export type EquipmentType = 'machinery' | 'measuring_tools' | 'fixtures' | 'building_attachments';
export type WageTier = 'none' | 'half' | 'quarter';

// 設備種類ごとの最低取得価額（万円）— SS2
export const MIN_COSTS: Record<EquipmentType, number> = {
  machinery: 160,
  measuring_tools: 30,
  fixtures: 30,
  building_attachments: 60,
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  machinery: '機械・装置',
  measuring_tools: '測定工具・検査工具',
  fixtures: '器具・備品',
  building_attachments: '建物附属設備',
};

// 設備種類ごとの具体的資産カテゴリと耐用年数
// 東京都「償却資産（固定資産税）申告の手引き」＋耐用年数省令 別表第一・第二 準拠
export interface AssetCategory {
  label: string;
  usefulLife: number;
}

export const ASSET_CATEGORIES: Record<EquipmentType, AssetCategory[]> = {
  machinery: [
    { label: '食料品製造設備', usefulLife: 10 },
    { label: '飲料・たばこ製造設備', usefulLife: 10 },
    { label: '繊維工業用設備', usefulLife: 7 },
    { label: '木材・木製品製造設備', usefulLife: 8 },
    { label: 'パルプ・紙製造設備', usefulLife: 12 },
    { label: '印刷・製本業用設備', usefulLife: 10 },
    { label: '化学工業用設備', usefulLife: 8 },
    { label: 'プラスチック製品製造設備', usefulLife: 8 },
    { label: 'ゴム製品製造設備', usefulLife: 9 },
    { label: '窯業・土石製品製造設備', usefulLife: 9 },
    { label: '鉄鋼業用設備', usefulLife: 14 },
    { label: '非鉄金属製造設備', usefulLife: 7 },
    { label: '金属製品製造設備', usefulLife: 10 },
    { label: '汎用機械器具製造設備', usefulLife: 12 },
    { label: '生産用機械器具製造設備', usefulLife: 12 },
    { label: '業務用機械器具製造設備', usefulLife: 7 },
    { label: '電子部品・デバイス製造設備', usefulLife: 8 },
    { label: '電気機械器具製造設備', usefulLife: 7 },
    { label: '情報通信機械器具製造設備', usefulLife: 7 },
    { label: '輸送用機械器具製造設備', usefulLife: 9 },
    { label: '農業用設備', usefulLife: 7 },
    { label: '建設機械', usefulLife: 8 },
    { label: 'コンベア', usefulLife: 10 },
    { label: 'クレーン・ホイスト', usefulLife: 12 },
    { label: 'ボイラー', usefulLife: 15 },
    { label: '冷凍機', usefulLife: 12 },
    { label: 'その他の機械・装置', usefulLife: 10 },
  ],
  measuring_tools: [
    { label: '計量器・測定器', usefulLife: 5 },
    { label: '光学検査機器', usefulLife: 8 },
    { label: '試験機器', usefulLife: 5 },
    { label: 'その他の測定工具・検査工具', usefulLife: 5 },
  ],
  fixtures: [
    // --- 理容業でよく使う設備（上位表示） ---
    { label: '理容椅子・セットイス', usefulLife: 5 },
    { label: 'シャンプー台・シャンプーユニット', usefulLife: 5 },
    { label: 'パーマ器具・ロッド式加温器', usefulLife: 5 },
    { label: '業務用ドライヤー・スチーマー', usefulLife: 5 },
    { label: 'タオルウォーマー・タオル蒸し器', usefulLife: 5 },
    { label: '理容ワゴン・サイドテーブル', usefulLife: 5 },
    { label: '鏡台・セット面（ドレッサー）', usefulLife: 5 },
    { label: '待合ソファ・待合椅子', usefulLife: 5 },
    { label: 'レジスター・POS端末・予約管理端末', usefulLife: 5 },
    { label: '洗濯機・乾燥機（業務用）', usefulLife: 6 },
    { label: '看板・ネオンサイン・サインポール', usefulLife: 3 },
    { label: 'テレビ・音響機器', usefulLife: 5 },
    { label: '冷房・暖房用機器（据置型）', usefulLife: 6 },
    // --- 一般的な器具・備品 ---
    { label: '事務机・椅子・キャビネット（金属製）', usefulLife: 15 },
    { label: '事務机・椅子・キャビネット（その他）', usefulLife: 8 },
    { label: '応接セット（接客用）', usefulLife: 5 },
    { label: 'パソコン・サーバー', usefulLife: 4 },
    { label: '複写機・ファクシミリ', usefulLife: 5 },
    { label: '電気冷蔵庫', usefulLife: 6 },
    { label: '自動販売機', usefulLife: 5 },
    { label: '陳列棚・陳列ケース', usefulLife: 8 },
    { label: 'その他の器具・備品', usefulLife: 8 },
  ],
  building_attachments: [
    // --- 理容業でよく使う設備（上位表示） ---
    { label: '給排水・衛生設備（シャンプー台配管等）', usefulLife: 15 },
    { label: '給湯設備', usefulLife: 15 },
    { label: '空調設備（業務用エアコン等）', usefulLife: 13 },
    { label: '電気設備（照明設備含む）', usefulLife: 15 },
    // --- 一般的な建物附属設備 ---
    { label: 'ガス設備', usefulLife: 15 },
    { label: 'エレベーター', usefulLife: 17 },
    { label: '消火設備・排煙設備', usefulLife: 8 },
    { label: '太陽光発電設備（屋根設置）', usefulLife: 17 },
    { label: 'その他の建物附属設備', usefulLife: 15 },
  ],
};
