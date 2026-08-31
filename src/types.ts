export type Category = '外套' | '上装' | '下装' | '连衣裙' | '鞋' | '包' | '配饰';
export type Season = '春' | '夏' | '秋' | '冬';
export type Style = '通勤' | '温柔' | '运动' | '甜美' | '复古' | '简约' | '学院' | '街头';
export type BodyType = '梨形' | '苹果形' | 'H形' | '沙漏形';

export interface Garment {
  id: string;
  name: string;              // 中文具体名称，含版型/长度等特征
  category: Category;
  colors: string[];          // 主辅色，中文，1-3个
  seasons: Season[];
  styles: Style[];
  material?: string;
  imageUri?: string;         // base64，seed 数据留空
  emoji?: string;            // 无图时的占位 emoji，seed 数据必填
  wearCount: number;
  lastWorn?: string;         // ISO 日期字符串
  source: 'ai' | 'manual';
  createdAt: string;
}

export interface OutfitPlan {
  id: string;
  title: string;
  itemIds: string[];
  scene: string;
  score: number;             // 0-10，一位小数
  review: string;
  tags: string[];
  pros: string[];
  cons: string[];
  createdAt: string;
  saved: boolean;
}

export interface Post {
  id: string;
  author: { name: string; avatar: string; school?: string };
  images: string[];          // seed 数据用 emoji 填充
  caption: string;
  aiScore?: number;
  aiComment?: string;
  likes: number;
  comments: number;
}

export interface UserProfile {
  name: string;
  avatar: string;            // emoji
  height?: number;
  weight?: number;
  bodyType?: BodyType;
  stylePrefs: string[];
  avoid: string[];           // 注入 prompt 的负面约束
  goal: string[];            // 想显高 / 想显瘦 等
}
