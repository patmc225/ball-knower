import React from 'react';

export const ArcadeButton = ({ 
  children, 
  onClick, 
  variant = 'primary', // primary, secondary, danger, success, ghost
  size = 'md', // sm, md, lg, xl
  className = '',
  disabled = false,
  icon = null
}) => {
  
  const baseStyles = "font-heading uppercase tracking-wider transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden group";
  
  const variants = {
    primary: "bg-brand-blue text-white hover:bg-blue-600 shadow-[0_4px_0_rgb(29,78,216)] active:shadow-none active:translate-y-1 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
    secondary: "bg-brand-pink text-white hover:bg-pink-600 shadow-[0_4px_0_rgb(190,24,93)] active:shadow-none active:translate-y-1 hover:shadow-[0_0_15px_rgba(236,72,153,0.5)]",
    danger: "bg-neon-red text-white hover:bg-red-600 shadow-[0_4px_0_rgb(185,28,28)] active:shadow-none active:translate-y-1",
    success: "bg-neon-green text-white hover:bg-emerald-600 shadow-[0_4px_0_rgb(4,120,87)] active:shadow-none active:translate-y-1",
    ghost: "bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700 hover:border-slate-600",
    outline: "bg-transparent border-2 border-current text-brand-blue hover:bg-brand-blue/10"
  };

  const sizes = {
    sm: "text-sm px-3 py-1 rounded-md",
    md: "text-lg px-6 py-2 rounded-lg",
    lg: "text-xl px-8 py-3 rounded-xl",
    xl: "text-2xl px-10 py-4 rounded-2xl"
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {/* Shine effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
      
      {icon && <span className="mr-2">{icon}</span>}
      <span className="relative z-0">{children}</span>
    </button>
  );
};

export const ArcadeCard = ({ 
  children, 
  title, 
  className = '',
  glow = false, // blue, pink, none
  headerAction = null
}) => {
  const glowStyles = {
    blue: "border-brand-blue/50 shadow-neon-blue",
    pink: "border-brand-pink/50 shadow-neon-pink",
    none: "border-slate-700 hover:border-slate-600"
  };

  return (
    <div className={`bg-card-bg border rounded-2xl overflow-hidden backdrop-blur-sm transition-all duration-300 ${glow ? glowStyles[glow] : glowStyles.none} ${className}`}>
      {(title || headerAction) && (
        <div className="bg-slate-900/50 p-4 border-b border-slate-700/50 flex justify-between items-center">
          {title && <h3 className="font-heading text-xl md:text-2xl text-white tracking-wide">{title}</h3>}
          {headerAction}
        </div>
      )}
      <div className="p-4 md:p-6">
        {children}
      </div>
    </div>
  );
};

export const ArcadeInput = ({
  value,
  onChange,
  placeholder,
  className = '',
  ...props
}) => {
  return (
    <div className="relative group">
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-input-bg border-2 border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-brand-blue focus:shadow-neon-blue transition-all font-sans text-lg ${className}`}
        {...props}
      />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-brand-blue group-focus-within:w-[90%] transition-all duration-300" />
    </div>
  );
};

