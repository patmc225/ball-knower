# Quick Reference Guide

## Common Commands

### Run Full Pipeline (Both Leagues)
```bash
cd scraper
python run_scraper.py
```

### Run NFL Only
```bash
python run_scraper.py --leagues NFL
```

### Run NBA Only
```bash
python run_scraper.py --leagues NBA
```

### Run Specific Steps
```bash
# Just fetch player lists
python run_scraper.py --steps 1

# Resume from Step 3
python run_scraper.py --steps 3 4 5

# Only merge and normalize
python run_scraper.py --steps 5
```

### Custom Output Location
```bash
python run_scraper.py --output /path/to/custom_output.json
```

## Individual Scraper Usage

### Fetch Players
```bash
python fetch_players.py NFL   # NFL player list
python fetch_players.py NBA   # NBA player list
```

### Initialize Database
```bash
python init_db.py NFL players_nfl.json players_db_nfl.json
python init_db.py NBA players_nba.json players_db_nba.json
```

### Fetch Teams
```bash
python fetch_teams.py NFL players_db_nfl.json
python fetch_teams.py NBA players_db_nba.json
```

### Fetch Numbers (NBA) / Colleges (NFL)
```bash
python fetch_colleges.py NFL players_db_nfl.json
python fetch_numbers.py NBA players_db_nba.json
```

### Merge Data
```bash
python merge_final.py players_db_nfl.json players_db_nba.json output.json
```

### Normalize Colleges
```bash
python college_normalizer.py output.json
```

## Pipeline Steps Reference

| Step | Description | NFL Time | NBA Time |
|------|-------------|----------|----------|
| 1 | Fetch Players | ~5 min | ~5 min |
| 2 | Initialize DB | <1 sec | <1 sec |
| 3 | Fetch Teams/Numbers | ~2.5 hrs | ~3 min |
| 4 | Fetch Colleges/Numbers | ~15 min | ~6 min |
| 5 | Merge & Normalize | ~1 min | ~1 min |

## Output Files

### Intermediate Files (Generated)
- `players_nfl.json` - Raw NFL player list
- `players_nba.json` - Raw NBA player list
- `players_db_nfl.json` - NFL database
- `players_db_nba.json` - NBA database

### Final Output
- `../namegame/public/backend/players_new.json` - Combined & normalized

## Troubleshooting

### "File not found" error
- Make sure you're in the `scraper` directory
- Run previous steps first (e.g., Step 1 before Step 2)

### Rate limiting messages
- Normal behavior - scraper enforces 20 req/min limit
- Will automatically retry

### Incomplete data
- Some players may not have all fields (normal)
- Data reflects what's available on Sports Reference

### Resume interrupted scrape
- Just run the pipeline again
- Data is saved incrementally, so progress isn't lost

## Help

```bash
# Get help for main pipeline
python run_scraper.py --help

# Get help for individual scrapers
python fetch_players.py --help
python fetch_teams.py --help
```

## File Locations

- **Scraper code**: `scraper/`
- **Final output**: `namegame/public/backend/players_new.json`
- **Archive (old code)**: `scraper/archive/`
- **Documentation**: 
  - `scraper/README.md` - User guide
  - `scraper/TECHNICAL.md` - Developer guide
  - `scraper/DATA_FILES.md` - Data file reference
  - `scraper/QUICK_REFERENCE.md` - This file

---

**Tip**: The full pipeline takes ~3 hours due to rate limiting. Run overnight or in a tmux/screen session.

