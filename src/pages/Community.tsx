// 灵感社区展示 AI 点评信息流，并提供基于衣橱单品的轻量发布流程。
import {
  Bookmark,
  Check,
  Heart,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { reviewOutfit } from '../ai/client';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ScoreBadge from '../components/ScoreBadge';
import { useStore } from '../store/useStore';

type PublishStatus = 'idle' | 'loading' | 'error';

const dailyThemes = [
  '低饱和秋日叠穿',
  '早八五分钟出门',
  '图书馆温柔学院风',
  '小个子显高公式',
  '周末逛展松弛感',
];

const imageGridTones = ['bg-mint-light', 'bg-sky-light', 'bg-cream-light'];

const getLocalDate = (): string => {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
};

function Community() {
  const posts = useStore((state) => state.posts);
  const garments = useStore((state) => state.garments);
  const profile = useStore((state) => state.profile);
  const addPost = useStore((state) => state.addPost);
  const [hasHydrated, setHasHydrated] = useState(() => useStore.persist.hasHydrated());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(() => new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(() => new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [publishError, setPublishError] = useState('');
  const [publishNotice, setPublishNotice] = useState('');

  useEffect(() => {
    const stopHydrating = useStore.persist.onHydrate(() => setHasHydrated(false));
    const stopHydrated = useStore.persist.onFinishHydration(() => setHasHydrated(true));
    setHasHydrated(useStore.persist.hasHydrated());
    return () => {
      stopHydrating();
      stopHydrated();
    };
  }, []);

  const garmentOptions = useMemo(
    () => (Array.isArray(garments) ? garments.filter((garment) => garment.emoji) : []),
    [garments],
  );
  const garmentById = useMemo(
    () => new Map(garmentOptions.map((garment) => [garment.id, garment])),
    [garmentOptions],
  );
  const today = getLocalDate();
  const themeIndex = [...today].reduce((sum, character) => sum + character.charCodeAt(0), 0) % dailyThemes.length;
  const dailyTheme = dailyThemes[themeIndex];

  const toggleSetValue = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    value: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleSelectedGarment = (id: string) => {
    setSelectedItemIds((current) => {
      if (current.includes(id)) return current.filter((itemId) => itemId !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  };

  const closeComposer = () => {
    if (publishStatus === 'loading') return;
    setComposerOpen(false);
    setPublishStatus('idle');
    setPublishError('');
  };

  const publishPost = async () => {
    if (selectedItemIds.length < 2 || selectedItemIds.length > 3 || !caption.trim()) return;
    setPublishStatus('loading');
    setPublishError('');

    try {
      const result = await reviewOutfit(selectedItemIds);
      addPost({
        author: { name: profile.name, avatar: profile.avatar, school: '同校' },
        images: selectedItemIds.map((id) => garmentById.get(id)?.emoji ?? '👚'),
        caption: caption.trim(),
        aiScore: result.data.score,
        aiComment: result.data.comment,
        likes: 0,
        comments: 0,
      });
      setPublishNotice(
        result.source === 'mock'
          ? '发布成功！AI 点评当前使用演示数据。'
          : '发布成功！真实 AI 已完成穿搭点评 · source=ai',
      );
      setSelectedItemIds([]);
      setCaption('');
      setPublishStatus('idle');
      setComposerOpen(false);
      window.setTimeout(() => setPublishNotice(''), 3_000);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'AI 点评失败');
      setPublishStatus('error');
    }
  };

  if (!hasHydrated) {
    return <div className="min-h-full px-[18px] py-5"><LoadingSkeleton rows={4} label="正在加载灵感社区" /></div>;
  }

  if (!Array.isArray(posts) || !Array.isArray(garments) || !profile || typeof profile.name !== 'string') {
    return (
      <div className="min-h-full px-[18px] py-5">
        <EmptyState emoji="🛠️" title="社区数据加载失败" description="本地信息流暂时无法读取，刷新页面后再试一次。" ctaLabel="刷新页面" onAction={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="min-h-full px-[18px] pb-6 pt-4">
      <header className="rounded-card bg-gradient-to-br from-sky-light to-cream-light p-5 shadow-card">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold text-ink">AI 每日灵感</span>
          <Sparkles className="text-mint" size={20} />
        </div>
        <h1 className="mt-4 text-xl font-bold text-ink">今天试试「{dailyTheme}」</h1>
        <p className="mt-2 text-xs leading-5 text-ink-soft">从同龄人的真实穿搭里，找到属于你的下一套灵感。</p>
      </header>

      {publishNotice ? (
        <div className="sticky top-2 z-20 mt-3 rounded-control bg-mint px-4 py-3 text-center text-xs font-bold text-white shadow-card">{publishNotice}</div>
      ) : null}

      {posts.length === 0 ? (
        <div className="mt-5">
          <EmptyState emoji="🌱" title="第一条灵感等你发布" description="从衣橱挑 2–3 件单品，分享今天的穿搭想法吧。" ctaLabel="发布第一条" onAction={() => setComposerOpen(true)} />
        </div>
      ) : (
        <section className="mt-5 space-y-4" aria-label="社区信息流">
          {posts.map((post) => {
            const score = post.aiScore ?? 0;
            const liked = likedPostIds.has(post.id);
            const saved = savedPostIds.has(post.id);
            return (
              <article key={post.id} className="rounded-card bg-white p-4 shadow-card">
                <header className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-light text-xl">{post.author.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-ink">{post.author.name}</h2>
                      {post.author.school ? <span className="rounded-full bg-sky-light px-2 py-0.5 text-[9px] font-bold text-ink">{post.author.school}</span> : null}
                    </div>
                    <p className="mt-1 text-[10px] text-ink-soft">分享了今日穿搭灵感</p>
                  </div>
                  {post.aiScore !== undefined ? <ScoreBadge score={score} /> : null}
                </header>

                <div className={`mt-4 grid gap-2 ${post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {post.images.slice(0, 3).map((emoji, index) => (
                    <div key={`${emoji}-${index}`} className={`flex aspect-square items-center justify-center rounded-control text-[44px] ${imageGridTones[index % imageGridTones.length]}`}>{emoji}</div>
                  ))}
                </div>

                <p className="mt-4 text-sm leading-6 text-ink">{post.caption}</p>
                {post.aiComment ? (
                  <div className="mt-3 flex items-start gap-2 rounded-control bg-mint-light p-3">
                    <Sparkles className="mt-0.5 shrink-0 text-mint" size={15} />
                    <p className="text-xs leading-5 text-ink">{post.aiComment}</p>
                  </div>
                ) : null}

                <footer className="mt-3 flex items-center gap-2 border-t border-mint-light pt-3 text-xs text-ink-soft">
                  <button type="button" onClick={() => toggleSetValue(setLikedPostIds, post.id)} className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${liked ? 'bg-coral-light text-ink' : 'bg-bg text-ink-soft'}`} aria-label={liked ? '取消点赞' : '点赞'}>
                    <Heart size={15} className={liked ? 'fill-current' : ''} /> {post.likes + (liked ? 1 : 0)}
                  </button>
                  <span className="flex items-center gap-1 rounded-full bg-bg px-3 py-1.5" title="评论详情即将上线"><MessageCircle size={15} /> {post.comments} · 评论待开放</span>
                  <button type="button" onClick={() => toggleSetValue(setSavedPostIds, post.id)} className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 ${saved ? 'bg-cream-light text-ink' : 'bg-bg text-ink-soft'}`} aria-label={saved ? '取消收藏' : '收藏'}>
                    <Bookmark size={15} className={saved ? 'fill-current' : ''} /> {saved ? '已收藏' : '收藏'}
                  </button>
                </footer>
              </article>
            );
          })}
        </section>
      )}

      <button type="button" onClick={() => setComposerOpen(true)} className="absolute bottom-[104px] right-[18px] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-white shadow-card" aria-label="发布穿搭">
        <Plus size={26} />
      </button>

      {composerOpen ? (
        <div className="absolute inset-0 z-40 flex items-end bg-ink/30 p-[10px]" role="dialog" aria-modal="true" aria-label="发布穿搭灵感">
          <section className="phone-scrollbar max-h-[calc(100%_-_38px)] w-full overflow-y-auto rounded-card bg-bg p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-mint">NEW INSPIRATION</p>
                <h2 className="mt-1 text-lg font-bold text-ink">分享今天的穿搭</h2>
              </div>
              <button type="button" onClick={closeComposer} className="rounded-full bg-white p-2 text-ink-soft" aria-label="关闭发布框"><X size={18} /></button>
            </div>

            {garmentOptions.length < 2 ? (
              <div className="mt-4">
                <EmptyState emoji="🧺" title="衣橱单品还不够" description="至少准备 2 件带 emoji 的单品，才能发布搭配。" ctaLabel="先关闭发布框" onAction={closeComposer} />
              </div>
            ) : publishStatus === 'loading' ? (
              <div className="mt-5">
                <p className="mb-3 text-center text-sm font-bold text-ink">AI 正在从配色和比例角度点评…</p>
                <LoadingSkeleton rows={1} label="AI 正在生成社区点评" />
              </div>
            ) : (
              <>
                <fieldset className="mt-4">
                  <legend className="text-xs font-bold text-ink">选择 2–3 件单品</legend>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {garmentOptions.map((garment) => {
                      const active = selectedItemIds.includes(garment.id);
                      return (
                        <button key={garment.id} type="button" onClick={() => toggleSelectedGarment(garment.id)} className={`relative flex aspect-square items-center justify-center rounded-control text-3xl ${active ? 'bg-mint-light' : 'bg-white'}`} aria-label={`选择${garment.name}`}>
                          {garment.emoji}
                          {active ? <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-mint text-white"><Check size={10} /></span> : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-ink-soft">已选择 {selectedItemIds.length}/3 件</p>
                </fieldset>

                <label className="mt-4 block text-xs font-bold text-ink">
                  说说这套搭配
                  <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={120} rows={3} placeholder="比如：今天想走轻松学院风，去图书馆也要好看～" className="mt-2 w-full resize-none rounded-control border border-mint-light bg-white px-3 py-3 text-sm leading-5 text-ink outline-none focus:border-mint" />
                  <span className="mt-1 block text-right text-[10px] text-ink-soft">{caption.length}/120</span>
                </label>

                {publishStatus === 'error' ? (
                  <div className="mt-3 rounded-control bg-coral-light p-3">
                    <p className="text-xs font-bold text-ink">AI 点评没有生成成功</p>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">{publishError}</p>
                  </div>
                ) : null}

                <button type="button" onClick={() => void publishPost()} disabled={selectedItemIds.length < 2 || selectedItemIds.length > 3 || !caption.trim()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-control bg-mint py-3 text-sm font-bold text-white disabled:opacity-50">
                  <Send size={16} /> {publishStatus === 'error' ? '重试并发布' : '让 AI 点评并发布'}
                </button>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default Community;
