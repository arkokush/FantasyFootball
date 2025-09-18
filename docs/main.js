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
const draftedPlayersWithTeam = new Map(); // Maps player name to team number

function updateDropdowns() {
    document.querySelectorAll('select').forEach(select => {
        Array.from(select.options).forEach(option => {
            option.disabled = option.value && unavailablePlayers.has(option.value);
        });
    });

    // Update draft board if it exists
    updateDraftBoard();

    // Also update draft status in player rankings table
    updatePlayerRankingDraftStatus();
}

// Function to update draft status in player rankings table
function updatePlayerRankingDraftStatus() {
    const rankingTableBody = document.getElementById('ranking-table-body');
    if (!rankingTableBody) return; // Exit if rankings table doesn't exist

    // Get all player rows in the table
    const playerRows = rankingTableBody.querySelectorAll('tr');

    playerRows.forEach(row => {
        const playerName = row.querySelector('td:nth-child(2)')?.textContent;
        const draftStatusCell = row.querySelector('td:nth-child(8)'); // 8th column is Draft Status

        if (playerName && draftStatusCell) {
            if (draftedPlayersWithTeam.has(playerName)) {
                const teamNumber = draftedPlayersWithTeam.get(playerName);
                // Get team name from team boxes
                let teamName = `Team ${teamNumber}`;
                const teamBoxes = document.querySelectorAll('.team-box');
                if (teamBoxes[teamNumber - 1]) {
                    const teamNameEl = teamBoxes[teamNumber - 1].querySelector('h3');
                    if (teamNameEl) {
                        teamName = teamNameEl.textContent;
                    }
                }
                draftStatusCell.textContent = `Drafted by ${teamName}`;
                draftStatusCell.classList.add('drafted');
            } else {
                draftStatusCell.textContent = 'Available';
                draftStatusCell.classList.remove('drafted');
            }
        }
    });
}

document.body.addEventListener('change', function(e) {
    if (e.target.tagName === 'SELECT') {
        const previousValue = e.target.dataset.previousValue;
        const currentValue = e.target.value;

        // Get the current selection name (team and position)
        const selectName = e.target.name;
        const teamNumberMatch = selectName.match(/team(\d+)-/);

        // If there was a previous selection, remove it from unavailable players
        if (previousValue) {
            // We need to check if this player is still selected in any other dropdown
            let stillSelected = false;
            document.querySelectorAll('select').forEach(select => {
                if (select !== e.target && select.value === previousValue) {
                    stillSelected = true;
                }
            });

            if (!stillSelected) {
                unavailablePlayers.delete(previousValue);
                draftedPlayersWithTeam.delete(previousValue);
            }
        }

        // Add the new selection to unavailable players
        if (currentValue && !previousValue) {
            unavailablePlayers.add(currentValue);
            if (teamNumberMatch && teamNumberMatch[1]) {
                const teamNumber = parseInt(teamNumberMatch[1], 10);
                draftedPlayersWithTeam.set(currentValue, teamNumber);
            }
        } else if (currentValue && previousValue !== currentValue) {
            unavailablePlayers.add(currentValue);
            if (teamNumberMatch && teamNumberMatch[1]) {
                const teamNumber = parseInt(teamNumberMatch[1], 10);
                draftedPlayersWithTeam.set(currentValue, teamNumber);
            }
        }

        // Store current value for future reference
        e.target.dataset.previousValue = currentValue;

        updateDropdowns();
    }
});

// --- Draft Board Logic ---
function updateDraftBoard() {
    // Check if draft board exists, create it if not
    let draftBoard = document.getElementById('draft-board');
    if (!draftBoard) {
        // Create draft board container
        const draftAssistantContainer = document.getElementById('draft-assistant-container');
        draftBoard = document.createElement('div');
        draftBoard.id = 'draft-board';
        draftBoard.className = 'draft-board-section';
        draftBoard.innerHTML = `
            <h3><i class="fas fa-clipboard-list"></i> Draft Board</h3>
            <div class="draft-board-container">
                <table class="draft-table">
                    <thead>
                        <tr>
                            <th>Round</th>
                            <th>Pick</th>
                            <th>Team</th>
                            <th>Player</th>
                            <th>Position</th>
                        </tr>
                    </thead>
                    <tbody id="draft-board-body">
                    </tbody>
                </table>
            </div>
        `;

        // Insert draft board after recommendation box
        const recBox = document.getElementById('recommendation-box');
        if (recBox && recBox.nextSibling) {
            draftAssistantContainer.insertBefore(draftBoard, recBox.nextSibling);
        } else {
            draftAssistantContainer.appendChild(draftBoard);
        }

        // Add animation
        draftBoard.style.opacity = '0';
        draftBoard.style.transform = 'translateY(20px)';
        setTimeout(() => {
            draftBoard.style.transition = 'all 0.5s ease-out';
            draftBoard.style.opacity = '1';
            draftBoard.style.transform = 'translateY(0)';
        }, 200);
    }

    // Update the draft board with current selections
    const draftBoardBody = document.getElementById('draft-board-body');
    draftBoardBody.innerHTML = '';

    // Convert draftedPlayersWithTeam map to array of drafted players
    const draftedPlayers = [];
    let pickCount = 1;

    draftedPlayersWithTeam.forEach((teamNumber, playerName) => {
        // Find the player's position by checking which team dropdown they're selected in
        let playerPosition = '';
        document.querySelectorAll(`select[name^="team${teamNumber}-"]`).forEach(select => {
            if (select.value === playerName) {
                // Extract position from select name (format: team{number}-{position}{number})
                const posMatch = select.name.match(/team\d+-(QB|RB|WR|TE|K|FLEX|DST|Bench)/);
                if (posMatch && posMatch[1]) {
                    playerPosition = posMatch[1];
                }
            }
        });

        // Calculate round based on pick number and total teams
        const settings = getDraftSettings();
        const round = Math.ceil(pickCount / settings.numTeams);

        draftedPlayers.push({
            playerName,
            teamNumber,
            position: playerPosition,
            pick: pickCount,
            round
        });

        pickCount++;
    });

    // Sort by pick number
    draftedPlayers.sort((a, b) => a.pick - b.pick);

    // Add players to draft board
    draftedPlayers.forEach(player => {
        const row = document.createElement('tr');

        // Get team name
        let teamName = `Team ${player.teamNumber}`;
        const teamBoxes = document.querySelectorAll('.team-box');
        if (teamBoxes[player.teamNumber - 1]) {
            const teamNameEl = teamBoxes[player.teamNumber - 1].querySelector('h3');
            if (teamNameEl) {
                teamName = teamNameEl.textContent;
            }
        }

        row.innerHTML = `
            <td>${player.round}</td>
            <td>${player.pick}</td>
            <td>${teamName}</td>
            <td>${player.playerName}</td>
            <td>${player.position}</td>
        `;

        // Add animation
        row.style.opacity = '0';
        draftBoardBody.appendChild(row);
        setTimeout(() => {
            row.style.transition = 'all 0.3s ease-out';
            row.style.opacity = '1';
        }, 50);
    });
}

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
        dst: playerDataCache.dst ? filterAndSortPlayers(playerDataCache.dst, scoringType) : [],
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

// --- Model Scaling Helpers ---
const bounded_cols = [
    'pick_no','round',
    'qb_need', 'rb_need', 'wr_need', 'te_need', 'flex_need',
    'other_qb_need', 'other_rb_need', 'other_wr_need', 'other_te_need', 'other_flex_need',
    'qb_available', 'rb_available', 'wr_available', 'te_available', 'flex_available'
];
const vor_cols = [
    'qb_vor', 'rb_vor', 'wr_vor', 'te_vor', 'k_vor', 'flex_vor'
];

// Updated with actual min/max/mean/std from training data
const minMax = {
    pick_no: {min: 1, max: 150},
    round: {min: 1, max: 15},
    qb_need: {min: 0, max: 1},
    rb_need: {min: 0, max: 2},
    wr_need: {min: 0, max: 2},
    te_need: {min: 0, max: 1},
    flex_need: {min: 0, max: 2},
    other_qb_need: {min: 0, max: 9},
    other_rb_need: {min: 0, max: 18},
    other_wr_need: {min: 0, max: 18},
    other_te_need: {min: 0, max: 9},
    other_flex_need: {min: 0, max: 18},
    qb_available: {min: 4, max: 22},
    rb_available: {min: 12, max: 48},
    wr_available: {min: 23, max: 71},
    te_available: {min: 17, max: 32},
    flex_available: {min: 52, max: 151}
};
const vorStats = {
    qb_vor: {mean: 35.0, std: 25.0},
    rb_vor: {mean: 90.0, std: 45.0},
    wr_vor: {mean: 80.0, std: 35.0},
    te_vor: {mean: 45.0, std: 25.0},
    k_vor: {mean: 17.0, std: 5.0},
    flex_vor: {mean: 95.0, std: 45.0}
};

function minMaxScale(val, min, max) {
    if (max === min) return 0;
    return (val - min) / (max - min);
}
function standardScale(val, mean, std) {
    if (std === 0) return 0;
    return (val - mean) / std;
}

// --- Model Prediction Helper ---
// Replace this with your actual model API call or JS inference
async function predictBestPosition(featureVector) {
    // Example: POST to /predict endpoint
    // const res = await fetch('/predict', {method: 'POST', body: JSON.stringify({features: featureVector})});
    // const {best_position} = await res.json();
    // return best_position;

    // Dummy logic for demo: pick the position with highest VOR
    const posOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'FLEX'];
    let maxIdx = 0, maxVal = featureVector.slice(-6)[0];
    for (let i = 1; i < 6; ++i) {
        if (featureVector.slice(-6)[i] > maxVal) {
            maxVal = featureVector.slice(-6)[i];
            maxIdx = i;
        }
    }
    return posOrder[maxIdx];
}

// --- Position Filtering Helper ---
function getValidPositions(draftState, settings) {
    const validPositions = [];

    // Check which positions still have open slots
    if (draftState.qb_need > 0) validPositions.push('QB');
    if (draftState.rb_need > 0) validPositions.push('RB');
    if (draftState.wr_need > 0) validPositions.push('WR');
    if (draftState.te_need > 0) validPositions.push('TE');
    if (draftState.k_need > 0) validPositions.push('K');
    if (draftState.dst_need > 0) validPositions.push('DST');

    // FLEX is valid if any RB/WR/TE slots are open
    if (draftState.rb_need > 0 || draftState.wr_need > 0 || draftState.te_need > 0 ||
        draftState.flex_need > 0) {
        validPositions.push('FLEX');
    }

    // Always allow bench picks if there are bench slots
    const filledPositions = (settings.numQBs - draftState.qb_need) +
                           (settings.numRBs - draftState.rb_need) +
                           (settings.numWRs - draftState.wr_need) +
                           (settings.numTEs - draftState.te_need) +
                           (settings.numKs - draftState.k_need) +
                           (settings.numDST - draftState.dst_need) +
                           (settings.numFlex - draftState.flex_need);
    const totalSlots = settings.numQBs + settings.numRBs + settings.numWRs +
                      settings.numTEs + settings.numKs + settings.numDST +
                      settings.numFlex + settings.numBench;

    if (filledPositions < totalSlots) {
        // Add all positions for bench consideration
        ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].forEach(pos => {
            if (!validPositions.includes(pos)) validPositions.push(pos);
        });
    }

    return validPositions;
}

// --- Enhanced Model Prediction Helper ---
async function predictBestPositionWithFilter(featureVector, draftState, settings) {
    // Get model prediction
    let predictedPosition = await predictBestPosition(featureVector);

    // Get valid positions
    const validPositions = getValidPositions(draftState, settings);

    // If predicted position is valid, use it
    if (validPositions.includes(predictedPosition)) {
        return predictedPosition;
    }

    // Otherwise, find the best valid position by VOR
    const availablePlayers = getAvailablePlayersSync();
    const scoringType = draftState.scoring_type;

    let bestPosition = validPositions[0]; // fallback
    let bestVOR = -Infinity;

    for (const position of validPositions) {
        const posKey = position.toLowerCase();
        let vor = 0;

        if (position === 'FLEX') {
            vor = getHighestVOR('flex', availablePlayers, settings.numFlex, scoringType);
        } else {
            vor = getHighestVOR(posKey, availablePlayers, settings[`num${position}s`] || 1, scoringType);
        }

        if (vor > bestVOR) {
            bestVOR = vor;
            bestPosition = position;
        }
    }

    return bestPosition;
}

// --- Player Recommendation Helper ---
function getBestPlayerAtPosition(position, scoringType) {
    const availablePlayers = getAvailablePlayersSync();
    let players = [];

    if (position === 'FLEX') {
        // For FLEX, consider RB, WR, and TE players
        players = availablePlayers.flex;
    } else {
        const posKey = position.toLowerCase();
        players = availablePlayers[posKey] || [];
    }

    if (players.length === 0) return null;

    // Return the highest projected player (already sorted by getAvailablePlayersSync)
    return players[0];
}

// --- Round Check Helpers ---
function isSecondToLastRound(round, settings) {
    const totalRounds = settings.numQBs + settings.numRBs + settings.numWRs +
                       settings.numTEs + settings.numKs + settings.numFlex +
                       settings.numDST + settings.numBench;
    return round === totalRounds - 1;
}

function isLastRound(round, settings) {
    const totalRounds = settings.numQBs + settings.numRBs + settings.numWRs +
                       settings.numTEs + settings.numKs + settings.numFlex +
                       settings.numDST + settings.numBench;
    return round === totalRounds;
}

// --- UI Creation ---
function createRecommendationBox(numTeams, teamSelectRef) {
    const draftAssistantContainer = document.getElementById('draft-assistant-container');
    let recBox = document.getElementById('recommendation-box');
    if (!recBox) {
        recBox = document.createElement('div');
        recBox.id = 'recommendation-box';
        recBox.style.opacity = '0';
        recBox.style.transform = 'translateY(20px)';
        draftAssistantContainer.appendChild(recBox); // Append to the stable container

        // Animate in
        setTimeout(() => {
            recBox.style.transition = 'all 0.5s ease-out';
            recBox.style.opacity = '1';
            recBox.style.transform = 'translateY(0)';
        }, 200);
    }

    recBox.innerHTML = `
        <div class="recommendation-header">
            <h3><i class="fas fa-magic"></i> AI Draft Assistant</h3>
            <p>Get intelligent position recommendations based on your current draft state</p>
        </div>
        
        <div class="recommendation-controls">
            <div class="control-group">
                <label for="assist-team-select">
                    <i class="fas fa-users"></i>
                    Select Team
                </label>
                <select id="assist-team-select"></select>
            </div>
            
            <div class="assist-row">
                <div class="control-group">
                    <label for="assist-round-input">Round</label>
                    <input id="assist-round-input" type="number" min="1" value="1">
                </div>
                <div class="control-group">
                    <label for="assist-pick-input">Pick</label>
                    <input id="assist-pick-input" type="number" min="1" value="1">
                </div>
                <button id="assist-btn" class="assist-button">
                    <i class="fas fa-brain"></i>
                    <span>Get Recommendation</span>
                </button>
            </div>
        </div>
        
        <div id="assist-recommendation"></div>
    `;

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
        // Add loading state to button
        this.classList.add('loading');
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Analyzing...</span>';

        try {
            const selectedTeam = parseInt(teamSelect.value, 10);
            const round = parseInt(roundInput.value, 10) || 1;
            const pick_no = parseInt(pickInput.value, 10) || 1;
            const draftState = getCurrentDraftState(selectedTeam, round, pick_no);
            await getAvailablePlayersAsync();

            const settings = getDraftSettings();
            const scoringType = draftState.scoring_type;

            let recommendedPosition;
            let recommendedPlayer;
            let reasonText = "";

            // Rule 1: If it's the 2nd to last round, always recommend best kicker
            if (isSecondToLastRound(round, settings)) {
                recommendedPosition = 'K';
                recommendedPlayer = getBestPlayerAtPosition('K', scoringType);
                reasonText = " (2nd to last round - drafting best kicker)";
            }
            // Rule 2: If it's the last round, always recommend best DST
            else if (isLastRound(round, settings)) {
                recommendedPosition = 'DST';
                recommendedPlayer = getBestPlayerAtPosition('DST', scoringType);
                reasonText = " (last round - drafting best defense)";
            }
            // Otherwise, use the model to predict best position
            else {
                const availablePlayers = getAvailablePlayersSync();

                // Calculate VORs
                const qb_vor = getHighestVOR('qb', availablePlayers, settings.numQBs, scoringType);
                const rb_vor = getHighestVOR('rb', availablePlayers, settings.numRBs, scoringType);
                const wr_vor = getHighestVOR('wr', availablePlayers, settings.numWRs, scoringType);
                const te_vor = getHighestVOR('te', availablePlayers, settings.numTEs, scoringType);
                const k_vor = getHighestVOR('k', availablePlayers, settings.numKs, scoringType);
                const flex_vor = getHighestVOR('flex', availablePlayers, settings.numFlex, scoringType);

                // Min-max scale bounded cols
                const boundedScaled = bounded_cols.map(col => {
                    const val = draftState[col];
                    const {min, max} = minMax[col];
                    return minMaxScale(val, min, max);
                });
                // Standard scale VORs
                const vorVals = [qb_vor, rb_vor, wr_vor, te_vor, k_vor, flex_vor];
                const vorScaled = vor_cols.map((col, i) => {
                    const {mean, std} = vorStats[col];
                    return standardScale(vorVals[i], mean, std);
                });

                const featureVector = [...boundedScaled, ...vorScaled];

                // Predict best position using the enhanced model with filtering
                recommendedPosition = await predictBestPositionWithFilter(featureVector, draftState, settings);
                recommendedPlayer = getBestPlayerAtPosition(recommendedPosition, scoringType);
                reasonText = " (model prediction)";
            }

            // Display the recommendation with enhanced styling
            const recDiv = recBox.querySelector('#assist-recommendation');
            if (recommendedPlayer) {
                const projectedPoints = getProjectedPoints(recommendedPlayer, scoringType).toFixed(1);
                recDiv.innerHTML = `
                    <div class="recommendation-result success">
                        <div class="result-header">
                            <i class="fas fa-lightbulb"></i>
                            <h4>Recommendation Ready</h4>
                        </div>
                        <div class="result-content">
                            <div class="position-recommendation">
                                <span class="label">Recommended Position:</span>
                                <span class="value">${recommendedPosition}</span>
                                <span class="reason">${reasonText}</span>
                            </div>
                            <div class="player-recommendation">
                                <span class="label">Best Available Player:</span>
                                <span class="value player-name">${recommendedPlayer.name}</span>
                            </div>
                            <div class="points-projection">
                                <span class="label">Projected Points:</span>
                                <span class="value points">${projectedPoints}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                recDiv.innerHTML = `
                    <div class="recommendation-result warning">
                        <div class="result-header">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h4>No Players Available</h4>
                        </div>
                        <div class="result-content">
                            <div class="position-recommendation">
                                <span class="label">Recommended Position:</span>
                                <span class="value">${recommendedPosition}</span>
                                <span class="reason">${reasonText}</span>
                            </div>
                            <p>No available players found at this position.</p>
                        </div>
                    </div>
                `;
            }

            // Animate the recommendation
            recDiv.style.opacity = '0';
            recDiv.style.transform = 'translateY(10px)';
            setTimeout(() => {
                recDiv.style.transition = 'all 0.3s ease-out';
                recDiv.style.opacity = '1';
                recDiv.style.transform = 'translateY(0)';
            }, 100);

        } catch (error) {
            console.error('Error getting recommendation:', error);
            const recDiv = recBox.querySelector('#assist-recommendation');
            recDiv.innerHTML = `
                <div class="recommendation-result error">
                    <div class="result-header">
                        <i class="fas fa-exclamation-circle"></i>
                        <h4>Error</h4>
                    </div>
                    <div class="result-content">
                        <p>Unable to get recommendation. Please try again.</p>
                    </div>
                </div>
            `;
        } finally {
            // Reset button state
            this.classList.remove('loading');
            this.innerHTML = '<i class="fas fa-brain"></i><span>Get Recommendation</span>';
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
    const draftAssistantContainer = document.getElementById('draft-assistant-container');
    let teamsContainer = document.getElementById('teams-container');
    if (!teamsContainer) {
        teamsContainer = document.createElement('div');
        teamsContainer.id = 'teams-container';
        teamsContainer.className = 'teams-section'; // Ensure class is set
        draftAssistantContainer.appendChild(teamsContainer); // Append to the stable container
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
            const oldName = h3.textContent;
            const newName = input.value || 'Team';
            h3.textContent = newName;
            teamDiv.replaceChild(h3, input);
            if (teamSelect) {
                teamSelect.options[teamIndex - 1].textContent = newName;
            }

            // If the name has changed, update the player draft status in the rankings table
            if (oldName !== newName) {
                updateDropdowns(); // This will call updatePlayerRankingDraftStatus()
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
    showLoadingState();
    this.classList.add('submitted');

    const settings = getDraftSettings();
    const teamSelectRef = { current: null };
    const draftAssistantContainer = document.getElementById('draft-assistant-container');
    draftAssistantContainer.innerHTML = ''; // Clear previous content

    // Always create the UI structure first
    try {
        createRecommendationBox(settings.numTeams, teamSelectRef);
        const teamsContainer = createTeamsContainer();

        // First preload player names to ensure dropdowns have data
        await preloadAllPlayerNames();

        // Create team boxes only once, after player data is loaded
        createTeamBoxes(settings, teamsContainer, teamSelectRef.current);
        animateTeamBoxes();

        showNotification('Draft setup complete! Player data loaded.', 'success');
    } catch (error) {
        console.error('Error during draft setup:', error);
        hideLoadingState();
        showNotification('An error occurred during setup. Please try again.', 'error');
        this.style.display = 'block';
        this.classList.remove('submitted');
        return; // Stop execution
    } finally {
        // Hide form and loading state
        setTimeout(() => {
            this.style.display = 'none';
        }, 500);
        hideLoadingState();
    }
});

// --- Enhanced UI Functions ---
function showLoadingState() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('show');
}

function hideLoadingState() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('show');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('notification-exit');
        setTimeout(() => notification.remove(), 300);
    }, 5000);

    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.add('notification-exit');
        setTimeout(() => notification.remove(), 300);
    });
}

function getNotificationIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

function animateTeamBoxes() {
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach((box, index) => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(30px)';

        setTimeout(() => {
            box.style.transition = 'all 0.5s ease-out';
            box.style.opacity = '1';
            box.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// --- Enhanced Recommendation Box Creation ---
function createRecommendationBox(numTeams, teamSelectRef) {
    const draftAssistantContainer = document.getElementById('draft-assistant-container');
    let recBox = document.getElementById('recommendation-box');
    if (!recBox) {
        recBox = document.createElement('div');
        recBox.id = 'recommendation-box';
        recBox.style.opacity = '0';
        recBox.style.transform = 'translateY(20px)';
        draftAssistantContainer.appendChild(recBox); // Append to the stable container

        // Animate in
        setTimeout(() => {
            recBox.style.transition = 'all 0.5s ease-out';
            recBox.style.opacity = '1';
            recBox.style.transform = 'translateY(0)';
        }, 200);
    }

    recBox.innerHTML = `
        <div class="recommendation-header">
            <h3><i class="fas fa-magic"></i> AI Draft Assistant</h3>
            <p>Get intelligent position recommendations based on your current draft state</p>
        </div>
        
        <div class="recommendation-controls">
            <div class="control-group">
                <label for="assist-team-select">
                    <i class="fas fa-users"></i>
                    Select Team
                </label>
                <select id="assist-team-select"></select>
            </div>
            
            <div class="assist-row">
                <div class="control-group">
                    <label for="assist-round-input">Round</label>
                    <input id="assist-round-input" type="number" min="1" value="1">
                </div>
                <div class="control-group">
                    <label for="assist-pick-input">Pick</label>
                    <input id="assist-pick-input" type="number" min="1" value="1">
                </div>
                <button id="assist-btn" class="assist-button">
                    <i class="fas fa-brain"></i>
                    <span>Get Recommendation</span>
                </button>
            </div>
        </div>
        
        <div id="assist-recommendation"></div>
    `;

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
        // Add loading state to button
        this.classList.add('loading');
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Analyzing...</span>';

        try {
            const selectedTeam = parseInt(teamSelect.value, 10);
            const round = parseInt(roundInput.value, 10) || 1;
            const pick_no = parseInt(pickInput.value, 10) || 1;
            const draftState = getCurrentDraftState(selectedTeam, round, pick_no);
            await getAvailablePlayersAsync();

            const settings = getDraftSettings();
            const scoringType = draftState.scoring_type;

            let recommendedPosition;
            let recommendedPlayer;
            let reasonText = "";

            // Rule 1: If it's the 2nd to last round, always recommend best kicker
            if (isSecondToLastRound(round, settings)) {
                recommendedPosition = 'K';
                recommendedPlayer = getBestPlayerAtPosition('K', scoringType);
                reasonText = " (2nd to last round - drafting best kicker)";
            }
            // Rule 2: If it's the last round, always recommend best DST
            else if (isLastRound(round, settings)) {
                recommendedPosition = 'DST';
                recommendedPlayer = getBestPlayerAtPosition('DST', scoringType);
                reasonText = " (last round - drafting best defense)";
            }
            // Otherwise, use the model to predict best position
            else {
                const availablePlayers = getAvailablePlayersSync();

                // Calculate VORs
                const qb_vor = getHighestVOR('qb', availablePlayers, settings.numQBs, scoringType);
                const rb_vor = getHighestVOR('rb', availablePlayers, settings.numRBs, scoringType);
                const wr_vor = getHighestVOR('wr', availablePlayers, settings.numWRs, scoringType);
                const te_vor = getHighestVOR('te', availablePlayers, settings.numTEs, scoringType);
                const k_vor = getHighestVOR('k', availablePlayers, settings.numKs, scoringType);
                const flex_vor = getHighestVOR('flex', availablePlayers, settings.numFlex, scoringType);

                // Min-max scale bounded cols
                const boundedScaled = bounded_cols.map(col => {
                    const val = draftState[col];
                    const {min, max} = minMax[col];
                    return minMaxScale(val, min, max);
                });
                // Standard scale VORs
                const vorVals = [qb_vor, rb_vor, wr_vor, te_vor, k_vor, flex_vor];
                const vorScaled = vor_cols.map((col, i) => {
                    const {mean, std} = vorStats[col];
                    return standardScale(vorVals[i], mean, std);
                });

                const featureVector = [...boundedScaled, ...vorScaled];

                // Predict best position using the enhanced model with filtering
                recommendedPosition = await predictBestPositionWithFilter(featureVector, draftState, settings);
                recommendedPlayer = getBestPlayerAtPosition(recommendedPosition, scoringType);
                reasonText = " (model prediction)";
            }

            // Display the recommendation with enhanced styling
            const recDiv = recBox.querySelector('#assist-recommendation');
            if (recommendedPlayer) {
                const projectedPoints = getProjectedPoints(recommendedPlayer, scoringType).toFixed(1);
                recDiv.innerHTML = `
                    <div class="recommendation-result success">
                        <div class="result-header">
                            <i class="fas fa-lightbulb"></i>
                            <h4>Recommendation Ready</h4>
                        </div>
                        <div class="result-content">
                            <div class="position-recommendation">
                                <span class="label">Recommended Position:</span>
                                <span class="value">${recommendedPosition}</span>
                                <span class="reason">${reasonText}</span>
                            </div>
                            <div class="player-recommendation">
                                <span class="label">Best Available Player:</span>
                                <span class="value player-name">${recommendedPlayer.name}</span>
                            </div>
                            <div class="points-projection">
                                <span class="label">Projected Points:</span>
                                <span class="value points">${projectedPoints}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                recDiv.innerHTML = `
                    <div class="recommendation-result warning">
                        <div class="result-header">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h4>No Players Available</h4>
                        </div>
                        <div class="result-content">
                            <div class="position-recommendation">
                                <span class="label">Recommended Position:</span>
                                <span class="value">${recommendedPosition}</span>
                                <span class="reason">${reasonText}</span>
                            </div>
                            <p>No available players found at this position.</p>
                        </div>
                    </div>
                `;
            }

            // Animate the recommendation
            recDiv.style.opacity = '0';
            recDiv.style.transform = 'translateY(10px)';
            setTimeout(() => {
                recDiv.style.transition = 'all 0.3s ease-out';
                recDiv.style.opacity = '1';
                recDiv.style.transform = 'translateY(0)';
            }, 100);

        } catch (error) {
            console.error('Error getting recommendation:', error);
            const recDiv = recBox.querySelector('#assist-recommendation');
            recDiv.innerHTML = `
                <div class="recommendation-result error">
                    <div class="result-header">
                        <i class="fas fa-exclamation-circle"></i>
                        <h4>Error</h4>
                    </div>
                    <div class="result-content">
                        <p>Unable to get recommendation. Please try again.</p>
                    </div>
                </div>
            `;
        } finally {
            // Reset button state
            this.classList.remove('loading');
            this.innerHTML = '<i class="fas fa-brain"></i><span>Get Recommendation</span>';
        }
    };
}
