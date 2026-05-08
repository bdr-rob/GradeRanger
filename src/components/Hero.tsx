import React from 'react';

interface HeroProps {
  onScanClick: () => void;
  onDealFinderClick: () => void;
}

export default function Hero({ onScanClick, onDealFinderClick }: HeroProps) {
  return (
    <div className="relative bg-gradient-to-br from-[#14314F] via-[#47682d] to-[#14314F] text-white overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <img 
          src="/hero-background.webp"
          alt="Hero Background"
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Built for the Complete Card Cycle
          </h1>
          <p className="text-xl md:text-2xl text-[#ABD2BE] mb-8 max-w-3xl mx-auto">
          From research and deal finding to grading decisions and selling—without bouncing between platforms.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onScanClick}
              className="bg-[#47682d] hover:bg-[#47682d]/90 text-white px-8 py-4 rounded-lg text-lg font-semibold transition shadow-lg hover:shadow-xl"
            >
              🔍 Scan Your First Card
            </button>
            <button 
              onClick={onDealFinderClick}
              className="bg-white text-[#14314F] hover:bg-gray-100 px-8 py-4 rounded-lg text-lg font-semibold transition shadow-lg hover:shadow-xl"
            >
              💎 Find Deals Now
            </button>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#47682d]">98%</div>
              <div className="text-sm text-[#ABD2BE]">Accuracy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#47682d]">50K+</div>
              <div className="text-sm text-[#ABD2BE]">Cards Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#47682d]">$2M+</div>
              <div className="text-sm text-[#ABD2BE]">Deals Found</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
