import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Scan, Brain, TrendingUp, Package,
  BarChart3, ShoppingBag, ArrowRight,
} from 'lucide-react';
import AnnouncementPopup from '@/components/AnnouncementPopup';

const FEATURES = [
  { icon: <Scan className="h-6 w-6" />, title: 'Batch Card Scanning', description: 'Scan multiple cards at once using your Ricoh scanner or upload photos. Front and back captured in a single pass.' },
  { icon: <Brain className="h-6 w-6" />, title: 'AI Card Recognition', description: 'Instantly identify sports cards and TCG cards. Player, set, year, and card number all auto-populated.' },
  { icon: <TrendingUp className="h-6 w-6" />, title: 'AI Grade Prediction', description: 'Get a preliminary grade before sending to PSA, BGS, or SGC. Corners, edges, surface, and centering analyzed.' },
  { icon: <BarChart3 className="h-6 w-6" />, title: 'Market Pricing', description: 'Real-time pricing from eBay and major marketplaces. Know what your cards are worth before you list.' },
  { icon: <Package className="h-6 w-6" />, title: 'Grading Management', description: 'Track bundles through PSA, BGS, SGC from submission to return. Turnaround tracking and grade recording.' },
  { icon: <ShoppingBag className="h-6 w-6" />, title: 'Listing & Sales', description: 'Manage marketplace listings, record sales, and track ROI across your entire inventory.' },
];

const STEPS = [
  { step: '01', title: 'Scan or Upload', description: 'Use your Ricoh scanner for high-resolution duplex scans, or upload photos from any device.' },
  { step: '02', title: 'Auto-Identify', description: 'AI recognizes the card — sport, player, year, set, and card number returned in seconds.' },
  { step: '03', title: 'Grade & Price', description: 'Get an AI grade prediction and live market value before deciding to submit for grading.' },
  { step: '04', title: 'Manage & Sell', description: 'Track your portfolio, manage grading submissions, and list cards across marketplaces.' },
];

// Placeholder posts — will be replaced by Supabase CMS data
const POSTS = [
  { tag: 'Announcement', title: 'AI Card Grading Now Live', date: 'June 11, 2026', excerpt: 'Our AI grading engine is now available in beta. Get preliminary grades for sports cards and TCG cards before submitting to PSA or BGS.' },
  { tag: 'Guide', title: 'Getting Started with Batch Scanning', date: 'June 10, 2026', excerpt: 'Learn how to use your Ricoh fi-8170 with Grade Ranger to process dozens of cards per hour with duplex scanning.' },
  { tag: 'Update', title: 'Portal v2.0 Released', date: 'June 8, 2026', excerpt: 'The new member portal brings a redesigned collection dashboard, grading bundle tracker, and market value panels.' },
];

export default function Index() {
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);

  // Redirect logged-in users straight to portal
  if (user) return <Navigate to="/portal" replace />;

  useEffect(() => {
    const lastShown = localStorage.getItem('gr_popup_date');
    const today = new Date().toDateString();
    if (lastShown === today) return;

    const timer = setTimeout(() => {
      setShowPopup(true);
      localStorage.setItem('gr_popup_date', today);
    }, 20000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <img src="/grade-ranger-logo.png" alt="Grade Ranger" className="h-8 w-8 object-contain" />
              <span className="text-lg font-bold text-[#14314F]">Grade Ranger</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
              <a href="#features" className="hover:text-[#14314F] transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-[#14314F] transition-colors">How It Works</a>
              <a href="#news" className="hover:text-[#14314F] transition-colors">News</a>
            </nav>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="text-gray-600">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="bg-[#47682d] hover:bg-[#47682d]/90 text-white">
                <Link to="/signup">Get started <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="bg-[#14314F] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-sm text-[#ABD2BE] mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#47682d] animate-pulse" />
              Now in beta — AI card grading is live
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              The professional platform for serious card dealers
            </h1>
            <p className="text-lg text-[#ABD2BE] mb-8 max-w-2xl">
              Scan, identify, grade, and sell sports cards and TCG collections at scale.
              AI-powered recognition and grade prediction built for high-volume dealers.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#47682d] hover:bg-[#47682d]/90 text-white">
                <Link to="/signup">Start for free <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                <Link to="/login">Log in to portal</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <section className="bg-[#47682d] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-3 divide-x divide-white/20 text-center">
            {[
              { value: '11M+', label: 'Cards in database' },
              { value: '99.5%', label: 'Recognition accuracy' },
              { value: 'PSA · BGS · SGC', label: 'Grading services' },
            ].map((s) => (
              <div key={s.label} className="px-4">
                <p className="text-xl sm:text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-white/70 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#14314F]">How it works</h2>
            <p className="text-gray-500 mt-3">From scan to sale in four steps</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {STEPS.map((s) => (
              <div key={s.step}>
                <div className="text-5xl font-bold text-[#47682d]/15 mb-2">{s.step}</div>
                <h3 className="text-lg font-semibold text-[#14314F] mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#14314F]">Everything you need</h2>
            <p className="text-gray-500 mt-3">Built specifically for dealers who process volume</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-gray-100 hover:border-[#47682d]/30 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#47682d]/10 flex items-center justify-center text-[#47682d] mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-[#14314F] mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── News / Announcements ──────────────────────────────── */}
      <section id="news" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-[#14314F]">Latest news</h2>
            <p className="text-gray-500 mt-2">Updates, announcements, and guides</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {POSTS.map((p) => (
              <div key={p.title} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-sm transition-shadow">
                <span className="text-xs font-semibold text-[#47682d] uppercase tracking-wide">{p.tag}</span>
                <h3 className="font-semibold text-[#14314F] mt-2 mb-2">{p.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{p.excerpt}</p>
                <p className="text-xs text-gray-400">{p.date}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────── */}
      <section className="py-20 bg-[#14314F] text-white">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to scale your card business?</h2>
          <p className="text-[#ABD2BE] mb-8">
            Join dealers already using Grade Ranger to process more cards,
            make smarter grading decisions, and maximize returns.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" className="bg-[#47682d] hover:bg-[#47682d]/90 text-white">
              <Link to="/signup">Get started free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <img src="/grade-ranger-logo.png" alt="" className="h-5 w-5 object-contain" />
            <span>© 2026 Grade Ranger. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link to="/terms" className="hover:text-gray-600">Terms</Link>
            <Link to="/account/delete" className="hover:text-gray-600">Account deletion</Link>
          </div>
        </div>
      </footer>

      {/* ── Popup ─────────────────────────────────────────────── */}
      {showPopup && <AnnouncementPopup onClose={() => setShowPopup(false)} />}
    </div>
  );
}