# 🏀 BallKnower

> Test your sports knowledge by connecting NBA and NFL players through shared attributes

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.1.0-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10.14.1-orange.svg)](https://firebase.google.com/)

## 🎮 About

BallKnower is an addictive web game that challenges players to connect sports players through shared attributes like teams, jersey numbers, and colleges. Think of it as "Six Degrees of Kevin Bacon" meets sports trivia!

### Game Modes
- **Quick Play**: Connect any two players by finding common attributes
- **Daily Challenge**: New challenge every day with optimal path scoring
- **Online Multiplayer**: Compete against other players in real-time

### Features
- 🏈 **Comprehensive Database**: Thousands of NBA and NFL players
- 🎯 **Smart Autocomplete**: Quick search with intelligent suggestions
- 📊 **ELO Rating System**: Track your skill progression
- 🏆 **Leaderboards**: Compete with players worldwide
- 📱 **Responsive Design**: Play on any device
- 🌙 **Dark Mode**: Easy on the eyes during late-night sessions

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Firebase project with Firestore and Authentication enabled

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ball-knower.git
cd ball-knower/ballknower
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure Firebase**
```bash
cp .env.example .env
```

Edit `.env` and add your Firebase configuration:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

4. **Deploy Firebase Security Rules**
```bash
firebase deploy --only firestore:rules
```

5. **Start the development server**
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
ballknower/
├── public/
│   ├── backend/           # Static JSON data (players, teams)
│   └── ...               # Static assets
├── src/
│   ├── components/       # React components
│   │   ├── ArcadeUI.js   # Arcade-style game interface
│   │   ├── AutocompleteInput.js  # Smart search component
│   │   ├── DailyGame.js  # Daily challenge component
│   │   └── ...
│   ├── context/          # React Context providers
│   │   └── GameContext.js  # Game state management
│   ├── pages/            # Page components
│   │   ├── Home.js       # Landing page
│   │   ├── GameOver.js   # Results screen
│   │   ├── Profile.js    # User profile
│   │   └── ...
│   ├── services/         # API and external services
│   │   └── api.js        # Data fetching and storage
│   ├── utils/            # Utility functions
│   │   ├── analytics.js  # Google Analytics tracking
│   │   ├── gameUtils.js  # Game logic utilities
│   │   └── rateLimiter.js # Firebase rate limiting
│   ├── App.js            # Main app component
│   ├── firebaseConfig.js # Firebase initialization
│   └── index.js          # App entry point
├── dailyAutomater/       # Scripts for generating daily challenges
├── scraper/              # Player data scraping tools
└── ...
```

## 🎮 How to Play

1. **Start a Game**: Choose Quick Play or Daily Challenge
2. **Make Your Move**: 
   - Search for a player by name
   - Or connect using:
     - 👕 Jersey Number
     - 🏟️ Team
     - 🎓 College
3. **Chain Connections**: Each move must share an attribute with the previous move
4. **Win Condition**: Successfully connect to the target player/attribute
5. **Scoring**: Fewer moves = Higher score

### Example Game Flow
```
Start: LeBron James
  ↓ (Team: Lakers)
Anthony Davis
  ↓ (College: Kentucky)
Rajon Rondo
  ↓ (Number: 9)
Target: Nick Foles ✓
```

## 🔧 Tech Stack

### Frontend
- **React 19** - UI framework
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Chart.js** - Statistics visualization

### Backend
- **Firebase Firestore** - NoSQL database
- **Firebase Auth** - User authentication
- **Firebase Analytics** - Event tracking
- **Firebase Hosting** - Production deployment

### Data Management
- **Python** - Web scraping scripts
- **BeautifulSoup** - HTML parsing
- **Sports Reference** - Data source

## 📊 Data Pipeline

The player database is maintained through automated web scraping:

```bash
cd scraper
python run_scraper.py
```

See `scraper/README.md` for detailed documentation.

### Data Sources
- Basketball-Reference.com (NBA data)
- Pro-Football-Reference.com (NFL data)

### Data Structure
```json
{
  "player_id": {
    "id": "BradSa00",
    "name": "Sam Bradford",
    "league": "NFL",
    "start_year": "2010",
    "end_year": "2018",
    "teams": ["nfl_STL", "nfl_PHI", "nfl_MIN", "nfl_ARI"],
    "numbers": ["8", "7"],
    "colleges": ["Oklahoma"]
  }
}
```

## 🔒 Security

### Firebase Security Rules
Comprehensive Firestore security rules prevent:
- ✅ Unauthorized data access
- ✅ Stats manipulation
- ✅ Spam and abuse
- ✅ Excessive API calls

### Rate Limiting
Client-side rate limiting prevents:
- ✅ Firebase quota exhaustion
- ✅ Malicious overuse
- ✅ Accidental infinite loops

### Environment Variables
All sensitive credentials are stored in environment variables (never committed to git).

## 📈 Analytics

The app tracks user behavior with Firebase Analytics:

- User engagement and retention
- Game completion rates
- Feature adoption
- Performance metrics

See `ANALYTICS.md` for implementation details.

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase
```bash
firebase deploy
```

### Environment Setup
1. Set environment variables in Firebase Hosting
2. Deploy Firestore security rules
3. Configure Firebase Authentication providers

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use Prettier for formatting
- Follow React best practices
- Write descriptive commit messages
- Add tests for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Sports Reference** for providing comprehensive player data
- **Firebase** for backend infrastructure
- **React** community for excellent libraries and tools

## 📧 Contact

Patrick McKeever - [GitHub Profile](https://github.com/patrickmckeever)

Project Link: [https://github.com/yourusername/ball-knower](https://github.com/yourusername/ball-knower)

Live Demo: [https://ballknower.com](https://ballknower.com)

## 🗺️ Roadmap

- [ ] Add MLB and NHL players
- [ ] Team vs team challenges
- [ ] Tournament mode
- [ ] Mobile app (React Native)
- [ ] AI opponent with difficulty levels
- [ ] Custom challenge creator
- [ ] Social features (friends, challenges)

---

**Made with ❤️ and ☕ by sports fans, for sports fans**
