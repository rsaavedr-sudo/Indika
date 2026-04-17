import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Users, LogOut, Trophy,
  User, ChevronLeft, ChevronRight, Shield, Target, Layers, LayoutDashboard,
  DollarSign, Settings2, ClipboardList,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  soon?: boolean;
}

export type AdminSection = 'dashboard' | 'usuarios' | 'campanhas' | 'faixas' | 'missoes' | 'comprar-pontos' | 'withdrawals' | 'finance' | 'surveys';

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
    { label: 'Pesquisas',  icon: <ClipboardList className="w-[18px] h-[18px]" />,   href: '/admin?tab=surveys'   },
    { label: 'Faixas',     icon: <Shield className="w-[18px] h-[18px]" />,          href: '/admin?tab=faixas'    },
  ];

  const financeNav: NavItem[] = [
    { label: 'Saques Pix',   icon: <DollarSign className="w-[18px] h-[18px]" />, href: '/admin?tab=withdrawals' },
    { label: 'Configurações', icon: <Settings2 className="w-[18px] h-[18px]" />,  href: '/admin?tab=finance'     },
  ];

  const sectionMap: Record<AdminSection, string> = {
    dashboard: '/admin?tab=dashboard',
    usuarios: '/admin?tab=usuarios',
    campanhas: '/admin?tab=campanhas',
    missoes: '/admin?tab=missoes',
    faixas: '/admin?tab=faixas',
    'comprar-pontos': '/admin/comprar-pontos',
    withdrawals: '/admin?tab=withdrawals',
    finance: '/admin?tab=finance',
    surveys: '/admin?tab=surveys',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* ── Sidebar ── */}
      <aside className={cn(
        'fixed top-0 left-0 h-full bg-[#0A2540] border-r border-blue-900/20 flex flex-col z-20 transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-blue-800/30 flex-shrink-0">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-[13px] font-light text-[#60A5FA]">武</span>
          </div>
          {!collapsed && (
            <div>
              <p className="text-[14px] font-bold text-white tracking-tight leading-none">Indika</p>
              <p className="text-[9px] font-semibold text-white/70 uppercase tracking-widest">Admin</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="px-2 text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Gestão</p>
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
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:bg-white/5 hover:text-white',
                  item.soon && 'opacity-40 pointer-events-none'
                )}
              >
                <span className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-white/70')}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}

          {/* Finance section */}
          <div className="pt-3 mt-2 border-t border-blue-800/30 space-y-0.5">
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Financeiro</p>
            )}
            {financeNav.map(item => {
              const isActive = activeSection && sectionMap[activeSection] === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/80 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <span className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-white/70')}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="pt-3 mt-2 border-t border-blue-800/30">
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Acesso</p>
            )}
            <Link
              to="/user"
              title={collapsed ? 'Área do Usuário' : undefined}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all"
            >
              <User className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>Ver como Usuário</span>}
            </Link>
          </div>
        </nav>

        {/* User info + Logout */}
        <div className="flex-shrink-0 border-t border-blue-800/30 p-2 space-y-1">
          {!collapsed && (
            <div className="px-2.5 py-2.5 rounded-lg bg-white/10 mb-1">
              <p className="text-xs font-semibold text-white truncate">{profile?.nome} {profile?.sobrenome}</p>
              <p className="text-[10px] text-white/70 truncate">{profile?.email}</p>
            </div>
          )}
          <button
            onClick={() => signOut(auth)}
            title={collapsed ? 'Sair' : undefined}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-white/80 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1 text-white/50 hover:text-white/80 transition-colors"
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
