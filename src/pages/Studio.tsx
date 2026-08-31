// AI 搭配工作室串联场景、心情、天气与衣橱，生成并保存完整穿搭方案。
import {
  Minus,
  Plus,
  Sparkles,
  ThermometerSun,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateOutfits, provider, providerLabel } from '../ai/client';
import { getCompleteCombinations, getOutfitAvailability, getPlanSignature } from '../ai/outfitRules';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PlanCard from '../components/PlanCard';
import { getMockWeather } from '../data/weather';
import { useStore } from '../store/useStore';
import type { OutfitPlan } from '../types';

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';
type ResultSource = 'ai' | 'mock';
type TemperatureBand = 'cold' | 'comfortable' | 'hot';

interface StudioLocationState {
  prefillScene?: string;
}

const scenes = ['上课', '约会', '运动', '面试', '旅行', '聚会'];
const moods = ['想显瘦', '想亮眼', '想舒服', '想正式'];
const loadingSteps = [
  '正在分析你的衣橱…',
  '匹配身材与偏好…',
  '结合天气生成方案…',
];

const getTemperatureBand = (temperature: number): TemperatureBand => {
  if (temperature < 18) return 'cold';
  if (temperature > 28) return 'hot';
  return 'comfortable';
};

const getTemperatureHint = (temperature: number) => {
  const band = getTemperatureBand(temperature);
  if (band === 'cold') return { label: '需要外套', tone: 'bg-sky-light text-sky-deep' };
  if (band === 'hot') return { label: '轻薄为主', tone: 'bg-coral-light text-coral-deep' };
  return { label: '舒适', tone: 'bg-mint-light text-mint' };
};

const getBatchSignature = (plans: OutfitPlan[]): string =>
  plans
    .map((plan) => [...plan.itemIds].sort().join('|'))
    .sort()
    .join('::');

function Studio() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as StudioLocationState | null;
  const garments = useStore((state) => state.garments);
  const profile = useStore((state) => state.profile);
  const savePlan = useStore((state) => state.savePlan);
  const storedPlans = useStore((state) => state.plans);
  const weather = useMemo(() => getMockWeather(), []);

  const [hasHydrated, setHasHydrated] = useState(() => useStore.persist.hasHydrated());
  const [scene, setScene] = useState('上课');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [temperature, setTemperature] = useState(weather.temp);
  const [generatedTemperature, setGeneratedTemperature] = useState<number>();
  const [plans, setPlans] = useState<OutfitPlan[]>([]);
  const [resultSource, setResultSource] = useState<ResultSource>();
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('idle');
  const [requestError, setRequestError] = useState('');
  const [fallbackReason, setFallbackReason] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [batchSeed, setBatchSeed] = useState(0);
  const [savedResultIds, setSavedResultIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const stopHydrating = useStore.persist.onHydrate(() => setHasHydrated(false));
    const stopHydrated = useStore.persist.onFinishHydration(() => setHasHydrated(true));
    setHasHydrated(useStore.persist.hasHydrated());
    return () => {
      stopHydrating();
      stopHydrated();
    };
  }, []);

  useEffect(() => {
    if (locationState?.prefillScene && scenes.includes(locationState.prefillScene)) {
      setScene(locationState.prefillScene);
    }
  }, [locationState?.prefillScene]);

  useEffect(() => {
    if (requestStatus !== 'loading') return;
    setLoadingStep(0);
    const timer = window.setInterval(
      () => setLoadingStep((current) => (current + 1) % loadingSteps.length),
      500,
    );
    return () => window.clearInterval(timer);
  }, [requestStatus]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const toggleMood = (mood: string) => {
    setSelectedMoods((current) =>
      current.includes(mood)
        ? current.filter((item) => item !== mood)
        : [...current, mood],
    );
  };

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2_600);
  };

  const requestPlans = async (requestedSeed: number, previousSignature?: string) => {
    if (!Array.isArray(garments) || wardrobeIssue || requestStatus === 'loading') return;
    setRequestStatus('loading');
    setRequestError('');

    try {
      let resolvedSeed = requestedSeed;
      let result = await generateOutfits({
        scene,
        mood: selectedMoods.join('、') || undefined,
        weather: { temp: temperature, condition: weather.condition },
        wardrobe: garments,
        profile,
        seed: resolvedSeed,
      });

      if (previousSignature && getBatchSignature(result.data) === previousSignature) {
        resolvedSeed += 1;
        result = await generateOutfits({
          scene,
          mood: selectedMoods.join('、') || undefined,
          weather: { temp: temperature, condition: weather.condition },
          wardrobe: garments,
          profile,
          seed: resolvedSeed,
        });
      }

      if (previousSignature && getBatchSignature(result.data) === previousSignature) {
        throw new Error('新一批方案仍与上一批重复，请再试一次');
      }
      if (result.data.length !== 3) throw new Error(result.error || 'AI 未返回完整的三套方案');

      setPlans(result.data);
      setResultSource(result.source);
      setFallbackReason(result.error ?? '');
      setGeneratedTemperature(temperature);
      setBatchSeed(resolvedSeed);
      setSavedResultIds(new Set());
      setRequestStatus('success');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '搭配生成失败');
      setRequestStatus('error');
    }
  };

  const handleSave = (plan: OutfitPlan) => {
    if (savedResultIds.has(plan.id) || storedPlans.some((stored) => stored.saved && stored.scene === plan.scene && getPlanSignature(stored.itemIds) === getPlanSignature(plan.itemIds))) return;
    savePlan({
      title: plan.title,
      itemIds: [...plan.itemIds],
      scene: plan.scene,
      score: plan.score,
      review: plan.review,
      tags: [...plan.tags],
      pros: [...plan.pros],
      cons: [...plan.cons],
      saved: true,
    });
    setSavedResultIds((current) => new Set(current).add(plan.id));
    showToast(`“${plan.title}”已存入我的方案`);
  };

  const temperatureHint = getTemperatureHint(temperature);
  const crossedTemperatureThreshold =
    generatedTemperature !== undefined &&
    plans.length > 0 &&
    getTemperatureBand(generatedTemperature) !== getTemperatureBand(temperature);
  const wardrobeIssue = useMemo(() => {
    if (!Array.isArray(garments)) return '衣橱数据暂不可用。';
    return getOutfitAvailability(garments, temperature) ?? (getCompleteCombinations(garments, temperature).length < 3 ? '当前只能组成不足三套不同搭配，请再添加可替换的上装、下装或鞋。' : undefined);
  }, [garments, temperature]);
  const insufficientWardrobe = Boolean(wardrobeIssue);

  if (!hasHydrated) {
    return <div className="min-h-full px-[18px] py-5"><LoadingSkeleton rows={4} label="正在准备 AI 搭配工作室" /></div>;
  }

  if (!Array.isArray(garments) || !profile || !Array.isArray(profile.goal)) {
    return (
      <div className="min-h-full px-[18px] py-5">
        <EmptyState emoji="🛠️" title="工作室数据加载失败" description="衣橱或个人档案暂时无法读取，刷新页面后再试。" ctaLabel="刷新页面" onAction={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="min-h-full pb-6">
      {toast ? (
        <div className="absolute left-1/2 top-[58px] z-50 w-[calc(100%-36px)] -translate-x-1/2 rounded-control bg-mint px-4 py-3 text-center text-xs font-bold text-white shadow-card" role="status">
          {toast}
        </div>
      ) : null}

      <header className="bg-gradient-to-br from-coral-light to-cream-light px-[18px] pb-6 pt-5">
        <div className="flex items-center gap-2 text-xs font-bold text-coral-deep">
          <WandSparkles size={16} /> 从衣橱出发，找到今日灵感
        </div>
        <h1 className="mt-2 text-2xl font-bold text-ink">AI 搭配工作室</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">选好场景和心情，AI 从你的真实衣橱里配出今天能直接穿走的三套方案。</p>
      </header>

      <main className="space-y-5 px-[18px] pt-5">
        <fieldset>
          <legend className="text-sm font-bold text-ink">今天要去哪里？</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {scenes.map((option) => (
              <button key={option} type="button" onClick={() => setScene(option)} className={`rounded-full px-4 py-2 text-xs font-bold ${scene === option ? 'bg-coral text-white' : 'bg-white text-ink-soft'}`}>
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-ink">今天想要什么感觉？</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {moods.map((mood) => {
              const active = selectedMoods.includes(mood);
              return (
                <button key={mood} type="button" onClick={() => toggleMood(mood)} className={`rounded-full px-4 py-2 text-xs font-bold ${active ? 'bg-mint text-white' : 'bg-white text-ink-soft'}`}>
                  {mood}
                </button>
              );
            })}
          </div>
        </fieldset>

        <section className="rounded-card bg-white p-4 shadow-card" aria-label="温度设置">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-control bg-coral-light text-coral-deep"><ThermometerSun size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-soft">当前温度</p>
              <p className="mt-1 text-xl font-bold text-ink">{temperature}°C</p>
            </div>
            <button type="button" onClick={() => setTemperature((current) => Math.max(-10, current - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-light text-sky-deep" aria-label="温度减一度"><Minus size={17} /></button>
            <button type="button" onClick={() => setTemperature((current) => Math.min(40, current + 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-coral-light text-coral-deep" aria-label="温度加一度"><Plus size={17} /></button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${temperatureHint.tone}`}>{temperatureHint.label}</span>
            <span className="text-[10px] text-ink-soft">天气：{weather.condition} · 可手动调整</span>
          </div>
        </section>

        {insufficientWardrobe ? (
          <p className="rounded-control bg-coral-light px-4 py-3 text-xs font-bold leading-5 text-coral-deep">
            {wardrobeIssue}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void requestPlans(batchSeed)}
          disabled={insufficientWardrobe || requestStatus === 'loading'}
          className="flex w-full items-center justify-center gap-2 rounded-control bg-gradient-to-r from-mint to-sky py-4 text-sm font-bold text-white shadow-card disabled:opacity-50"
        >
          <Sparkles size={18} /> {requestStatus === 'loading' ? loadingSteps[loadingStep] : '生成我的三套搭配'}
        </button>

        <section aria-label="AI 搭配结果">
          {crossedTemperatureThreshold ? (
            <div className="mb-3 rounded-control bg-coral-light px-4 py-3 text-xs font-bold text-coral-deep">温度已变更，建议重新生成</div>
          ) : null}

          {requestStatus === 'loading' ? (
            <div>
              <div className="mb-4 rounded-card bg-cream-light p-4 text-center">
                <Sparkles className="mx-auto text-mint" size={20} />
                <p className="mt-2 text-sm font-bold text-ink">{loadingSteps[loadingStep]}</p>
                <div className="mx-auto mt-3 flex w-fit gap-1.5">
                  {loadingSteps.map((step, index) => <span key={step} className={`h-1.5 rounded-full transition-all ${index === loadingStep ? 'w-6 bg-mint' : 'w-1.5 bg-white'}`} />)}
                </div>
              </div>
              <LoadingSkeleton rows={3} label={loadingSteps[loadingStep]} />
            </div>
          ) : requestStatus === 'error' ? (
            <EmptyState emoji="😵‍💫" title="这次搭配没有生成成功" description={requestError || 'AI 暂时开小差了，保留你的选择再试一次。'} ctaLabel="重试生成" onAction={() => void requestPlans(batchSeed)} />
          ) : plans.length ? (
            <div className="space-y-4">
              {resultSource === 'mock' ? (
                <div className="rounded-control bg-cream-light px-4 py-3 text-xs leading-5 text-ink-soft">
                  当前为演示数据，配置 API Key 后可体验真实 AI 生成
                  {fallbackReason ? <p className="mt-1">已切换演示数据：{fallbackReason}</p> : null}
                </div>
              ) : <div role="status" className="rounded-control bg-mint-light px-4 py-3 text-xs font-bold text-ink">真实 AI 已生成 · {providerLabel[provider]} · source=ai</div>}
              {plans.map((plan, index) => (
                <PlanCard
                  key={`${batchSeed}-${plan.id}`}
                  plan={plan}
                  garments={garments}
                  index={index}
                  isSaved={savedResultIds.has(plan.id) || storedPlans.some((stored) => stored.saved && stored.scene === plan.scene && getPlanSignature(stored.itemIds) === getPlanSignature(plan.itemIds))}
                  isBusy={false}
                  onSave={handleSave}
                  onRegenerate={() => void requestPlans(batchSeed + 1, getBatchSignature(plans))}
                />
              ))}
            </div>
          ) : insufficientWardrobe ? (
            <EmptyState emoji="🧺" title="衣橱还需要再丰富一点" description={wardrobeIssue ?? '请添加组成完整搭配所需的单品。'} ctaLabel="去添加单品" onAction={() => navigate('/wardrobe')} />
          ) : (
            <EmptyState emoji="✨" title="你的专属方案还没生成" description="选择场景、心情与温度，让 AI 开始分析你的真实衣橱。" ctaLabel="开始生成" onAction={() => void requestPlans(batchSeed)} />
          )}
        </section>
      </main>
    </div>
  );
}

export default Studio;
