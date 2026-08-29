'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '@/context/dashboard-context';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  Users, 
  Database, 
  ChevronDown, 
  Check, 
  Sparkles,
  LogOut,
  LogIn
} from 'lucide-react';
import { Profile, TeamId } from '@/types/dashboard';

export function Navbar() {
  const { currentProfile, setCurrentProfile, profiles, isSupabaseConnected } = useDashboard();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getTeamBadgeColor = (teamId: TeamId | null, role: string) => {
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

  const getTeamName = (teamId: TeamId | null, role: string) => {
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
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
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
                Supabase 연결됨
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                데모 / 로컬 모드
              </span>
            )}
          </div>
        </div>

        {/* Right section: Profile & Quick Demo Switcher */}
        <div className="flex items-center gap-3">
          {/* Demo User Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-2 rounded-lg border border-border bg-card hover:bg-accent/60 transition shadow-sm"
              title="클릭하여 다른 팀 계정으로 전환해 권한 격리를 테스트해보세요"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentProfile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentProfile.full_name}
                  className="h-8 w-8 rounded-full object-cover border border-border"
                />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
              <div className="hidden md:flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground leading-none">{currentProfile.full_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${getTeamBadgeColor(currentProfile.team_id, currentProfile.role)}`}>
                    {getTeamName(currentProfile.team_id, currentProfile.role)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5">{currentProfile.email}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setIsDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-border/60 mb-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">권한 테스트 (계정 전환)</p>
                    <span className="text-[10px] text-primary flex items-center gap-0.5 font-medium">
                      <Sparkles className="h-3 w-3" /> 팀별 격리 테스트
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    계정을 변경하여 각 팀별 접근 권한 제한을 확인하세요.
                  </p>
                </div>

                <div className="space-y-1">
                  {profiles.map((p) => {
                    const isSelected = p.id === currentProfile.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setCurrentProfile(p)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition ${
                          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={p.full_name}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                          <div>
                            <div className="font-semibold">{p.full_name}</div>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold border ${getTeamBadgeColor(p.team_id, p.role)}`}>
                              {getTeamName(p.team_id, p.role)}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between px-1">
                  <Link
                    href="/onboarding"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 p-1 rounded transition"
                  >
                    <Users className="h-3.5 w-3.5" /> 팀 변경/온보딩
                  </Link>
                  <Link
                    href="/login"
                    className="text-xs text-primary hover:underline flex items-center gap-1 p-1"
                  >
                    <LogIn className="h-3.5 w-3.5" /> 로그인 화면
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
