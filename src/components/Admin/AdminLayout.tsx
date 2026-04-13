import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Users, LogOut, Trophy,
  User, ChevronLeft, ChevronRight, Shield, Target, Layers, LayoutDashboard,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  soon?: boolean;
}

export type AdminSection = 'dashboard' | 'usuarios' | 'campanhas' | 'faixas' | 'missoes' | 'comprar-pontos';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeSection?: AdminSection;
}

export default function AdminLayout({ children, activeSection }: AdminLayoutProps) {
  const { profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const nav: NavItem[] = [
    { label: 'Dashboard',  icon: <LayoutDashboard className="w-[18px] h-[18px]" />, href: '/admin?tab=dashboard' },
    { label: 'Usuários',   icon: <Users className="w-[18px] h-[18px]" />,           href: '/admin?tab=usuarios'  },
    { label: 'Campanhas',  icon: <Layers className="w-[18px] h-[18px]" />,          href: '/admin?tab=campanhas' },
    { label: 'Missões',    icon: <Target className="w-[18px] h-[18px]" />,          href: '/admin?tab=missoes'   },
    { label: 'Faixas',     icon: <Shield className="w-[18px] h-[18px]" />,          href: '/admin?tab=faixas'    },
  ];

  const sectionMap: Record<AdminSection, string> = {
    dashboard: '/admin?tab=dashboard',
    usuarios: '/admin?tab=usuarios',
    campanhas: '/admin?tab=campanhas',
    missoes: '/admin?tab=missoes',
    faixas: '/admin?tab=faixas',
    'comprar-pontos': '/admin/comprar-pontos',
  };

  return (
    <div className="min-h-screen bg-stone-50 flex font-sans">
      {/* ── Sidebar ── */}
      <aside className={cn(
        'fixed top-0 left-0 h-full bg-white border-r border-stone-200 flex flex-col z-20 transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-stone-100 flex-shrink-0">
          <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-[14px] font-bold text-zinc-900 tracking-tight leading-none">Indika</p>
              <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Admin</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="px-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Gestão</p>
          )}
          {nav.map(item => {
            const isActive = activeSection && sectionMap[activeSection] === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all',
                  isActive
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-zinc-500 hover:bg-stone-50 hover:text-zinc-900',
                  item.soon && 'opacity-40 pointer-events-none'
                )}
              >
                <span className={cn('flex-shrink-0', isActive ? 'text-amber-600' : 'text-zinc-400')}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="pt-3 mt-2 border-t border-stone-100">
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Acesso</p>
            )}
            <Link
              to="/user"
              title={collapsed ? 'Área do Usuário' : undefined}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-zinc-400 hover:bg-stone-50 hover:text-zinc-900 transition-all"
            >
              <User className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>Ver como Usuário</span>}
            </Link>
          </div>
        </nav>

        {/* User info + Logout */}
        <div className="flex-shrink-0 border-t border-stone-100 p-2 space-y-1">
          {!collapsed && (
            <div className="px-2.5 py-2.5 rounded-lg bg-zinc-950 mb-1">
              <p className="text-xs font-semibold text-zinc-200 truncate">{profile?.nome} {profile?.sobrenome}</p>
              <p className="text-[10px] text-zinc-500 truncate">{profile?.email}</p>
            </div>
          )}
          <button
            onClick={() => signOut(auth)}
            title={collapsed ? 'Sair' : undefined}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1 text-stone-300 hover:text-zinc-500 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className={cn(
        'flex-1 min-h-screen transition-all duration-200',
        collapsed ? 'ml-14' : 'ml-56'
      )}>
        {children}
      </div>
    </div>
  );
}
