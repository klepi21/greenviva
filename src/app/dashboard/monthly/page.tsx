'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';

interface MonthlyTotal {
  month: string;
  totalAmount: number;
  numberOfTransfers: number;
}

export default function MonthlyOverviewPage() {
  const { data: session, status } = useSession();
  const [monthlyData, setMonthlyData] = useState<MonthlyTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(2025);

  const fetchMonthlyData = async (year: number) => {
    try {
      setLoading(true);
      setLoadingProgress(null);
      setError(null);

      const response = await fetch(`/api/gmail/monthly?year=${year}`);
      if (!response.ok) {
        throw new Error('Failed to fetch monthly data');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream not available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                throw new Error(data.error);
              }

              if (data.type === 'progress') {
                setLoadingProgress({
                  current: data.current,
                  total: data.total
                });
              } else if (data.type === 'data') {
                // Create a map of all months in the year with zero values
                const allMonths = eachMonthOfInterval({
                  start: startOfYear(new Date(year, 0)),
                  end: endOfYear(new Date(year, 0))
                }).map(date => ({
                  month: format(date, 'MMMM yyyy'),
                  totalAmount: 0,
                  numberOfTransfers: 0
                }));

                // Merge actual data with the zero-value months
                const mergedData = allMonths.map(month => {
                  const actualData = data.monthlyTotals.find(
                    (d: MonthlyTotal) => d.month === month.month
                  );
                  return actualData || month;
                });

                setMonthlyData(mergedData);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching monthly data:', err);
      setError('Failed to fetch monthly data. Please try again later.');
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && session) {
      fetchMonthlyData(selectedYear);
    } else if (status === 'unauthenticated') {
      setError('Please sign in to view monthly data');
    }
  }, [status, session]);

  const yearOptions = [2023, 2024, 2025];
  
  const totalYearlyAmount = monthlyData.reduce((sum, month) => sum + month.totalAmount, 0);
  const totalYearlyTransfers = monthlyData.reduce((sum, month) => sum + month.numberOfTransfers, 0);

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
          <h2 className="text-xl font-semibold text-gray-900">Monthly Overview</h2>
          <div className="flex gap-3">
            <select
              value={selectedYear}
              onChange={(e) => {
                const year = Number(e.target.value);
                setSelectedYear(year);
                fetchMonthlyData(year);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              onClick={() => fetchMonthlyData(selectedYear)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Yearly Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500">Total Yearly Amount</h3>
            <p className="mt-2 text-2xl font-semibold text-primary">
              €{totalYearlyAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500">Total Yearly Orders</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{totalYearlyTransfers}</p>
          </div>
        </div>

        {error ? (
          <div className="text-center py-6 text-red-600">{error}</div>
        ) : loading ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-gray-500">Loading monthly data...</div>
            {loadingProgress && (
              <div className="max-w-md mx-auto">
                <div className="text-sm text-gray-500 mb-2">
                  Processing emails: {loadingProgress.current} of {loadingProgress.total}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : monthlyData.length > 0 ? (
          <div className="space-y-4">
            {monthlyData.map((monthData, index) => (
              <div
                key={index}
                className={`flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${
                  monthData.numberOfTransfers === 0 ? 'opacity-50' : ''
                }`}
              >
                <div>
                  <h3 className="font-medium text-gray-900">{monthData.month}</h3>
                  <p className="text-sm text-gray-500">{monthData.numberOfTransfers} orders</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-primary">
                    €{monthData.totalAmount.toFixed(2)}
                  </p>
                  {monthData.numberOfTransfers > 0 && (
                    <p className="text-sm text-gray-500">
                      avg €{(monthData.totalAmount / monthData.numberOfTransfers).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            No data available for {selectedYear}
          </div>
        )}
      </div>
    </div>
  );
} 