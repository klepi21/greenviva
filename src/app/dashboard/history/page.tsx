'use client';

import { useState, useEffect } from 'react';
import { format, isAfter, startOfToday, parseISO } from 'date-fns';
import { useSession } from 'next-auth/react';

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

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const today = startOfToday();
  const dailyGoal = 40; // Daily earnings goal in euros
  
  const [selectedDate, setSelectedDate] = useState<string>(
    format(today, 'yyyy-MM-dd')
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [syncService, setSyncService] = useState<any>(null);

  // Initialize sync service when session is available
  useEffect(() => {
    if (session) {
      const { SyncService } = require('@/lib/sync');
      const service = new SyncService();
      setSyncService(service);
      
      // Initialize and load tips
      service.initialize().then(() => {
        return service.getTipsByDate(selectedDate);
      }).then((loadedTips: Tip[]) => {
        setTips(loadedTips);
        setLoading(false);
      }).catch((err: Error) => {
        console.error('Error initializing sync service:', err);
        setError('Failed to load tips. Please try again later.');
        setLoading(false);
      });
    }
  }, [session, selectedDate]);

  const fetchTransfers = async (date: string) => {
    try {
      console.log('Fetching transfers for date:', date);
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/gmail?date=${date}`);
      console.log('API Response status:', response.status);
      
      const data = await response.json();
      console.log('API Response data:', data);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to view transfers');
        }
        if (response.status === 429) {
          throw new Error('Too many requests. Please try again in a few minutes.');
        }
        if (response.status === 503) {
          throw new Error('Connection error. Please check your internet connection and try again.');
        }
        throw new Error(data.error || 'Failed to fetch transfers');
      }
      
      setTransfers(data.transfers || []);

      // Load tips for the selected date
      if (syncService) {
        try {
          const dateTips = await syncService.getTipsByDate(date);
          setTips(dateTips);
        } catch (tipError) {
          console.error('Error loading tips:', tipError);
          // Don't fail the whole operation if tips fail to load
        }
      }
    } catch (err) {
      console.error('Error fetching transfers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transfers. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && session) {
      console.log('Session authenticated, fetching transfers');
      fetchTransfers(selectedDate);
    } else if (status === 'unauthenticated') {
      console.log('User is not authenticated');
      setError('Please sign in to view transfers');
    }
  }, [status, session, selectedDate]);

  const handleDateChange = (date: string) => {
    const selectedDateTime = new Date(date);
    if (isAfter(selectedDateTime, today)) {
      setError('Cannot select future dates');
      return;
    }
    setError(null);
    setSelectedDate(date);
  };

  // Filter tips for selected date
  const selectedDateTips = tips.filter(tip => tip.date.startsWith(selectedDate));
  const totalTips = selectedDateTips.reduce((sum, tip) => sum + tip.amount, 0);
  const totalTransfers = transfers.reduce((sum, t) => sum + t.amount, 0);
  const totalAmount = totalTransfers + totalTips;
  const progressPercentage = (totalAmount / dailyGoal) * 100;

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Transfer History</h2>
          <div className="flex gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const date = e.target.value;
                const selectedDateTime = new Date(date);
                if (isAfter(selectedDateTime, today)) {
                  setError('Cannot select future dates');
                  return;
                }
                setError(null);
                setSelectedDate(date);
                fetchTransfers(date);
              }}
              max={format(today, 'yyyy-MM-dd')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={() => fetchTransfers(selectedDate)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Amount Card */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500">Total Amount</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-2xl font-semibold text-primary">€{totalAmount.toFixed(2)}</p>
                <p className="ml-2 text-sm text-gray-500">/ €{dailyGoal}</p>
                {totalTips > 0 && (
                  <p className="ml-2 text-sm text-green-600">(+€{totalTips.toFixed(2)} tips)</p>
                )}
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Number of Orders Card */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500">Number of Orders</h3>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {transfers.length}
                {selectedDateTips.length > 0 && (
                  <span className="text-sm text-green-600 ml-2">
                    (+{selectedDateTips.length} tips)
                  </span>
                )}
              </p>
            </div>

            {/* Average Order Value Card */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500">Average Order Value</h3>
              <p className="mt-2 text-2xl font-semibold text-primary">
                €{transfers.length > 0 ? (totalTransfers / transfers.length).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="text-center py-6 text-red-600">{error}</div>
        ) : loading ? (
          <div className="text-center py-6 text-gray-500">Loading transfers...</div>
        ) : transfers.length > 0 || selectedDateTips.length > 0 ? (
          <div className="space-y-3">
            {/* Tips */}
            {tips.map((tip) => (
              <div
                key={tip.id}
                className="flex justify-between items-center p-3 bg-green-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    Cash Tips{tip.note && ` - ${tip.note}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(parseISO(tip.date), 'HH:mm')}
                  </p>
                </div>
                <span className="text-lg font-semibold text-green-600">
                  €{tip.amount.toFixed(2)}
                </span>
              </div>
            ))}
            {/* Regular Transfers */}
            {transfers.map((transfer, index) => {
              // Clean up the 'from' field by removing HTML tags
              const cleanFrom = transfer.from.replace(/<\/?(?:strong|br)>/g, '').trim();
              
              return (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{cleanFrom}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(transfer.timestamp), 'HH:mm')}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-primary">
                    €{transfer.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            No activity found for this date
          </div>
        )}
      </div>
    </div>
  );
} 