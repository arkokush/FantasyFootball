// main.js

// --- Draft Settings ---
function getDraftSettings() {
    return {
        numTeams: parseInt(document.getElementById('num-teams').value, 10),
        numQBs: parseInt(document.getElementById('num-qbs').value, 10),
        numRBs: parseInt(document.getElementById('num-rbs').value, 10),
        numWRs: parseInt(document.getElementById('num-wrs').value, 10),
        numTEs: parseInt(document.getElementById('num-tes').value, 10),
        numKs: parseInt(document.getElementById('num-ks').value, 10),
        numFlex: parseInt(document.getElementById('num-flex').value, 10),
        numDST: parseInt(document.getElementById('num-dst').value, 10),
        numBench: parseInt(document.getElementById('num-bench').value, 10)
    };
}

// --- Player Names ---
const playerNamesByPos = {};
async function loadPlayerNames(position) {
    const fileMap = {
        QB: 'qb_projections.csv',
        RB: 'rb_projections.csv',
        WR: 'wr_projections.csv',
        TE: 'te_projections.csv',
        K: 'k_projections.csv',
        DST: 'dst_projections.csv'
    };
    if (position === 'FLEX') {
        const files = ['rb_projections.csv', 'wr_projections.csv', 'te_projections.csv'];
        let names = [];
        for (const file of files) {
            const res = await fetch(`../data/2025/${file}`);
            const text = await res.text();
            const [header, ...rows] = text.trim().split('\n');
            const keys = header.split(',');
            const nameIdx = keys.indexOf('name');
            if (nameIdx !== -1) {
                names = names.concat(rows.map(row => row.split(',')[nameIdx]).filter(Boolean));
            }
        }
        return [...new Set(names)];
    }
    if (position === 'Bench') {
        const res = await fetch('../data/2025/projections_full.csv');
        const text = await res.text();
        const [header, ...rows] = text.trim().split('\n');
        const keys = header.split(',');
        const nameIdx = keys.indexOf('name');
        if (nameIdx === -1) return [];
        return rows.map(row => row.split(',')[nameIdx]).filter(Boolean);
    }
    const file = fileMap[position];
    if (!file) return [];
    const res = await fetch(`../data/2025/${file}`);
    const text = await res.text();
    const [header, ...rows] = text.trim().split('\n');
    const keys = header.split(',');
    const nameIdx = keys.indexOf('name');
    if (nameIdx === -1) return [];
    return rows.map(row => row.split(',')[nameIdx]).filter(Boolean);
}
async function preloadAllPlayerNames() {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'FLEX', 'DST', 'Bench'];
    for (const pos of positions) {
        playerNamesByPos[pos] = await loadPlayerNames(pos);
    }
}

// --- Unavailable Players Logic ---
const unavailablePlayers = new Set();
function updateDropdowns() {
    document.querySelectorAll('select').forEach(select => {
        Array.from(select.options).forEach(option => {
            if (option.value && unavailablePlayers.has(option.value)) {
                option.disabled = true;
            } else {
                option.disabled = false;
            }
        });
    });
}
document.body.addEventListener('change', function(e) {
    if (e.target.tagName === 'SELECT') {
        unavailablePlayers.clear();
        document.querySelectorAll('select').forEach(select => {
            if (select.value) unavailablePlayers.add(select.value);
        });
        updateDropdowns();
    }
});

// --- Scoring Type Helper ---
function getScoringType() {
    const val = document.getElementById('scoring-type').value;
    if (val === 'ppr') return 1;
    if (val === 'half-ppr') return 0.5;
    return 0;
}

// --- Projected Points Helper ---
function getProjectedPoints(player, scoringType) {
    // Use correct CSV fields: std, half_ppr, ppr
    if (scoringType === 1 && player.ppr !== undefined && !isNaN(player.ppr)) return player.ppr;
    if (scoringType === 0.5 && player.half_ppr !== undefined && !isNaN(player.half_ppr)) return player.half_ppr;
    if (player.std !== undefined && !isNaN(player.std)) return player.std;
    // fallback for legacy fields
    if (scoringType === 1 && player.projected_points_ppr !== undefined && !isNaN(player.projected_points_ppr)) return player.projected_points_ppr;
    if (scoringType === 0.5 && player.projected_points_half_ppr !== undefined && !isNaN(player.projected_points_half_ppr)) return player.projected_points_half_ppr;
    if (player.projected_points !== undefined && !isNaN(player.projected_points)) return player.projected_points;
    return 0;
}

// --- VOR Calculation ---
function getBaseValue(position, availablePlayers, numRequired, scoringType) {
    // availablePlayers[position] should be sorted by projected points DESC for the scoring type
    const idx = numRequired; // nth+1, zero-based
    if (!availablePlayers[position] || availablePlayers[position].length <= idx) return 0;
    return getProjectedPoints(availablePlayers[position][idx], scoringType);
}

function getHighestVOR(position, availablePlayers, numRequired, scoringType) {
    if (!availablePlayers[position] || availablePlayers[position].length === 0) return 0;
    const base = getBaseValue(position, availablePlayers, numRequired, scoringType);
    const topPlayer = availablePlayers[position][0];
    return getProjectedPoints(topPlayer, scoringType) - base;
}

// --- CSV Loader and Player Cache ---
const playerDataCache = {};

async function loadPlayersForPosition(position) {
    const fileMap = {
        qb: 'qb_projections.csv',
        rb: 'rb_projections.csv',
        wr: 'wr_projections.csv',
        te: 'te_projections.csv',
        k: 'k_projections.csv',
        dst: 'dst_projections.csv'
    };
    if (playerDataCache[position]) return playerDataCache[position];

    let files = [];
    if (position === 'flex') {
        files = ['rb_projections.csv', 'wr_projections.csv', 'te_projections.csv'];
    } else {
        const file = fileMap[position];
        if (!file) return [];
        files = [file];
    }

    let players = [];
    for (const file of files) {
        const res = await fetch(`../data/2025/${file}`);
        const text = await res.text();
        const [header, ...rows] = text.trim().split('\n');
        const keys = header.split(',');
        for (const row of rows) {
            const vals = row.split(',');
            const obj = {};
            keys.forEach((k, i) => {
                // Map CSV fields to correct property names and parse as numbers
                if (k === 'std') obj.std = parseFloat(vals[i]);
                else if (k === 'half_ppr') obj.half_ppr = parseFloat(vals[i]);
                else if (k === 'ppr') obj.ppr = parseFloat(vals[i]);
                else if (k === 'projected_points') obj.projected_points = parseFloat(vals[i]);
                else if (k === 'projected_points_half_ppr') obj.projected_points_half_ppr = parseFloat(vals[i]);
                else if (k === 'projected_points_ppr') obj.projected_points_ppr = parseFloat(vals[i]);
                else obj[k] = vals[i];
            });
            players.push(obj);
        }
    }
    playerDataCache[position] = players;
    return players;
}

// --- Available Players Loader ---
function getAvailablePlayersSync() {
    // This function is only used after all player data is loaded (after preloadAllPlayerNames)
    // and after at least one call to getAvailablePlayersAsync has populated the cache.
    const scoringType = getScoringType();
    const filterAndSort = (arr) => arr
        .filter(p => !unavailablePlayers.has(p.name))
        .sort((a, b) => getProjectedPoints(b, scoringType) - getProjectedPoints(a, scoringType));
    return {
        qb: playerDataCache.qb ? filterAndSort(playerDataCache.qb) : [],
        rb: playerDataCache.rb ? filterAndSort(playerDataCache.rb) : [],
        wr: playerDataCache.wr ? filterAndSort(playerDataCache.wr) : [],
        te: playerDataCache.te ? filterAndSort(playerDataCache.te) : [],
        k: playerDataCache.k ? filterAndSort(playerDataCache.k) : [],
        flex: (playerDataCache.rb && playerDataCache.wr && playerDataCache.te)
            ? filterAndSort([...playerDataCache.rb, ...playerDataCache.wr, ...playerDataCache.te])
            : []
    };
}

async function getAvailablePlayersAsync() {
    // Loads and caches all player data if not already loaded
    await Promise.all([
        loadPlayersForPosition('qb'),
        loadPlayersForPosition('rb'),
        loadPlayersForPosition('wr'),
        loadPlayersForPosition('te'),
        loadPlayersForPosition('k'),
        loadPlayersForPosition('dst')
    ]);
    // flex is just a combination, no need to load separately
    return getAvailablePlayersSync();
}

// --- CSV/Recommendation Logic (update to async) ---
async function createCsvRowAsync(draftState) {
    const availablePlayers = getAvailablePlayersSync();
    const scoringType = draftState.scoring_type;
    const settings = getDraftSettings();
    const row = [
        draftState.pick_no,
        draftState.round,
        scoringType,
        draftState.qb_need,
        draftState.rb_need,
        draftState.wr_need,
        draftState.te_need,
        draftState.k_need,
        draftState.dst_need,
        draftState.flex_need,
        draftState.other_qb_need,
        draftState.other_rb_need,
        draftState.other_wr_need,
        draftState.other_te_need,
        draftState.other_k_need,
        draftState.other_dst_need,
        draftState.other_flex_need,
        draftState.qb_available,
        draftState.rb_available,
        draftState.wr_available,
        draftState.te_available,
        draftState.k_available,
        draftState.dst_available,
        draftState.flex_available,
        getHighestVOR('qb', availablePlayers, settings.numQBs, scoringType),
        getHighestVOR('rb', availablePlayers, settings.numRBs, scoringType),
        getHighestVOR('wr', availablePlayers, settings.numWRs, scoringType),
        getHighestVOR('te', availablePlayers, settings.numTEs, scoringType),
        getHighestVOR('k', availablePlayers, settings.numKs, scoringType),
        getHighestVOR('flex', availablePlayers, settings.numFlex, scoringType)
    ];
    return row.join(',');
}

// --- UI Creation (update to async) ---
function createRecommendationBox(numTeams, teamSelectRef) {
    let recBox = document.getElementById('recommendation-box');
    if (!recBox) {
        recBox = document.createElement('div');
        recBox.id = 'recommendation-box';
        document.body.insertBefore(recBox, document.getElementById('teams-container'));
    }
    recBox.innerHTML = `
        <label for="assist-team-select"><strong>Choose a team:</strong></label>
        <select id="assist-team-select"></select>
        <label style="margin-left:12px;" for="assist-round-input">Round:</label>
        <input id="assist-round-input" type="number" min="1" value="1" style="width:50px;">
        <label style="margin-left:8px;" for="assist-pick-input">Pick:</label>
        <input id="assist-pick-input" type="number" min="1" value="1" style="width:50px;">
        <button id="assist-btn" style="margin-left:12px;">Assist Me</button>
        <div id="assist-recommendation" style="margin-top:12px;color:#2563eb;font-weight:bold;"></div>
    `;
    const teamSelect = recBox.querySelector('#assist-team-select');
    teamSelect.innerHTML = '';
    for (let t = 1; t <= numTeams; t++) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = `Team ${t}`;
        teamSelect.appendChild(opt);
    }
    teamSelectRef.current = teamSelect;

    recBox.querySelector('#assist-btn').onclick = async function() {
        const selectedTeam = parseInt(teamSelect.value, 10);
        const round = parseInt(document.getElementById('assist-round-input').value, 10) || 1;
        const pick_no = parseInt(document.getElementById('assist-pick-input').value, 10) || 1;
        const draftState = getCurrentDraftState(selectedTeam, round, pick_no);
        await getAvailablePlayersAsync(); // Ensure cache is populated
        const csvRow = await createCsvRowAsync(draftState);

        // Copy CSV row to clipboard
        try {
            await navigator.clipboard.writeText(csvRow);
            recBox.querySelector('#assist-recommendation').textContent =
                `CSV copied to clipboard for Team ${selectedTeam}, Round ${round}, Pick ${pick_no}.`;
        } catch (err) {
            recBox.querySelector('#assist-recommendation').textContent =
                `Failed to copy CSV to clipboard.`;
        }
    };
}

// --- Helpers to get draft state and available players ---
function getCurrentDraftState(selectedTeam, round, pick_no) {
    const teams = Array.from(document.querySelectorAll('.team-box'));
    function countEmpty(teamDiv, label, count) {
        let empty = 0;
        for (let i = 1; i <= count; i++) {
            const sel = teamDiv.querySelector(`select[name^="team${teamDiv.dataset.teamIndex}-${label}${i}"]`);
            if (sel && !sel.value) empty++;
        }
        return empty;
    }
    const settings = getDraftSettings();
    teams.forEach((div, idx) => { div.dataset.teamIndex = idx + 1; });

    const myTeamDiv = teams[selectedTeam - 1];
    const qb_need = countEmpty(myTeamDiv, 'QB', settings.numQBs);
    const rb_need = countEmpty(myTeamDiv, 'RB', settings.numRBs);
    const wr_need = countEmpty(myTeamDiv, 'WR', settings.numWRs);
    const te_need = countEmpty(myTeamDiv, 'TE', settings.numTEs);
    const k_need = countEmpty(myTeamDiv, 'K', settings.numKs);
    const dst_need = countEmpty(myTeamDiv, 'DST', settings.numDST);

    let other_qb_need = 0, other_rb_need = 0, other_wr_need = 0, other_te_need = 0, other_k_need = 0, other_dst_need = 0;
    teams.forEach((div, idx) => {
        if (idx + 1 === selectedTeam) return;
        other_qb_need += countEmpty(div, 'QB', settings.numQBs);
        other_rb_need += countEmpty(div, 'RB', settings.numRBs);
        other_wr_need += countEmpty(div, 'WR', settings.numWRs);
        other_te_need += countEmpty(div, 'TE', settings.numTEs);
        other_k_need += countEmpty(div, 'K', settings.numKs);
        other_dst_need += countEmpty(div, 'DST', settings.numDST);
    });

    // flex_need and other_flex_need as sum of RB/WR/TE needs
    const flex_need = rb_need + wr_need + te_need;
    const other_flex_need = other_rb_need + other_wr_need + other_te_need;

    const qb_available = playerNamesByPos.QB.filter(n => !unavailablePlayers.has(n)).length;
    const rb_available = playerNamesByPos.RB.filter(n => !unavailablePlayers.has(n)).length;
    const wr_available = playerNamesByPos.WR.filter(n => !unavailablePlayers.has(n)).length;
    const te_available = playerNamesByPos.TE.filter(n => !unavailablePlayers.has(n)).length;
    const k_available = playerNamesByPos.K.filter(n => !unavailablePlayers.has(n)).length;
    const dst_available = playerNamesByPos.DST.filter(n => !unavailablePlayers.has(n)).length;
    const flex_available = playerNamesByPos.FLEX.filter(n => !unavailablePlayers.has(n)).length;

    return {
        pick_no,
        round,
        scoring_type: getScoringType(),
        qb_need,
        rb_need,
        wr_need,
        te_need,
        k_need,
        dst_need,
        flex_need,
        other_qb_need,
        other_rb_need,
        other_wr_need,
        other_te_need,
        other_k_need,
        other_dst_need,
        other_flex_need,
        qb_available,
        rb_available,
        wr_available,
        te_available,
        k_available,
        dst_available,
        flex_available
    };
}

// --- Team UI ---
function createTeamsContainer() {
    let teamsContainer = document.getElementById('teams-container');
    if (!teamsContainer) {
        teamsContainer = document.createElement('div');
        teamsContainer.id = 'teams-container';
        document.body.appendChild(teamsContainer);
    }
    teamsContainer.innerHTML = '';
    return teamsContainer;
}
function addDropdowns(teamDiv, t, label, count) {
    const names = playerNamesByPos[label] || [];
    for (let i = 1; i <= count; i++) {
        const select = document.createElement('select');
        select.name = `team${t}-${label}${i}`;
        let options = `<option value="">Select ${label} ${i}</option>`;
        for (const name of names) {
            options += `<option value="${name}">${name}</option>`;
        }
        select.innerHTML = options;
        teamDiv.appendChild(select);
    }
}
function makeTeamNameEditable(h3, teamDiv, teamSelect, teamIndex) {
    h3.addEventListener('click', function () {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = h3.textContent;
        input.className = 'team-name-input';
        teamDiv.replaceChild(input, h3);
        input.focus();
        function saveName() {
            h3.textContent = input.value || 'Team';
            teamDiv.replaceChild(h3, input);
            if (teamSelect) {
                teamSelect.options[teamIndex - 1].textContent = h3.textContent;
            }
        }
        input.addEventListener('blur', saveName);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    });
}
function createTeamBoxes(settings, teamsContainer, teamSelect) {
    for (let t = 1; t <= settings.numTeams; t++) {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'team-box';
        const h3 = document.createElement('h3');
        h3.textContent = `Team ${t}`;
        makeTeamNameEditable(h3, teamDiv, teamSelect, t);
        teamDiv.appendChild(h3);
        addDropdowns(teamDiv, t, 'QB', settings.numQBs);
        addDropdowns(teamDiv, t, 'RB', settings.numRBs);
        addDropdowns(teamDiv, t, 'WR', settings.numWRs);
        addDropdowns(teamDiv, t, 'TE', settings.numTEs);
        addDropdowns(teamDiv, t, 'K', settings.numKs);
        addDropdowns(teamDiv, t, 'FLEX', settings.numFlex);
        addDropdowns(teamDiv, t, 'DST', settings.numDST);
        addDropdowns(teamDiv, t, 'Bench', settings.numBench);
        teamsContainer.appendChild(teamDiv);
    }
}

// --- Main Form Handler ---
document.getElementById('draft-settings-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    document.getElementById('draft-settings-form').style.display = 'none';
    await preloadAllPlayerNames();
    const settings = getDraftSettings();
    const teamSelectRef = { current: null };
    createRecommendationBox(settings.numTeams, teamSelectRef);
    const teamsContainer = createTeamsContainer();
    createTeamBoxes(settings, teamsContainer, teamSelectRef.current);
});
