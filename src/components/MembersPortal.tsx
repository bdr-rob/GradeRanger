import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, Package, Search, Star, DollarSign, BarChart3 } from 'lucide-react';

export default function MembersPortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('portfolio');

  const portfolioStats = {
    totalValue: 45678.90,
    totalGain: 8234.50,
    gainPercent: 22.3,
    totalCards: 156,
    topPerformer: 'Mike Trout RC PSA 10',
    topGain: 2500.00
  };

  const researchHistory = [
    { player: 'Mike Trout', date: '2025-10-08', result: 'PSA 9 Prediction' },
    { player: 'LeBron James', date: '2025-10-07', result: 'PSA 10 Prediction' },
    { player: 'Tom Brady', date: '2025-10-06', result: 'PSA 8 Prediction' }
  ];

  const savedSearches = [
    { name: 'Rookie Cards Under $500', filters: 'Baseball, Rookie, Max $500', lastRun: '2025-10-08' },
    { name: 'High Grade Potential', filters: 'All Sports, Score > 4.0', lastRun: '2025-10-07' }
  ];

  const submissions = [
    { id: 'PSA-12345', player: 'Mike Trout', status: 'Grading', submitted: '2025-09-15', expected: '2025-11-15' },
    { id: 'BGS-67890', player: 'LeBron James', status: 'Received', submitted: '2025-09-20', grade: 'BGS 9.5' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-[#14314F] mb-6">My Portal</h2>

      {user && (
        <div className="mb-6 rounded-lg border border-[#47682d]/40 bg-[#47682d]/10 px-4 py-3 text-sm text-[#14314F]">
          <p className="font-semibold mb-1">Build your portfolio in the member workspace</p>
          <p className="text-gray-700 mb-2">
            Add cards, track value, and soon see grading decision tools—all in one place.
          </p>
          <Link
            to="/portal"
            className="inline-block font-semibold text-[#47682d] hover:underline"
          >
            Open your portal →
          </Link>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
        {[
          { id: 'portfolio', label: 'Portfolio', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'history', label: 'Research History', icon: <TrendingUp className="w-4 h-4" /> },
          { id: 'searches', label: 'Saved Searches', icon: <Search className="w-4 h-4" /> },
          { id: 'submissions', label: 'Submissions', icon: <Package className="w-4 h-4" /> },
          { id: 'watchlist', label: 'Watchlist', icon: <Star className="w-4 h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-semibold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-[#47682d] border-b-2 border-[#47682d]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {/* Portfolio Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Portfolio Value</span>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">${portfolioStats.totalValue.toLocaleString()}</p>
              <p className="text-sm text-green-600 mt-1">
                +${portfolioStats.totalGain.toLocaleString()} ({portfolioStats.gainPercent}%)
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Cards</span>
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{portfolioStats.totalCards}</p>
              <p className="text-sm text-gray-600 mt-1">Across all collections</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Top Performer</span>
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-sm font-bold text-gray-900">{portfolioStats.topPerformer}</p>
              <p className="text-sm text-purple-600 mt-1">+${portfolioStats.topGain.toLocaleString()}</p>
            </div>
          </div>

          {/* Action Button */}
          <Link 
            to={user ? "/portal/portfolio" : "/login"}
            className="inline-block bg-[#47682d] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#47682d]/90 transition"
          >
            {user ? 'Manage portfolio →' : 'Sign in to manage portfolio →'}
          </Link>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {researchHistory.map((item, i) => (
            <div key={i} className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#47682d] transition">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-[#14314F]">{item.player}</h3>
                  <p className="text-sm text-gray-600">{item.result}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{item.date}</p>
                  <button className="text-[#47682d] text-sm hover:underline">View Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'searches' && (
        <div className="space-y-3">
          {savedSearches.map((search, i) => (
            <div key={i} className="border-2 border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-[#14314F]">{search.name}</h3>
                <button className="bg-[#47682d] text-white px-4 py-1 rounded-lg text-sm hover:bg-[#47682d]/90">
                  Run Search
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-1">{search.filters}</p>
              <p className="text-xs text-gray-500">Last run: {search.lastRun}</p>
            </div>
          ))}
          <button className="w-full border-2 border-dashed border-[#47682d] rounded-lg p-4 text-[#47682d] hover:bg-[#47682d]/5 transition">
            + Create New Saved Search
          </button>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="space-y-3">
          {submissions.map((sub, i) => (
            <div key={i} className="border-2 border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-[#14314F]">{sub.player}</h3>
                  <p className="text-sm text-gray-600">ID: {sub.id}</p>
                  <p className="text-sm text-gray-600">Submitted: {sub.submitted}</p>
                  {sub.grade && <p className="text-sm font-bold text-[#47682d] mt-1">Grade: {sub.grade}</p>}
                  {sub.expected && <p className="text-sm text-gray-500">Expected: {sub.expected}</p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  sub.status === 'Received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {sub.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'watchlist' && (
        <div className="space-y-4">
          <p className="text-gray-600">
            Track cards you are watching for price drops or availability.
          </p>
          <Link
            to={user ? '/watchlist' : '/login'}
            className="inline-block bg-[#47682d] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#47682d]/90 transition"
          >
            {user ? 'Open watchlist →' : 'Sign in for watchlist →'}
          </Link>
        </div>
      )}
    </div>
  );
}