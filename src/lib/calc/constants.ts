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
