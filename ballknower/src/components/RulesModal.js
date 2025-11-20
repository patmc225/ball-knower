import React from 'react';
import { ArcadeButton } from './ArcadeUI';

const RulesModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
    <div className="bg-card-bg border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col text-white relative">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <h2 className="text-4xl font-heading tracking-wide text-brand-blue">GAME RULES</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
        <section>
            <h3 className="text-2xl font-heading text-slate-300 mb-2">How to Play</h3>
            <ul className="list-disc pl-5 space-y-3 text-slate-400">
              <li>Take turns naming NFL/NBA players and their connections (Team, Number, College).</li>
              <li>Player 1 starts with <span className="text-white font-bold">ANY</span> player.</li>
              <li>Player 2 must link that player to a <span className="text-brand-blue font-bold">Team</span>, <span className="text-brand-blue font-bold">Number</span>, or <span className="text-brand-blue font-bold">College</span>.</li>
              <li>Player 1 then names a <span className="text-brand-pink font-bold">NEW player</span> who shares that connection.</li>
              <li>Chain continues: Player → Attribute → Player → Attribute...</li>
              <li>60 second timer per turn.</li>
            </ul>
        </section>
        <section>
            <h3 className="text-2xl font-heading text-slate-300 mb-4">Special Moves</h3>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="font-heading text-xl text-brand-pink mb-2">CHALLENGE</h4>
                    <p className="text-sm text-slate-400">Think your opponent is wrong or stuck? Challenge them! If they can't prove their link (or name another attribute), you win.</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="font-heading text-xl text-brand-blue mb-2">REVERSE</h4>
                    <p className="text-sm text-slate-400">Know another answer for the current prompt? Hit "Reverse" to flip the turn back to your opponent. Can't reverse twice in a row.</p>
                </div>
            </div>
        </section>

        <section className="mt-6 pt-6 border-t border-slate-700">
            <h3 className="text-2xl font-heading text-brand-pink mb-2">Daily Challenge</h3>
            <p className="text-slate-400 mb-3">Connect two specific entities (Players, Teams, Numbers) in as few moves as possible.</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>A new start and end point is given every day.</li>
              <li>Global leaderboard for the shortest path.</li>
              <li>Use the same connection rules as competitive play.</li>
            </ul>
        </section>
      </div>
      <div className="p-6 border-t border-slate-700">
        <ArcadeButton onClick={onClose} className="w-full" size="lg">GOT IT</ArcadeButton>
      </div>
    </div>
  </div>
);

export default RulesModal;

