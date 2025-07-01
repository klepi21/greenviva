'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { useSession, signOut } from 'next-auth/react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();

  const today = new Date();
  const formattedDate = format(today, 'dd/MM/yyyy');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/' });
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-primary">GreenViva</h1>
              </div>
              <div className="hidden sm:flex sm:space-x-4">
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/dashboard')
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Daily Overview
                </Link>
                <Link
                  href="/dashboard/history"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/dashboard/history')
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  History
                </Link>
                <Link
                  href="/dashboard/monthly"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/dashboard/monthly')
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly Overview
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{formattedDate}</span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="grid grid-cols-2 gap-1 p-2">
          <Link
            href="/dashboard"
            className={`flex justify-center items-center py-3 ${
              isActive('/dashboard')
                ? 'text-primary font-medium'
                : 'text-gray-600'
            }`}
          >
            Daily Overview
          </Link>
          <Link
            href="/dashboard/history"
            className={`flex justify-center items-center py-3 ${
              isActive('/dashboard/history')
                ? 'text-primary font-medium'
                : 'text-gray-600'
            }`}
          >
            History
          </Link>
          <Link
            href="/dashboard/monthly"
            className={`flex justify-center items-center py-3 ${
              isActive('/dashboard/monthly')
                ? 'text-primary font-medium'
                : 'text-gray-600'
            }`}
          >
            Monthly Overview
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 sm:pb-8">
        {children}
      </main>
    </div>
  );
} 