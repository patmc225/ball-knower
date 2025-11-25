import React, { useState, useEffect, useRef } from 'react';
import { getAssetPath } from '../config/basePath';
import { getTeamLogoUrl, getCollegeLogoUrl } from '../utils/gameUtils';

const AutocompleteInput = ({ 
  inputValue,
  onInputChange,
  onSelect,
  suggestions,
  displayAttribute,
  valueAttribute,
  placeholder = 'Enter value...', 
  disabled = false,
  type,
  className = '',
  onSubmit
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const handleInputChangeInternal = (e) => {
    onInputChange(e.target.value);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  const handleSelectSuggestion = (suggestion) => {
    let displayValue = suggestion;
    let returnValue = suggestion;
    
    if (typeof suggestion === 'object' && suggestion !== null) {
      if(type === "player") {
        displayValue = suggestion[displayAttribute] || '';
        returnValue = suggestion[valueAttribute] || suggestion;
      } else {
        displayValue = suggestion[displayAttribute] || '';
        returnValue = suggestion[valueAttribute] || suggestion;
      }
    }
    
    onInputChange(displayValue);
    setShowSuggestions(false);
    onSelect(returnValue, displayValue);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || !suggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex];
      if (selectedElement) selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div className="relative w-full group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChangeInternal}
        onKeyDown={handleKeyDown}
        onFocus={() => inputValue.trim() && suggestions && suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pl-12 ${onSubmit ? 'pr-12' : 'pr-4'} py-4 bg-slate-800 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all font-sans text-lg ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
        autoComplete="off"
      />

      {onSubmit && (
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
          <button
            onClick={onSubmit}
            disabled={disabled || !inputValue.trim()}
            className="p-2 bg-brand-blue hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors shadow-lg flex items-center justify-center w-10 h-10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}
      
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <ul 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-700/50"
        >
          {suggestions.map((item, index) => {
              let displayValue = typeof item === 'object' && item !== null ? item[displayAttribute] : item;
              let playerLeagueYears = null;
              let leagueLogo = null;
              let imageUrl = null;
              
              if(type === 'player' && typeof item === 'object' && item !== null) {
                displayValue = item[displayAttribute] || '';
                if (item['league'] && (item['start_year'] || item['end_year'])) {
                  const years = item['start_year'] && item['end_year'] ? `${item['start_year']}-${item['end_year']}` : item['start_year'] || item['end_year'] || '';
                  leagueLogo = item['league'] === 'NBA' ? 'nba.png' : (item['league'] === 'NFL' ? 'nfl.png' : null);
                  playerLeagueYears = years;
                  
                  if (item['id']) {
                      if (item['league'] === 'NFL') {
                          imageUrl = `https://www.pro-football-reference.com/req/20230307/images/headshots/${item['id']}.jpg`;
                      } else if (item['league'] === 'NBA') {
                          imageUrl = `https://www.basketball-reference.com/req/202106291/images/headshots/${item['id']}.jpg`;
                      }
                  }
                }
              } else if (type === 'team' && typeof item === 'object' && item !== null) {
                  imageUrl = getTeamLogoUrl(item.id);
              } else if (type === 'college') {
                  imageUrl = getCollegeLogoUrl(item); // item is the college name string
              }
              
              // Placeholder for colleges
              const isCollege = type === 'college';
               
              return (
                <li
                  key={index}
                  onClick={() => handleSelectSuggestion(item)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                    index === selectedIndex ? 'bg-brand-blue text-white' : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {(imageUrl || isCollege) && (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center p-1">
                          {imageUrl ? (
                              <img 
                                  src={imageUrl} 
                                  alt="" 
                                  className={type === 'team' || type === 'college' ? "w-full h-full object-contain" : "w-full h-full object-cover"}
                                  onError={(e) => { e.target.style.display = 'none'; if(e.target.nextSibling) e.target.nextSibling.style.display = 'block'; }} 
                              />
                          ) : null}
                           {isCollege && (
                              <div style={{ display: imageUrl ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
                                <svg width="800px" height="800px" viewBox="0 0 15 15" className="w-6 h-6 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                    <path d="M7.5,1L0,4.5l2,0.9v1.7C1.4,7.3,1,7.9,1,8.5s0.4,1.2,1,1.4V10l-0.9,2.1&#xA; C0.8,13,1,14,2.5,14s1.7-1,1.4-1.9L3,10c0.6-0.3,1-0.8,1-1.5S3.6,7.3,3,7.1V5.9L7.5,8L15,4.5L7.5,1z M11.9,7.5l-4.5,2L5,8.4v0.1&#xA; c0,0.7-0.3,1.3-0.8,1.8l0.6,1.4v0.1C4.9,12.2,5,12.6,4.9,13c0.7,0.3,1.5,0.5,2.5,0.5c3.3,0,4.5-2,4.5-3L11.9,7.5L11.9,7.5z"/>
                                </svg>
                              </div>
                          )}
                      </div>
                  )}
                  <div>
                    <div className="font-medium text-xs">{displayValue || 'N/A'}</div>
                    {(playerLeagueYears || leagueLogo) && (
                      <div className={`text-[8px] mt-0.5 flex items-center gap-1 ${index === selectedIndex ? 'text-blue-100' : 'text-slate-500'}`}>
                        {leagueLogo && <img src={getAssetPath(leagueLogo)} alt="" className="h-3 w-auto opacity-80" />}
                        {leagueLogo && <span>•</span>}
                        <span>{playerLeagueYears}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
          })}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;
