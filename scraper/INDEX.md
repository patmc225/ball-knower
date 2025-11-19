# NameGame Scraper - Documentation Index

Welcome to the NameGame scraper documentation. This index will help you find the information you need.

## 📚 Documentation Files

### For Users

- **[README.md](README.md)** - Start here! Complete user guide with installation, usage, and examples
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick command reference and troubleshooting tips
- **[DATA_FILES.md](DATA_FILES.md)** - Information about input/output data files

### For Developers

- **[TECHNICAL.md](TECHNICAL.md)** - Deep dive into architecture, data flow, and implementation details
- **[archive/README.md](archive/README.md)** - Information about archived legacy scripts

## 🚀 Quick Start

```bash
# Install dependencies
pip install requests beautifulsoup4

# Run the scraper
cd scraper
python run_scraper.py
```

Output: `../namegame/public/backend/players_new.json`

## 📋 What This Scraper Does

Collects comprehensive player data for NFL and NBA:
- ✅ Player names
- ✅ Years active (start/end)
- ✅ Team affiliations
- ✅ Jersey numbers
- ✅ College information
- ✅ Normalized college names

## ⚡ Key Features

- **Rate Limited**: Respects Sports Reference ToS (20 requests/minute)
- **Progress Tracking**: Shows completion percentage and time remaining
- **Incremental Saves**: Data saved continuously to prevent loss
- **Error Handling**: Automatic retries with exponential backoff
- **Modular Design**: Run individual steps or entire pipeline

## 📖 Documentation Guide

### I want to...

**...run the scraper**
→ Read [README.md](README.md) sections: Quick Start, Usage Examples

**...understand what the scraper does**
→ Read [README.md](README.md) section: Pipeline Architecture

**...find a specific command**
→ Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

**...troubleshoot an issue**
→ See [README.md](README.md) section: Troubleshooting
→ Or [QUICK_REFERENCE.md](QUICK_REFERENCE.md) section: Troubleshooting

**...understand the code**
→ Read [TECHNICAL.md](TECHNICAL.md) sections: Architecture, Core Modules

**...modify or extend the scraper**
→ Read [TECHNICAL.md](TECHNICAL.md) sections: Data Flow, Extension Points

**...understand the data format**
→ Read [TECHNICAL.md](TECHNICAL.md) section: Player Record Evolution
→ Or [DATA_FILES.md](DATA_FILES.md)

**...use the old scripts**
→ Don't! They're archived for reference only
→ See [archive/README.md](archive/README.md)

## 🗂️ Project Structure

```
scraper/
├── 📄 Documentation
│   ├── README.md              # Main user guide
│   ├── QUICK_REFERENCE.md     # Command reference
│   ├── TECHNICAL.md           # Developer guide
│   ├── DATA_FILES.md          # Data file info
│   └── INDEX.md               # This file
│
├── 🔧 Core Pipeline
│   ├── run_scraper.py         # Main entry point
│   ├── config.py              # Configuration
│   └── utils.py               # Shared utilities
│
├── 📊 Scraper Modules
│   ├── fetch_players.py       # Step 1: Player lists
│   ├── init_db.py             # Step 2: DB format
│   ├── fetch_teams.py         # Step 3: Teams/numbers
│   ├── fetch_numbers.py       # Step 4: NBA numbers
│   ├── fetch_colleges.py      # Step 4: NFL colleges
│   ├── merge_final.py         # Step 5a: Merge
│   └── college_normalizer.py  # Step 5b: Normalize
│
├── 📁 Data Files
│   ├── colleges.json          # College names
│   └── colleges_grouped.json  # Normalization map
│
└── 📦 Archive
    └── archive/               # Old scripts (not used)
```

## 💡 Tips

1. **First Time Running?** Start with NFL or NBA only to test: `python run_scraper.py --leagues NFL`
2. **In a Hurry?** Run NBA only (~15 minutes): `python run_scraper.py --leagues NBA`
3. **Long Running?** Use `tmux` or `screen` to keep it running if your connection drops
4. **Debugging?** Run individual steps: `python run_scraper.py --steps 1 2`

## ⏱️ Expected Completion Times

| Task | Duration |
|------|----------|
| Full Pipeline (NFL + NBA) | ~3+ hours |
| NFL Only | ~3 hours |
| NBA Only | ~15 minutes |
| Steps 1-2 (Quick Test) | <5 minutes |

*Times based on 20 requests/minute rate limit*

## 🆘 Need Help?

1. Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for common commands
2. Review [README.md](README.md) Troubleshooting section
3. Read relevant [TECHNICAL.md](TECHNICAL.md) sections for deep dives
4. Check the inline documentation in Python files (docstrings)

## 📝 Maintenance

To update player data, simply run:
```bash
cd scraper
python run_scraper.py
```

The scraper will fetch the latest data from Sports Reference websites.

**Recommended frequency**: Monthly during season, quarterly in off-season

---

**Version**: 2.0 (Refactored Pipeline)
**Last Updated**: November 2025
**Author**: Patrick McKeever

