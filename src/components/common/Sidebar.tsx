'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboard } from '@/context/dashboard-context';
import { 
  LayoutDashboard, 
  Lightbulb, 
  Palette, 
  Code2, 
  Lock, 
  ShieldCheck, 
  CheckCircle2,
  FolderKanban
} from 'lucide-react';
import { TeamId } from '@/types/dashboard';

interface NavItem {
  id?: TeamId;
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  color?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { currentProfile, canAccessTeam, summaryStats } = useDashboard();

  const mainNavItems: NavItem[] = [
    {
      name: '메인 종합 대시보드',
      href: '/',
      icon: LayoutDashboard,
    },
  ];

  const teamNavItems: NavItem[] = [
    {
      id: 'planning',
      name: '기획팀 워크스페이스',
      href: '/teams/planning',
      icon: Lightbulb,
      color: 'text-blue-500 bg-blue-50 border-blue-200',
    },
    {
      id: 'design',
      name: '디자인팀 워크스페이스',
      href: '/teams/design',
      icon: Palette,
      color: 'text-purple-500 bg-purple-50 border-purple-200',
    },
    {
      id: 'development',
      name: '개발팀 워크스페이스',
      href: '/teams/development',
      icon: Code2,
      color: 'text-emerald-500 bg-emerald-50 border-emerald-200',
    },
  ];

  const getTeamTaskCount = (teamId?: TeamId) => {
    if (!teamId) return 0;
    const stat = summaryStats.find((s) => s.team_id === teamId);
    return stat ? stat.total_count : 0;
  };

  return (
    <aside className="w-64 shrink-0 border-r border-border/80 bg-card min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        {/* Main Section */}
        <div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Overview
          </div>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Teams Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              팀별 워크스페이스
            </span>
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              격리 관리
            </span>
          </div>

          <nav className="space-y-1.5">
            {teamNavItems.map((item) => {
              const isAllowed = item.id ? canAccessTeam(item.id) : true;
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const count = getTeamTaskCount(item.id);
              const isMyTeam = currentProfile.team_id === item.id;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition group ${
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                      : isAllowed
                      ? 'text-foreground hover:bg-accent/70'
                      : 'text-muted-foreground/60 hover:bg-accent/40 cursor-not-allowed opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className={`p-1.5 rounded-lg border ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="truncate">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isMyTeam && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                        내 팀
                      </span>
                    )}
                    {isAllowed ? (
                      <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full font-semibold">
                        {count}
                      </span>
                    ) : (
                      <span title="본인 팀만 조회할 수 있습니다" className="text-muted-foreground/80 flex items-center">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer / Team Security Notice Card */}
      <div className="rounded-xl border border-border/80 bg-secondary/40 p-3.5 text-xs">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>팀 보안 격리(RLS) 적용</span>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {currentProfile.role === 'admin' ? (
            '관리자 계정으로 모든 팀의 업무를 열람 및 관리하고 있습니다.'
          ) : (
            `현재 [${
              currentProfile.team_id === 'planning'
                ? '기획팀'
                : currentProfile.team_id === 'design'
                ? '디자인팀'
                : currentProfile.team_id === 'development'
                ? '개발팀'
                : '팀 미지정'
            }] 소속으로 타 팀의 상세 태스크는 보호됩니다.`
          )}
        </p>
      </div>
    </aside>
  );
}
