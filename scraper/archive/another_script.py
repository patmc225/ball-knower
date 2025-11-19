import json

def transform_college(data):
    """
    Transform the 'college' field from a comma-separated string
    into a list of trimmed strings for each player entry.
    """
    def split_college(college_str):
        # Split by commas and strip whitespace
        return [c.strip() for c in college_str.split(',') if c.strip()]

    if isinstance(data, dict):
        # data is a dict of player_id -> player_info
        for player_id, info in data.items():
            if 'college' in info and isinstance(info['college'], str):
                info['college'] = split_college(info['college'])
    elif isinstance(data, list):
        # data is a list of player_info dicts
        for info in data:
            if 'college' in info and isinstance(info['college'], str):
                info['college'] = split_college(info['college'])
    else:
        raise RuntimeError("Unexpected JSON structure: expected dict or list.")

    return data

def main():
    # Load the JSON file
    input_path = 'nba_players_updated.json'
    output_path = 'nba_players_final.json'
    with open(input_path, 'r') as f:
        data = json.load(f)

    # Transform the college field
    updated_data = transform_college(data)

    # Write out the updated file
    with open(output_path, 'w') as f:
        json.dump(updated_data, f, indent=2)

    print(f"✅ Transformed 'college' into lists in '{output_path}'")

if __name__ == "__main__":
    main()
