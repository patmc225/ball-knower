"""
NameGame Scraper - Player Data Collection Pipeline

This module orchestrates the complete data collection pipeline for NFL and NBA players,
including names, teams, jersey numbers, colleges, and years active.

Pipeline Steps:
    1. Fetch Players: Scrape player lists from Basketball/Football Reference
    2. Initialize DB: Convert lists to database format (dict by player ID)
    3. Fetch Teams: Get team affiliations (NFL includes numbers via uniform pages)
    4. Fetch Colleges/Numbers: NFL colleges from PFR, NBA numbers from BBR
    5. Merge & Normalize: Combine leagues and normalize college names

Usage:
    # Run complete pipeline
    python run_scraper.py

    # Run specific leagues
    python run_scraper.py --leagues NFL
    python run_scraper.py --leagues NBA

    # Run specific steps
    python run_scraper.py --steps 1 2 3

    # Custom output location
    python run_scraper.py --output /path/to/output.json

Rate Limiting:
    All requests enforce a 3.1-second delay (20 requests/minute) to comply with
    Sports Reference terms of service.

Output:
    Default: ../public/backend/players_new.json
    Format: Dictionary keyed by player ID with player attributes

Author: Patrick McKeever
"""

import argparse
from pathlib import Path

# Import scraper modules
from fetch_players import fetch_players
from init_db import init_db
from fetch_teams import fetch_teams
from fetch_numbers import fetch_numbers
from fetch_colleges import fetch_colleges
from merge_final import merge_final
from college_normalizer import run_normalization

def run_pipeline(leagues, steps, output_file):
    """
    Execute the scraping pipeline for specified leagues and steps.
    
    Args:
        leagues: List of league strings ('NFL', 'NBA')
        steps: List of step numbers to execute (1-5)
        output_file: Path for final merged output
        
    Steps:
        1. Fetch Players List - Scrape A-Z player index
        2. Initialize DB - Convert list to dictionary format
        3. Fetch Teams - Get team affiliations (NFL also gets numbers)
        4. Fetch Colleges/Numbers - NFL colleges, NBA numbers
        5. Merge & Normalize - Combine leagues and normalize college names
    """
    
    for league in leagues:
        league_lower = league.lower()
        list_file = f"players_{league_lower}.json"
        db_file = f"players_db_{league_lower}.json"
        
        print(f"\n{'='*60}")
        print(f"Processing {league}")
        print(f"{'='*60}\n")
        
        if 1 in steps:
            print(f"--- Step 1: Fetch Players List ---")
            fetch_players(league)
            
        if 2 in steps:
            print(f"\n--- Step 2: Initialize Database ---")
            if not Path(list_file).exists():
                print(f"Error: {list_file} not found. Run Step 1 first.")
                continue
            init_db(league, list_file, db_file)
            
        if 3 in steps:
            print(f"\n--- Step 3: Fetch Teams & Numbers ---")
            if league == 'NFL':
                print("(NFL: Teams and Numbers scraped via uniform pages)")
            else:
                print("(NBA: Teams only - numbers in Step 4)")
            
            if not Path(db_file).exists():
                print(f"Error: {db_file} not found. Run Step 2 first.")
                continue
            fetch_teams(league, db_file)
            
        if 4 in steps:
            if league == 'NFL':
                print(f"\n--- Step 4: Fetch Colleges (NFL) ---")
                if not Path(db_file).exists():
                    print(f"Error: {db_file} not found. Run Step 2 first.")
                    continue
                fetch_colleges(league, db_file)
            else:
                print(f"\n--- Step 4: Fetch Numbers (NBA) ---")
                if not Path(db_file).exists():
                    print(f"Error: {db_file} not found. Run Step 2 first.")
                    continue
                fetch_numbers(league, db_file)

    if 5 in steps:
        print(f"\n{'='*60}")
        print(f"Step 5: Merge & Normalize")
        print(f"{'='*60}\n")
        
        nfl_db = "players_db_nfl.json"
        nba_db = "players_db_nba.json"
        
        if not Path(nfl_db).exists():
            print(f"Warning: {nfl_db} missing. Merging only available data.")
        if not Path(nba_db).exists():
            print(f"Warning: {nba_db} missing. Merging only available data.")
            
        merge_final(nfl_db, nba_db, output_file)
        
        print(f"\n--- Normalizing College Names ---")
        if Path(output_file).exists():
            run_normalization(output_file)
        else:
            print(f"Error: Output file {output_file} not found. Cannot normalize.")
        
        print(f"\n{'='*60}")
        print(f"Pipeline Complete!")
        print(f"Output: {output_file}")
        print(f"{'='*60}\n")

def main():
    parser = argparse.ArgumentParser(
        description="NameGame Scraper - Collect NFL and NBA player data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_scraper.py                          # Run full pipeline
  python run_scraper.py --leagues NFL            # NFL only
  python run_scraper.py --steps 1 2 3            # First 3 steps
  python run_scraper.py --output custom.json     # Custom output path

Steps:
  1. Fetch Players      - Scrape player lists (names, years, NBA colleges)
  2. Initialize DB      - Convert to database format
  3. Fetch Teams        - Get team affiliations (NFL also gets numbers)
  4. Fetch Data         - NFL colleges OR NBA numbers
  5. Merge & Normalize  - Combine and normalize college names
        """
    )
    
    parser.add_argument(
        "--leagues", 
        nargs="+", 
        choices=["NBA", "NFL"], 
        default=["NBA", "NFL"],
        help="Leagues to scrape (default: both)"
    )
    
    parser.add_argument(
        "--steps", 
        nargs="+", 
        type=int, 
        default=[1, 2, 3, 4, 5],
        choices=[1, 2, 3, 4, 5],
        help="Pipeline steps to run (default: all)"
    )
    
    parser.add_argument(
        "--output",
        default="../namegame/public/backend/players_new.json",
        help="Output file path (default: ../namegame/public/backend/players_new.json)"
    )
    
    args = parser.parse_args()
    
    run_pipeline(args.leagues, args.steps, args.output)

if __name__ == '__main__':
    main()
