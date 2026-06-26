import { useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ScanLine, Award, Tag,
  LogOut, Shield, Microscope, Settings,
  Package, LayoutDashboard,
} from 'lucide-react';

// ── Pipeline stages in the sidebar ───────────────────────────────────────────

interface PipelineStage {
  key: string;
  label: string;
  icon: React.ReactNode;
  to: string;
  stageParam?: string;  // ?stage=xxx on /portal
  end?: boolean;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    key:        'pipeline',
    label:      'Pipeline',
    icon:       <LayoutDashboard className="w-4 h-4 shrink-0" />,
    to:         '/portal',
    end:        true,
  },
  {
    key:        'intake',
    label:      'Scan',
    icon:       <ScanLine className="w-4 h-4 shrink-0" />,
    to:         '/portal/intake',
  },
  {
    key:        'grading',
    label:      'Grading',
    icon:       <Award className="w-4 h-4 shrink-0" />,
    to:         '/portal/grading',
  },
  {
    key:        'listed',
    label:      'Listings',
    icon:       <Tag className="w-4 h-4 shrink-0" />,
    to:         '/portal/listings',
  },
  {
    key:        'collection',
    label:      'Collection',
    icon:       <Package className="w-4 h-4 shrink-0" />,
    to:         '/portal/portfolio',
  },
];

// ── Tools (non-pipeline) ──────────────────────────────────────────────────────

const TOOL_ITEMS = [
  { to: '/portal/research', label: 'Research', icon: <Microscope className="w-4 h-4 shrink-0" /> },
  { to: '/portal/settings', label: 'Settings',  icon: <Settings   className="w-4 h-4 shrink-0" /> },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  // Card counts per status (for pipeline badge)
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadCounts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cards')
      .select('status')
      .eq('user_id', user.id);
    if (!data) return;
    const c: Record<string, number> = {};
    data.forEach((row) => { c[row.status] = (c[row.status] ?? 0) + 1; });
    setCounts(c);
  }, [user]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  // Re-fetch counts on card changes (lightweight real-time)
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('layout-counts')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'cards',
        filter: `user_id=eq.${user.id}`,
      }, loadCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadCounts]);

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

  function stageCount(key: string): number {
    return counts[key] ?? 0;
  }

  // Is a given pipeline stage "active" in the current location?
  function isPipelineActive(stage: PipelineStage): boolean {
    const path = location.pathname;
    if (stage.key === 'pipeline') {
      return path === '/portal';
    }
    return path.startsWith(stage.to);
  }

  const activeStyle = { backgroundColor: '#14314F' };

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

        {/* Pipeline nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Pipeline header */}
          <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Pipeline
          </p>

          {PIPELINE_STAGES.map((stage) => {
            const active = isPipelineActive(stage);
            const count = stage.key !== 'intake' && stage.key !== 'pipeline' && stage.key !== 'collection'
              ? stageCount(stage.key)
              : null;

            return (
              <NavLink
                key={stage.key}
                to={stage.to}
                end={stage.end}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors group
                  ${active ? 'text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
                style={active ? activeStyle : undefined}
              >
                {stage.icon}
                <span className="flex-1 truncate">{stage.label}</span>
                {count !== null && count > 0 && (
                  <span className={`
                    text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                    ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}
                  `}>
                    {count}
                  </span>
                )}
              </NavLink>
            );
          })}

          {/* Divider + Tools section */}
          <div className="pt-3 pb-1">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Tools
            </p>
          </div>

          {TOOL_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
              style={({ isActive }) => isActive ? activeStyle : undefined}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          {/* Admin */}
          {isAdmin && (
            <NavLink
              to="/portal/admin"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
              style={({ isActive }) => isActive ? activeStyle : undefined}
            >
              <Shield className="w-4 h-4 shrink-0" />
              Admin
            </NavLink>
          )}
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
        <div className="px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
