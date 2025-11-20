import React, { useState, useEffect } from 'react';
import { getAssetPath } from '../config/basePath';
import RulesModal from './RulesModal';

const Footer = ({ withTabBar = false }) => {
  const [showRules, setShowRules] = useState(false);
  const [lastUpdatedDate, setLastUpdatedDate] = useState(null);

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/backend/metadata.json`)
      .then(res => res.json())
      .then(data => setLastUpdatedDate(data.last_updated))
      .catch(err => console.error("Failed to load metadata:", err));
  }, []);

  return (
    <>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      
      <footer className={`mt-0 sm:mt-12 text-center text-slate-600 text-xs space-y-3 ${withTabBar ? 'mb-24' : 'mb-6'} sm:mb-8`}>

      {/* Explainer Button */}
      <div className="mb-2">
          <button 
            onClick={() => setShowRules(true)}
            className="text-slate-400 hover:text-white font-heading text-sm uppercase tracking-wider underline decoration-slate-600 underline-offset-4 hover:decoration-white transition-all"
          >
            HOW TO PLAY
          </button>
        </div>

        {/* Data Via Section */}
        <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold text-slate-500 bg-slate-900/50 py-2 px-4 rounded-xl sm:rounded-full border border-slate-800 mx-auto">
           
           {/* Mobile: Row 1 / Desktop: Part of Row */}
           <div className="flex items-center gap-2">
               <img src={getAssetPath('nba.png')} alt="NBA" className="h-3 sm:h-4 w-auto opacity-70" />
               <span className="opacity-50">+</span>
               <img src={getAssetPath('nfl.png')} alt="NFL" className="h-3 sm:h-4 w-auto opacity-70" />
               <span className="mx-1 opacity-50">DATA VIA</span>
               <a href="https://www.sports-reference.com/" target="_blank" rel="noreferrer" className="hover:opacity-100 transition-opacity opacity-70">
                 <img src={getAssetPath('Sports_Reference_Logo.svg')} alt="Sports Reference" className="h-3 w-auto" style={{ filter: 'grayscale(100%) brightness(1.5)' }} />
               </a>
           </div>

           {/* Mobile: Row 2 / Desktop: Part of Row (Separated by border) */}
           <div className="hidden sm:block h-3 border-l border-slate-700 opacity-50"></div>
           
           {lastUpdatedDate && (
             <div>
                 <span className="opacity-50">UPDATED {lastUpdatedDate}</span>
             </div>
           )}
        </div>

        <div>
           <div className="flex justify-center gap-4 mt-1">
              <a href="mailto:patmc225@gmail.com" className="hover:text-brand-blue">Contact</a>
              <a href="https://x.com/BallKnowerGame" target="_blank" rel="noreferrer" className="hover:text-brand-blue">Twitter / X</a>
           </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;

