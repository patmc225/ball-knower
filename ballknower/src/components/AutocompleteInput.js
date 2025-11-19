import React, { useState, useEffect, useRef } from 'react';

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
  className = ''
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
        className={`w-full pl-12 pr-4 py-4 bg-slate-800 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all font-sans text-lg ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
        autoComplete="off"
      />
      
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <ul 
          ref={suggestionsRef}
          className="absolute z-20 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-700/50"
        >
          {suggestions.map((item, index) => {
              let displayValue = typeof item === 'object' && item !== null ? item[displayAttribute] : item;
              let playerLeagueYears = null;
              
              if(type === 'player' && typeof item === 'object' && item !== null) {
                displayValue = item[displayAttribute] || '';
                if (item['league'] && (item['start_year'] || item['end_year'])) {
                  const years = item['start_year'] && item['end_year'] ? `${item['start_year']}-${item['end_year']}` : item['start_year'] || item['end_year'] || '';
                  playerLeagueYears = `${item['league']} ${years}`;
                }
              }
               
              return (
                <li
                  key={index}
                  onClick={() => handleSelectSuggestion(item)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-brand-blue text-white' : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium text-lg">{displayValue || 'N/A'}</div>
                  {playerLeagueYears && (
                    <div className={`text-xs mt-0.5 ${index === selectedIndex ? 'text-blue-100' : 'text-slate-500'}`}>
                      {playerLeagueYears}
                    </div>
                  )}
                </li>
              );
          })}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;
