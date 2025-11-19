# Data Files

## Active Data

### colleges_grouped.json
College name normalization mapping used by `college_normalizer.py`. Maps variant names to canonical forms.

Example:
```json
{
  "unc": ["North Carolina", "UNC", "U of North Carolina"],
  "ucla": ["UCLA", "University of California Los Angeles"]
}
```

### colleges.json
Flat list of college names extracted from Sports Reference sites.

## Generated Files (Git Ignored)

These files are generated during the scraping process:

- `players_nfl.json` - Raw NFL player list from Step 1
- `players_nba.json` - Raw NBA player list from Step 1
- `players_db_nfl.json` - NFL player database from Step 2
- `players_db_nba.json` - NBA player database from Step 2

## Final Output

The final merged and normalized output is saved to:
`../namegame/public/backend/players_new.json`

This file is used by the NameGame web application.

