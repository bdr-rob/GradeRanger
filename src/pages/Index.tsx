import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AnnouncementPopup from '@/components/AnnouncementPopup';
import {
  Shield, Zap, BarChart3, Star, ChevronRight, Award,
  TrendingUp, Eye, Clock, CheckCircle, ArrowRight,
  BookOpen, Newspaper
} from 'lucide-react';

export default function Index() {
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);

  // ALL hooks must be declared before any conditional return
  useEffect(() => {
    if (user) return; // Don't show popup to logged-in users
    const lastShown = localStorage.getItem('gr_popup_date');
    const today = new Date().toDateString();
    if (lastShown === today) return;
    const timer = setTimeout(() => {
      setShowPopup(true);
      localStorage.setItem('gr_popup_date', today);
    }, 20000);
    return () => clearTimeout(timer);
  }, [user]);

  // Redirect logged-in users — safe to do AFTER all hooks
  if (user) return <Navigate to="/portal" replace />;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                 style={{ backgroundColor: '#14314F' }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold" style={{ color: '#14314F' }}>
              Grade Ranger
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#news" className="hover:text-gray-900 transition-colors">News</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
              style={{ color: '#14314F' }}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors"
              style={{ backgroundColor: '#47682d' }}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
               style={{ backgroundColor: '#ABD2BE30', borderColor: '#47682d40', color: '#47682d' }}>
            <Zap className="w-3 h-3" />
            AI-Powered Card Grading Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-none"
              style={{ color: '#14314F' }}>
            Grade Smarter.<br />
            <span style={{ color: '#47682d' }}>Collect Confidently.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Professional AI card grading for sports cards and TCG. Scan, identify, grade,
            and track your collection — all in one platform built for serious collectors.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg shadow-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#47682d' }}
            >
              Start Grading Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg border-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#14314F', color: '#14314F' }}
            >
              Sign In <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────── */}
      <section className="py-12 border-y border-gray-100" style={{ backgroundColor: '#14314F' }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {[
            { value: '50,000+', label: 'Cards Graded' },
            { value: '99.2%', label: 'Accuracy Rate' },
            { value: '< 2 min', label: 'Average Grade Time' },
            { value: '10,000+', label: 'Active Collectors' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-extrabold mb-1">{stat.value}</div>
              <div className="text-sm opacity-70">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#14314F' }}>
              How It Works
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              From scan to grade in minutes — no expertise required.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', icon: <Eye className="w-6 h-6" />, title: 'Scan Your Cards', desc: 'Use your scanner or upload photos. We support front & back capture with auto-alignment.' },
              { step: '02', icon: <Zap className="w-6 h-6" />, title: 'AI Identifies', desc: 'Our AI instantly identifies the card — player, year, set, variation, and parallel.' },
              { step: '03', icon: <Award className="w-6 h-6" />, title: 'Get Graded', desc: 'Receive a detailed AI grade with centering, corners, edges, and surface analysis.' },
              { step: '04', icon: <TrendingUp className="w-6 h-6" />, title: 'Track Value', desc: 'Monitor market prices, portfolio value, and grading history over time.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-black mb-4 opacity-10" style={{ color: '#14314F' }}>
                  {item.step}
                </div>
                <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center text-white"
                     style={{ backgroundColor: '#14314F' }}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: '#14314F' }}>{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6" style={{ backgroundColor: '#f8faf9' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#14314F' }}>
              Everything You Need
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Built for professional collectors who demand accuracy and efficiency.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Shield className="w-5 h-5" />, title: 'AI Grade Prediction', desc: 'Multi-model AI delivers PSA/BGS-comparable grades with detailed sub-grade breakdowns.' },
              { icon: <Zap className="w-5 h-5" />, title: 'Batch Scanning', desc: 'Scan dozens of cards at once. Our queue system handles bulk imports with ease.' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Portfolio Analytics', desc: 'Track cost basis, current value, ROI, and market trends across your entire collection.' },
              { icon: <Star className="w-5 h-5" />, title: 'Card Recognition', desc: 'Identifies 99%+ of sports and TCG cards including rare variants and error cards.' },
              { icon: <Clock className="w-5 h-5" />, title: 'Grading History', desc: 'Full audit trail of every grade — compare AI predictions against actual PSA results.' },
              { icon: <CheckCircle className="w-5 h-5" />, title: 'Market Pricing', desc: 'Real-time eBay sold data and marketplace integration for accurate valuations.' },
            ].map((feature) => (
              <div key={feature.title}
                   className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 text-white"
                     style={{ backgroundColor: '#47682d' }}>
                  {feature.icon}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: '#14314F' }}>{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWS / ANNOUNCEMENTS ─────────────────────────────── */}
      <section id="news" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#14314F' }}>
              Latest News
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Updates, features, and insights from the Grade Ranger team.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                tag: 'Product Update',
                date: 'June 2026',
                title: 'AI Recognition v2.0 Launched',
                excerpt: 'Our new Ximilar-powered recognition engine now identifies cards with 99.2% accuracy across all major sports and TCG sets.',
                icon: <Zap className="w-4 h-4" />,
              },
              {
                tag: 'Blog',
                date: 'May 2026',
                title: 'How to Grade Cards Like a PSA Expert',
                excerpt: 'A deep dive into the four grading pillars — centering, corners, edges, and surface — and how AI is transforming the process.',
                icon: <BookOpen className="w-4 h-4" />,
              },
              {
                tag: 'Announcement',
                date: 'April 2026',
                title: 'Batch Scanning Now Live',
                excerpt: 'You can now scan entire boxes in one session. Our queue system handles up to 500 cards per batch with full AI identification.',
                icon: <Newspaper className="w-4 h-4" />,
              },
            ].map((post) => (
              <div key={post.title}
                   className="rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: '#47682d' }}>
                      {post.icon} {post.tag}
                    </span>
                    <span className="text-xs text-gray-400">{post.date}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2 leading-snug" style={{ color: '#14314F' }}>
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{post.excerpt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6" style={{ backgroundColor: '#14314F' }}>
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-4xl font-extrabold mb-4">Ready to Start Grading?</h2>
          <p className="text-lg opacity-70 mb-10">
            Join thousands of collectors using Grade Ranger to protect and grow their collection.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#47682d', color: 'white' }}
            >
              Create Free Account <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg border-2 border-white/40 text-white hover:border-white transition-colors"
            >
              Sign In <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center"
                 style={{ backgroundColor: '#14314F' }}>
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: '#14314F' }}>Grade Ranger</span>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Grade Ranger. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <a href="#" className="hover:text-gray-700 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* ── ANNOUNCEMENT POPUP ──────────────────────────────── */}
      {showPopup && <AnnouncementPopup onClose={() => setShowPopup(false)} />}
    </div>
  );
}