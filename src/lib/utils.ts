import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getDaysRemaining(dueDateString: string | null | undefined): {
  days: number;
  label: string;
  isOverdue: boolean;
} {
  if (!dueDateString) return { days: 0, label: '마감일 없음', isOverdue: false };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDateString);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { days: diffDays, label: `D+${Math.abs(diffDays)} 지연`, isOverdue: true };
  } else if (diffDays === 0) {
    return { days: 0, label: 'D-Day 오늘 마감', isOverdue: false };
  } else {
    return { days: diffDays, label: `D-${diffDays}`, isOverdue: false };
  }
}
