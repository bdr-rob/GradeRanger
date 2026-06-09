import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ScanLine,
  Scale,
  ShoppingBag,
  Settings,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[#47682d] text-white'
      : 'text-[#ABD2BE] hover:bg-white/10 hover:text-white',
  );

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/portal', label: 'Collection', icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, end: true },
  { to: '/portal/intake', label: 'Quick scan', icon: <ScanLine className="w-4 h-4 shrink-0" /> },
  { to: '/portal/grading', label: 'Grading', icon: <Scale className="w-4 h-4 shrink-0" /> },
  { to: '/portal/listings', label: 'Listings', icon: <ShoppingBag className="w-4 h-4 shrink-0" /> },
  { to: '/settings', label: 'Settings', icon: <Settings className="w-4 h-4 shrink-0" /> },
  { to: '/portal/admin', label: 'Admin', icon: <Shield className="w-4 h-4 shrink-0" />, adminOnly: true },
];

export default function PortalLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#14314f] text-white shadow-md shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/" className="shrink-0">
                <img
                  src="/grade-ranger-logo.png"
                  alt=""
                  className="h-9 w-9 object-contain"
                />
              </Link>
              <div className="min-w-0">
                <p className="text-xs text-[#ABD2BE] uppercase tracking-wide">Member portal</p>
                <h1 className="text-lg font-bold text-white truncate">Grade Ranger</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#ABD2BE] truncate max-w-[200px]">{user?.email}</span>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[#ABD2BE]/40 text-[#ABD2BE] hover:bg-white/10"
              >
                <Link to="/">
                  Main app
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-[#ABD2BE] hover:text-white"
              >
                <Link to="/profile">Profile</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#ABD2BE] hover:text-white"
                onClick={() => signOut()}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
        <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white md:min-h-[calc(100vh-5rem)]">
          <nav className="p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navLinkClass}
              >
                {item.icon}
                <span className="hidden sm:inline md:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
