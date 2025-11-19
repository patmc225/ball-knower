import requests
from bs4 import BeautifulSoup
import json
import os
import time

BASE_URL = "https://www.pro-football-reference.com"

def get_soup(url):
    """Fetches `url` and returns a BeautifulSoup object."""
    resp = requests.get(url)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")

def scrape_schools():
    """Returns a list of (school_name, school_url) tuples."""
    soup = get_soup(f"{BASE_URL}/schools/")
    table = soup.find("table", id="college_stats_table")
    schools = []
    for row in table.tbody.find_all("tr"):
        if(row.find("td") is None):
            continue
        link = row.find("td", {"data-stat": "college_name"}).find("a", href=True)
        if not link: 
            continue
        name = link.text.strip()
        href = link["href"]
        schools.append((name, BASE_URL + href))
    return schools

def scrape_players_from_school(school_url):
    """Returns a list of player IDs (e.g. 'BradyTo00') for one school page."""
    soup = get_soup(school_url)
    table = soup.find("table", id="all_players")
    if not table:
        return []
    player_ids = []
    #print(len(table.tbody.find_all("tr")))
    for row in table.tbody.find_all("tr"):
        cell = row.find("td", {"data-stat": "player"})
        link = cell.find("a", href=True)
        if not link:
            print(cell)
            continue
        # link['href'] like '/players/B/BradyTo00.htm'
        pid = os.path.splitext(os.path.basename(link["href"]))[0]
        player_ids.append(pid)
    return player_ids

def main():
    # 1) Load existing data
    with open("players_by_id.json", "r") as f:
        players = json.load(f)

    # 2) Scrape schools
    schools = scrape_schools()
    print(f"Found {len(schools)} schools.")

    # 3) For each school, add it to each player's 'colleges' list
    for idx, (school_name, school_url) in enumerate(schools, 1):
        print(f"[{idx}/{len(schools)}] Scraping {school_name} …", end=" ")
        player_ids = scrape_players_from_school(school_url)
        print(f"found {len(player_ids)} players.")

        for pid in player_ids:
            if pid in players:
                cols = players[pid].setdefault("colleges", [])
                if school_name not in cols:
                    cols.append(school_name)

        # Be polite to the server
        time.sleep(3.1)

    # 4) Write back out
    with open("players_by_id_college.json", "w") as f:
        json.dump(players, f, indent=2)
    print("Updated players_by_id.json.")


if __name__ == "__main__":
    main()