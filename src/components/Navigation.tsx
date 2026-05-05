import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  onNavigate?: (section: string) => void;
  currentSection?: string;
}

export default function Navigation({ onNavigate, currentSection }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: '📊' },
    { id: 'scanner', label: 'AI Scanner', icon: '🔍' },
    { id: 'deals', label: 'Deal Finder', icon: '💎' },
    { id: 'research', label: 'Research', icon: '📈' },
    { id: 'members', label: 'My Portal', icon: '👤' },
    { id: 'admin', label: 'Admin', icon: '⚙️' }
  ];

  return (
    <nav className="bg-[#14314F] text-[#ABD2BE] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center shrink-0" aria-label="Grade Ranger home">
              <img
                src="/grade-ranger-logo.svg"
                alt="Grade Ranger"
                className="h-9 w-auto max-w-[200px] object-contain"
              />
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            {onNavigate && navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-4 py-2 rounded-lg transition ${
                  currentSection === item.id 
                    ? 'bg-[#47682d] text-white' 
                    : 'hover:bg-[#47682d]/20'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
            
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" className="text-[#ABD2BE]">Dashboard</Button>
                </Link>
                <Link to="/watchlist">
                  <Button variant="ghost" className="text-[#ABD2BE]">Watchlist</Button>
                </Link>
                <Button onClick={signOut} variant="ghost" className="text-[#ABD2BE]">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-[#ABD2BE]">Login</Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-[#47682d] text-white">Sign Up</Button>
                </Link>
              </>
            )}
          </div>

          <button 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-[#14314F] border-t border-[#47682d]/30">
          {onNavigate && navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setMobileMenuOpen(false); }}
              className="block w-full text-left px-4 py-3 hover:bg-[#47682d]/20"
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
          {user ? (
            <>
              <Link to="/dashboard" className="block px-4 py-3 hover:bg-[#47682d]/20">Dashboard</Link>
              <Link to="/watchlist" className="block px-4 py-3 hover:bg-[#47682d]/20">Watchlist</Link>
              <button onClick={signOut} className="block w-full text-left px-4 py-3 hover:bg-[#47682d]/20">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="block px-4 py-3 hover:bg-[#47682d]/20">Login</Link>
              <Link to="/signup" className="block px-4 py-3 hover:bg-[#47682d]/20">Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
