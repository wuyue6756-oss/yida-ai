// PhoneFrame 负责模拟 iPhone 14 机身、状态栏与应用滚动区域。
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isPublicDemo } from '../config'

interface PhoneFrameProps {
  children: ReactNode
}

function PhoneFrame({ children }: PhoneFrameProps) {
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [pathname])
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#E9E7E2] p-3">
      <section
        aria-label="衣搭 AI 移动端原型"
        className="relative h-[844px] max-h-[calc(100dvh-24px)] w-[390px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[46px] border-[8px] border-[#19191D] bg-bg shadow-card"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 z-50 h-[28px] w-[126px] -translate-x-1/2 rounded-b-[18px] bg-[#19191D]" />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-[46px] items-center justify-between px-[22px] text-[11px] font-bold text-ink">
          <span>9:41</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="tracking-[-2px]">▮▮▮</span>
            <span>⌁</span>
            <span className="rounded-[4px] border border-ink px-1 text-[9px] leading-[13px]">
              100
            </span>
          </span>
        </header>

        <div ref={scrollRef} className="phone-scrollbar h-full overflow-y-auto pb-[94px] pt-[46px]">
          {isPublicDemo && <aside className="bg-cream-light px-4 py-2 text-[10px] leading-4 text-ink" aria-label="公开演示说明">公开演示 · Mock · 数据仅保存在当前浏览器<br /><a href="../" className="font-bold underline">查看项目说明与真实联调证据 ↗</a></aside>}
          {children}
        </div>
      </section>
    </main>
  )
}

export default PhoneFrame
