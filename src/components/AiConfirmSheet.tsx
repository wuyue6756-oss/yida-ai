// AI 识别确认卡允许用户在入库前校正关键服装信息。
import { Check, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GarmentRecognition } from '../ai/client';
import type { Category, Season, Style } from '../types';

interface AiConfirmSheetProps {
  recognition: GarmentRecognition;
  notice?: string;
  onCancel: () => void;
  onConfirm: (recognition: GarmentRecognition) => void;
}

const categories: Category[] = ['外套', '上装', '下装', '连衣裙', '鞋', '包', '配饰'];
const seasons: Season[] = ['春', '夏', '秋', '冬'];
const styles: Style[] = ['通勤', '温柔', '运动', '甜美', '复古', '简约', '学院', '街头'];

const toggleValue = <T extends string>(values: T[], value: T): T[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

function AiConfirmSheet({ recognition, notice, onCancel, onConfirm }: AiConfirmSheetProps) {
  const [draft, setDraft] = useState<GarmentRecognition>(recognition);
  const [colorText, setColorText] = useState(recognition.colors.join('、'));

  useEffect(() => {
    setDraft(recognition);
    setColorText(recognition.colors.join('、'));
  }, [recognition]);

  const handleConfirm = () => {
    const colors = colorText
      .split(/[、,，]/)
      .map((color) => color.trim())
      .filter(Boolean)
      .slice(0, 3);
    onConfirm({ ...draft, colors: colors.length ? colors : ['未识别'] });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-ink/30 p-[10px]" role="dialog" aria-modal="true" aria-label="确认 AI 识别结果">
      <section className="phone-scrollbar max-h-[calc(100%_-_38px)] w-full overflow-y-auto rounded-card bg-bg p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1 text-xs font-bold text-mint">
              <Sparkles size={14} /> AI 识别完成
            </p>
            <h2 className="mt-1 text-lg font-bold text-ink">确认单品信息</h2>
          </div>
          <button type="button" onClick={onCancel} className="rounded-full bg-white p-2 text-ink-soft" aria-label="关闭确认卡">
            <X size={18} />
          </button>
        </div>

        {notice ? (
          <p className="mt-3 rounded-control bg-cream-light px-3 py-2 text-xs leading-5 text-ink">
            {notice}
          </p>
        ) : null}

        <label className="mt-4 block text-xs font-bold text-ink">
          单品名称
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className="mt-2 w-full rounded-control border border-mint-light bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint"
          />
        </label>

        <label className="mt-3 block text-xs font-bold text-ink">
          分类
          <select
            value={draft.category}
            onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as Category }))}
            className="mt-2 w-full rounded-control border border-mint-light bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint"
          >
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>

        <label className="mt-3 block text-xs font-bold text-ink">
          颜色（最多 3 个，用顿号分隔）
          <input
            value={colorText}
            onChange={(event) => setColorText(event.target.value)}
            className="mt-2 w-full rounded-control border border-mint-light bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-mint"
          />
        </label>

        <fieldset className="mt-3">
          <legend className="text-xs font-bold text-ink">适合季节</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {seasons.map((season) => {
              const active = draft.seasons.includes(season);
              return (
                <button
                  key={season}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, seasons: toggleValue(current.seasons, season) }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-mint text-white' : 'bg-white text-ink-soft'}`}
                >
                  {season}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-3">
          <legend className="text-xs font-bold text-ink">风格标签</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {styles.map((style) => {
              const active = draft.styles.includes(style);
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, styles: toggleValue(current.styles, style).slice(-3) }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? 'bg-mint text-white' : 'bg-white text-ink-soft'}`}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4 flex items-center justify-between rounded-control bg-sky-light px-3 py-2 text-xs text-ink">
          <span>面料：{draft.material}</span>
          <span>把握度 {Math.round(draft.confidence * 100)}%</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="rounded-control bg-white py-3 text-sm font-bold text-ink-soft">
            重新选择
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!draft.name.trim() || draft.seasons.length === 0 || draft.styles.length === 0}
            className="flex items-center justify-center gap-1 rounded-control bg-mint py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Check size={16} /> 确认入库
          </button>
        </div>
      </section>
    </div>
  );
}

export default AiConfirmSheet;
