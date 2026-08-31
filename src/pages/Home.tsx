// 首页将天气、当日 AI 推荐、快捷入口与衣橱洞察组织成每日决策入口。
import {
  ArrowRight,
  CalendarDays,
  CloudSun,
  ScanLine,
  Shirt,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateOutfits, provider, type AIResult, type OutfitInput } from '../ai/client';
import { getOutfitAvailability } from '../ai/outfitRules';
import { validateOutfitPlans } from '../ai/parsers';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { getMockWeather } from '../data/weather';
import { useStore } from '../store/useStore';
import type { OutfitPlan } from '../types';
import { getWardrobeStats } from '../utils/wardrobeStats';

let dailyRequestKey = '';
let dailyRequest: Promise<AIResult<OutfitPlan[]>> | undefined;

const getLocalDate = (): string => {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
};

const getDailyRequest = (
  key: string,
  input: OutfitInput,
): Promise<AIResult<OutfitPlan[]>> => {
  if (dailyRequest && dailyRequestKey === key) return dailyRequest;
  dailyRequestKey = key;
  dailyRequest = generateOutfits(input).then((result) => {
    if (result.data.length !== 3) throw new Error(result.error || '衣橱暂时不足以生成三套搭配');
    return result;
  }).catch((error) => {
    dailyRequest = undefined;
    throw error;
  });
  return dailyRequest;
};

const getTimeContext = () => {
  const hour = new Date().getHours();
  return {
    greeting: hour < 11 ? '早安' : hour < 18 ? '午安' : '晚上好',
    scene: hour < 18 ? '上课' : '聚会',
  };
};

function Home() {
  const navigate = useNavigate();
  const garments = useStore((state) => state.garments);
  const profile = useStore((state) => state.profile);
  const dailyRecommendation = useStore((state) => state.dailyRecommendation);
  const cacheDailyRecommendation = useStore((state) => state.cacheDailyRecommendation);
  const [hasHydrated, setHasHydrated] = useState(() => useStore.persist.hasHydrated());
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [requestError, setRequestError] = useState('');
  const [retrySeed, setRetrySeed] = useState(0);

  const weather = useMemo(() => getMockWeather(), []);
  const today = getLocalDate();
  const timeContext = getTimeContext();
  const wardrobeStats = getWardrobeStats(Array.isArray(garments) ? garments : []);
  const wardrobeIssue = getOutfitAvailability(Array.isArray(garments) ? garments : [], weather.temp);
  const todayRecommendation =
    dailyRecommendation?.date === today && dailyRecommendation.provider === provider && Array.isArray(dailyRecommendation.plans) && Array.isArray(garments) && validateOutfitPlans({ plans: dailyRecommendation.plans }, garments, weather.temp).ok
      ? dailyRecommendation
      : undefined;
  const plans = todayRecommendation?.plans ?? [];

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
    if (
      !hasHydrated ||
      !Array.isArray(garments) ||
      wardrobeIssue ||
      !profile ||
      !Array.isArray(profile.goal)
    ) return;
    if (todayRecommendation?.plans.length) {
      setRequestStatus('success');
      return;
    }

    let active = true;
    setRequestStatus('loading');
    setRequestError('');

    void getDailyRequest(JSON.stringify([today, provider, timeContext.scene, retrySeed, garments.map(({ id, name, category }) => ({ id, name, category })), profile]), {
      scene: timeContext.scene,
      mood: profile.goal.join('、'),
      weather,
      wardrobe: garments,
      profile,
      seed: retrySeed,
    })
      .then((result) => {
        if (!active) return;
        cacheDailyRecommendation({
          provider,
          date: today,
          scene: timeContext.scene,
          plans: result.data,
          source: result.source,
          error: result.error,
        });
        setRequestStatus('success');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRequestError(error instanceof Error ? error.message : '今日推荐生成失败');
        setRequestStatus('error');
      });

    return () => {
      active = false;
    };
  }, [
    cacheDailyRecommendation,
    garments,
    hasHydrated,
    profile,
    retrySeed,
    timeContext.scene,
    today,
    todayRecommendation,
    weather,
    wardrobeIssue,
  ]);

  const garmentById = useMemo(
    () => new Map((Array.isArray(garments) ? garments : []).map((garment) => [garment.id, garment])),
    [garments],
  );

  const formatPlanEmojis = (plan: OutfitPlan): string[] =>
    plan.itemIds.map((id) => garmentById.get(id)?.emoji ?? '🧺');

  const insight = weather.temp < 18
    ? '今天偏冷，记得给搭配加件外套，教室里也方便随时脱下。'
    : wardrobeStats.idleCount > 0
      ? `你有 ${wardrobeStats.idleCount} 件衣服很久没穿了，今天试着让一件旧爱重新出场吧！`
      : '你的衣橱最近利用得很均衡，继续保持这个节奏～';

  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short',
  }).format(new Date());

  if (!hasHydrated) {
    return <div className="min-h-full px-[18px] py-5"><LoadingSkeleton rows={4} label="正在准备今日首页" /></div>;
  }

  if (!Array.isArray(garments) || !profile || !Array.isArray(profile.goal)) {
    return (
      <div className="min-h-full px-[18px] py-5">
        <EmptyState emoji="🛠️" title="今日首页加载失败" description="本地资料暂时无法读取，刷新页面后再试一次。" ctaLabel="刷新页面" onAction={() => window.location.reload()} />
      </div>
    );
  }

  const mainPlan = plans[0];
  const morePlans = plans.slice(1, 3);

  return (
    <div className="min-h-full pb-5">
      <header className="bg-gradient-to-br from-mint-light to-sky-light px-[18px] pb-6 pt-5">
        <div className="flex items-center justify-between text-xs font-bold text-ink-soft">
          <span className="flex items-center gap-1.5"><CalendarDays size={14} />{dateLabel}</span>
          <span className="flex items-center gap-1.5"><CloudSun size={16} />{weather.temp}°C · {weather.condition}</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink">{timeContext.greeting}，{profile.name} 👋</h1>
        <p className="mt-1 text-sm text-ink-soft">今天也让穿衣这件事，轻松一点吧。</p>
      </header>

      <main className="space-y-5 px-[18px] pt-4">
        <section aria-label="今日推荐">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-mint">TODAY'S PICK</p>
              <h2 className="mt-1 text-lg font-bold text-ink">今日推荐</h2>
            </div>
            {todayRecommendation?.source === 'mock' ? <span className="rounded-full bg-cream-light px-2.5 py-1 text-[10px] font-bold text-ink">演示数据</span> : null}
          </div>

          {wardrobeIssue ? (
            <EmptyState emoji="🧺" title="再添几件就能开始搭配" description={wardrobeIssue} ctaLabel="去完善衣橱" onAction={() => navigate('/wardrobe')} />
          ) : requestStatus === 'loading' || requestStatus === 'idle' ? (
            <LoadingSkeleton rows={1} label="正在生成今日推荐" />
          ) : requestStatus === 'error' ? (
            <EmptyState emoji="😵‍💫" title="今日灵感暂时迷路了" description={requestError || '稍等一下，再让 AI 试一次。'} ctaLabel="重新生成" onAction={() => setRetrySeed((seed) => seed + 1)} />
          ) : mainPlan ? (
            <article className="rounded-card bg-gradient-to-br from-mint-light to-sky-light p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold text-ink">{mainPlan.scene}</span>
                  <h3 className="mt-3 text-lg font-bold text-ink">{mainPlan.title}</h3>
                </div>
                <Sparkles className="text-mint" size={22} />
              </div>
              <div className="mt-4 flex items-center justify-center gap-3">
                {formatPlanEmojis(mainPlan).map((emoji, index) => (
                  <span key={`${emoji}-${index}`} className="flex h-[68px] w-[68px] items-center justify-center rounded-control bg-white text-[38px] shadow-card">{emoji}</span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-ink">{mainPlan.review}</p>
            </article>
          ) : (
            <EmptyState emoji="✨" title="今天还没有推荐" description="点一下，让 AI 从你的衣橱里挑出完整搭配。" ctaLabel="生成今日推荐" onAction={() => setRetrySeed((seed) => seed + 1)} />
          )}
        </section>

        <section>
          <h2 className="text-sm font-bold text-ink">想做什么？</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: '智能搭配', icon: <Sparkles size={20} />, tone: 'bg-mint-light', path: '/studio', state: { mode: 'generate' } },
              { label: '虚拟试穿', icon: <ScanLine size={20} />, tone: 'bg-coral-light', path: '/studio', state: { mode: 'try-on' } },
              { label: '衣橱管理', icon: <Shirt size={20} />, tone: 'bg-sky-light', path: '/wardrobe', state: undefined },
            ].map((item) => (
              <button key={item.label} type="button" onClick={() => navigate(item.path, { state: item.state })} className={`flex flex-col items-center rounded-card p-3 text-ink ${item.tone}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">{item.icon}</span>
                <span className="mt-2 text-xs font-bold">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="flex items-start gap-3 rounded-card bg-coral-light p-4">
          <span className="text-xl" aria-hidden="true">💡</span>
          <div>
            <p className="text-xs font-bold text-ink">AI 衣橱洞察</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{insight}</p>
          </div>
        </aside>

        {morePlans.length ? (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">再看看这两套</h2>
              <WandSparkles className="text-mint" size={18} />
            </div>
            <div className="phone-scrollbar -mx-[18px] mt-3 flex gap-3 overflow-x-auto px-[18px] pb-2">
              {morePlans.map((plan) => (
                <button key={plan.id} type="button" onClick={() => navigate('/studio', { state: { prefillScene: plan.scene, planId: plan.id } })} className="w-[245px] shrink-0 rounded-card bg-white p-4 text-left shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-sky-light px-2.5 py-1 text-[10px] font-bold text-ink">{plan.scene}</span>
                    <ArrowRight size={16} className="text-mint" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    {formatPlanEmojis(plan).map((emoji, index) => <span key={`${emoji}-${index}`} className="flex h-11 w-11 items-center justify-center rounded-control bg-cream-light text-2xl">{emoji}</span>)}
                  </div>
                  <p className="mt-3 text-sm font-bold text-ink">{plan.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-soft">{plan.review}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default Home;
