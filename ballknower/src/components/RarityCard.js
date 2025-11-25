import React, { useState } from 'react';
import { getAssetPath } from '../config/basePath';
import { getTeamLogoUrl, getCollegeLogoUrl } from '../utils/gameUtils';

export const getRarityClass = (score) => {
    if (score >= 100) return { class: 'GALAXY', color: 'galaxy', bg: 'bg-black border-purple-500/50', numberColor: 'text-purple-900' };
    if (score >= 95) return { class: 'LEGENDARY', color: 'gold', bg: 'bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-200 border-yellow-300/50', numberColor: 'text-yellow-900' };
    if (score >= 90) return { class: 'EPIC', color: 'purple', bg: 'bg-gradient-to-br from-purple-900 via-purple-600 to-purple-400 border-purple-400/50', numberColor: 'text-purple-900' };
    if (score >= 80) return { class: 'RARE', color: 'blue', bg: 'bg-gradient-to-br from-blue-900 via-blue-600 to-blue-400 border-blue-400/50', numberColor: 'text-blue-900' };
    if (score >= 70) return { class: 'UNCOMMON', color: 'green', bg: 'bg-gradient-to-br from-green-900 via-green-600 to-green-400 border-green-400/50', numberColor: 'text-green-800' };
    return { class: 'COMMON', color: 'silver', bg: 'bg-gradient-to-br from-slate-600 via-slate-400 to-slate-200 border-slate-400/50', numberColor: 'text-slate-600' };
};

export const formatTeamName = (teamId, getTeam) => { 
    const team = getTeam ? getTeam(teamId) : null;
    return team ? team.name : teamId || 'Unknown Team';
};

const RarityCard = ({ type, value, rarityScore, playerData, getTeam, isMe, count, clickable = false, onToggleShowcase, isShowcased, isSelectionMode, allPlayersData, popularityData }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [fallbackYear, setFallbackYear] = useState(null);
    const { class: rarityClass, bg, numberColor } = getRarityClass(rarityScore || 100);

    let displayName = value;
    let subtext = "";
    let imageUrl = null;
    let srUrl = "";

    // Helper function to get image URL for a specific year
    const getImageUrlForYear = (playerId, league, year) => {
        if (league === 'NFL') {
            return `https://www.pro-football-reference.com/req/20230307/images/headshots/${playerId}_${year}.jpg`;
        } else if (league === 'NBA') {
            return `https://www.basketball-reference.com/req/202106291/images/headshots/${playerId}_${year}.jpg`;
        }
        return null;
    };

    if (type === 'player' && playerData) {
        displayName = playerData.name;
        const leagueLogo = playerData.league === 'NBA' ? 'nba.png' : (playerData.league === 'NFL' ? 'nfl.png' : null);

        if (playerData.id) {
            if (playerData.league === 'NFL') {
                imageUrl = fallbackYear
                    ? getImageUrlForYear(playerData.id, 'NFL', fallbackYear)
                    : `https://www.pro-football-reference.com/req/20230307/images/headshots/${playerData.id}.jpg`;
                srUrl = `https://www.pro-football-reference.com/players/${playerData.id.charAt(0)}/${playerData.id}.htm`;
            } else if (playerData.league === 'NBA') {
                imageUrl = fallbackYear
                    ? getImageUrlForYear(playerData.id, 'NBA', fallbackYear)
                    : `https://www.basketball-reference.com/req/202106291/images/headshots/${playerData.id}.jpg`;
                srUrl = `https://www.basketball-reference.com/players/${playerData.id.charAt(0)}/${playerData.id}.html`;
            }
        }

        subtext = (
          <div className="flex items-center justify-center gap-1">
             {leagueLogo ? (
                 <img src={getAssetPath(leagueLogo)} alt={playerData.league} className="h-3 w-auto opacity-80" />
             ) : (
                 <span>{playerData.league || 'Pro'}</span>
             )}
             <span>•</span>
             <span>{playerData.start_year}-{playerData.end_year}</span>
          </div>
        );
    } else if (type === 'team') {
        displayName = formatTeamName(value, getTeam);
        subtext = null;
        imageUrl = getTeamLogoUrl(value);
    } else if (type === 'number') {
        displayName = `#${value}`;
        subtext = null;
    } else if (type === 'college') {
        displayName = value;
        subtext = null;
        imageUrl = getCollegeLogoUrl(value);
    }

    const handleCardClick = () => {
        if (clickable || (type !== 'player' && allPlayersData)) {
            setIsFlipped(!isFlipped);
        }
    };

    // Calculate stats for back of card (for non-player cards)
    const getCardStats = () => {
        if (!allPlayersData) return { topPlayers: [], totalCount: 0 };
        
        let relevantPlayers = [];
        if (type === 'team') {
            relevantPlayers = allPlayersData.filter(p => p.teams && p.teams.includes(value));
        } else if (type === 'college') {
            relevantPlayers = allPlayersData.filter(p => p.colleges && p.colleges.includes(value));
        } else if (type === 'number') {
            relevantPlayers = allPlayersData.filter(p => p.numbers && p.numbers.includes(value));
        }

        const totalCount = relevantPlayers.length;
        
        // Sort by popularity (frequency) - Copying logic from api.js searchPlayers
        const topPlayers = relevantPlayers.sort((a, b) => {
            const freqA = a.frequency || 0;
            const freqB = b.frequency || 0;
            return freqB - freqA;
        }).slice(0, 10); // Increased to 15 to fill space better with smaller badges

        return { topPlayers, totalCount };
    };

    const { topPlayers, totalCount } = type !== 'player' ? getCardStats() : { topPlayers: [], totalCount: 0 };

    return (
        <div
            className={`flex flex-col items-center relative ${clickable || (type !== 'player' && allPlayersData) ? 'cursor-pointer group' : ''}`}
            onClick={handleCardClick}
        >
            <div
                className={`flex-none w-40 h-60 relative transition-all duration-500 ${clickable ? 'group-hover:scale-105' : 'hover:scale-105'}`}
            >
                
                {/* Front of Card */}
                <div
                    className={`absolute inset-0 rounded-xl p-3 flex flex-col relative overflow-hidden shadow-xl ${bg} border-2 transition-opacity duration-500`}
                    style={{
                        opacity: isFlipped ? 0 : 1,
                        pointerEvents: isFlipped ? 'none' : 'auto'
                    }}
                >
                     {/* Galaxy Effect Overlay */}
                     {rarityClass === 'GALAXY' && (
                        <>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-50 animate-pulse-slow pointer-events-none"></div>
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-purple-900/30 pointer-events-none"></div>
                        </>
                     )}

                     {/* Showcase Toggle */}
                     {onToggleShowcase && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); onToggleShowcase(); }}
                            className="absolute top-2 left-2 z-30 cursor-pointer hover:scale-110 transition-transform bg-black/60 rounded-full p-1.5 backdrop-blur-sm border border-white/20 shadow-lg ring-1 ring-white/10"
                        >
                            <svg 
                                className={`w-4 h-4 ${isShowcased ? 'text-yellow-400 fill-yellow-400' : 'text-white/70 hover:text-white'}`} 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </div>
                     )}
                     
                     {/* Selection Overlay */}
                     {isSelectionMode && (
                        <div className="absolute inset-0 bg-black/60 z-20 rounded-xl pointer-events-none"></div>
                     )}
                     
                     <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className={`font-heading text-3xl drop-shadow-md leading-none ${rarityClass === 'GALAXY' ? 'text-transparent bg-clip-text bg-gradient-to-br from-purple-300 to-fuchsia-500' : 'text-white'}`}>{rarityScore || 100}</span>
                         <span className="font-mono text-[9px] text-white/90 font-bold tracking-widest uppercase border border-white/40 px-1.5 py-0.5 rounded bg-black/20 backdrop-blur-sm">{rarityClass}</span>
                     </div>
                     
                     <div className="flex-grow flex items-center justify-center relative z-10 py-2">
                         {type === 'number' ? (
                             <div className="flex items-center justify-center h-24">
                                 <span className={`text-6xl font-bold ${numberColor} font-heading drop-shadow-md`}>
                                     {displayName}
                                 </span>
                             </div>
                         ) : type === 'team' || type === 'college' ? (
                             <div className="w-24 h-24 flex items-center justify-center relative">
                                 {imageUrl ? (
                                     <img 
                                         src={imageUrl} 
                                         alt={displayName} 
                                         className="w-full h-full object-contain drop-shadow-xl transform scale-110"
                                         onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} 
                                     />
                                 ) : null}
                                 {type === 'college' && (
                                    <div className="w-full h-full flex items-center justify-center text-black/20" style={{ display: imageUrl ? 'none' : 'flex' }}>
                                       <svg width="800px" height="800px" viewBox="0 0 15 15" className={`w-full h-full ${rarityClass === 'GALAXY' ? 'text-purple-400/300' : 
                                                                                                           rarityClass === 'LEGENDARY' ? 'text-yellow-400/300' :
                                                                                                           rarityClass === 'EPIC' ? 'text-purple-400/300' :
                                                                                                           rarityClass === 'RARE' ? 'text-blue-400/300' :
                                                                                                           rarityClass === 'UNCOMMON' ? 'text-green-400/300' :
                                                                                                           'text-slate-400/300'}`} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                           <path d="M7.5,1L0,4.5l2,0.9v1.7C1.4,7.3,1,7.9,1,8.5s0.4,1.2,1,1.4V10l-0.9,2.1&#xA; C0.8,13,1,14,2.5,14s1.7-1,1.4-1.9L3,10c0.6-0.3,1-0.8,1-1.5S3.6,7.3,3,7.1V5.9L7.5,8L15,4.5L7.5,1z M11.9,7.5l-4.5,2L5,8.4v0.1&#xA; c0,0.7-0.3,1.3-0.8,1.8l0.6,1.4v0.1C4.9,12.2,5,12.6,4.9,13c0.7,0.3,1.5,0.5,2.5,0.5c3.3,0,4.5-2,4.5-3L11.9,7.5L11.9,7.5z"/>
                                       </svg>
                                    </div>
                                 )}
                             </div>
                         ) : (
                             <div className={`w-24 h-24 rounded-full bg-white border-2 border-black/20 flex items-center justify-center overflow-hidden backdrop-blur-sm shadow-inner relative`}>
                                 {imageUrl ? (
                                     <img
                                         src={imageUrl}
                                         alt={displayName}
                                         className="w-3/4 h-auto object-contain"
                                         onError={(e) => {
                                             const currentYear = fallbackYear || (playerData?.end_year || new Date().getFullYear());
                                             const startYear = playerData?.start_year || currentYear;

                                             if (currentYear > startYear) {
                                                 setFallbackYear(currentYear - 1);
                                             } else {
                                                 e.target.style.display = 'none';
                                                 e.target.nextSibling.style.display = 'block';
                                             }
                                         }}
                                     />
                                 ) : null}
                                 <div className="translate-y-1/4 w-full h-full flex items-center justify-center text-white/20" style={{ display: imageUrl ? 'none' : 'flex' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-19/20 h-19/20 ${rarityClass === 'GALAXY' ? 'text-purple-400/100' : 
                                                                                                        rarityClass === 'LEGENDARY' ? 'text-yellow-400/100' :
                                                                                                        rarityClass === 'EPIC' ? 'text-purple-400/100' :
                                                                                                        rarityClass === 'RARE' ? 'text-blue-400/100' :
                                                                                                        rarityClass === 'UNCOMMON' ? 'text-green-400/100' :
                                                                                                        'text-slate-400/100'}`} viewBox="0 0 24 24" fill="currentColor">
                                        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                                    </svg>
                                 </div>
                             </div>
                         )}
                     </div>
                     
                     {/* Bottom Section - Fixed Height for All Card Types */}
                     <div className="mt-auto h-12 flex items-center justify-center text-center relative z-10">
                         {type !== 'number' && (
                             <div className="w-full bg-black/20 rounded-lg p-2 backdrop-blur-sm border border-white/10">
                                 <div className="font-heading text-white text-md leading-tight line-clamp-2 mb-0.5 drop-shadow-md">{displayName}</div>
                                 {subtext && <div className="text-[9px] text-white/80 font-mono uppercase tracking-wide truncate">{subtext}</div>}
                             </div>
                         )}
                     </div>

                     {/* Count Indicator */}
                     {count && count > 1 && (
                         <div className="absolute right-0 bottom-0 bg-card-bg opacity-100 text-white text-[8px] font-bold px-2 py-1 shadow-lg z-20 border rounded-xl border-white/20 rounded-b-sm">
                             {count}x
                         </div>
                     )}
                </div>

                {/* Back of Card */}
                {(clickable || (type !== 'player' && allPlayersData)) && (
                    <div
                        className={`absolute inset-0 rounded-xl p-3 flex flex-col bg-slate-900 border-2 border-slate-600 shadow-xl overflow-hidden transition-opacity duration-500`}
                        style={{
                            opacity: isFlipped ? 1 : 0,
                            pointerEvents: isFlipped ? 'auto' : 'none'
                        }}
                    >
                        <div className="font-heading text-white text-sm text-center mb-2 border-b border-slate-700 pb-1">{displayName}</div>
                        
                        {type === 'player' && playerData ? (
                            <>
                                <div className="flex-grow overflow-y-auto custom-scrollbar text-[9px] space-y-2 text-slate-300">
                                    {playerData.teams && (
                                        <div>
                                            <span className="text-slate-500 uppercase font-bold block text-[8px]">Teams</span>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {playerData.teams.map(t => (
                                                    <span key={t} className="bg-slate-800 px-1 rounded">{formatTeamName(t, getTeam)}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {playerData.numbers && (
                                        <div>
                                            <span className="text-slate-500 uppercase font-bold block text-[8px]">Numbers</span>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {playerData.numbers.map(n => (
                                                    <span key={n} className="bg-slate-800 px-1 rounded">#{n}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {playerData.colleges && (
                                        <div>
                                            <span className="text-slate-500 uppercase font-bold block text-[8px]">Colleges</span>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {playerData.colleges.map(c => (
                                                    <span key={c} className="bg-slate-800 px-1 rounded">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto pt-2 border-t border-slate-700 flex flex-col items-center gap-1">
                                    <div className="flex items-center justify-center gap-2 w-full">
                                        <div className="flex flex-col items-center">
                                            <img src={getAssetPath('Sports_Reference_Logo.svg')} alt="Sports Reference" className="h-4 w-auto" />
                                            <span className="text-[6px] text-slate-500 uppercase tracking-wider mt-0.5">Player Profile</span>
                                        </div>
                                        <a 
                                            href={srUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </>
                        ) : (
                            // Back for non-player cards (Team, College, Number)
                            <div className="flex flex-col h-full">
                                <div className="text-[8px] text-slate-400 uppercase font-bold text-center mb-1">Top Players</div>
                                <div className="flex-grow overflow-y-auto custom-scrollbar">
                                    <div className="flex flex-wrap gap-1 justify-left content-start">
                                        {topPlayers.map((p, i) => (
                                            <span key={p.id} className="bg-slate-800 px-0.5 py-0.5 rounded text-[7px] text-slate-300 border border-slate-700/50 whitespace-nowrap">
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                    {topPlayers.length === 0 && (
                                        <div className="text-center text-[9px] text-slate-500 italic mt-4">No players found</div>
                                    )}
                                </div>
                                <div className="mt-auto pt-2 border-t border-slate-700 text-center">
                                    <div className="text-[8px] text-slate-500 uppercase">Total Players</div>
                                    <div className="font-mono text-lg text-white leading-none">{totalCount}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Owner Indicator - Moved below card */}
            {isMe !== undefined && (
                <div className={`mt-2 px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-lg border border-white/20 ${isMe ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'}`}>
                    {isMe ? 'YOU' : 'OPP'}
                </div>
            )}
        </div>
    );
};

export default RarityCard;
