// TabBar 负责五个核心页面的固定底部导航与当前路由选中态。
import {
  Home,
  Shirt,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

interface TabItem {
  label: string
  path: string
  icon: LucideIcon
}

const tabs: TabItem[] = [
  { label: '今日', path: '/', icon: Home },
  { label: '衣橱', path: '/wardrobe', icon: Shirt },
  { label: '工作室', path: '/studio', icon: Sparkles },
  { label: '灵感', path: '/community', icon: UsersRound },
  { label: '我的', path: '/me', icon: UserRound },
]

function TabBar() {
  return (
    <nav
      aria-label="底部导航"
      className="absolute inset-x-0 bottom-0 z-30 h-[88px] border-t border-[#EEE8DF] bg-white/95 px-2 pb-4 pt-2 backdrop-blur"
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ label, path, icon: Icon }) => (
          <li key={path}>
            <NavLink
              to={path}
              end={path === '/'}
              aria-label={label}
              className={({ isActive }) =>
                `mx-auto flex w-[58px] flex-col items-center gap-1 rounded-control py-1.5 text-[11px] font-bold transition-colors ${
                  isActive
                    ? 'bg-mint-light text-mint'
                    : 'text-ink-soft hover:text-ink'
                }`
              }
            >
              <Icon aria-hidden="true" size={21} strokeWidth={2.4} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default TabBar
