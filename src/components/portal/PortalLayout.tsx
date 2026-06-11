import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, ScanLine, Award, List,
  TrendingUp, Settings, LogOut, Shield, ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/portal', label: 'Collection', icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, end: true },
  { to: '/portal/intake', label: 'Add Cards', icon: <ScanLine className="w-4 h-4 shrink-0" /> },
  { to: '/portal/portfolio', label: 'Portfolio', icon: <TrendingUp className="w-4 h-4 shrink-0" /> },
  { to: '/portal/grading', label: 'Grading', icon: <Award className="w-4 h-4 shrink-0" /> },
  { to: '/portal/listings', label: 'Listings', icon: <List className="w-4 h-4 shrink-0" /> },
  { to: '/portal/admin', label: 'Admin', icon: <Shield className="w-4 h-4 shrink-0" />, adminOnly: true },
];

export default function PortalLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(data?.role === 'admin'));
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#14314F' }}
            >
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: '#14314F' }}>
              Grade Ranger
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
              style={({ isActive }) =>
                isActive ? { backgroundColor: '#14314F' } : {}
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User / Sign out */}
        <div className="px-3 py-4 border-t border-gray-100 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}