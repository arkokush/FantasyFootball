import pandas as pd
import numpy as np
import requests


def main():
    draft_ids = {
        "std": [
            1224007842931937280,
            1225537361266360320,
            1226238212440068096,
            1226239151213391872,
            1226239327491596288,
        ],
        "half_ppr": [
            1226239627019419648,
            1226239805541593088,
            1226240040112246784,
            1226240173625311232,
            1226240308937768960,
        ],
        "ppr": [
            1226240520171307008,
            1226240849864568832,
            1226241106484678656,
            1226241287234007040,
            1226241366703489024,
        ],
    }

    all_dfs = []
    for scoring_type, ids in draft_ids.items():
        for draft_id in ids:
            df = get_draft_data(draft_id)
            if df is not None:
                df['draft_id'] = draft_id  # Optionally add draft_id column
                all_dfs.append(df)

    if all_dfs:
        big_df = pd.concat(all_dfs, ignore_index=True)
        big_df.to_csv('../data/all_draft_data.csv', index=False)
        print("Saved all draft data to all_draft_data.csv")
    else:
        print("No data to save.")


def get_draft_data(draft_id):
    draft_url = f"https://api.sleeper.app/v1/draft/{draft_id}"
    draft_responce = requests.get(draft_url)
    picks_data = get_raw_draft_picks(draft_id)

    if picks_data is not None and draft_responce.status_code == 200:
        draft_data = draft_responce.json()
        return initialize_df(draft_data, picks_data)
    else:
        print(f"Error: {draft_responce.status_code}")
        return None




def get_raw_draft_picks(draft_id):
    url = f"https://api.sleeper.app/v1/draft/{draft_id}/picks"
    responce = requests.get(url)
    if responce.status_code == 200:
        data = responce.json()
        df =  pd.DataFrame.from_dict(data)
        df['position'] = df['metadata'].apply(lambda x: x.get('position') if isinstance(x, dict) else None)
        return df[['pick_no', 'round', 'player_id', 'draft_slot', 'draft_id', 'position']]
    else:
        print(f"Error: {responce.status_code}")
        return None

def get_team_total_needs(draft_data):
    teams = draft_data['settings']['teams']
    wr_slots = draft_data['settings']['slots_wr']
    te_slots = draft_data['settings']['slots_te']
    rb_slots = draft_data['settings']['slots_rb']
    qb_slots = draft_data['settings']['slots_qb']
    k_slots = draft_data['settings']['slots_k']
    flex_slots = draft_data['settings']['slots_flex']
    dst_slots = draft_data['settings']['slots_def']
    bn_slots = draft_data['settings']['rounds']-(qb_slots+rb_slots+wr_slots+te_slots+k_slots+dst_slots+flex_slots)
    team_needs = []
    for i in range(teams):
        team_needs.append({
            'team_id': i,
            'qb_slots': qb_slots,
            'rb_slots': rb_slots,
            'wr_slots': wr_slots,
            'te_slots': te_slots,
            'k_slots': k_slots,
            'flex_slots': flex_slots,
            'dst_slots': dst_slots,
            'total_slots': bn_slots+qb_slots+rb_slots+wr_slots+te_slots+k_slots+dst_slots
        })
    total_needs = {
        'qb_slots': qb_slots*teams,
        'rb_slots': rb_slots*teams,
        'wr_slots': wr_slots*teams,
        'te_slots': te_slots*teams,
        'k_slots': k_slots*teams,
        'flex_slots': flex_slots*teams,
        'dst_slots': dst_slots*teams,
        'total_slots': (bn_slots+qb_slots+rb_slots+wr_slots+te_slots+k_slots+dst_slots)*teams
    }
    return team_needs, total_needs

def initialize_df(draft_data, picks_data):
    columns = [
        'pick_no', 'round', 'scoring_type',
        'qb_need', 'rb_need', 'wr_need', 'te_need', 'k_need', 'dst_need', 'flex_need',
        'other_qb_need', 'other_rb_need', 'other_wr_need', 'other_te_need', 'other_k_need', 'other_dst_need',
        'other_flex_need',
        'qb_available', 'rb_available', 'wr_available', 'te_available', 'k_available', 'dst_available',
        'flex_available',
        'qb_vor', 'rb_vor', 'wr_vor', 'te_vor', 'k_vor', 'flex_vor',
        'position_drafted'
    ]

    team_needs, total_needs = get_team_total_needs(draft_data)
    scoring_type = draft_data['metadata']['scoring_type']

    qb_projections = pd.read_csv('../data/qb_projections.csv').sort_values(by=scoring_type)
    rb_projections = pd.read_csv('../data/rb_projections.csv').sort_values(by=scoring_type)
    wr_projections = pd.read_csv('../data/wr_projections.csv').sort_values(by=scoring_type)
    te_projections = pd.read_csv('../data/te_projections.csv').sort_values(by=scoring_type)
    k_projections = pd.read_csv('../data/k_projections.csv').sort_values(by=scoring_type)
    dst_projections = pd.read_csv('../data/dst_projections.csv')

    qb_projections['drafted'] = False
    rb_projections['drafted'] = False
    wr_projections['drafted'] = False
    te_projections['drafted'] = False
    k_projections['drafted'] = False
    dst_projections['drafted'] = False

    qb_projections['player_id'] = qb_projections['player_id'].astype(str)
    rb_projections['player_id'] = rb_projections['player_id'].astype(str)
    wr_projections['player_id'] = wr_projections['player_id'].astype(str)
    te_projections['player_id'] = te_projections['player_id'].astype(str)
    k_projections['player_id'] = k_projections['player_id'].astype(str)
    dst_projections['player_id'] = dst_projections['player_id'].astype(str)

    scoring_map = {
        'std': 0,
        'half_ppr': 0.5,
        'ppr': 1
    }

    scoring = scoring_map.get(scoring_type, 0)
    scoring_rank = scoring_type + '_rank'

    qb_base = qb_projections.iloc[total_needs['qb_slots']][scoring_type]
    rb_base = rb_projections.iloc[total_needs['qb_slots']][scoring_type]
    wr_base = wr_projections.iloc[total_needs['qb_slots']][scoring_type]
    te_base = te_projections.iloc[total_needs['qb_slots']][scoring_type]
    k_base = k_projections.iloc[total_needs['qb_slots']][scoring_type]

    rows = []
    for i, row in picks_data.iterrows():
        current_team = row['draft_slot'] - 1
        current_team_needs = team_needs[row['draft_slot'] - 1]
        player_id = str(row['player_id'])

        pick_no = row['pick_no']
        round_num = row['round']
        qb_need = current_team_needs['qb_slots']
        rb_need = current_team_needs['rb_slots']
        wr_need = current_team_needs['wr_slots']
        te_need = current_team_needs['te_slots']
        k_need = current_team_needs['k_slots']
        dst_need = current_team_needs['dst_slots']
        flex_need = current_team_needs['flex_slots']
        other_qb_need = total_needs['qb_slots'] - qb_need
        other_rb_need = total_needs['rb_slots'] - rb_need
        other_wr_need = total_needs['wr_slots'] - wr_need
        other_te_need = total_needs['te_slots'] - te_need
        other_k_need = total_needs['k_slots'] - k_need
        other_dst_need = total_needs['dst_slots'] - dst_need
        other_flex_need = total_needs['flex_slots'] - flex_need
        qb_available = qb_projections[qb_projections['drafted'] == False].shape[0]
        rb_available = rb_projections[rb_projections['drafted'] == False].shape[0]
        wr_available = wr_projections[wr_projections['drafted'] == False].shape[0]
        te_available = te_projections[te_projections['drafted'] == False].shape[0]
        k_available = k_projections[k_projections['drafted'] == False].shape[0]
        dst_available = dst_projections[dst_projections['drafted'] == False].shape[0]
        flex_available = rb_available + wr_available + te_available
        qb_vor = qb_projections[qb_projections['drafted'] == False][scoring_type].max() - qb_base
        rb_vor = (rb_projections[rb_projections['drafted'] == False][scoring_type].max() - rb_base)
        wr_vor = (wr_projections[wr_projections['drafted'] == False][scoring_type].max() - wr_base)
        te_vor = (te_projections[te_projections['drafted'] == False][scoring_type].max() - te_base)
        flex_vor = max(rb_vor, wr_vor, te_vor)
        k_vor = k_projections[k_projections['drafted'] == False][scoring_type].max() - k_base
        position_drafted = row['position']

        rows.append({
            'pick_no': pick_no,
            'round': round_num,
            'scoring_type': scoring,
            'qb_need': qb_need,
            'rb_need': rb_need,
            'wr_need': wr_need,
            'te_need': te_need,
            'k_need': k_need,
            'dst_need': dst_need,
            'flex_need': flex_need,
            'other_qb_need': other_qb_need,
            'other_rb_need': other_rb_need,
            'other_wr_need': other_wr_need,
            'other_te_need': other_te_need,
            'other_k_need': other_k_need,
            'other_dst_need': other_dst_need,
            'other_flex_need': other_flex_need,
            'qb_available': qb_available,
            'rb_available': rb_available,
            'wr_available': wr_available,
            'te_available': te_available,
            'k_available': k_available,
            'dst_available': dst_available,
            'flex_available': flex_available,
            'qb_vor': qb_vor,
            'rb_vor': rb_vor,
            'wr_vor': wr_vor,
            'te_vor': te_vor,
            'k_vor': k_vor,
            'flex_vor': flex_vor,
            'position_drafted': position_drafted
        })

        if position_drafted == 'QB':
            update_drafted_status(position_drafted, player_id, qb_projections, team_needs, total_needs, current_team)
        elif position_drafted == 'RB':
            update_drafted_status(position_drafted, player_id, rb_projections, team_needs, total_needs, current_team)
        elif position_drafted == 'WR':
            update_drafted_status(position_drafted, player_id, wr_projections, team_needs, total_needs, current_team)
        elif position_drafted == 'TE':
            update_drafted_status(position_drafted, player_id, te_projections, team_needs, total_needs, current_team)
        elif position_drafted == 'K':
            update_drafted_status(position_drafted, player_id, k_projections, team_needs, total_needs, current_team)
        elif position_drafted == 'DST':
            update_drafted_status(position_drafted, player_id, dst_projections, team_needs, total_needs, current_team)

    full_data = pd.DataFrame(rows, columns=columns)
    return full_data


def update_drafted_status(position_drafted, player_id, df, team_needs, total_needs, current_team):
    pos_map = {
        'QB': 'qb_slots',
        'RB': 'rb_slots',
        'WR': 'wr_slots',
        'TE': 'te_slots',
        'K': 'k_slots',
        'DEF': 'dst_slots'
    }
    slot_key = pos_map.get(position_drafted)
    if slot_key and team_needs[current_team][slot_key] > 0:
        team_needs[current_team][slot_key] -= 1
        total_needs[slot_key] -= 1
    elif position_drafted in ['RB', 'WR', 'TE'] and team_needs[current_team]['flex_slots'] > 0:
        team_needs[current_team]['flex_slots'] -= 1
        total_needs['flex_slots'] -= 1

    df.loc[df['player_id'] == player_id, 'drafted'] = True

if __name__ == "__main__":
    main()