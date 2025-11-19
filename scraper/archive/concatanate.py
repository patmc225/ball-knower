import json
import os

# Path to your JSON file
INPUT_PATH = "players_new.json"
# If you’d rather write to a new file instead of overwriting:
OUTPUT_PATH = "/Users/patrickmckeever/Desktop/NameGame/namegame/build/backend/players_new.json"
#OUTPUT_PATH = "players_new.json"

def prefix_teams(data):
    """
    Given the loaded JSON dict, mutate each player's "teams" list
    by prefixing every string with "nba_".
    """
    for player_id, player in data.items():
        if "teams" in player and isinstance(player["teams"], list):
            player["teams"] = [f"nba_{team}" for team in player["teams"]]
    return data

def main():
    # 1) Load
    with open(INPUT_PATH, "r") as f:
        players = json.load(f)

    # 2) Prefix
    players = prefix_teams(players)

    # 3) Write back out
    out_path = OUTPUT_PATH if os.path.isdir(os.path.dirname(OUTPUT_PATH)) else INPUT_PATH
    with open(out_path, "w") as f:
        json.dump(players, f, indent=2)
    print(f"Wrote updated data to {out_path}")

if __name__ == "__main__":
    main()