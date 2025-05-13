import pandas as pd
import numpy as np
import requests

half_ppr = pd.read_csv('../data/2025/projections_half_ppr.csv')
std = pd.read_csv('../data/2025/projections_non_ppr.csv')
ppr = pd.read_csv('../data/2025/projections_ppr.csv')

def split_position_ranks(df,note):
    df.drop(columns=['rank'],inplace=True)
    df[['position', f'{note}_rank']] = df['position'].str.extract(r'([A-Za-z]+)(\d+)')

split_position_ranks(half_ppr,'half_ppr')
split_position_ranks(std,'std')
split_position_ranks(ppr,'ppr')

projections_full = pd.merge(std, half_ppr, on=['name', 'position', 'team'], how='outer')
projections_full = pd.merge(projections_full, ppr, on=['name', 'position', 'team'], how='outer')

projections_full.head()

url = "https://api.sleeper.app/v1/players/nfl"
response = requests.get(url)
player_data = response.json()

player_data_df = pd.DataFrame.from_dict(player_data, orient='index')

#player_data_df.to_csv('../data/player_data.csv', index=False)

player_data_df = pd.read_csv('../data/player_data.csv')

player_mapping = player_data_df[['player_id', 'full_name']]

projections_full = pd.merge(
    projections_full,
    player_mapping,
    left_on='name',
    right_on='full_name',
    how='left'
)

projections_full.drop(columns=['full_name'], inplace=True)
projections_full.dropna(subset=['player_id'], inplace=True)
projections_full.fillna(0, inplace=True)

#projections_full.to_csv('../data/projections_full.csv', index=False)


# Example: split by position
qb_projections = projections_full[projections_full['position'] == 'QB']
rb_projections = projections_full[projections_full['position'] == 'RB']
wr_projections = projections_full[projections_full['position'] == 'WR']
te_projections = projections_full[projections_full['position'] == 'TE']
k_projections  = projections_full[projections_full['position'] == 'K']
dst_projections = projections_full[projections_full['position'] == 'DST']

qb_projections.to_csv('../data/qb_projections.csv', index=False)
rb_projections.to_csv('../data/rb_projections.csv', index=False)
wr_projections.to_csv('../data/wr_projections.csv', index=False)
te_projections.to_csv('../data/te_projections.csv', index=False)
k_projections.to_csv('../data/k_projections.csv', index=False)

print("Projections data has been split by position and saved to CSV files.")