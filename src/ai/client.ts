// 本文件提供多种 provider 的统一 AI 调用入口，并负责超时、重试和 mock 降级。
import type { Category, Garment, OutfitPlan, Season, Style, UserProfile } from '../types';
import { seedGarments } from '../data/seed';
import { useStore } from '../store/useStore';
import { getCompleteCombinations, getOutfitAvailability, getPlanSignature } from './outfitRules';
import {
  parseWithRetry,
  validateGarmentRecognition,
  validateOutfitPlans,
  type GeneratedOutfitPlan,
} from './parsers';
import { buildOutfitPrompt, buildRecognizePrompt, buildReviewPrompt } from './prompts';
import { validateReviewForGarments } from './reviewRules';

import { provider, requestProvider } from './transport';
export { provider, providerLabel } from './transport';
export type { Provider } from './transport';

export interface AIResult<T> {
  data: T;
  source: 'ai' | 'mock';
  error?: string;
}

export interface GarmentRecognition {
  name: string;
  category: Category;
  colors: string[];
  seasons: Season[];
  styles: Style[];
  material: string;
  confidence: number;
}

export interface OutfitInput {
  scene: string;
  mood?: string;
  weather: {
    temp: number;
    condition: string;
  };
  wardrobe: Garment[];
  profile: UserProfile;
  seed?: number;
}

export interface OutfitReview {
  score: number;
  comment: string;
  tags: string[];
}

// 演示延迟保留真实等待感；所有真实请求统一走本机服务端。
const waitForMock = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1_200 + Math.floor(Math.random() * 601)));
const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : 'AI 服务发生未知错误';

type MockScene = '上课' | '约会' | '运动' | '面试' | '旅行' | '聚会';

interface MockPlanTemplate {
  style: string;
  baseItemIds: [string, string, string];
  outerwearId: string;
  includeOuterwearAtMild?: boolean;
  reason: string;
  tags: string[];
  pro: string;
}

interface MockSceneCopy {
  tags: string[];
  review: string;
  pro: string;
  cons: string;
}

type MockSceneBatches = [MockPlanTemplate[], MockPlanTemplate[]];

const MOCK_SCENES: MockScene[] = ['上课', '约会', '运动', '面试', '旅行', '聚会'];
const MOCK_SCORES = [9.3, 8.8, 8.2];
const seedGarmentById = new Map(seedGarments.map((garment) => [garment.id, garment]));

const SCENE_COPY: Record<MockScene, MockSceneCopy> = {
  上课: {
    tags: ['上课友好', '校园实穿'],
    review: '整体适合教室、图书馆与校园步行，在整洁度和久坐舒适之间保持平衡。',
    pro: '活动方便，早八到晚课都不会显得用力过度',
    cons: '浅色单品在食堂或咖啡课间需要注意污渍',
  },
  约会: {
    tags: ['约会氛围', '精致有度'],
    review: '轮廓与细节都保留了约会需要的亲和感，拍照有亮点但不会显得刻意。',
    pro: '精致元素集中在一处，近距离看有细节且整体协调',
    cons: '精致鞋包更适合中短距离步行，长时间走路需留意舒适度',
  },
  运动: {
    tags: ['运动透气', '便于活动'],
    review: '搭配优先考虑透气、伸展和快速移动，适合操场、健身房或轻运动场景。',
    pro: '活动余量充足，鞋底支撑和裤装松量更适合运动',
    cons: '运动结束后进入空调房，建议及时擦汗避免着凉',
  },
  面试: {
    tags: ['面试得体', '稳重可信'],
    review: '利落线条与低饱和配色传达得体、稳重和可信感，适合校园招聘与实习面试。',
    pro: '肩线和裤线清晰，能让表达状态显得更专业从容',
    cons: '正式鞋款久站前建议提前磨合，避免影响面试状态',
  },
  旅行: {
    tags: ['旅行轻便', '久走友好'],
    review: '组合兼顾久走、温差和拍照层次，行李中也容易拆开重复搭配。',
    pro: '鞋履和下装适合长时间移动，单品之间复用率高',
    cons: '旅途中天气变化快，建议额外准备折叠雨具',
  },
  聚会: {
    tags: ['聚会亮点', '上镜吸睛'],
    review: '主次关系清楚，保留聚会需要的视觉焦点，同时控制高饱和面积避免显乱。',
    pro: '拍照时轮廓清晰，鞋包或配饰能形成明确记忆点',
    cons: '亮点单品已经足够，不建议再叠加大面积复杂配饰',
  },
};

const SCENE_MOCK_POOLS: Record<MockScene, MockSceneBatches> = {
  上课: [
    [
      { style: '清爽学院', baseItemIds: ['g_013', 'g_006', 'g_009'], outerwearId: 'g_001', reason: '白衬衫提亮面部，直筒牛仔裤修饰腿胯，小白鞋适合全天赶课', tags: ['清爽', '学院'], pro: '上短下长的视觉比例利落，梨形身材也容易驾驭' },
      { style: '舒适简约', baseItemIds: ['g_003', 'g_015', 'g_010'], outerwearId: 'g_014', reason: '针织开衫柔化烟管裤的正式感，乐福鞋让课堂展示更整洁', tags: ['简约', '柔和'], pro: '高腰烟管裤拉直下半身线条，久坐后仍显利落' },
      { style: '轻松运动', baseItemIds: ['g_016', 'g_017', 'g_018'], outerwearId: 'g_002', reason: '连帽卫衣、束脚运动裤与缓震跑鞋形成完整运动层次', tags: ['运动', '舒适'], pro: '宽松上装和弹性裤装为满课日保留足够活动量' },
    ],
    [
      { style: '温柔书卷', baseItemIds: ['g_004', 'g_007', 'g_020'], outerwearId: 'g_001', reason: '雾霾蓝针织衫搭配高腰A字裙，玛丽珍鞋补足书卷气', tags: ['温柔', '书卷感'], pro: '上浅下深稳定视觉重心，高腰线对梨形身材友好' },
      { style: '复古学院', baseItemIds: ['g_013', 'g_015', 'g_010'], outerwearId: 'g_014', includeOuterwearAtMild: true, reason: '挺括衬衫、烟管裤和乐福鞋组成克制的校园复古感', tags: ['复古', '学院'], pro: '纵向裤线显高，西装外套让小组展示更有精神' },
      { style: '街头活力', baseItemIds: ['g_005', 'g_006', 'g_009'], outerwearId: 'g_002', includeOuterwearAtMild: true, reason: '白T与牛仔裤保持清爽，短夹克和小白鞋增加街头活力', tags: ['街头', '减龄'], pro: '短外套抬高视觉重心，基础单品组合不挑课程场景' },
    ],
  ],
  约会: [
    [
      { style: '法式浪漫', baseItemIds: ['g_019', 'g_020', 'g_021'], outerwearId: 'g_014', reason: '收腰小黑裙配酒红玛丽珍鞋，链条包提供精致金属细节', tags: ['法式', '浪漫'], pro: '连续裙身拉长比例，酒红色只作局部重点更显高级' },
      { style: '甜美复古', baseItemIds: ['g_003', 'g_007', 'g_020'], outerwearId: 'g_001', reason: '奶油白开衫与A字裙柔和显腰线，玛丽珍鞋强化复古甜感', tags: ['甜美', '复古'], pro: '柔软上装平衡下装量感，整体亲和且不显幼稚' },
      { style: '温柔清新', baseItemIds: ['g_008', 'g_009', 'g_012'], outerwearId: 'g_001', reason: '淡蓝碎花裙配小白鞋保持轻盈，珍珠发夹增加近距离细节', tags: ['清新', '温柔'], pro: '蓝白低饱和配色显肤色干净，裙身纵向线条也显高' },
    ],
    [
      { style: '都市精致', baseItemIds: ['g_013', 'g_015', 'g_020'], outerwearId: 'g_014', includeOuterwearAtMild: true, reason: '白衬衫与烟管裤利落克制，酒红玛丽珍鞋打破过度正式', tags: ['都市', '精致'], pro: '上装留白与高腰裤线共同优化比例，约会后也能去看展' },
      { style: '俏皮学院', baseItemIds: ['g_004', 'g_007', 'g_020'], outerwearId: 'g_002', includeOuterwearAtMild: true, reason: '雾霾蓝针织衫和A字裙清甜，短牛仔夹克带来俏皮层次', tags: ['俏皮', '学院'], pro: '短夹克提高腰线，玛丽珍鞋让风格完整但不过分甜腻' },
      { style: '松弛氛围', baseItemIds: ['g_019', 'g_009', 'g_012'], outerwearId: 'g_001', reason: '小黑裙用小白鞋降低距离感，珍珠发夹保留轻松的精致度', tags: ['松弛', '氛围感'], pro: '黑白主色简洁上镜，鞋款舒适度适合散步约会' },
    ],
  ],
  运动: [
    [
      { style: '活力运动', baseItemIds: ['g_016', 'g_017', 'g_018'], outerwearId: 'g_002', reason: '卫衣、束脚运动裤和缓震跑鞋从上到下都为活动服务', tags: ['活力', '运动'], pro: '速干裤装与支撑鞋底适合跑跳，灰色系也耐脏' },
      { style: '轻氧休闲', baseItemIds: ['g_005', 'g_006', 'g_009'], outerwearId: 'g_001', reason: '白T、直筒牛仔裤与小白鞋适合散步、拉伸等轻运动', tags: ['轻氧', '休闲'], pro: '版型不过分紧身，课后临时运动也能自然切换' },
      { style: '街头机能', baseItemIds: ['g_005', 'g_017', 'g_018'], outerwearId: 'g_002', includeOuterwearAtMild: true, reason: '白T搭束脚运动裤突出腿部利落感，跑鞋补足机能感', tags: ['街头', '机能'], pro: '上简下动的轮廓清楚，便于活动同时保留街头层次' },
    ],
    [
      { style: '清爽跑步', baseItemIds: ['g_005', 'g_017', 'g_018'], outerwearId: 'g_001', reason: '轻薄白T配速干运动裤和缓震跑鞋，减少运动时的闷热感', tags: ['跑步', '清爽'], pro: '鞋裤都围绕跑步需求选择，步幅和散热不受限制' },
      { style: '校园动感', baseItemIds: ['g_016', 'g_006', 'g_009'], outerwearId: 'g_002', reason: '宽松卫衣搭直筒牛仔裤和小白鞋，适合社团活动与校园骑行', tags: ['校园', '动感'], pro: '上身有活动量，下装线条稳定，运动后直接去上课也得体' },
      { style: '轻户外', baseItemIds: ['g_016', 'g_017', 'g_009'], outerwearId: 'g_001', includeOuterwearAtMild: true, reason: '卫衣和束脚裤减少拖沓，小白鞋适合公园与短程徒步', tags: ['轻户外', '舒展'], pro: '束脚设计便于移动，外套在风大环境下也能快速增减' },
    ],
  ],
  面试: [
    [
      { style: '干练面试', baseItemIds: ['g_013', 'g_015', 'g_010'], outerwearId: 'g_014', includeOuterwearAtMild: true, reason: '白衬衫、烟管裤、西装外套与乐福鞋构成标准而不僵硬的面试组合', tags: ['干练', '专业'], pro: '黑白灰配色稳重，清晰肩线和裤线增强可信度' },
      { style: '沉稳知性', baseItemIds: ['g_004', 'g_015', 'g_010'], outerwearId: 'g_014', reason: '雾霾蓝针织衫弱化紧张感，烟管裤与乐福鞋维持正式边界', tags: ['沉稳', '知性'], pro: '低饱和蓝色显得温和可靠，裤型也能修饰梨形身材' },
      { style: '简约得体', baseItemIds: ['g_019', 'g_010', 'g_021'], outerwearId: 'g_014', includeOuterwearAtMild: true, reason: '小黑裙与乐福鞋保持简约得体，链条包控制体积避免喧宾夺主', tags: ['简约', '得体'], pro: '单色裙身显高，西装外套让校园面试场合更稳妥' },
    ],
    [
      { style: '利落专业', baseItemIds: ['g_013', 'g_007', 'g_010'], outerwearId: 'g_014', includeOuterwearAtMild: true, reason: '白衬衫搭高腰A字裙和乐福鞋，正式中保留年轻感', tags: ['利落', '专业'], pro: '腰线明确且露出鞋面，比例清楚，适合校招初面' },
      { style: '温和可信', baseItemIds: ['g_003', 'g_015', 'g_020'], outerwearId: 'g_001', reason: '奶油白开衫柔和亲切，烟管裤稳住线条，玛丽珍鞋增加记忆点', tags: ['温和', '可信'], pro: '柔和上装降低距离感，深色下装仍保持面试所需稳重' },
      { style: '校园职场', baseItemIds: ['g_013', 'g_006', 'g_010'], outerwearId: 'g_014', reason: '白衬衫与深色乐福鞋建立正式感，直筒牛仔裤适合创意类实习面试', tags: ['校园职场', '自然'], pro: '整洁但不老成，适合强调活力与执行力的岗位' },
    ],
  ],
  旅行: [
    [
      { style: '轻便探索', baseItemIds: ['g_016', 'g_017', 'g_018'], outerwearId: 'g_002', reason: '卫衣、束脚运动裤与缓震跑鞋适合车站换乘和长时间探索', tags: ['轻便', '探索'], pro: '全套活动余量充足，坐车和步行都不会束缚' },
      { style: '松弛文艺', baseItemIds: ['g_008', 'g_009', 'g_011'], outerwearId: 'g_001', reason: '碎花裙适合旅拍，小白鞋保证步行舒适，托特包能容纳随身用品', tags: ['文艺', '旅拍'], pro: '蓝白配色清爽上镜，大容量包也提升旅行实用性' },
      { style: '机能出行', baseItemIds: ['g_005', 'g_006', 'g_018'], outerwearId: 'g_001', includeOuterwearAtMild: true, reason: '白T和直筒牛仔裤耐看易搭，跑鞋与风衣应对移动和温差', tags: ['机能', '耐走'], pro: '内外层方便增减，缓震鞋适合日均万步的城市旅行' },
    ],
    [
      { style: '清爽漫步', baseItemIds: ['g_005', 'g_017', 'g_009'], outerwearId: 'g_001', reason: '白T与束脚裤轻便不拖沓，小白鞋适合海边或校园漫步', tags: ['清爽', '漫步'], pro: '轻量单品方便收纳，运动裤也能应对长时间乘车' },
      { style: '温柔旅拍', baseItemIds: ['g_003', 'g_006', 'g_020'], outerwearId: 'g_001', reason: '奶油白开衫与复古蓝牛仔裤柔和上镜，玛丽珍鞋增加照片细节', tags: ['温柔', '旅拍'], pro: '柔和色彩显肤色干净，高腰裤也让全身照比例更好' },
      { style: '复古城市', baseItemIds: ['g_004', 'g_006', 'g_010'], outerwearId: 'g_002', includeOuterwearAtMild: true, reason: '雾霾蓝针织衫与牛仔裤形成复古蓝调，乐福鞋适合城市街拍', tags: ['复古', '城市感'], pro: '同色系层次稳定耐看，短夹克能应对早晚温差' },
    ],
  ],
  聚会: [
    [
      { style: '复古亮眼', baseItemIds: ['g_019', 'g_020', 'g_021'], outerwearId: 'g_014', reason: '小黑裙、酒红玛丽珍鞋与链条包形成克制的复古亮点', tags: ['复古', '亮眼'], pro: '黑色主调显瘦，酒红鞋和金属链条在合照中有记忆点' },
      { style: '酷感街头', baseItemIds: ['g_005', 'g_007', 'g_010'], outerwearId: 'g_002', includeOuterwearAtMild: true, reason: '白T与A字裙制造黑白反差，牛仔夹克和乐福鞋增加酷感', tags: ['酷感', '街头'], pro: '短外套提高腰线，黑白层次在聚会灯光下仍然清晰' },
      { style: '甜酷焦点', baseItemIds: ['g_004', 'g_007', 'g_020'], outerwearId: 'g_001', reason: '雾霾蓝针织衫柔和显白，A字裙和酒红鞋形成甜酷焦点', tags: ['甜酷', '焦点'], pro: '局部酒红色提亮但不过分张扬，梨形身材也能突出腰线' },
    ],
    [
      { style: '精致小黑裙', baseItemIds: ['g_019', 'g_010', 'g_012'], outerwearId: 'g_014', includeOuterwearAtMild: true, reason: '小黑裙与乐福鞋简洁稳重，珍珠发夹让近距离造型更精致', tags: ['精致', '小黑裙'], pro: '单色裙身利落显瘦，珍珠细节在室内光线下更有层次' },
      { style: '轻奢知性', baseItemIds: ['g_013', 'g_015', 'g_020'], outerwearId: 'g_014', reason: '白衬衫与烟管裤保持知性，酒红玛丽珍鞋增加轻奢亮点', tags: ['轻奢', '知性'], pro: '简洁廓形衬托状态，重点色集中在鞋履更显克制' },
      { style: '活力吸睛', baseItemIds: ['g_008', 'g_020', 'g_021'], outerwearId: 'g_001', reason: '淡蓝碎花裙与酒红玛丽珍鞋形成冷暖对比，链条包补足聚会质感', tags: ['活力', '吸睛'], pro: '裙装轻盈上镜，鞋包色彩让造型在多人合照中更突出' },
    ],
  ],
};

const MOOD_REVIEW: Record<string, string> = {
  想显瘦: '通过高腰线和纵向轮廓回应“想显瘦”',
  想亮眼: '用一处重点色或精致配饰回应“想亮眼”',
  想舒服: '优先保留活动余量和鞋履舒适度回应“想舒服”',
  想正式: '以利落线条和低饱和配色回应“想正式”',
};

const resolveMockScene = (scene: string): MockScene =>
  MOCK_SCENES.includes(scene as MockScene) ? (scene as MockScene) : '上课';

const resolveMoodContext = (mood?: string): { tags: string[]; review: string } => {
  const moods = mood
    ? mood.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
    : [];
  const notes = moods.map((item) => MOOD_REVIEW[item] ?? `兼顾“${item}”`);
  return {
    tags: moods,
    review: notes.length ? `；同时${notes.join('，')}` : '',
  };
};

export const buildMockPlans = (input: OutfitInput): OutfitPlan[] => {
  const combinations = getCompleteCombinations(input.wardrobe, input.weather.temp);
  if (combinations.length < 3) {
    throw new Error(getOutfitAvailability(input.wardrobe, input.weather.temp) ?? '当前衣橱不足以组成三套不同的完整搭配，请增加可替换的鞋、上装或下装。');
  }
  const scene = resolveMockScene(input.scene);
  const isCold = input.weather.temp < 18;
  const isHot = input.weather.temp > 28;
  const batchVariant = Math.abs(input.seed ?? 0) % 2;
  const templates = SCENE_MOCK_POOLS[scene][batchVariant];
  const sceneCopy = SCENE_COPY[scene];
  const moodContext = resolveMoodContext(input.mood);
  const createdAt = new Date().toISOString();
  const garmentById = new Map(input.wardrobe.map((item) => [item.id, item]));
  const used = new Set<string>();
  // 可替换组合足够时，下一批主动避开上一批，而不是反复碰运气。
  const previous = batchVariant === 1 ? buildMockPlans({ ...input, seed: 0 }).map((plan) => getPlanSignature(plan.itemIds)) : [];
  const excluded = new Set(combinations.length >= 6 ? previous : combinations.length > 3 ? previous.slice(0, 1) : []);

  const plans = templates.map((template, index) => {
    const shouldIncludeOuterwear =
      isCold || (!isHot && template.includeOuterwearAtMild === true);
    const preferredIds = shouldIncludeOuterwear
      ? [template.outerwearId, ...template.baseItemIds]
      : [...template.baseItemIds];
    // 在合法候选中优先场景模板，再按心情调整；同一批次不重复。
    const scoreCombination = (ids: string[]): number => ids.reduce((score, id) => {
      const item = garmentById.get(id)!;
      const sameCategory = preferredIds.some((preferredId) => seedGarmentById.get(preferredId)?.category === item.category);
      let next = score + (preferredIds.includes(id) ? 8 : sameCategory ? 1 : 0);
      // 心情只能微调场景，不应把运动变成正式面试穿搭。
      if (input.mood && scene === '运动' && item.styles.includes('运动')) next += 18;
      if (input.mood && scene === '面试' && item.styles.includes('通勤')) next += 8;
      if (input.mood?.includes('想舒服') && item.styles.includes('运动')) next += 10;
      if (input.mood?.includes('想正式') && item.styles.includes('通勤')) next += 10;
      if (input.mood?.includes('想亮眼') && (item.styles.includes('甜美') || item.colors.includes('酒红色'))) next += 10;
      if (input.mood?.includes('想显瘦') && /高腰|收腰|直筒|烟管/.test(item.name)) next += 10;
      return next;
    }, ids.length === preferredIds.length ? 3 : 0);
    const candidates = combinations.filter((ids) => !used.has(getPlanSignature(ids)) && !excluded.has(getPlanSignature(ids)))
      .sort((a, b) => scoreCombination(b) - scoreCombination(a));
    const itemIds = candidates[0];
    used.add(getPlanSignature(itemIds));
    const changed = getPlanSignature(itemIds) !== getPlanSignature(preferredIds);
    const actualNames = itemIds.map((id) => garmentById.get(id)!.name).join('＋');
    const hasOuterwear = itemIds.some((id) => garmentById.get(id)!.category === '外套');
    const temperatureReview = isCold
      ? '低于 18°C 已补入一件外套保证保暖'
      : isHot
        ? '高于 28°C 已去除外套保持轻薄透气'
        : hasOuterwear
          ? '当前温度加入一件外套，可按室内外温差灵活穿脱'
          : '当前温度保持三件完整搭配，轻便且层次清楚';
    const temperatureCons = isCold
      ? '低温叠加外套后层次较多，进入室内需要及时脱下'
      : isHot
        ? '高温已去除外套，长时间户外仍需注意防晒和补水'
        : shouldIncludeOuterwear
          ? '当前含外套，午后升温或室内久坐时可以脱下'
          : sceneCopy.cons;

    return {
      id: `mock_plan_${index + 1}`,
      title: `${scene} · ${template.style}`,
      itemIds,
      scene,
      score: MOCK_SCORES[index],
      review: `${changed ? `根据现有衣橱与心情调整为：${actualNames}` : template.reason}。${sceneCopy.review}${moodContext.review}；${temperatureReview}。`,
      tags: Array.from(
        new Set([...sceneCopy.tags, ...template.tags, ...moodContext.tags]),
      ),
      pros: [changed ? '从当前衣橱选择真实单品，保留鞋履与上下身的完整结构' : template.pro, sceneCopy.pro],
      cons: [temperatureCons, ...(changed ? ['这是基于类别与偏好的演示匹配，面料厚度和实际舒适度仍需试穿确认'] : [])],
      createdAt,
      saved: false,
    };
  });
  const validation = validateOutfitPlans({ plans }, input.wardrobe, input.weather.temp);
  if (!validation.ok) throw new Error(validation.reason);
  return plans;
};

const hydratePlans = (
  plans: GeneratedOutfitPlan[],
  scene: string,
): OutfitPlan[] => {
  const createdAt = new Date().toISOString();
  return plans.map((plan, index) => ({
    ...plan,
    id: `ai_plan_${Date.now().toString(36)}_${index + 1}`,
    scene,
    createdAt,
    saved: false,
  }));
};

const mockRecognition: GarmentRecognition = {
  name: '米色中长款风衣',
  category: '外套',
  colors: ['米色', '杏色'],
  seasons: ['春', '秋'],
  styles: ['通勤', '温柔'],
  material: '棉混纺',
  confidence: 0.94,
};

const getMockRecognition = async (): Promise<GarmentRecognition> => {
  await waitForMock();
  return { ...mockRecognition, colors: [...mockRecognition.colors] };
};

const getMockOutfits = async (input: OutfitInput): Promise<OutfitPlan[]> => {
  await waitForMock();
  return buildMockPlans(input);
};

const getMockReview = async (garments: Garment[]): Promise<OutfitReview> => {
  await waitForMock();
  const colors = [...new Set(garments.flatMap((item) => item.colors))];
  const hasShoes = garments.some((item) => item.category === '鞋');
  const hasBody = garments.some((item) => item.category === '连衣裙') ||
    (garments.some((item) => item.category === '上装') && garments.some((item) => item.category === '下装'));
  return {
    score: hasShoes && hasBody ? 8.6 : 7.6,
    comment: `${garments.map((item) => item.name).join('、')}以${colors.slice(0, 3).join('、')}形成配色层次；${!hasShoes ? '还缺一双鞋，暂不能视为完整穿搭' : !hasBody ? '还需要补齐上下装或连衣裙' : '穿着结构完整，实际版型与活动舒适度仍需试穿确认'}。（演示点评）`,
    tags: ['衣橱组合', hasShoes && hasBody ? '结构完整' : '待补齐'],
  };
};

export const recognizeGarment = async (
  imageBase64: string,
): Promise<AIResult<GarmentRecognition>> => {
  try {
    if (provider === 'mock') {
      return { data: await getMockRecognition(), source: 'mock' };
    }

    const data = await parseWithRetry(
      (retryReason) => requestProvider(buildRecognizePrompt(retryReason), imageBase64),
      validateGarmentRecognition,
    );
    return { data, source: 'ai' };
  } catch (error) {
    return {
      data: await getMockRecognition(),
      source: 'mock',
      error: getErrorMessage(error),
    };
  }
};

export const generateOutfits = async (
  input: OutfitInput,
): Promise<AIResult<OutfitPlan[]>> => {
  const unavailableReason = getOutfitAvailability(input.wardrobe, input.weather.temp);
  if (unavailableReason) return { data: [], source: 'mock', error: unavailableReason };
  try {
    if (provider === 'mock') {
      return { data: await getMockOutfits(input), source: 'mock' };
    }

    const plans = await parseWithRetry(
      (retryReason) => requestProvider(buildOutfitPrompt(input, retryReason)),
      (value) => validateOutfitPlans(value, input.wardrobe, input.weather.temp),
    );
    return { data: hydratePlans(plans, input.scene), source: 'ai' };
  } catch (error) {
    try {
      return { data: await getMockOutfits(input), source: 'mock', error: getErrorMessage(error) };
    } catch (fallbackError) {
      return { data: [], source: 'mock', error: getErrorMessage(fallbackError) };
    }
  }
};

export const reviewOutfit = async (
  itemIds: string[],
): Promise<AIResult<OutfitReview>> => {
  const state = useStore.getState();
  const selected = itemIds.map((id) => state.garments.find((garment) => garment.id === id));
  if (!selected.length || selected.some((garment) => !garment) || new Set(itemIds).size !== itemIds.length) {
    throw new Error('所选单品为空、重复或已删除，请重新选择后点评。');
  }
  const garments = selected as Garment[];
  try {
    if (provider === 'mock') {
      return { data: await getMockReview(garments), source: 'mock' };
    }

    const data = await parseWithRetry(
      (retryReason) => requestProvider(buildReviewPrompt(garments, state.profile, retryReason)),
      (value) => validateReviewForGarments(value, garments),
    );
    return { data, source: 'ai' };
  } catch (error) {
    return {
      data: await getMockReview(garments),
      source: 'mock',
      error: getErrorMessage(error),
    };
  }
};
