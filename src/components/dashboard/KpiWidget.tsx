'use client';

import React from 'react';
import { OverviewMetrics } from '@/types/dashboard';
import { CheckCircle2, Clock, AlertTriangle, Layers } from 'lucide-react';

interface KpiWidgetProps {
  metrics: OverviewMetrics;
}

export function KpiWidget({ metrics }: KpiWidgetProps) {
  const cards = [
    {
      title: '전체 업무 완료율',
      value: `${metrics.completionRate}%`,
      subtitle: `${metrics.completedTasks}개 완료 / 총 ${metrics.totalTasks}개`,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      progress: metrics.completionRate,
    },
    {
      title: '현재 진행 중인 업무',
      value: `${metrics.inProgressTasks}개`,
      subtitle: '3개 팀 합산 진행 중',
      icon: Clock,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      title: '긴급/주의 필요 업무',
      value: `${metrics.urgentTasks}개`,
      subtitle: '우선순위 긴급 미완료 태스크',
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      title: '총 등록된 업무 수',
      value: `${metrics.totalTasks}개`,
      subtitle: '기획 / 디자인 / 개발 전사',
      icon: Layers,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{card.title}</span>
              <div className={`p-2 rounded-xl border ${card.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-foreground">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
            </div>

            {card.progress !== undefined && (
              <div className="mt-3 w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
