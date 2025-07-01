'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Transfer {
  from: string;
  amount: number;
  timestamp: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [goal] = useState(40);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [earningsData, setEarningsData] = useState<{
    totalAmount: number;
    goal: number;
    transfers: Transfer[];
  }>({
    totalAmount: 0,
    goal: goal,
    transfers: [],
  });

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
    signIn('google');
  };

  const fetchTransfers = useCallback(async (force: boolean = false) => {
    // Prevent fetching if less than 5 minutes have passed since last fetch
    const now = Date.now();
    if (!force && now - lastFetchTime < 5 * 60 * 1000) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/gmail');
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401 || data.error?.includes('Gmail API error')) {
          // If session expired or Gmail API error, sign out and redirect to sign in
          handleSignOut();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(data.error || 'Failed to fetch transfers');
      }

      const totalAmount = data.transfers.reduce((sum: number, t: Transfer) => sum + t.amount, 0);

      setEarningsData({
        totalAmount,
        goal,
        transfers: data.transfers,
      });
      setLastFetchTime(now);
    } catch (err: any) {
      console.error('Error fetching transfers:', err);
      setError(err.message || 'Failed to fetch transfers. Please try again later.');
      
      // If error persists after retry, sign out and redirect to sign in
      if (err.message?.includes('Gmail API error')) {
        handleSignOut();
      }
    } finally {
      setLoading(false);
    }
  }, [goal, lastFetchTime, handleSignOut]);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/');
      return;
    }

    fetchTransfers(false);
  }, [session, status, router, fetchTransfers]);

  const progressPercentage = (earningsData.totalAmount / goal) * 100;

  if (status === 'loading' || !session) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (loading && !earningsData.transfers.length) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-lg text-gray-600">Loading transfers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="text-lg text-red-600">{error}</div>
          {!error.includes('Session expired') && (
            <button
              onClick={() => fetchTransfers(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
            >
              Try Again
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
          >
            Sign Out and Sign In Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today's Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Today's Overview</h2>
          <button
            onClick={() => fetchTransfers(true)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {/* Goal Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: €{earningsData.totalAmount.toFixed(2)} / €{goal.toFixed(2)}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {progressPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500">Number of Orders</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{earningsData.transfers.length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500">Average Order Value</h3>
            <p className="mt-2 text-2xl font-semibold text-primary">
              €{earningsData.transfers.length > 0 ? (earningsData.totalAmount / earningsData.transfers.length).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>

        {/* Recent Transfers */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Transfers</h3>
          {earningsData.transfers.length > 0 ? (
            <div className="space-y-3">
              {earningsData.transfers.map((transfer, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{transfer.from.replace(/<\/?(?:strong|br)>/g, '')}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(transfer.timestamp), 'HH:mm')}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-primary">
                    €{transfer.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No transfers found for today
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 