// “我的”页面集中管理个人资料、AI 偏好、穿搭报告与本地数据设置。
import {
  BarChart3,
  BookmarkCheck,
  ChevronRight,
  Crown,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import SavedPlansSheet from '../components/SavedPlansSheet';
import { provider, providerLabel } from '../ai/client';
import { useStore } from '../store/useStore';
import type { BodyType, UserProfile } from '../types';

interface SheetProps {
  profile: UserProfile;
  onClose: () => void;
  onSave: (patch: Partial<UserProfile>) => void;
}

interface FeatureRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  onClick?: () => void;
}

const bodyTypes: BodyType[] = ['梨形', '苹果形', 'H形', '沙漏形'];
const preferenceOptions = {
  stylePrefs: ['温柔通勤', '韩系', '运动活力', '甜美学院', '复古简约', '街头酷感'],
  avoid: ['紧身', '高饱和撞色', '低腰', '过度宽松', '复杂印花'],
  goal: ['显高', '显瘦', '提亮气色', '增加正式感', '舒适自在'],
};

const toggleValue = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

function FeatureRow({ icon, title, description, action, onClick }: FeatureRowProps) {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-mint-light text-mint">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-ink-soft">{description}</span>
      </span>
      {action ?? <ChevronRight size={18} className="shrink-0 text-ink-soft" />}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-card bg-white p-4 shadow-card transition active:scale-[0.99]">
      {content}
    </button>
  ) : (
    <div className="flex w-full items-center gap-3 rounded-card bg-white p-4 shadow-card">{content}</div>
  );
}

function ProfileEditSheet({ profile, onClose, onSave }: SheetProps) {
  const [name, setName] = useState(profile.name);
  const [height, setHeight] = useState(profile.height?.toString() ?? '');
  const [weight, setWeight] = useState(profile.weight?.toString() ?? '');
  const [bodyType, setBodyType] = useState<BodyType | undefined>(profile.bodyType);

  const saveProfile = () => {
    const parsedHeight = Number(height);
    const parsedWeight = Number(weight);
    onSave({
      name: name.trim(),
      height: parsedHeight > 0 ? parsedHeight : undefined,
      weight: parsedWeight > 0 ? parsedWeight : undefined,
      bodyType,
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-ink/30 p-[10px]" role="dialog" aria-modal="true" aria-label="编辑个人资料">
      <section className="w-full rounded-card bg-bg p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-mint">PROFILE</p>
            <h2 className="mt-1 text-lg font-bold text-ink">更新身体档案</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white p-2 text-ink-soft" aria-label="关闭个人资料编辑"><X size={18} /></button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-bold text-ink">
            昵称
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-control border border-mint-light bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint" />
          </label>
          <label className="text-xs font-bold text-ink">
            身高（cm）
            <input type="number" min="100" max="220" value={height} onChange={(event) => setHeight(event.target.value)} className="mt-2 w-full rounded-control border border-mint-light bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint" />
          </label>
          <label className="text-xs font-bold text-ink">
            体重（kg）
            <input type="number" min="30" max="200" value={weight} onChange={(event) => setWeight(event.target.value)} className="mt-2 w-full rounded-control border border-mint-light bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint" />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs font-bold text-ink">身材类型</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {bodyTypes.map((option) => (
              <button key={option} type="button" onClick={() => setBodyType(option)} className={`rounded-full py-2 text-xs font-bold ${bodyType === option ? 'bg-mint text-white' : 'bg-white text-ink-soft'}`}>
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" onClick={saveProfile} disabled={!name.trim()} className="mt-5 w-full rounded-control bg-mint py-3 text-sm font-bold text-white disabled:opacity-50">
          保存身体档案
        </button>
      </section>
    </div>
  );
}

function PreferencesSheet({ profile, onClose, onSave }: SheetProps) {
  const [stylePrefs, setStylePrefs] = useState([...profile.stylePrefs]);
  const [avoid, setAvoid] = useState([...profile.avoid]);
  const [goal, setGoal] = useState([...profile.goal]);
  const [customValues, setCustomValues] = useState({ stylePrefs: '', avoid: '', goal: '' });

  const groups = [
    { key: 'stylePrefs' as const, title: '喜欢的风格', values: stylePrefs, setValues: setStylePrefs },
    { key: 'avoid' as const, title: '想要避开', values: avoid, setValues: setAvoid },
    { key: 'goal' as const, title: '穿搭目标', values: goal, setValues: setGoal },
  ];

  const addCustomValue = (key: keyof typeof customValues, values: string[], setValues: (values: string[]) => void) => {
    const nextValue = customValues[key].trim();
    if (nextValue && !values.includes(nextValue)) setValues([...values, nextValue]);
    setCustomValues((current) => ({ ...current, [key]: '' }));
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-ink/30 p-[10px]" role="dialog" aria-modal="true" aria-label="编辑 AI 穿搭偏好">
      <section className="phone-scrollbar max-h-[calc(100%_-_38px)] w-full overflow-y-auto rounded-card bg-bg p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-mint">AI PREFERENCES</p>
            <h2 className="mt-1 text-lg font-bold text-ink">告诉 AI 你喜欢什么</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white p-2 text-ink-soft" aria-label="关闭偏好编辑"><X size={18} /></button>
        </div>

        {groups.map((group) => (
          <fieldset key={group.key} className="mt-4">
            <legend className="text-xs font-bold text-ink">{group.title}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from(new Set([...preferenceOptions[group.key], ...group.values])).map((option) => {
                const active = group.values.includes(option);
                return (
                  <button key={option} type="button" onClick={() => group.setValues(toggleValue(group.values, option))} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-mint text-white' : 'bg-white text-ink-soft'}`}>
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customValues[group.key]}
                onChange={(event) => setCustomValues((current) => ({ ...current, [group.key]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomValue(group.key, group.values, group.setValues);
                  }
                }}
                placeholder="添加自定义项"
                className="min-w-0 flex-1 rounded-control border border-mint-light bg-white px-3 py-2 text-xs text-ink outline-none focus:border-mint"
              />
              <button type="button" onClick={() => addCustomValue(group.key, group.values, group.setValues)} className="flex items-center gap-1 rounded-control bg-sky-light px-3 text-xs font-bold text-ink">
                <Plus size={14} /> 添加
              </button>
            </div>
          </fieldset>
        ))}

        <button type="button" onClick={() => onSave({ stylePrefs, avoid, goal })} className="mt-5 w-full rounded-control bg-mint py-3 text-sm font-bold text-white">
          保存 AI 偏好
        </button>
      </section>
    </div>
  );
}

function Me() {
  const profile = useStore((state) => state.profile);
  const plans = useStore((state) => state.plans);
  const updateProfile = useStore((state) => state.updateProfile);
  const clearAll = useStore((state) => state.clearAll);
  const [hasHydrated, setHasHydrated] = useState(() => useStore.persist.hasHydrated());
  const [activeSheet, setActiveSheet] = useState<'profile' | 'preferences' | 'plans'>();

  useEffect(() => {
    const stopHydrating = useStore.persist.onHydrate(() => setHasHydrated(false));
    const stopHydrated = useStore.persist.onFinishHydration(() => setHasHydrated(true));
    setHasHydrated(useStore.persist.hasHydrated());
    return () => {
      stopHydrating();
      stopHydrated();
    };
  }, []);

  const monthlyPlanCount = useMemo(() => {
    if (!Array.isArray(plans)) return 0;
    const now = new Date();
    return plans.filter((plan) => {
      const createdAt = new Date(plan.createdAt);
      return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
    }).length;
  }, [plans]);
  const savedHours = ((monthlyPlanCount * 13) / 60).toFixed(1);

  const saveProfilePatch = (patch: Partial<UserProfile>) => {
    updateProfile(patch);
    setActiveSheet(undefined);
  };

  if (!hasHydrated) {
    return <div className="min-h-full px-[18px] py-5"><LoadingSkeleton rows={4} label="正在加载个人档案" /></div>;
  }

  if (!profile || typeof profile.name !== 'string' || !Array.isArray(profile.stylePrefs) || !Array.isArray(profile.avoid) || !Array.isArray(profile.goal) || !Array.isArray(plans)) {
    return (
      <div className="min-h-full px-[18px] py-5">
        <EmptyState emoji="🛠️" title="个人档案读取失败" description="本地数据格式不正确，刷新页面后再试一次吧。" ctaLabel="刷新页面" onAction={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="min-h-full pb-5">
      {!profile.name.trim() ? (
        <div className="px-[18px] py-5">
          <EmptyState emoji="🍊" title="先认识一下你吧" description="补充昵称和身体档案，AI 才能给出更贴合你的搭配建议。" ctaLabel="完善个人资料" onAction={() => setActiveSheet('profile')} />
        </div>
      ) : (
        <>
          <header className="bg-gradient-to-br from-mint-light to-sky-light px-[18px] pb-6 pt-5">
            <div className="flex items-center gap-4">
              <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white text-[42px] shadow-card" aria-label="用户头像">{profile.avatar}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-mint">MY STYLE SPACE</p>
                <h1 className="mt-1 text-2xl font-bold text-ink">{profile.name}</h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.stylePrefs.map((tag) => <span key={tag} className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold text-ink">{tag}</span>)}
                </div>
              </div>
            </div>
          </header>

          <main className="space-y-4 px-[18px] pt-4">
            <button type="button" onClick={() => setActiveSheet('profile')} className="grid w-full grid-cols-3 gap-2 rounded-card bg-white p-3 shadow-card" aria-label="编辑身体档案">
              {[
                { value: profile.height ? `${profile.height} cm` : '待填写', label: '身高' },
                { value: profile.weight ? `${profile.weight} kg` : '待填写', label: '体重' },
                { value: profile.bodyType ?? '待填写', label: '身材类型' },
              ].map((item, index) => (
                <span key={item.label} className={index === 1 ? 'border-x border-mint-light px-1' : 'px-1'}>
                  <span className="block text-sm font-bold text-ink">{item.value}</span>
                  <span className="mt-1 block text-[10px] text-ink-soft">{item.label}</span>
                </span>
              ))}
            </button>

            <FeatureRow icon={<SlidersHorizontal size={19} />} title="AI 穿搭偏好" description={`偏爱 ${profile.stylePrefs.join('、') || '待补充'}；避开 ${profile.avoid.join('、') || '待补充'}；目标 ${profile.goal.join('、') || '待补充'}`} onClick={() => setActiveSheet('preferences')} />

            <section className="rounded-card bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-control bg-sky-light text-ink"><BarChart3 size={19} /></span>
                <div>
                  <h2 className="text-sm font-bold text-ink">我的穿搭报告</h2>
                  <p className="mt-1 text-xs text-ink-soft">每一套选择，都在让你更懂自己</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-control bg-mint-light p-3">
                  <p className="text-xl font-bold text-ink">{monthlyPlanCount} 套</p>
                  <p className="mt-1 text-[10px] text-ink-soft">本月方案数</p>
                </div>
                <div className="rounded-control bg-cream-light p-3">
                  <p className="text-xl font-bold text-ink">{savedHours} 小时</p>
                  <p className="mt-1 text-[10px] text-ink-soft">预计节省时间（估算）</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-ink-soft">按每套方案节省 13 分钟估算，非实际测量结果。</p>
            </section>

            <FeatureRow icon={<BookmarkCheck size={19} />} title="我的方案" description={`已保存 ${plans.filter((plan) => plan.saved).length} 套搭配，点此查看与管理`} onClick={() => setActiveSheet('plans')} />

            <FeatureRow icon={<WandSparkles size={19} />} title="虚拟试穿记录" description="把搭配穿上身再做决定" action={<span className="rounded-full bg-coral-light px-2.5 py-1 text-[10px] font-bold text-ink">即将上线</span>} />

            <section className="rounded-card bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-control bg-mint-light text-mint"><Settings2 size={19} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-ink">AI 设置</h2>
                  <p className="mt-1 text-xs text-ink-soft">配置服务：{providerLabel[provider]}</p>
                  <p className="mt-1 text-[10px] text-ink-soft">实际调用来源请查看生成结果提示</p>
                </div>
                <button type="button" onClick={() => { if (window.confirm('确定清空全部衣橱、方案、社区与个人资料数据吗？清空后将恢复演示数据。')) clearAll(); }} className="flex items-center gap-1 rounded-control bg-coral-light px-3 py-2 text-xs font-bold text-ink">
                  <Trash2 size={14} /> 清空数据
                </button>
              </div>
            </section>

            <FeatureRow icon={<Crown size={19} />} title="会员中心" description="解锁更多 AI 搭配灵感" action={<span className="rounded-full bg-cream-light px-2.5 py-1 text-[10px] font-bold text-ink">即将上线</span>} />

            <div className="flex items-center justify-center gap-2 py-1 text-[10px] text-ink-soft">
              <Sparkles size={12} className="text-mint" /> 衣搭 AI · 让每天的选择轻松一点
            </div>
          </main>
        </>
      )}

      {activeSheet === 'profile' ? <ProfileEditSheet profile={profile} onClose={() => setActiveSheet(undefined)} onSave={saveProfilePatch} /> : null}
      {activeSheet === 'preferences' ? <PreferencesSheet profile={profile} onClose={() => setActiveSheet(undefined)} onSave={saveProfilePatch} /> : null}
      {activeSheet === 'plans' ? <SavedPlansSheet onClose={() => setActiveSheet(undefined)} /> : null}
    </div>
  );
}

export default Me;
