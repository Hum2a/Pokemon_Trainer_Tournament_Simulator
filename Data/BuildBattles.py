import json
import os
from itertools import combinations

def generate_tournament_matchups(input_file, output_file, run_n_times=100):
    RUN_N_TIMES = run_n_times

    # Read the JSON data from the input file
    with open(input_file, 'r') as file:
        gym_leaders_data = json.load(file)

    # Extract the teams into a list
    teams = list(gym_leaders_data.values())

    # Generate all possible pairs of teams for the tournament
    # Each matchup is repeated 100 times
    matchups = [[team1, team2] for team1, team2 in combinations(teams, 2) for _ in range(RUN_N_TIMES)]

    print(len(matchups))

    # Write the matchups to the output JSON file
    with open(output_file, 'w') as file:
        json.dump(matchups, file, indent=2)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="Inputs/GymLeaderTeams.json")
    parser.add_argument("--output", default="Inputs/tournament_battles.json")
    parser.add_argument("--runs", type=int, default=100, help="Battles per matchup")
    args = parser.parse_args()
    generate_tournament_matchups(args.input, args.output, args.runs)