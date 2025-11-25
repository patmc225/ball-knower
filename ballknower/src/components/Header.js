import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useButtonTracking, useNavigationTracking } from '../utils/analytics';

// Settings Icon Component
const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Icon Components for Navigation
const PlayIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ProfileIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const Header = ({
  activeTab = 'play',
  activeUsersCount = 0,
  showUsernameSection = false,
  profileUser = null,
  currentUser = null,
  onSettingsClick = null
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const trackButton = useButtonTracking('header');
  const trackNav = useNavigationTracking(location.pathname.substring(1) || 'home');

  const handleNavigation = (path, buttonName) => {
    trackButton(buttonName, { target_path: path });
    trackNav(path.substring(1) || 'home', 'button');
    navigate(path);
  };

  const handleLogoClick = () => {
    trackButton('logo_click', { target_path: '/' });
    trackNav('home', 'logo_click');
    navigate('/');
  };

  const handleSettingsClick = () => {
    trackButton('settings_click');
    if (onSettingsClick) onSettingsClick();
  };

  return (
    <>
      {/* Header */}
      <header className="mb-6 sm:mb-10 border-b border-slate-800 pb-4">
         <div className="flex justify-between items-center">
            <h1
              className="font-heading text-2xl sm:text-xl md:text-2xl lg:text-3xl leading-none tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 whitespace-nowrap cursor-pointer"
              onClick={handleLogoClick}
            >
              BALL KNOWER
            </h1>

            <div className="flex items-center gap-4">
               {/* Navigation Tabs - Desktop (Hidden on Mobile) */}
               <nav className="hidden sm:flex items-center gap-2">
                  {[
                    { id: 'play', icon: PlayIcon, label: 'Play', path: '/' },
                    { id: 'profile', icon: ProfileIcon, label: 'Profile', path: '/profile' }
                  ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                         <button
                      key={tab.id}
                      onClick={() => handleNavigation(tab.path, `nav_${tab.id}`)}
                      className={`flex items-center gap-2 px-3 py-2 transition-all rounded-lg ${
                        activeTab === tab.id
                        ? 'bg-brand-pink/20 text-brand-pink border border-brand-pink/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon />
                      <span className="text-sm font-medium">{tab.label}</span>
                       </button>
                      );
                  })}
               </nav>

               {showUsernameSection && profileUser ? (
                 <div className="bg-card-bg p-2 rounded-xl border border-slate-700">
                   <div className="flex items-center gap-2">
                     
                     <div>
                       <h1 className="font-heading text-sm text-white">{profileUser.displayName || 'Anonymous'}</h1>
                       {currentUser?.isAnonymous && (
                         <p className="-mt-1 text-[8px] text-yellow-500/80">Temporary account</p>
                       )}
                     </div>
                     {onSettingsClick && (
                       <button
                         onClick={handleSettingsClick}
                         className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-600 ml-auto"
                         title="Settings"
                       >
                         <SettingsIcon />
                       </button>
                     )}
                   </div>
                 </div>
               ) : (
                 <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                   <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${activeUsersCount > 0 ? 'bg-neon-green animate-pulse' : 'bg-slate-500'}`}></div>
                   <span className="text-[0.65rem] sm:text-xs font-medium text-slate-300 whitespace-nowrap">{activeUsersCount} ONLINE</span>
                 </div>
               )}
            </div>
         </div>
      </header>

      {/* Navigation Tabs - Mobile (Fixed Bottom) */}
      <nav className="sm:hidden fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe-area z-50 flex justify-around items-center px-2 py-3">
          {[
              { id: 'play', icon: PlayIcon, label: 'Play', path: '/' },
              { id: 'profile', icon: ProfileIcon, label: 'Profile', path: '/profile' }
          ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                  <button
                      key={item.id}
                      onClick={() => handleNavigation(item.path, `mobile_nav_${item.id}`)}
                      className={`flex flex-col items-center justify-center w-full space-y-1 ${isActive ? 'text-brand-pink' : 'text-slate-500 hover:text-slate-400'}`}
                  >
                      <Icon />
                      <span className="text-[10px] font-heading tracking-widest uppercase">{item.label}</span>
                  </button>
              );
          })}
      </nav>
    </>
  );
};

export default Header;
