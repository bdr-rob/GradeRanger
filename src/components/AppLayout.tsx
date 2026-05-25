import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navigation from './Navigation';
import Hero from './Hero';
import Dashboard from './Dashboard';
import CardScanner from './CardScanner';
import DealFinder from './DealFinder';
import MarketResearch from './MarketResearch';
import MembersPortal from './MembersPortal';
import AdminPanel from './AdminPanel';
import GradingHistory from './GradingHistory';
import Footer from './Footer';

export default function AppLayout() {
  const [currentSection, setCurrentSection] = useState('home');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleNavigate = (section: string) => {
    if (section === 'members' && user) {
      navigate('/portal');
      return;
    }
    setCurrentSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onNavigate={handleNavigate} currentSection={currentSection} />
      
      {currentSection === 'home' && (
        <>
          <Hero 
            onScanClick={() => handleNavigate('scanner')}
            onDealFinderClick={() => handleNavigate('deals')}
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Dashboard onNavigate={handleNavigate} />
          </div>
        </>
      )}

      {currentSection === 'scanner' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <CardScanner />
        </div>
      )}

      {currentSection === 'deals' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <DealFinder />
        </div>
      )}

      {currentSection === 'research' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <MarketResearch />
          <div className="mt-8">
            <GradingHistory />
          </div>
        </div>
      )}

      {currentSection === 'members' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <MembersPortal />
        </div>
      )}

      {currentSection === 'admin' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <AdminPanel />
        </div>
      )}

      <Footer />
    </div>
  );
}
