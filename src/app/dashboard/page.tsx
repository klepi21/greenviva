'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Transfer {
  from: string;
  amount: number;
  timestamp: string;
}

interface Tip {
  id: string;
  amount: number;
  date: string;
  note?: string;
  synced?: boolean;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [goal] = useState(40);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [tipNote, setTipNote] = useState('');
  const [tipDate, setTipDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tips, setTips] = useState<Tip[]>([]);
  const [syncService, setSyncService] = useState<any>(null);
  const [earningsData, setEarningsData] = useState<{
    totalAmount: number;
    goal: number;
    transfers: Transfer[];
  }>({
    totalAmount: 0,
    goal: goal,
    transfers: [],
  });

  // Initialize sync service when session is available
  useEffect(() => {
    if (session) {
      const { SyncService } = require('@/lib/sync');
      const service = new SyncService();
      setSyncService(service);
      
      // Initialize and load tips
      service.initialize().then(() => {
        return service.getTips();
      }).then((loadedTips: Tip[]) => {
        setTips(loadedTips);
        setLoading(false);
      }).catch((err: Error) => {
        console.error('Error initializing sync service:', err);
        setError('Failed to load tips. Please try again later.');
        setLoading(false);
      });
    }
  }, [session]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  const addTip = async () => {
    if (!tipAmount || !syncService) return;
    
    try {
      const newTip = await syncService.addTip({
        amount: parseFloat(tipAmount),
        date: new Date(`${tipDate}T12:00:00`).toISOString(),
        note: tipNote || undefined
      });

      setTips(prevTips => {
        // Sort tips by date, most recent first
        const newTips = [...prevTips, newTip].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        return newTips;
      });

      setTipAmount('');
      setTipNote('');
      setTipDate(format(new Date(), 'yyyy-MM-dd')); // Reset to today
      setShowTipModal(false);
    } catch (err) {
      console.error('Error adding tip:', err);
      setError('Failed to add tip. Please try again.');
    }
  };

  const removeTip = async (id: string) => {
    if (!syncService) return;
    
    try {
      await syncService.deleteTip(id);
      setTips(prevTips => prevTips.filter(tip => tip.id !== id));
    } catch (err) {
      console.error('Error removing tip:', err);
      setError('Failed to remove tip. Please try again.');
    }
  };

  const getTodaysTips = () => {
    const today = new Date().toISOString().split('T')[0];
    return tips.filter(tip => tip.date.startsWith(today))
      .reduce((sum, tip) => sum + tip.amount, 0);
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
        if (response.status === 401) {
          handleSignOut();
          throw new Error('Session expired. Please sign in again.');
        }
        if (response.status === 429) {
          throw new Error('Too many requests. Please try again in a few minutes.');
        }
        if (response.status === 503) {
          throw new Error('Connection error. Please check your internet connection and try again.');
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
      
      if (err.message?.includes('Session expired')) {
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

    // Only fetch on initial load or when forced
    fetchTransfers(false);
  }, [session, status, router, fetchTransfers]);

  const todaysTips = getTodaysTips();
  const totalWithTips = earningsData.totalAmount + todaysTips;
  const progressPercentage = (totalWithTips / goal) * 100;

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
          <div className="flex gap-2">
            <button
              onClick={() => setShowTipModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
            >
              Add Tips
            </button>
            <button
              onClick={() => fetchTransfers(true)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {/* Goal Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: €{totalWithTips.toFixed(2)} / €{goal.toFixed(2)}
              {todaysTips > 0 && (
                <span className="ml-2 text-green-600">(+€{todaysTips.toFixed(2)} tips)</span>
              )}
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

        {/* Recent Transfers and Tips */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Activity</h3>
          {earningsData.transfers.length > 0 || tips.length > 0 ? (
            <div className="space-y-3">
              {/* Tips */}
              {tips.map((tip) => (
                <div
                  key={tip.id}
                  className={`flex justify-between items-center p-3 ${
                    isToday(parseISO(tip.date)) ? 'bg-green-50' : 'bg-gray-50'
                  } rounded-lg`}
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      Cash Tips{tip.note && ` - ${tip.note}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(tip.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-semibold ${
                      isToday(parseISO(tip.date)) ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      €{tip.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeTip(tip.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {/* Regular Transfers */}
              {earningsData.transfers.map((transfer, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{transfer.from.replace(/<\/?(?:strong|br)>/g, '')}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(transfer.timestamp), 'MMM d, yyyy HH:mm')}
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
              No activity found
            </div>
          )}
        </div>
      </div>

      {/* Add Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Tips</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="tipDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  id="tipDate"
                  value={tipDate}
                  onChange={(e) => setTipDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="tipAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (€)
                </label>
                <input
                  type="number"
                  id="tipAmount"
                  step="0.01"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label htmlFor="tipNote" className="block text-sm font-medium text-gray-700 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  id="tipNote"
                  value={tipNote}
                  onChange={(e) => setTipNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Add a note..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowTipModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addTip}
                  disabled={!tipAmount}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 