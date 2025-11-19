# NameGame Scraper

Automated data collection pipeline for NBA and NFL player information from Sports Reference websites.

## Overview

This scraper collects comprehensive player data including names, teams, jersey numbers, colleges, and years active for both NBA and NFL players. The data is sourced from Basketball-Reference.com and Pro-Football-Reference.com.

## Quick Start

```bash
# Install dependencies
pip install requests beautifulsoup4

# Run the complete pipeline
cd scraper
python run_scraper.py
```

## Pipeline Architecture

The scraper follows a 5-step pipeline:

### Step 1: Fetch Players
- **NFL**: Scrapes A-Z player index from Pro-Football-Reference
- **NBA**: Scrapes A-Z player index from Basketball-Reference (includes colleges)
- **Output**: `players_nfl.json`, `players_nba.json`

### Step 2: Initialize Database
- Converts player lists to database format (dictionary keyed by player ID)
- Extracts player IDs from URLs
- **Output**: `players_db_nfl.json`, `players_db_nba.json`

### Step 3: Fetch Teams & Numbers
- **NFL**: Iterates through each team's uniform pages (0-99) to capture players, teams, numbers, and years
- **NBA**: Scrapes team roster pages for team affiliations
- **Output**: Updates database files

### Step 4: Fetch Colleges or Numbers
- **NFL**: Scrapes college pages from Pro-Football-Reference
- **NBA**: Scrapes jersey number pages from Basketball-Reference
- **Output**: Updates database files

### Step 5: Merge & Normalize
- Merges NFL and NBA databases into single file
- Normalizes college names using `colleges_grouped.json` mapping
- **Output**: `../namegame/public/backend/players_new.json`

## Usage Examples

```bash
# Run complete pipeline (default)
python run_scraper.py

# Scrape only NFL
python run_scraper.py --leagues NFL

# Scrape only NBA
python run_scraper.py --leagues NBA

# Run specific steps
python run_scraper.py --steps 1 2 3

# Custom output location
python run_scraper.py --output /path/to/output.json

# Combine options
python run_scraper.py --leagues NFL --steps 3 4
```

## File Structure

### Core Pipeline Files
- **`run_scraper.py`** - Main orchestrator and CLI interface
- **`fetch_players.py`** - Step 1: Scrape player lists
- **`init_db.py`** - Step 2: Convert lists to database format
- **`fetch_teams.py`** - Step 3: Scrape team affiliations (and NFL numbers)
- **`fetch_numbers.py`** - Step 4: Scrape NBA jersey numbers
- **`fetch_colleges.py`** - Step 4: Scrape NFL colleges
- **`merge_final.py`** - Step 5: Merge NFL and NBA data
- **`college_normalizer.py`** - Step 5: Normalize college names

### Supporting Files
- **`utils.py`** - HTTP requests, JSON I/O, rate limiting
- **`config.py`** - URLs, team codes, constants

### Data Files
- **`colleges_grouped.json`** - College name normalization mapping
- **`colleges.json`** - List of college names
- **`players_db_nfl.json`** - Intermediate NFL database (generated)
- **`players_db_nba.json`** - Intermediate NBA database (generated)

### Archive
- **`archive/`** - Old scripts (kept for reference, not used in pipeline)

## Data Structure

### Player Record Format
```json
{
  "BradSa00": {
    "id": "BradSa00",
    "name": "Sam Bradford",
    "url": "https://www.pro-football-reference.com/players/B/BradSa00.htm",
    "league": "NFL",
    "start_year": "2010",
    "end_year": "2018",
    "teams": ["nfl_STL", "nfl_PHI", "nfl_MIN", "nfl_ARI"],
    "numbers": ["8", "7"],
    "colleges": ["Oklahoma"]
  }
}
```

## Rate Limiting

**IMPORTANT**: The scraper enforces strict rate limiting to comply with Sports Reference Terms of Service.

- **Rate**: 20 requests per minute maximum
- **Implementation**: 3.1-second delay before each request
- **Progress Tracking**: Displays estimated time remaining based on rate limit

### Estimated Completion Times
- **NFL Players** (Step 1): ~5 minutes (26 letters)
- **NFL Teams/Numbers** (Step 3): ~2.5 hours (32 teams × 100 numbers = 3,200 requests)
- **NFL Colleges** (Step 4): ~15 minutes (200+ colleges)
- **NBA Players** (Step 1): ~5 minutes (26 letters)
- **NBA Teams** (Step 3): ~3 minutes (30 teams)
- **NBA Numbers** (Step 4): ~6 minutes (100 numbers)

**Total Pipeline**: ~3+ hours for both leagues

## Progress Tracking

Each scraper displays real-time progress:
```
Progress: 1543/3200 (48.2%) - Est. 1h 25m 12s remaining
```

Metrics shown:
- Current request / Total requests
- Percentage complete
- Estimated time remaining (HH:MM:SS)

## Requirements

```
Python 3.7+
requests>=2.25.0
beautifulsoup4>=4.9.0
```

## Error Handling

- **Rate Limiting**: Automatic retry with exponential backoff on HTTP 429
- **Network Errors**: Up to 5 retry attempts per request
- **Missing Data**: Graceful handling of empty tables or missing fields
- **Incremental Saves**: Data saved after each team/letter to prevent data loss

## Output Location

Default: `../namegame/public/backend/players_new.json`

This path is relative to the scraper directory and places the output directly in the web app's backend data folder.

## Troubleshooting

### "Rate limited" messages
- Normal behavior - the scraper will automatically wait and retry
- If persistent, check your IP hasn't been temporarily blocked

### Missing players
- Some players may not have complete data (e.g., no jersey number records)
- This is expected - the scraper only captures what's available

### Interrupted pipeline
- Resume by specifying the step you left off at
- Example: `python run_scraper.py --steps 3 4 5`

## Development

### Adding New Data Fields
1. Update scraper functions in respective `fetch_*.py` files
2. Update player record structure in `init_db.py`
3. Update merge logic in `merge_final.py` if needed

### Testing Individual Steps
Each scraper can be run standalone:
```bash
python fetch_players.py NFL
python fetch_teams.py NBA players_db_nba.json
python fetch_colleges.py NFL players_db_nfl.json
```

## License

This scraper is for personal use only. Please respect Sports Reference's Terms of Service and rate limits.

## Maintenance

When updating the scraper:
1. Test with `--steps 1` first (quick player list test)
2. Monitor progress logs for errors
3. Check output file structure before deploying

---

**Last Updated**: November 2025
**Author**: Patrick McKeever
