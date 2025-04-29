import pandas as pd

qb24actual = pd.read_csv('../data/2024/qb_actual24.csv')
rb24actual = pd.read_csv('../data/2024/rb_actual24.csv')
wr24actual = pd.read_csv('../data/2024/wr_actual24.csv')
te24actual = pd.read_csv('../data/2024/te_actual24.csv')
k24actual = pd.read_csv('../data/2024/k_actual24.csv')
dst24actual = pd.read_csv('../data/2024/dst_actual24.csv')

qb24projections = pd.read_csv('../data/2024/qb_projections24.csv')
rb24projections = pd.read_csv('../data/2024/rb_projections24.csv')
wr24projections = pd.read_csv('../data/2024/wr_projections24.csv')
te24projections = pd.read_csv('../data/2024/te_projections24.csv')
k24projections = pd.read_csv('../data/2024/k_projections24.csv')
dst24projections = pd.read_csv('../data/2024/dst_projections24.csv')

def remove_symbols(df):
    return df.replace([',', '%'], '', regex=True)

def split_player_team(df):
    if 'Team' not in df.columns and 'Player' in df.columns and 'SAFETY' not in df.columns:
        df[['Player', 'Team']] = df['Player'].str.extract(r'^(.*) \((.*)\)$')
    return df

def rename_columns(df, keyword):
    df.columns = [f"{keyword}{col}" if col not in ['Player', 'Team'] else col for col in df.columns]
    return df

def merge_dataframes(df1, df2):
    if df1.empty:
        return df2
    if df2.empty:
        return df1
    if 'Team' in df1.columns or 'Team' not in df2.columns:
        return pd.merge(df1, df2, on=['Player'], how='outer')
    else:
       return pd.merge(df1, df2, on=['Player', 'Team'], how='outer')

dataframes = [
    qb24actual, rb24actual, wr24actual, te24actual, k24actual, dst24actual,
    qb24projections, rb24projections, wr24projections, te24projections, k24projections, dst24projections
]

dataframes = [remove_symbols(df) for df in dataframes]
dataframes = [split_player_team(df) for df in dataframes]

for i in range(0, len(dataframes)):
    if i < len(dataframes)/2:
        dataframes[i] = rename_columns(dataframes[i], 'actual_')
    else:
        dataframes[i] = rename_columns(dataframes[i], 'projections_')

(qb24actual, rb24actual, wr24actual, te24actual, k24actual, dst24actual,
 qb24projections, rb24projections, wr24projections, te24projections, k24projections, dst24projections) = dataframes

qb24full = merge_dataframes(qb24actual, qb24projections).dropna()
rb24full = merge_dataframes(rb24actual, rb24projections).dropna()
wr24full = merge_dataframes(wr24actual, wr24projections).dropna()
te24full = merge_dataframes(te24actual, te24projections).dropna()
k24full = merge_dataframes(k24actual, k24projections).dropna()
dst24full = merge_dataframes(dst24actual, dst24projections).dropna()

qb24full.drop(columns=['Team_y'], inplace=True)
qb24full.rename(columns={'Team_x': 'Team'}, inplace=True)

rb24full.drop(columns=['Team_y'], inplace=True)
rb24full.rename(columns={'Team_x': 'Team'}, inplace=True)

wr24full.drop(columns=['Team_y'], inplace=True)
wr24full.rename(columns={'Team_x': 'Team'}, inplace=True)

te24full.drop(columns=['Team_y'], inplace=True)
te24full.rename(columns={'Team_x': 'Team'}, inplace=True)

k24full.drop(columns=['Team_y'], inplace=True)
k24full.rename(columns={'Team_x': 'Team'}, inplace=True)

dst24full = dst24full[['Player', 'Team', 'actual_Rank'] + [col for col in dst24full.columns if col not in ['Player', 'Team', 'actual_Rank']]]
qb24full = qb24full[['Player', 'Team', 'actual_Rank'] + [col for col in qb24full.columns if col not in ['Player', 'Team', 'actual_Rank']]]
rb24full = rb24full[['Player', 'Team', 'actual_Rank'] + [col for col in rb24full.columns if col not in ['Player', 'Team', 'actual_Rank']]]
wr24full = wr24full[['Player', 'Team', 'actual_Rank'] + [col for col in wr24full.columns if col not in ['Player', 'Team', 'actual_Rank']]]
te24full = te24full[['Player', 'Team', 'actual_Rank'] + [col for col in te24full.columns if col not in ['Player', 'Team', 'actual_Rank']]]
k24full = k24full[['Player', 'Team', 'actual_Rank'] + [col for col in k24full.columns if col not in ['Player', 'Team', 'actual_Rank']]]

dst24full = dst24full.sort_values(by='actual_Rank')
qb24full = qb24full.sort_values(by='actual_Rank')
rb24full = rb24full.sort_values(by='actual_Rank')
wr24full = wr24full.sort_values(by='actual_Rank')
te24full = te24full.sort_values(by='actual_Rank')
k24full = k24full.sort_values(by='actual_Rank')

qb24full.to_csv('../data/qb24full.csv', index=False)
rb24full.to_csv('../data/rb24full.csv', index=False)
wr24full.to_csv('../data/wr24full.csv', index=False)
te24full.to_csv('../data/te24full.csv', index=False)
k24full.to_csv('../data/k24full.csv', index=False)
dst24full.to_csv('../data/dst24full.csv', index=False)