# Google Analytics Integration - BallKnower

This project uses Firebase Analytics (Google Analytics 4) to track user behavior, game metrics, and app performance.

## Setup

### Prerequisites
1. Firebase project with Google Analytics enabled
2. Environment variables configured (see `.env.example`)

### Configuration
Add your Firebase Measurement ID to `.env`:
```
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Tracked Events

### Automatic Tracking
- **Page Views**: Every page navigation
- **Web Vitals**: Performance metrics (LCP, FID, CLS, FCP, TTFB)
- **App Load**: Initial app startup with user context
- **Session Duration**: Automatic session tracking

### User Authentication Events
```javascript
trackAuthEvent('sign_in', { method: 'anonymous' });
trackAuthEvent('sign_up', { method: 'email' });
trackAuthEvent('account_linked', { from: 'anonymous', to: 'email' });
```

**Events:**
- `auth_sign_in` - User signs in
- `auth_sign_up` - New user registration
- `auth_sign_out` - User signs out
- `auth_account_linked` - Anonymous account linked to email

### Game Events
```javascript
trackGameStart({
  gameMode: 'quickplay',
  playerCount: 2,
  difficulty: 'normal'
});

trackGameComplete({
  result: 'win',
  duration: 120,
  movesCount: 15,
  score: 850,
  ratingChange: +25
});

trackDailyChallengeComplete({
  date: '2025-01-15',
  movesCount: 8,
  timeSeconds: 95,
  isOptimal: true
});
```

**Events:**
- `game_start` - Game begins
- `game_complete` - Game ends (win/loss)
- `game_quit` - User quits mid-game
- `daily_challenge_complete` - Daily challenge finished

### User Engagement
```javascript
trackEngagement({
  timeMs: 45000,
  pageName: 'game_board'
});

trackFeatureUsage('challenge_mode', {
  firstTime: true
});

trackSearch({
  term: 'lebron',
  type: 'player',
  resultsCount: 5,
  selectedIndex: 0
});
```

**Events:**
- `user_engagement` - Time spent on pages
- `feature_usage` - Feature interactions
- `search` - Search/autocomplete usage

### Conversions (Key Actions)
```javascript
trackConversion('first_game', { value: 1 });
trackConversion('account_created', { value: 1 });
trackConversion('daily_streak', { value: 7 });
```

**Conversion Events:**
- `account_created` - User creates account
- `first_game` - User plays first game
- `return_user` - User returns after 24h
- `daily_streak` - User maintains daily streak (value = days)
- `high_score` - User achieves personal best

### Social/Sharing
```javascript
trackShare({
  contentType: 'score',
  method: 'twitter'
});
```

**Events:**
- `share` - User shares content

### Milestones
```javascript
trackMilestone('games_10', { gamesPlayed: 10 });
trackMilestone('rating_1500', { rating: 1500 });
```

**Milestone Events:**
- `games_10`, `games_50`, `games_100` - Games played
- `rating_1500`, `rating_2000` - Rating achievements
- `streak_7`, `streak_30` - Daily streak milestones

### Error Tracking
```javascript
trackError({
  message: 'Failed to load game data',
  type: 'network_error',
  component: 'GameBoard'
});
```

## Implementation Guide

### Adding Analytics to Components

#### Page Views
```javascript
import { trackPageView } from '../utils/analytics';

useEffect(() => {
  trackPageView('Home');
}, []);
```

#### Game Actions
```javascript
import { trackGameStart, trackGameComplete } from '../utils/analytics';

// Start game
const startGame = () => {
  trackGameStart({
    gameMode: 'quickplay',
    playerCount: 1
  });
  // ... game logic
};

// Complete game
const endGame = (result) => {
  trackGameComplete({
    result: result,
    duration: gameDuration,
    movesCount: moves.length,
    score: finalScore
  });
};
```

#### User Actions
```javascript
import { trackUserAction } from '../utils/analytics';

const handleButtonClick = (action) => {
  trackUserAction('button_click', {
    button_id: action,
    page: 'home'
  });
};
```

## Custom Dimensions & Metrics

### User Properties
Set in Firebase Authentication:
- `user_type`: 'anonymous' | 'registered'
- `account_age_days`: Days since account creation
- `games_played`: Total games played
- `current_rating`: Current ELO rating

### Event Parameters
Always included:
- `timestamp`: ISO timestamp of event
- `user_id`: Firebase user ID (when available)
- `session_id`: Current session identifier

## Viewing Analytics

### Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your project
3. Navigate to Analytics → Dashboard
4. View real-time and historical data

### Key Metrics to Monitor
1. **User Engagement**
   - Daily/Monthly Active Users (DAU/MAU)
   - Average session duration
   - Engagement rate

2. **Game Metrics**
   - Games started vs completed
   - Average game duration
   - Win/loss ratio distribution

3. **Conversion Funnel**
   - App load → First game → Account creation
   - Daily challenge participation rate
   - Return user rate

4. **Feature Adoption**
   - Most used game modes
   - Search usage frequency
   - Challenge mode adoption

### Custom Reports

#### User Retention Report
- Dimension: Days since first visit
- Metric: Active users
- Filter: Users who played at least 1 game

#### Game Completion Rate
- Dimension: Game mode
- Metrics: `game_start` / `game_complete`
- Shows drop-off rates by mode

#### Daily Challenge Engagement
- Dimension: Day of week
- Metric: `daily_challenge_complete` count
- Shows best days for challenges

## Privacy & Compliance

### Data Collection
- Analytics data is anonymized
- No personally identifiable information (PII) collected
- User IDs are Firebase-generated, not emails

### User Consent
Consider adding:
- Cookie consent banner
- Analytics opt-out option
- Privacy policy link

### GDPR Compliance
- Data automatically deleted after 14 months (configurable)
- User can request data deletion
- Data processing agreement with Google

## Best Practices

### Do's
✅ Track meaningful user actions
✅ Include context in event parameters
✅ Use consistent naming conventions
✅ Test analytics in development
✅ Document new events you add

### Don'ts
❌ Track PII (emails, names, addresses)
❌ Send sensitive data (passwords, tokens)
❌ Create too many custom events (stick to standard events when possible)
❌ Track every single click (be selective)
❌ Forget to test in production

## Debugging

### Enable Debug Mode
```javascript
// In browser console (Chrome):
gtag('config', 'G-XXXXXXXXXX', {
  'debug_mode': true
});

// Or add to URL:
// ?debug_mode=1
```

### DebugView
1. Go to Firebase Console → Analytics → DebugView
2. Enable debug mode in your browser
3. See real-time events as they fire

### Common Issues
- **Events not showing**: Check Firebase config is correct
- **Duplicate events**: Ensure effects have proper dependencies
- **Missing parameters**: Verify parameter names match GA4 spec

## Resources

- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [DebugView Guide](https://support.google.com/analytics/answer/7201382)

---

**Last Updated**: November 2025
**Analytics Version**: GA4 (Google Analytics 4)
