import pandas as pd
import os

# Define bye weeks for each team
bye_weeks = {
    'CHI': 5, 'ATL': 5, 'GB': 5, 'PIT': 5,  # Week 5
    'HOU': 6, 'MIN': 6,                      # Week 6
    'BUF': 7, 'BAL': 7,                      # Week 7
    'ARI': 8, 'JAC': 8, 'JAX': 8, 'DET': 8, 'LAR': 8, 'LV': 8, 'LVR': 8, 'SEA': 8,  # Week 8
    'CLE': 9, 'TB': 9, 'PHI': 9, 'NYJ': 9,   # Week 9
    'CIN': 10, 'KC': 10, 'DAL': 10, 'TEN': 10,  # Week 10
    'IND': 11, 'NO': 11,                     # Week 11
    'DEN': 12, 'LAC': 12, 'WAS': 12, 'MIA': 12,  # Week 12
    'SF': 14, 'NYG': 14, 'CAR': 14, 'NE': 14    # Week 14
}

# List of files to update
files = [
    'rb_projections.csv',
    'wr_projections.csv',
    'projections_non_ppr.csv',
    'te_projections.csv',
    'projections_half_ppr.csv',
    'qb_projections.csv',
    'projections_full.csv',
    'projections_ppr.csv',
    'k_projections.csv',
    'dst_projections.csv'
]

# Process each file
data_dir = '/Users/arkadykokush/WebstormProjects/FantasyFootball/data/2025/'
for filename in files:
    filepath = os.path.join(data_dir, filename)

    try:
        # Check if file exists
        if not os.path.exists(filepath):
            print(f"File not found: {filename}")
            continue

        # Read the CSV file
        print(f"Processing {filename}...")
        df = pd.read_csv(filepath)

        # Check if team column exists
        if 'team' not in df.columns:
            print(f"  No team column in {filename}, skipping")
            continue

        # Check if BYE column already exists
        if 'BYE' in df.columns:
            print(f"  BYE column already exists in {filename}, updating values")
            df.drop('BYE', axis=1, inplace=True)

        # Add BYE column
        df['BYE'] = df['team'].map(bye_weeks)

        # Fill NaN values with 'N/A'
        df['BYE'].fillna('N/A', inplace=True)

        # Save the updated file
        df.to_csv(filepath, index=False)
        print(f"  Added BYE column to {filename}")

    except Exception as e:
        print(f"Error processing {filename}: {str(e)}")

print("\nAll files processed successfully!")
