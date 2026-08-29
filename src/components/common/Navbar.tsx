'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '@/context/dashboard-context';
import { 
  LayoutDashboard, 
  Database, 
  ChevronDown, 
  Users, 
  LogIn, 
  LogOut, 
  UserCheck,
  Archive
} from 'lucide-react';
import { TeamId } from '@/types/dashboard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WeeklyArchiveModal } from '@/components/archive/WeeklyArchiveModal';

export function Navbar() {
  const { currentProfile, authUser, isSupabaseConnected, signOut, setUserRole, isSuperAdmin } = useDashboard();
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  const getTeamBadgeColor = (teamId: TeamId | null | undefined, role?: string) => {
    if (role === 'admin') return 'bg-amber-100 text-amber-800 border-amber-300';
    switch (teamId) {
      case 'planning':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'design':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'development':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTeamName = (teamId: TeamId | null | undefined, role?: string) => {
    if (role === 'admin') return '총괄 관리자 (전체 열람)';
    switch (teamId) {
      case 'planning':
        return '기획팀';
      case 'design':
        return '디자인팀';
      case 'development':
        return '개발팀';
      default:
        return '팀 미지정';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight hover:opacity-90 transition">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <span className="text-foreground">업무현황 대시보드</span>
            </Link>

            {/* Database status indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
              <Database className="h-3.5 w-3.5 text-primary" />
              {isSupabaseConnected ? (
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Supabase DB 실시간 연결됨
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  연결 확인 중...
                </span>
              )}
            </div>
          </div>

          {/* Right section: Archive Button & Profile / Login */}
          <div className="flex items-center gap-2.5">
            {/* Weekly Archive Button */}
            <button
              onClick={() => setIsArchiveModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-secondary-foreground border border-border transition shadow-sm"
              title="주간 업무 보관함 및 마감 관리"
            >
              <Archive className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">주간 보관함</span>
            </button>

            {/* Profile or Login Button */}
            {authUser ? (
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-accent/60 transition shadow-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        currentProfile?.avatar_url ||
                        authUser?.user_metadata?.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                      }
                      alt={currentProfile?.full_name || 'User'}
                      className="h-8 w-8 rounded-full object-cover border border-border"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                  </div>
                  <div className="hidden md:flex flex-col text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground leading-none">
                        {currentProfile?.full_name || authUser?.email?.split('@')[0] || '사용자'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${getTeamBadgeColor(currentProfile?.team_id, currentProfile?.role)}`}>
                        {getTeamName(currentProfile?.team_id, currentProfile?.role)}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{authUser.email}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64 p-1.5">
                <DropdownMenuLabel className="font-semibold text-xs">내 계정</DropdownMenuLabel>
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {authUser.email}
                </div>
                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link
                    href="/onboarding"
                    className="flex items-center gap-2 cursor-pointer text-xs"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>소속 팀 변경 / 온보딩</span>
                  </Link>
                </DropdownMenuItem>

                {/* Role Switcher (오직 최고관리자 siltarre@gmail.com 계정 전용) */}
                {isSuperAdmin && (
                  <DropdownMenuItem
                    onClick={() => {
                      const newRole = currentProfile?.role === 'admin' ? 'member' : 'admin';
                      setUserRole(newRole);
                    }}
                    className="flex items-center justify-between cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {currentProfile?.role === 'admin'
                          ? '일반 팀원 뷰 시뮬레이션'
                          : '총괄 관리자(Admin) 뷰 전환'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-bold">
                      {currentProfile?.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={signOut}
                  className="flex items-center gap-2 text-destructive cursor-pointer text-xs focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>로그인</span>
            </Link>
          )}
        </div>
      </div>
    </header>

    {/* Weekly Archive & Cycle Management Modal */}
    <WeeklyArchiveModal
      isOpen={isArchiveModalOpen}
      onClose={() => setIsArchiveModalOpen(false)}
      initialTeamId={currentProfile?.team_id || undefined}
    />
  </>
);
}

