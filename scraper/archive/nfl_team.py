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

def get_active_teams():
    """
    Scrape the main /teams/ page and return a list of
    (abbr, full_name) for each active NFL franchise.
    """
    soup = get_soup(f"{BASE_URL}/teams/")
    # Find the “Active Franchises” section:
    table = soup.find("table", id="teams_active")
    teams = []
    for row in table.tbody.find_all("tr"):
        link = row.find("th").find("a", href=True)
        if not link:
            continue
        # e.g. link['href'] = '/teams/crd/'
        abbr = os.path.basename(os.path.dirname(link["href"]))
        full_name = link.text.strip()
        teams.append((abbr, full_name))
    return teams

def scrape_players_for_team(abbr):
    """
    Given a team abbr (e.g. 'crd'), fetch /teams/{abbr}/career-av.htm
    and return a list of player IDs on that page.
    """
    url = f"{BASE_URL}/teams/{abbr}/career-av.htm"
    soup = get_soup(url)
    # Locate the Approximate Value table by its caption
    table = soup.find("table", id="av")
    player_ids = []
    for row in table.tbody.find_all("tr"):
        cell = row.find("td", {"data-stat": "player"})
        if not cell:
            continue
        link = cell.find("a", href=True)
        if not link:
            continue
        # Extract the ID (e.g. 'FitzLa00') from '/players/F/FitzLa00.htm'
        pid = os.path.splitext(os.path.basename(link["href"]))[0]
        player_ids.append(pid)
    return player_ids

def main():
    # 1) Load existing data
    with open("players_by_id_college.json", "r") as f:
        players = json.load(f)

    # 2) Get active franchises
    teams = get_active_teams()
    print(f"Found {len(teams)} active teams.")
    print(teams)

    # 3) For each team, add its name to each player's 'teams' list
    for idx, (abbr, full_name) in enumerate(teams, 1):
        print(f"[{idx}/{len(teams)}] Scraping {full_name} ({abbr}) …", end=" ")
        pids = scrape_players_for_team(abbr)
        print(f"found {len(pids)} players.")
        for pid in pids:
            if pid in players:
                team_list = players[pid].setdefault("teams", [])
                if full_name not in team_list:
                    team_list.append("nfl_" + abbr)
        # Respect 20 requests per minute
        time.sleep(3)

    # 4) Write back out
    with open("nfl_full.json", "w") as f:
        json.dump(players, f, indent=2)
    print("Updated players_by_id_college.json.")

if __name__ == "__main__":
    main()