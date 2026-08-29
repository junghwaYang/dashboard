import type { Metadata } from 'next';
import './globals.css';
import { DashboardProvider } from '@/context/dashboard-context';
import { Navbar } from '@/components/common/Navbar';
import { Sidebar } from '@/components/common/Sidebar';

export const metadata: Metadata = {
  title: '업무현황 대시보드 | Workspace Dashboard',
  description: '기획팀, 디자인팀, 개발팀 업무 현황을 한눈에 관리하는 대시보드',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background antialiased flex flex-col">
        <DashboardProvider>
          <Navbar />
          <div className="flex flex-1 max-w-7xl w-full mx-auto">
            <Sidebar />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
              {children}
            </main>
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
