import pandas as pd
import numpy as np

# Load the data
df = pd.read_csv('../data/2025/all_draft_data.csv')

# Bounded columns for min-max scaling
bounded_cols = [
    'pick_no', 'round',
    'qb_need', 'rb_need', 'wr_need', 'te_need', 'flex_need',
    'other_qb_need', 'other_rb_need', 'other_wr_need', 'other_te_need', 'other_flex_need',
    'qb_available', 'rb_available', 'wr_available', 'te_available', 'flex_available'
]

# VOR columns for standardization
vor_cols = ['qb_vor', 'rb_vor', 'wr_vor', 'te_vor', 'k_vor', 'flex_vor']

print('// Min-Max values for bounded columns:')
print('const minMax = {')
for col in bounded_cols:
    if col in df.columns:
        min_val = int(df[col].min())
        max_val = int(df[col].max())
        print(f'    {col}: {{min: {min_val}, max: {max_val}}},')
print('};')

print()
print('// Mean and Std values for VOR columns:')
print('const vorStats = {')
for col in vor_cols:
    if col in df.columns:
        mean_val = df[col].mean()
        std_val = df[col].std()
        print(f'    {col}: {{mean: {mean_val:.1f}, std: {std_val:.1f}}},')
print('};')

# Also show some basic stats
print('\n// Data summary:')
print(f'// Total rows: {len(df)}')
print(f'// Columns: {list(df.columns)}')
