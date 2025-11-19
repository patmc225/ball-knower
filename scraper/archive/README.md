# Scraper Archive

This directory contains old scripts from the original scraping implementation. These files are preserved for reference but are **not used** in the current pipeline.

## Why These Are Archived

The original scraping approach used multiple one-off scripts that needed to be run in a specific sequence. This was error-prone and hard to maintain. The new implementation (`run_scraper.py`) consolidates everything into a single, well-organized pipeline.

## Archived Files

- `script.py`, `script2.py` - Original player fetching scripts
- `team.py`, `nfl_team.py` - Team scraping prototypes
- `number.py` - Jersey number scraping
- `nfl_college.py` - College data collection
- `merge.py` - Data merging logic
- `edit.py`, `edit_script.py` - Data manipulation utilities
- `concatanate.py` - File concatenation
- `another_script.py` - Additional data processing
- `nba_script.py` - NBA-specific scraper
- `nfl_fixer.py`, `nfl_capitalizer.py` - Data cleanup scripts
- `college_unique.py` - College name deduplication
- `sportscsv_convert.py` - CSV conversion utility

## Current Pipeline

Use `run_scraper.py` in the parent directory instead:

```bash
cd ..
python run_scraper.py
```

See `../README.md` for complete documentation.

---

**Note**: These files may be deleted in the future if they are no longer needed for reference.

