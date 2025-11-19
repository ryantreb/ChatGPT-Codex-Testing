'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold">SecOps AI</h1>
        </div>
        <nav className="space-y-1 p-4">
          <a
            href="/app/chat"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100"
          >
            Chat
          </a>
          <a
            href="/app/agents"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100"
          >
            Agents
          </a>
          <a
            href="/app/detections"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100"
          >
            Detections
          </a>
          <a
            href="/app/audit-logs"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100"
          >
            Audit Logs
          </a>
          <a
            href="/app/settings"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100"
          >
            Settings
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="text-lg font-semibold">Welcome, {user?.name || user?.email}</div>
          <button
            onClick={logout}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
          >
            Logout
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
