// 衣橱页覆盖筛选、统计、单品维护与完整的 AI 图片识别入库流程。
import { Camera, Check, Pencil, Shirt, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { recognizeGarment, provider, providerLabel, type GarmentRecognition } from '../ai/client';
import AiConfirmSheet from '../components/AiConfirmSheet';
import EmptyState from '../components/EmptyState';
import GarmentCard from '../components/GarmentCard';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useStore } from '../store/useStore';
import type { Category, Garment } from '../types';
import { getWardrobeStats } from '../utils/wardrobeStats';

type CategoryFilter = '全部' | Category;
type RecognitionStatus = 'idle' | 'loading' | 'confirming' | 'error';

const categoryFilters: CategoryFilter[] = [
  '全部', '上装', '下装', '连衣裙', '外套', '鞋', '包', '配饰',
];

const categoryEmoji: Record<Category, string> = {
  外套: '🧥', 上装: '👚', 下装: '👖', 连衣裙: '👗', 鞋: '👟', 包: '👜', 配饰: '🎀',
};

const readImageAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('图片读取结果无效'));
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });

function Wardrobe() {
  const garments = useStore((state) => state.garments);
  const addGarment = useStore((state) => state.addGarment);
  const updateGarment = useStore((state) => state.updateGarment);
  const deleteGarment = useStore((state) => state.deleteGarment);
  const markWorn = useStore((state) => state.markWorn);

  const [hasHydrated, setHasHydrated] = useState(() => useStore.persist.hasHydrated());
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('全部');
  const [selectedId, setSelectedId] = useState<string>();
  const [editedName, setEditedName] = useState('');
  const [recognitionStatus, setRecognitionStatus] = useState<RecognitionStatus>('idle');
  const [recognition, setRecognition] = useState<GarmentRecognition>();
  const [recognitionNotice, setRecognitionNotice] = useState('');
  const [recognitionError, setRecognitionError] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stopHydrating = useStore.persist.onHydrate(() => setHasHydrated(false));
    const stopHydrated = useStore.persist.onFinishHydration(() => setHasHydrated(true));
    setHasHydrated(useStore.persist.hasHydrated());
    return () => {
      stopHydrating();
      stopHydrated();
    };
  }, []);

  const garmentList = Array.isArray(garments) ? garments : [];
  const selectedGarment = garmentList.find((garment) => garment.id === selectedId);
  const filteredGarments = useMemo(
    () => activeFilter === '全部'
      ? garmentList
      : garmentList.filter((garment) => garment.category === activeFilter),
    [activeFilter, garmentList],
  );
  const wardrobeStats = getWardrobeStats(garmentList);

  const openRecognition = () => fileInputRef.current?.click();

  const runRecognition = async (base64: string) => {
    setRecognitionStatus('loading');
    setRecognitionError('');
    setRecognitionNotice('');
    try {
      const result = await recognizeGarment(base64);
      setRecognition(result.data);
      setRecognitionNotice(
        result.source === 'mock'
          ? result.error
            ? `识别服务暂时不可用，已切换演示数据：${result.error}`
            : '当前为演示识别结果，可直接修改后入库。'
          : `真实 AI 识别完成 · ${providerLabel[provider]} · source=ai`,
      );
      setRecognitionStatus('confirming');
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : '图片识别失败');
      setRecognitionStatus('error');
    }
  };

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。');
      if (file.size > 3 * 1024 * 1024) throw new Error('图片请控制在 3MB 内，避免本机存储和上传失败。');
      const base64 = await readImageAsBase64(file);
      setImageBase64(base64);
      await runRecognition(base64);
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : '图片读取失败');
      setRecognitionStatus('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openGarment = (garment: Garment) => {
    setSelectedId(garment.id);
    setEditedName(garment.name);
  };

  const confirmRecognition = (result: GarmentRecognition) => {
    addGarment({
      name: result.name.trim(),
      category: result.category,
      colors: result.colors,
      seasons: result.seasons,
      styles: result.styles,
      material: result.material,
      imageUri: imageBase64,
      emoji: categoryEmoji[result.category],
      wearCount: 0,
      source: 'ai',
    });
    setRecognitionStatus('idle');
    setRecognition(undefined);
    setRecognitionNotice('');
  };

  const handleDelete = () => {
    if (!selectedGarment) return;
    if (window.confirm(`确定删除“${selectedGarment.name}”吗？删除后无法恢复。`)) {
      deleteGarment(selectedGarment.id);
      setSelectedId(undefined);
    }
  };

  if (!hasHydrated) {
    return <div className="min-h-full px-[18px] py-5"><LoadingSkeleton rows={4} label="正在整理你的衣橱" /></div>;
  }

  if (!Array.isArray(garments)) {
    return (
      <div className="min-h-full px-[18px] py-5">
        <EmptyState emoji="🛠️" title="衣橱数据开小差了" description="数据格式暂时无法读取，可以刷新页面后再试。" ctaLabel="刷新页面" onAction={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="min-h-full px-[18px] py-4">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void handleFileChange(event.target.files?.[0])} />

      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold text-mint">WARDROBE</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">我的衣橱</h1>
        </div>
        <p className="pb-1 text-xs font-bold text-ink-soft">{garments.length} 件 · 本周利用率 {wardrobeStats.utilization}%</p>
      </header>

      <section className="mt-4 grid grid-cols-3 gap-2" aria-label="衣橱统计">
        {[
          { label: '总件数', value: `${garments.length}`, tone: 'bg-mint-light' },
          { label: '本周穿搭数', value: `${wardrobeStats.weeklyWornCount}`, tone: 'bg-sky-light' },
          { label: '闲置估值', value: `¥${wardrobeStats.idleValue}`, tone: 'bg-coral-light' },
        ].map((item) => (
          <div key={item.label} className={`rounded-control p-3 ${item.tone}`}>
            <p className="text-lg font-bold text-ink">{item.value}</p>
            <p className="mt-1 text-[10px] text-ink-soft">{item.label}</p>
          </div>
        ))}
      </section>

      <div className="phone-scrollbar -mx-[18px] mt-4 flex gap-2 overflow-x-auto px-[18px] pb-1">
        {categoryFilters.map((filter) => (
          <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${activeFilter === filter ? 'bg-mint text-white' : 'bg-white text-ink-soft'}`}>
            {filter}
          </button>
        ))}
      </div>

      {garments.length === 0 ? (
        <div className="mt-6">
          <EmptyState emoji="👗" title="衣橱还是空空的" description="拍一件你常穿的单品，AI 会帮你自动识别分类与风格。" ctaLabel="拍一张开始识别" onAction={openRecognition} />
        </div>
      ) : (
        <section className="mt-4 grid grid-cols-3 gap-3" aria-label="单品列表">
          <button type="button" onClick={openRecognition} className="flex min-h-[154px] flex-col items-center justify-center rounded-card border-2 border-dashed border-mint bg-mint-light p-3 text-center text-ink">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-mint"><Camera size={20} /></span>
            <span className="mt-2 text-xl" aria-hidden="true">📷</span>
            <span className="mt-1 text-[10px] font-bold leading-4">拍一张<br />AI 自动识别</span>
          </button>
          {filteredGarments.map((garment) => <GarmentCard key={garment.id} garment={garment} onClick={openGarment} />)}
        </section>
      )}

      {garments.length > 0 && filteredGarments.length === 0 ? (
        <div className="mt-4 rounded-card bg-white p-5 text-center shadow-card">
          <Shirt className="mx-auto text-mint" size={30} />
          <p className="mt-2 text-sm font-bold text-ink">这个分类还没有单品</p>
          <button type="button" onClick={openRecognition} className="mt-3 rounded-control bg-mint px-4 py-2 text-xs font-bold text-white">添加一件</button>
        </div>
      ) : null}

      {recognitionStatus === 'loading' ? (
        <div className="absolute inset-0 z-40 flex items-center bg-bg/95 px-[18px]">
          <div className="w-full">
            <p className="mb-4 flex items-center justify-center gap-2 text-sm font-bold text-ink"><Sparkles className="text-mint" size={18} /> AI 正在读懂这件单品…</p>
            <LoadingSkeleton rows={2} label="AI 正在识别单品" />
          </div>
        </div>
      ) : null}

      {recognitionStatus === 'error' ? (
        <div className="absolute inset-0 z-40 flex items-center bg-bg/95 px-[18px]">
          <EmptyState emoji="😵‍💫" title="这张照片没看清" description={recognitionError || '换一张光线更好的单品照片再试试吧。'} ctaLabel={imageBase64 ? '重新识别' : '重新选图'} onAction={() => imageBase64 ? void runRecognition(imageBase64) : openRecognition()} />
          <button type="button" onClick={() => setRecognitionStatus('idle')} className="absolute right-[18px] top-[60px] rounded-full bg-white p-2 text-ink-soft" aria-label="关闭错误提示"><X size={18} /></button>
        </div>
      ) : null}

      {recognitionStatus === 'confirming' && recognition ? (
        <AiConfirmSheet recognition={recognition} notice={recognitionNotice} onCancel={() => setRecognitionStatus('idle')} onConfirm={confirmRecognition} />
      ) : null}

      {selectedGarment ? (
        <div className="absolute inset-0 z-40 flex items-end bg-ink/30 p-[10px]" role="dialog" aria-modal="true" aria-label="编辑单品">
          <section className="w-full rounded-card bg-bg p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-control bg-cream-light text-3xl">
                  {selectedGarment.imageUri ? <img src={selectedGarment.imageUri} alt={selectedGarment.name} className="h-full w-full object-cover" /> : selectedGarment.emoji}
                </span>
                <div>
                  <p className="text-xs text-ink-soft">{selectedGarment.category} · 穿过 {selectedGarment.wearCount} 次</p>
                  <p className="mt-1 text-xs font-bold text-mint">{selectedGarment.styles.join(' · ')}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(undefined)} className="rounded-full bg-white p-2 text-ink-soft" aria-label="关闭单品详情"><X size={18} /></button>
            </div>

            <label className="mt-4 block text-xs font-bold text-ink">
              编辑名称
              <span className="relative mt-2 block">
                <Pencil className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" size={15} />
                <input value={editedName} onChange={(event) => setEditedName(event.target.value)} className="w-full rounded-control border border-mint-light bg-white py-3 pl-9 pr-3 text-sm text-ink outline-none focus:border-mint" />
              </span>
            </label>

            <button type="button" onClick={() => { updateGarment(selectedGarment.id, { name: editedName.trim() }); setSelectedId(undefined); }} disabled={!editedName.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-control bg-mint py-3 text-sm font-bold text-white disabled:opacity-50">
              <Check size={16} /> 保存名称
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { markWorn(selectedGarment.id); setSelectedId(undefined); }} className="rounded-control bg-sky-light py-3 text-sm font-bold text-ink">今天穿了</button>
              <button type="button" onClick={handleDelete} className="flex items-center justify-center gap-1 rounded-control bg-coral-light py-3 text-sm font-bold text-ink"><Trash2 size={15} /> 删除单品</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default Wardrobe;
