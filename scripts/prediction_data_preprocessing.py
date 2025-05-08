#%%
import pandas as pd
import numpy as np
import requests
#%%
half_ppr = pd.read_csv('../data/2025/projections_half_ppr.csv')
non_ppr = pd.read_csv('../data/2025/projections_non_ppr.csv')
ppr = pd.read_csv('../data/2025/projections_ppr.csv')
#%%
def split_position_ranks(df,note):
    df.drop(columns=['rank'],inplace=True)
    df[['position', f'{note}_rank']] = df['position'].str.extract(r'([A-Za-z]+)(\d+)')
#%%
split_position_ranks(half_ppr,'half_ppr')
split_position_ranks(non_ppr,'non_ppr')
split_position_ranks(ppr,'ppr')
#%%
projections_full = pd.merge(non_ppr, half_ppr, on=['name', 'position', 'team'], how='outer')
projections_full = pd.merge(projections_full, ppr, on=['name', 'position', 'team'], how='outer')
#%%
projections_full.head()
#%%
url = "https://api.sleeper.app/v1/players/nfl"
#response = requests.get(url)
#player_data = response.json()
#%%
#player_data_df = pd.DataFrame.from_dict(player_data, orient='index')
#player_data_df.to_csv('../data/player_data.csv', index=False)
player_data_df = pd.read_csv('../data/player_data.csv')
#%%
player_mapping = player_data_df[['player_id', 'full_name']]

projections_full = pd.merge(
    projections_full,
    player_mapping,
    left_on='name',
    right_on='full_name',
    how='left'
)

projections_full.drop(columns=['full_name'], inplace=True)
projections_full.rename(columns={'player_id': 'sleeper_id'}, inplace=True)
projections_full.dropna(subset=['sleeper_id'], inplace=True)
projections_full.fillna(0, inplace=True)
#%%
projections_full.to_csv('../data/projections_full.csv', index=False)