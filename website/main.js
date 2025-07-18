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

async function fetchCsvRows(file) {
    const res = await fetch(`../data/2025/${file}`);
    const text = await res.text();
    const [header, ...rows] = text.trim().split('\n');
    const keys = header.split(',');
    return rows.map(row => {
        const vals = row.split(',');
        const obj = {};
        keys.forEach((k, i) => obj[k] = vals[i]);
        return obj;
    });
}

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
            const rows = await fetchCsvRows(file);
            names = names.concat(rows.map(obj => obj.name).filter(Boolean));
        }
        return [...new Set(names)];
    }
    if (position === 'Bench') {
        const rows = await fetchCsvRows('projections_full.csv');
        return rows.map(obj => obj.name).filter(Boolean);
    }
    const file = fileMap[position];
    if (!file) return [];
    const rows = await fetchCsvRows(file);
    return rows.map(obj => obj.name).filter(Boolean);
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
            option.disabled = option.value && unavailablePlayers.has(option.value);
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
    if (scoringType === 1 && !isNaN(player.ppr)) return Number(player.ppr);
    if (scoringType === 0.5 && !isNaN(player.half_ppr)) return Number(player.half_ppr);
    if (!isNaN(player.std)) return Number(player.std);
    if (scoringType === 1 && !isNaN(player.projected_points_ppr)) return Number(player.projected_points_ppr);
    if (scoringType === 0.5 && !isNaN(player.projected_points_half_ppr)) return Number(player.projected_points_half_ppr);
    if (!isNaN(player.projected_points)) return Number(player.projected_points);
    return 0;
}

// --- VOR Calculation ---
function getBaseValue(position, availablePlayers, numRequired, scoringType) {
    const idx = numRequired;
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
        const rows = await fetchCsvRows(file);
        for (const obj of rows) {
            obj.std = parseFloat(obj.std);
            obj.half_ppr = parseFloat(obj.half_ppr);
            obj.ppr = parseFloat(obj.ppr);
            obj.projected_points = parseFloat(obj.projected_points);
            obj.projected_points_half_ppr = parseFloat(obj.projected_points_half_ppr);
            obj.projected_points_ppr = parseFloat(obj.projected_points_ppr);
            players.push(obj);
        }
    }
    playerDataCache[position] = players;
    return players;
}

// --- Available Players Loader ---
function filterAndSortPlayers(arr, scoringType) {
    return arr
        .filter(p => !unavailablePlayers.has(p.name))
        .sort((a, b) => getProjectedPoints(b, scoringType) - getProjectedPoints(a, scoringType));
}

function getAvailablePlayersSync() {
    const scoringType = getScoringType();
    return {
        qb: playerDataCache.qb ? filterAndSortPlayers(playerDataCache.qb, scoringType) : [],
        rb: playerDataCache.rb ? filterAndSortPlayers(playerDataCache.rb, scoringType) : [],
        wr: playerDataCache.wr ? filterAndSortPlayers(playerDataCache.wr, scoringType) : [],
        te: playerDataCache.te ? filterAndSortPlayers(playerDataCache.te, scoringType) : [],
        k: playerDataCache.k ? filterAndSortPlayers(playerDataCache.k, scoringType) : [],
        flex: (playerDataCache.rb && playerDataCache.wr && playerDataCache.te)
            ? filterAndSortPlayers([...playerDataCache.rb, ...playerDataCache.wr, ...playerDataCache.te], scoringType)
            : []
    };
}

async function getAvailablePlayersAsync() {
    await Promise.all([
        loadPlayersForPosition('qb'),
        loadPlayersForPosition('rb'),
        loadPlayersForPosition('wr'),
        loadPlayersForPosition('te'),
        loadPlayersForPosition('k'),
        loadPlayersForPosition('dst')
    ]);
    return getAvailablePlayersSync();
}

// --- CSV/Recommendation Logic ---
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

// --- UI Creation ---
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
        <div class="assist-row">
            <label for="assist-round-input">Round:</label>
            <input id="assist-round-input" type="number" min="1" value="1">
            <label for="assist-pick-input">Pick:</label>
            <input id="assist-pick-input" type="number" min="1" value="1">
            <button id="assist-btn">Assist Me</button>
        </div>
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

    // --- Set max for round and pick inputs ---
    const settings = getDraftSettings();
    const totalRounds =
        settings.numQBs +
        settings.numRBs +
        settings.numWRs +
        settings.numTEs +
        settings.numKs +
        settings.numFlex +
        settings.numDST +
        settings.numBench;
    const roundInput = recBox.querySelector('#assist-round-input');
    const pickInput = recBox.querySelector('#assist-pick-input');
    roundInput.max = totalRounds;
    pickInput.max = totalRounds * settings.numTeams;

    recBox.querySelector('#assist-btn').onclick = async function() {
        const selectedTeam = parseInt(teamSelect.value, 10);
        const round = parseInt(roundInput.value, 10) || 1;
        const pick_no = parseInt(pickInput.value, 10) || 1;
        const draftState = getCurrentDraftState(selectedTeam, round, pick_no);
        await getAvailablePlayersAsync();
        const csvRow = await createCsvRowAsync(draftState);
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
