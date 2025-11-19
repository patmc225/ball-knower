# NameGame Scraper - Technical Overview

## Architecture

The scraper follows a modular pipeline architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        run_scraper.py                            │
│                   (Pipeline Orchestrator)                        │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├──► Step 1: fetch_players.py ──► players_{league}.json
             │
             ├──► Step 2: init_db.py ──► players_db_{league}.json
             │
             ├──► Step 3: fetch_teams.py ──► (updates DB)
             │                    │
             │                    ├─ NFL: uniform pages (teams + numbers)
             │                    └─ NBA: roster pages (teams only)
             │
             ├──► Step 4: fetch_colleges.py / fetch_numbers.py ──► (updates DB)
             │                    │
             │                    ├─ NFL: college pages
             │                    └─ NBA: number pages
             │
             └──► Step 5: merge_final.py + college_normalizer.py
                           │
                           └──► players_new.json (final output)
```

## Core Modules

### 1. `run_scraper.py` - Pipeline Orchestrator
- **Purpose**: Command-line interface and workflow coordination
- **Responsibilities**:
  - Parse command-line arguments
  - Execute pipeline steps in correct order
  - Handle errors and provide progress feedback
- **Key Functions**:
  - `run_pipeline(leagues, steps, output_file)`: Main orchestration logic
  - `main()`: CLI argument parsing

### 2. `utils.py` - Shared Utilities
- **Purpose**: Common functionality used across all scrapers
- **Responsibilities**:
  - HTTP requests with retry logic and rate limiting
  - JSON file I/O
- **Key Functions**:
  - `fetch_with_retry(url, session, max_retries=5)`: Rate-limited HTTP GET
  - `load_json(path)`: Load JSON from file
  - `save_json(data, path)`: Save JSON to file with formatting
- **Rate Limiting**: Enforces 3.1-second delay per request (20 req/min)

### 3. `config.py` - Configuration Constants
- **Purpose**: Centralized configuration
- **Contents**:
  - Base URLs for Sports Reference sites
  - Letter ranges (A-Z) for player index iteration
  - Jersey numbers (00, 0-99)
  - NBA team abbreviations
  - NFL teams (dynamically fetched, not hardcoded)

### 4. `fetch_players.py` - Step 1
- **Purpose**: Scrape initial player lists from A-Z index pages
- **Data Collected**:
  - NFL: name, URL, start year, end year
  - NBA: name, URL, start year, end year, colleges
- **Key Functions**:
  - `get_players_for_letter(base_url, letter, session, league)`: Parse one letter page
  - `fetch_players(league)`: Iterate through all letters
- **Output**: `players_nfl.json`, `players_nba.json` (array format)

### 5. `init_db.py` - Step 2
- **Purpose**: Convert array format to database format
- **Transformation**:
  - Extract player IDs from URLs
  - Convert array to dictionary keyed by ID
  - Initialize empty arrays for teams, numbers, colleges
- **Key Functions**:
  - `init_db(league, input_list_path, db_path)`
- **Output**: `players_db_nfl.json`, `players_db_nba.json` (dict format)

### 6. `fetch_teams.py` - Step 3
- **Purpose**: Scrape team affiliations (and NFL numbers)
- **NFL Approach**:
  - Dynamically fetch team abbreviations from `/teams/` page
  - For each team, iterate through numbers 0-99
  - Parse uniform pages: `/players/uniform.cgi?team={abbr}&number={num}`
  - Extract: player ID, team, number, years
- **NBA Approach**:
  - Iterate through hardcoded team abbreviations
  - Parse roster pages: `/teams/{abbr}/players.html`
  - Extract: player IDs (team affiliation)
- **Key Functions**:
  - `get_active_teams_nfl(session, base_url)`: Scrape team list
  - `extract_player_data_uniform(html, team_code)`: Parse uniform page
  - `fetch_teams_nfl(db_path, players)`: NFL logic
  - `fetch_teams_nba(db_path, players)`: NBA logic
- **Output**: Updates database files in place

### 7. `fetch_colleges.py` - Step 4 (NFL)
- **Purpose**: Scrape college affiliations for NFL players
- **Approach**:
  - Scrape college list from `/schools/` page
  - For each college, scrape player roster
  - Associate players with colleges
- **Key Functions**:
  - `scrape_schools(session, base_url)`: Get college list
  - `scrape_players_from_school(school_url, session)`: Get players per college
  - `fetch_colleges(league, db_path)`: Main logic
- **Output**: Updates `players_db_nfl.json`

### 8. `fetch_numbers.py` - Step 4 (NBA)
- **Purpose**: Scrape jersey numbers for NBA players
- **Approach**:
  - Iterate through numbers 0-99
  - Parse number pages: `/friv/numbers.fcgi?number={num}`
  - Associate players with numbers
- **Key Functions**:
  - `extract_player_ids(html)`: Parse number page
  - `fetch_numbers(league, db_path)`: Main logic
- **Output**: Updates `players_db_nba.json`
- **Note**: NFL numbers handled in Step 3

### 9. `merge_final.py` - Step 5a
- **Purpose**: Combine NFL and NBA databases
- **Approach**:
  - Load both league databases
  - Merge into single dictionary
  - Check for ID collisions (rare)
- **Key Functions**:
  - `merge_final(nfl_path, nba_path, output_path)`
- **Output**: Initial merged `players_new.json`

### 10. `college_normalizer.py` - Step 5b
- **Purpose**: Normalize college name variants
- **Approach**:
  - Load `colleges_grouped.json` mapping
  - Build canonical name mapping
  - Replace variant names with canonical forms
- **Key Functions**:
  - `build_canonical_map(grouped)`: Create variant->canonical mapping
  - `normalize_players(col_map, players)`: Apply normalization
  - `run_normalization(db_path)`: Main logic
- **Output**: Final normalized `players_new.json`

## Data Flow

### Player Record Evolution

**Step 1 Output** (List Format):
```json
{
  "name": "Sam Bradford",
  "url": "https://www.pro-football-reference.com/players/B/BradSa00.htm",
  "start_year": "2010",
  "end_year": "2018",
  "colleges": []
}
```

**Step 2 Output** (DB Format):
```json
{
  "BradSa00": {
    "id": "BradSa00",
    "name": "Sam Bradford",
    "url": "https://www.pro-football-reference.com/players/B/BradSa00.htm",
    "league": "NFL",
    "start_year": "2010",
    "end_year": "2018",
    "teams": [],
    "numbers": [],
    "colleges": []
  }
}
```

**Step 3 Output** (Teams Added):
```json
{
  "BradSa00": {
    ...
    "teams": ["nfl_STL", "nfl_PHI", "nfl_MIN", "nfl_ARI"],
    "numbers": ["8", "7"],
    ...
  }
}
```

**Step 4 Output** (Colleges Added):
```json
{
  "BradSa00": {
    ...
    "colleges": ["Oklahoma"],
    ...
  }
}
```

**Step 5 Output** (Merged & Normalized):
```json
{
  "BradSa00": { ... },
  "abdelal01": { ... },
  ...
}
```

## HTML Parsing Strategies

### Basketball-Reference (NBA)
- **Player Lists**: `<table id="players">` with structured data-stat attributes
- **Team Rosters**: `<table id="franchise_register">` or `<table id="roster">`
- **Number Pages**: `<table id="numbers">`

### Pro-Football-Reference (NFL)
- **Player Lists**: `<div id="div_players">` with `<p>` tags containing links
- **Team List**: `<table id="teams_active">`
- **Uniform Pages**: Dynamic tables with Player/From/To columns
- **College Pages**: `<table id="all_players">` or `<table id="college_stats_table">`

## Error Handling

### Network Errors
- Up to 5 retry attempts per request
- Exponential backoff: 2^attempt seconds
- Honors `Retry-After` header on 429 responses

### Data Errors
- Graceful handling of missing tables/fields
- Continues on individual page failures
- Incremental saves prevent data loss

### Rate Limiting
- Mandatory 3.1-second delay per request
- Automatic retry on 429 with extended wait
- Progress tracking shows estimated completion time

## Performance Characteristics

### Request Counts
- **NFL Step 1**: ~26 requests (letters A-Z)
- **NFL Step 3**: ~3,200 requests (32 teams × 100 numbers)
- **NFL Step 4**: ~200 requests (colleges)
- **NBA Step 1**: ~26 requests (letters a-z)
- **NBA Step 3**: ~30 requests (teams)
- **NBA Step 4**: ~100 requests (numbers)

### Estimated Times (at 20 req/min)
- **NFL Only**: ~3 hours
- **NBA Only**: ~8 minutes
- **Both Leagues**: ~3+ hours

### Memory Usage
- Moderate: ~100MB for full database
- Incremental saves minimize memory footprint

## File Organization

```
scraper/
├── run_scraper.py          # Main entry point
├── config.py               # Configuration constants
├── utils.py                # Shared utilities
├── fetch_players.py        # Step 1: Player lists
├── init_db.py              # Step 2: DB initialization
├── fetch_teams.py          # Step 3: Team affiliations
├── fetch_numbers.py        # Step 4: NBA numbers
├── fetch_colleges.py       # Step 4: NFL colleges
├── merge_final.py          # Step 5a: Merge leagues
├── college_normalizer.py   # Step 5b: Normalize colleges
├── colleges_grouped.json   # College name mapping
├── colleges.json           # College name list
├── README.md               # User documentation
├── DATA_FILES.md           # Data file documentation
├── TECHNICAL.md            # This file
├── .gitignore              # Git ignore rules
└── archive/                # Old scripts (not used)
    ├── README.md
    └── ... (legacy files)
```

## Extension Points

### Adding New Data Fields
1. Update scraper function to extract new field
2. Update `init_db.py` to initialize field
3. Update database schema documentation

### Supporting New Leagues
1. Add base URL to `config.py`
2. Add league-specific logic to scraper modules
3. Update `run_scraper.py` to handle new league

### Customizing Rate Limits
1. Modify `time.sleep(3.1)` in `utils.py`
2. Update documentation with new rate

## Testing Strategy

### Unit Testing (Individual Scrapers)
```bash
python fetch_players.py NFL
python fetch_teams.py NBA players_db_nba.json
```

### Integration Testing (Full Pipeline)
```bash
python run_scraper.py --leagues NFL --steps 1 2 3
```

### Validation
- Check output file exists and is valid JSON
- Verify record counts match expected ranges
- Spot-check individual player records for completeness

## Maintenance

### Regular Updates
Run the scraper periodically to capture:
- New players entering the leagues
- Roster changes (trades, signings)
- Updated jersey numbers

### Monitoring
Watch for:
- Increased 429 responses (adjust rate limit)
- HTML structure changes (update parsers)
- New teams (update team lists)

### Debugging
- Check individual scraper outputs
- Review request logs for failures
- Validate intermediate JSON files

---

**Last Updated**: November 2025
**Version**: 2.0 (Refactored Pipeline)

