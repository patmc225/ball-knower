import React from 'react';
import { ArcadeButton } from './ArcadeUI';
import { getAssetPath } from '../config/basePath';

const RulesModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-[60] p-4 animate-fade-in">
    <div className="bg-card-bg border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col text-white relative">
      <div className="p-4 border-b border-slate-700">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-heading tracking-wide text-white mb-1">BALL KNOWER</h1>
            <p className="text-md font-heading text-slate-400 uppercase tracking-widest flex items-center gap-1">
              the ultimate
              <img src={getAssetPath('nba.png')} alt="NBA" className="h-4 w-auto opacity-70" />
              <span>+</span>
              <img src={getAssetPath('nfl.png')} alt="NFL" className="h-4 w-auto opacity-70" />
              trivia challenge
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 overflow-y-auto space-y-6 custom-scrollbar">
        <section>
            <h3 className="text-xl font-heading text-slate-300 mb-2">How to Play</h3>
            <ul className="list-disc pl-5 space-y-3 text-slate-400 text-sm">
              <li>Take turns naming NFL/NBA players and their connections (Team, Number, College).</li>
              <li>Player 1 starts with <span className="text-white font-bold">ANY</span> player.</li>
              <li>Player 2 must link that player to a <span className="text-brand-blue font-bold">Team</span>, <span className="text-brand-blue font-bold">Number</span>, or <span className="text-brand-blue font-bold">College</span>.</li>
              <li>Player 1 then names a <span className="text-brand-pink font-bold">NEW player</span> who shares that connection.</li>
              <li>Chain continues: Player → Attribute → Player → Attribute...</li>
              <li>60 second timer per turn.</li>
              <li>Any incorrect response will result in a loss.</li>
            </ul>
        </section>
        <section>
            <h3 className="text-xl font-heading text-slate-300 mb-4">Special Moves</h3>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="font-heading text-lg text-brand-pink mb-2">CHALLENGE</h4>
                    <p className="text-xs text-slate-400">Think your opponent is stuck? Challenge them! If they can't prove their link by naming another attribute, you win.</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="font-heading text-lg text-brand-blue mb-2">REVERSE</h4>
                    <p className="text-xs text-slate-400">Know another answer for the current prompt? Hit "Reverse" to flip the turn back to your opponent. Can't reverse twice in a row.</p>
                </div>
            </div>
        </section>
        <section>
            <h3 className="text-xl font-heading text-slate-300 mb-2">Rarity Scores</h3>
            <p className="text-slate-400 text-sm mb-3">Every player, team, college, and jersey number has a rarity score (60-100) that corresponds to how many users have played it. Rarity scores are updated daily.</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400 text-sm">
              <li><span className="text-slate-200 font-bold">Galaxy (100)</span> (First and only player to play it)</li>
              <li><span className="text-yellow-400 font-bold">Legendary (95-99)</span></li>
              <li><span className="text-purple-400 font-bold">Epic (90-94)</span></li>
              <li><span className="text-blue-400 font-bold">Rare (80-89)</span></li>
              <li><span className="text-green-400 font-bold">Uncommon (70-79)</span></li>
              <li><span className="text-slate-400 font-bold">Common (60-69)</span></li>
            </ul>
        </section>

        <section className="mt-6 pt-6 border-t border-slate-700">
            <h3 className="text-xl font-heading text-brand-pink mb-2">Daily Challenge</h3>
            <p className="text-slate-400 text-sm mb-3">Connect two specific players or teams in as few moves as possible.</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400 text-sm">
              <li>A new start and end point is given every day.</li>
              <li>Try to use as few moves as possible.</li>
              <li>Use the same connection rules as competitive play.</li>
            </ul>
        </section>
      </div>
      <div className="p-4 border-t border-slate-700">
        <ArcadeButton onClick={onClose} className="w-full" size="lg">GOT IT</ArcadeButton>
      </div>
    </div>
  </div>
);

export default RulesModal;

