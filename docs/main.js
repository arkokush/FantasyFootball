// File Name: main.js

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
    try {
        // Try different possible paths to work both locally and on GitHub Pages
        const possiblePaths = [
            `data/2025/${file}`,
            `./data/2025/${file}`,
            `/FantasyFootball/docs/data/2025/${file}`, // GitHub Pages path
            `/docs/data/2025/${file}`
        ];

        let response;
        let lastError;

        for (const path of possiblePaths) {
            try {
                response = await fetch(path);
                if (response.ok) {
                    break;
                }
            } catch (error) {
                lastError = error;
                continue;
            }
        }

        if (!response || !response.ok) {
            console.warn(`Could not fetch ${file} from any path. Last error:`, lastError);
            return [];
        }

        const text = await response.text();
        if (!text.trim()) {
            console.warn(`File ${file} is empty`);
            return [];
        }

        const lines = text.trim().split('\n');
        if (lines.length < 2) {
            console.warn(`File ${file} has no data rows`);
            return [];
        }

        const [header, ...rows] = lines;
        const keys = header.split(',').map(key => key.trim());

        return rows.map(row => {
            const vals = row.split(',').map(val => val.trim());
            const obj = {};
            keys.forEach((k, i) => {
                obj[k] = vals[i] || '';
            });
            return obj;
        }).filter(obj => obj.name); // Filter out rows without names

    } catch (error) {
        console.error(`Error fetching ${file}:`, error);
        return [];
    }
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

// --- New UI Component Functionality ---

// Theme Toggle Functionality
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;

    // Get saved theme or default to dark
    const savedTheme = localStorage.getItem('fantasy-draft-theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('fantasy-draft-theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    // Reapply accent color for new theme
    const savedAccentColor = localStorage.getItem('fantasy-draft-accent') || 'green';
    setAccentColor(savedAccentColor);
}

// Hide loading overlay on page load
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Accent Color Functionality
function initAccentColorSelector() {
    const colorSelector = document.getElementById('accent-color-selector');
    const html = document.documentElement;

    // Get saved accent color or default to green
    const savedAccentColor = localStorage.getItem('fantasy-draft-accent') || 'green';
    setAccentColor(savedAccentColor);
    updateColorSelectorActive(savedAccentColor);

    colorSelector.addEventListener('click', (e) => {
        if (e.target.closest('.color-option')) {
            const colorOption = e.target.closest('.color-option');
            const colorValue = colorOption.dataset.color;

            // Remove active class from all options
            colorSelector.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('active');
            });

            // Add active class to selected option
            colorOption.classList.add('active');

            // Apply the accent color
            setAccentColor(colorValue);
            localStorage.setItem('fantasy-draft-accent', colorValue);
        }
    });
}

function setAccentColor(color) {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');

    // Define accent colors for each theme
    const accentColors = {
        green: {
            light: { primary: '#34c759', hover: '#28a745' },
            dark: { primary: '#30d158', hover: '#28b946' }
        },
        blue: {
            light: { primary: '#007aff', hover: '#0056cc' },
            dark: { primary: '#0a84ff', hover: '#0066cc' }
        },
        red: {
            light: { primary: '#ff3b30', hover: '#d70015' },
            dark: { primary: '#ff453a', hover: '#dc2626' }
        },
        orange: {
            light: { primary: '#ff9500', hover: '#e6850e' },
            dark: { primary: '#ff9f0a', hover: '#e6850e' }
        }
    };

    const themeColors = accentColors[color];
    if (themeColors) {
        const colors = currentTheme === 'dark' ? themeColors.dark : themeColors.light;
        html.style.setProperty('--color-accent', colors.primary);
        html.style.setProperty('--color-accent-hover', colors.hover);
    }
}

function updateColorSelectorActive(color) {
    const colorSelector = document.getElementById('accent-color-selector');
    if (colorSelector) {
        colorSelector.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.color === color);
        });
    }
}

// Stepper Controls Functionality
function initStepperControls() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.stepper-btn')) {
            const btn = e.target.closest('.stepper-btn');
            const action = btn.dataset.action;
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);

            if (!input) return;

            const currentValue = parseInt(input.value, 10);
            const min = parseInt(input.min, 10);
            const max = parseInt(input.max, 10);

            let newValue = currentValue;

            if (action === 'increment' && currentValue < max) {
                newValue = currentValue + 1;
            } else if (action === 'decrement' && currentValue > min) {
                newValue = currentValue - 1;
            }

            if (newValue !== currentValue) {
                input.value = newValue;
                // Trigger input event to maintain compatibility with existing form validation
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });

    // Keyboard support for steppers
    document.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('stepper-btn')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.target.click();
            }
        }
    });
}

// Segmented Control Functionality
function initSegmentedControl() {
    const segmentedControl = document.querySelector('.segmented-control');
    const hiddenInput = document.getElementById('scoring-type');

    if (!segmentedControl || !hiddenInput) return;

    segmentedControl.addEventListener('click', (e) => {
        if (e.target.classList.contains('segment-btn')) {
            // Remove active class from all buttons
            segmentedControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Add active class to clicked button
            e.target.classList.add('active');

            // Update hidden input value
            const value = e.target.dataset.value;
            hiddenInput.value = value;

            // Trigger change event for compatibility
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // Keyboard support for segmented control
    segmentedControl.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('segment-btn')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.target.click();
            }
        }
    });
}

// Player Rankings Sidebar Functionality
function initPlayerRankingsSidebar() {
    const toggleBtn = document.getElementById('player-rankings-toggle');
    const sidebar = document.getElementById('player-rankings-sidebar');
    const closeBtn = document.getElementById('close-sidebar');

    if (!toggleBtn || !sidebar || !closeBtn) return;

    // Toggle sidebar open/close
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        toggleBtn.classList.toggle('active');

        // Load player data when sidebar is opened
        if (sidebar.classList.contains('open')) {
            updatePlayerRankings();
        }
    });

    // Close sidebar
    closeBtn.addEventListener('click', () => {
        sidebar.classList.remove('open');
        toggleBtn.classList.remove('active');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !toggleBtn.contains(e.target)) {
            sidebar.classList.remove('open');
            toggleBtn.classList.remove('active');
        }
    });

    // ESC key to close sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            toggleBtn.classList.remove('active');
        }
    });
}

// Team Pinning Functionality
const pinnedTeams = new Set();

function initTeamPinning() {
    // Add event delegation for pin buttons
    document.addEventListener('click', (e) => {
        if (e.target.closest('.pin-btn')) {
            const pinBtn = e.target.closest('.pin-btn');
            const teamNumber = parseInt(pinBtn.dataset.team);
            const teamBox = pinBtn.closest('.team-box');

            toggleTeamPin(teamNumber, teamBox, pinBtn);
        }
    });
}

function toggleTeamPin(teamNumber, teamBox, pinBtn) {
    if (pinnedTeams.has(teamNumber)) {
        // Unpin team
        pinnedTeams.delete(teamNumber);
        teamBox.classList.remove('pinned');
        pinBtn.classList.remove('pinned');
        pinBtn.title = 'Pin team';
    } else {
        // Pin team
        pinnedTeams.add(teamNumber);
        teamBox.classList.add('pinned');
        pinBtn.classList.add('pinned');
        pinBtn.title = 'Unpin team';
    }

    // Reorganize team boxes
    reorganizeTeamBoxes();
}

function reorganizeTeamBoxes() {
    const teamBoxesContainer = document.querySelector('.team-boxes-grid');
    if (!teamBoxesContainer) return;

    // Check if we need to add a pinned teams section
    if (pinnedTeams.size > 0) {
        // Create or update pinned teams header
        let pinnedTeamsHeader = document.querySelector('.pinned-teams-header');
        if (!pinnedTeamsHeader) {
            pinnedTeamsHeader = document.createElement('div');
            pinnedTeamsHeader.className = 'pinned-teams-header';

            // Insert before the team boxes grid
            const teamBoxesSection = document.querySelector('.team-boxes-section');
            if (teamBoxesSection) {
                teamBoxesSection.insertBefore(pinnedTeamsHeader, teamBoxesContainer);
            }
        }

        pinnedTeamsHeader.innerHTML = `
            <h4><i class="fas fa-thumbtack"></i> Pinned Teams (${pinnedTeams.size})</h4>
            <p>Teams you're tracking closely</p>
        `;
    } else {
        // Remove pinned teams header if it exists
        const pinnedTeamsHeader = document.querySelector('.pinned-teams-header');
        if (pinnedTeamsHeader) {
            pinnedTeamsHeader.remove();
        }
    }

    // Sort team boxes with pinned teams at the top
    const allTeamBoxes = Array.from(document.querySelectorAll('.team-box'));
    allTeamBoxes.sort((a, b) => {
        const aTeamNumber = parseInt(a.dataset.team);
        const bTeamNumber = parseInt(b.dataset.team);
        const aIsPinned = pinnedTeams.has(aTeamNumber);
        const bIsPinned = pinnedTeams.has(bTeamNumber);

        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;
        return aTeamNumber - bTeamNumber; // Keep original order within groups
    });

    // Reorder the DOM elements
    allTeamBoxes.forEach(teamBox => {
        teamBoxesContainer.appendChild(teamBox);
    });
}

// Team Name Editing Functionality
function initTeamNameEditing() {
    document.addEventListener('click', (e) => {
        if (e.target.matches('.team-header h3[contenteditable="true"]')) {
            const h3 = e.target;
            h3.classList.add('editing');

            // Select all text when clicking to edit
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(h3);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }, 10);
        }
    });

    document.addEventListener('blur', (e) => {
        if (e.target.matches('.team-header h3[contenteditable="true"]')) {
            const h3 = e.target;
            h3.classList.remove('editing');

            // Validate and sanitize the team name
            let newName = h3.textContent.trim();
            if (newName === '') {
                newName = h3.dataset.original;
                h3.textContent = newName;
            }

            // Update any references to this team name in the draft board
            updateDraftBoard();
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.target.matches('.team-header h3[contenteditable="true"]')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                const h3 = e.target;
                h3.textContent = h3.dataset.original;
                h3.blur();
            }
        }
    });
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize UI components first
        initThemeToggle();
        initAccentColorSelector();
        initStepperControls();
        initSegmentedControl();

        // Initialize new sidebar and team functionality
        initPlayerRankingsSidebar();
        initTeamPinning();
        initTeamNameEditing();

        // Initialize player rankings functionality
        initPlayerRankings();

        // Initialize draft form
        initDraftForm();

        // Try to preload player data in the background
        try {
            await preloadAllPlayerNames();
            console.log('Player data loaded successfully');
        } catch (error) {
            console.warn('Could not preload player data:', error);
            // Continue without player data - the app should still work for configuration
        }

        // Hide loading overlay
        hideLoadingOverlay();

    } catch (error) {
        console.error('Error during initialization:', error);
        // Hide loading overlay even if there's an error
        hideLoadingOverlay();
    }
});

// Make sure loading overlay is hidden even if there are issues
window.addEventListener('load', function() {
    // Fallback to hide loading overlay after a delay
    setTimeout(() => {
        hideLoadingOverlay();
    }, 2000);
});

// Player Rankings Functionality
function initPlayerRankings() {
    const playerRankingsSection = document.getElementById('player-rankings');
    const rankingTabs = document.querySelectorAll('.tab-btn');
    const playerSearch = document.getElementById('player-search');
    const rankingLimit = document.getElementById('ranking-limit');

    if (!playerRankingsSection) return;

    // Tab switching
    rankingTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            rankingTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updatePlayerRankings();
        });
    });

    // Search functionality
    if (playerSearch) {
        playerSearch.addEventListener('input', debounce(updatePlayerRankings, 300));
    }

    // Limit dropdown
    if (rankingLimit) {
        rankingLimit.addEventListener('change', updatePlayerRankings);
    }

    // Table sorting
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sort;
            toggleSort(sortBy);
            updatePlayerRankings();
        });
    });
}

let currentSort = { field: 'projected', direction: 'desc' };

function toggleSort(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function updatePlayerRankings() {
    const activeTab = document.querySelector('.tab-btn.active');
    const searchTerm = document.getElementById('player-search')?.value.toLowerCase() || '';
    const limit = document.getElementById('ranking-limit')?.value || '50';
    const tableBody = document.getElementById('ranking-table-body');

    if (!activeTab || !tableBody) return;

    const position = activeTab.dataset.tab;

    try {
        // Show loading state
        tableBody.innerHTML = `
            <tr class="table-loading">
                <td colspan="8">
                    <div class="loading-spinner-small">
                        <i class="fas fa-football-ball fa-spin"></i> Loading players...
                    </div>
                </td>
            </tr>
        `;

        let players = [];
        const scoringType = getScoringType();

        // Load players based on active tab
        if (position === 'all') {
            // Load all positions
            const [qb, rb, wr, te, k, dst] = await Promise.all([
                loadPlayersForPosition('qb'),
                loadPlayersForPosition('rb'),
                loadPlayersForPosition('wr'),
                loadPlayersForPosition('te'),
                loadPlayersForPosition('k'),
                loadPlayersForPosition('dst')
            ]);
            players = [...qb, ...rb, ...wr, ...te, ...k, ...dst];
        } else if (position === 'flex') {
            const [rb, wr, te] = await Promise.all([
                loadPlayersForPosition('rb'),
                loadPlayersForPosition('wr'),
                loadPlayersForPosition('te')
            ]);
            players = [...rb, ...wr, ...te];
        } else {
            players = await loadPlayersForPosition(position);
        }

        // Filter by search term
        if (searchTerm) {
            players = players.filter(player =>
                player.name.toLowerCase().includes(searchTerm) ||
                (player.team && player.team.toLowerCase().includes(searchTerm))
            );
        }

        // Sort players
        players.sort((a, b) => {
            let aVal, bVal;

            if (currentSort.field === 'projected') {
                aVal = getProjectedPoints(a, scoringType);
                bVal = getProjectedPoints(b, scoringType);
            } else if (currentSort.field === 'vor') {
                // Simple VOR calculation (projected points - average)
                aVal = getProjectedPoints(a, scoringType);
                bVal = getProjectedPoints(b, scoringType);
            } else {
                aVal = a[currentSort.field] || 0;
                bVal = b[currentSort.field] || 0;
            }

            if (currentSort.direction === 'desc') {
                return bVal - aVal;
            }
            return aVal - bVal;
        });

        // Apply limit
        if (limit !== 'all') {
            players = players.slice(0, parseInt(limit));
        }

        // Clear table
        tableBody.innerHTML = '';

        // Populate table
        players.forEach((player, index) => {
            const projectedPoints = getProjectedPoints(player, scoringType);
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${index + 1}</td>
                <td class="player-name">${player.name}</td>
                <td class="position">${player.position || 'N/A'}</td>
                <td class="team">${player.team || 'N/A'}</td>
                <td class="bye">${player.bye || 'N/A'}</td>
                <td class="projected">${projectedPoints.toFixed(1)}</td>
                <td class="vor">${(projectedPoints - 10).toFixed(1)}</td>
                <td class="draft-status">Available</td>
            `;

            tableBody.appendChild(row);
        });

        // Update draft statuses
        updatePlayerRankingDraftStatus();

    } catch (error) {
        console.error('Error updating player rankings:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--color-text-muted);">
                    Error loading player data
                </td>
            </tr>
        `;
    }
}

// Draft Form Functionality
function initDraftForm() {
    const draftForm = document.getElementById('draft-settings-form');

    if (!draftForm) return;

    draftForm.addEventListener('submit', function(e) {
        e.preventDefault();
        startDraftAssistant();
    });
}

async function startDraftAssistant() {
    const settings = getDraftSettings();
    const scoringType = document.getElementById('scoring-type').value;

    try {
        // Show loading state
        const submitBtn = document.querySelector('.start-draft-btn');
        const originalContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Setting up draft...</span>';
        submitBtn.disabled = true;

        // Load player data if not already loaded
        await getAvailablePlayersAsync();

        // Show player rankings section
        const playerRankingsSection = document.getElementById('player-rankings');
        if (playerRankingsSection) {
            playerRankingsSection.style.display = 'block';
            updatePlayerRankings();
        }

        // Create recommendation box and team UI
        const teamSelectRef = { current: null };
        createRecommendationBox(settings.numTeams, teamSelectRef);
        createTeamBoxes(settings.numTeams);

        // Scroll to draft assistant
        const draftContainer = document.getElementById('draft-assistant-container');
        if (draftContainer) {
            draftContainer.scrollIntoView({ behavior: 'smooth' });
        }

        // Reset button
        submitBtn.innerHTML = originalContent;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error starting draft assistant:', error);

        // Reset button
        const submitBtn = document.querySelector('.start-draft-btn');
        submitBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Draft Assistant</span>';
        submitBtn.disabled = false;

        // Show error message
        alert('Error setting up draft assistant. Please try again.');
    }
}

// Team Boxes Creation
function createTeamBoxes(numTeams) {
    const draftAssistantContainer = document.getElementById('draft-assistant-container');
    let teamBoxesContainer = document.getElementById('team-boxes-container');

    if (teamBoxesContainer) {
        teamBoxesContainer.remove();
    }

    teamBoxesContainer = document.createElement('div');
    teamBoxesContainer.id = 'team-boxes-container';
    teamBoxesContainer.className = 'team-boxes-section';

    teamBoxesContainer.innerHTML = `
        <div class="section-header">
            <h3><i class="fas fa-users"></i> Draft Teams</h3>
            <p>Track each team's draft picks</p>
        </div>
        <div class="team-boxes-grid">
            ${Array.from({ length: numTeams }, (_, i) => createTeamBoxHTML(i + 1)).join('')}
        </div>
    `;

    draftAssistantContainer.appendChild(teamBoxesContainer);

    // Add event listeners for team boxes
    initTeamBoxes(numTeams);
}

function createTeamBoxHTML(teamNumber) {
    const settings = getDraftSettings();

    return `
        <div class="team-box" data-team="${teamNumber}">
            <div class="team-header">
                <h3 contenteditable="true" data-original="Team ${teamNumber}">Team ${teamNumber}</h3>
                <div class="team-controls">
                    <button class="pin-btn" title="Pin team" data-team="${teamNumber}">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                </div>
            </div>
            <div class="team-roster">
                ${createPositionInputsHTML(teamNumber, settings)}
            </div>
        </div>
    `;
}

function createPositionInputsHTML(teamNumber, settings) {
    let html = '';

    // QB positions
    for (let i = 1; i <= settings.numQBs; i++) {
        html += createPositionSelectHTML(teamNumber, 'QB', i);
    }

    // RB positions
    for (let i = 1; i <= settings.numRBs; i++) {
        html += createPositionSelectHTML(teamNumber, 'RB', i);
    }

    // WR positions
    for (let i = 1; i <= settings.numWRs; i++) {
        html += createPositionSelectHTML(teamNumber, 'WR', i);
    }

    // TE positions
    for (let i = 1; i <= settings.numTEs; i++) {
        html += createPositionSelectHTML(teamNumber, 'TE', i);
    }

    // FLEX positions
    for (let i = 1; i <= settings.numFlex; i++) {
        html += createPositionSelectHTML(teamNumber, 'FLEX', i);
    }

    // K positions
    for (let i = 1; i <= settings.numKs; i++) {
        html += createPositionSelectHTML(teamNumber, 'K', i);
    }

    // DST positions
    for (let i = 1; i <= settings.numDST; i++) {
        html += createPositionSelectHTML(teamNumber, 'DST', i);
    }

    // Bench positions
    for (let i = 1; i <= settings.numBench; i++) {
        html += createPositionSelectHTML(teamNumber, 'Bench', i);
    }

    return html;
}

function createPositionSelectHTML(teamNumber, position, slotNumber) {
    return `
        <div class="position-slot">
            <label for="team${teamNumber}-${position}${slotNumber}">${position}${slotNumber}:</label>
            <select name="team${teamNumber}-${position}${slotNumber}" id="team${teamNumber}-${position}${slotNumber}">
                <option value="">Select Player</option>
            </select>
        </div>
    `;
}

function initTeamBoxes(numTeams) {
    // Add expand/collapse functionality
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const teamBox = this.closest('.team-box');
            teamBox.classList.toggle('expanded');

            const icon = this.querySelector('i');
            if (teamBox.classList.contains('expanded')) {
                icon.className = 'fas fa-compress';
                this.title = 'Collapse team';
            } else {
                icon.className = 'fas fa-expand';
                this.title = 'Expand team';
            }
        });
    });

    // Populate dropdowns with player names
    populateAllDropdowns();
}

async function populateAllDropdowns() {
    try {
        // Wait for player names to be loaded if not already
        if (Object.keys(playerNamesByPos).length === 0) {
            await preloadAllPlayerNames();
        }

        // Populate each dropdown
        document.querySelectorAll('select').forEach(select => {
            const name = select.name;
            if (!name || !name.includes('-')) return;

            const position = name.split('-')[1].replace(/\d+$/, ''); // Remove trailing numbers
            const players = playerNamesByPos[position] || [];

            // Clear existing options except the first one
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }

            // Add player options
            players.forEach(playerName => {
                const option = document.createElement('option');
                option.value = playerName;
                option.textContent = playerName;
                select.appendChild(option);
            });
        });

    } catch (error) {
        console.error('Error populating dropdowns:', error);
    }
}

// Draft State Calculation
function getCurrentDraftState(teamNumber, round, pickNo) {
    const settings = getDraftSettings();
    const scoringType = getScoringType();

    // Calculate current needs for the specified team
    const teamNeeds = calculateTeamNeeds(teamNumber, settings);

    // Calculate needs for other teams
    const otherTeamsNeeds = calculateOtherTeamsNeeds(teamNumber, settings);

    // Calculate available players
    const availablePlayers = getAvailablePlayersSync();

    return {
        pick_no: pickNo,
        round: round,
        scoring_type: scoringType,
        qb_need: teamNeeds.qb,
        rb_need: teamNeeds.rb,
        wr_need: teamNeeds.wr,
        te_need: teamNeeds.te,
        k_need: teamNeeds.k,
        dst_need: teamNeeds.dst,
        flex_need: teamNeeds.flex,
        other_qb_need: otherTeamsNeeds.qb,
        other_rb_need: otherTeamsNeeds.rb,
        other_wr_need: otherTeamsNeeds.wr,
        other_te_need: otherTeamsNeeds.te,
        other_k_need: otherTeamsNeeds.k,
        other_dst_need: otherTeamsNeeds.dst,
        other_flex_need: otherTeamsNeeds.flex,
        qb_available: availablePlayers.qb.length,
        rb_available: availablePlayers.rb.length,
        wr_available: availablePlayers.wr.length,
        te_available: availablePlayers.te.length,
        k_available: availablePlayers.k.length,
        dst_available: availablePlayers.dst.length,
        flex_available: availablePlayers.flex.length
    };
}

function calculateTeamNeeds(teamNumber, settings) {
    const needs = {
        qb: settings.numQBs,
        rb: settings.numRBs,
        wr: settings.numWRs,
        te: settings.numTEs,
        k: settings.numKs,
        dst: settings.numDST,
        flex: settings.numFlex
    };

    // Count filled positions for this team
    document.querySelectorAll(`select[name^="team${teamNumber}-"]`).forEach(select => {
        if (select.value) {
            const posMatch = select.name.match(/-(QB|RB|WR|TE|K|DST|FLEX)/);
            if (posMatch) {
                const pos = posMatch[1].toLowerCase();
                if (needs[pos] > 0) {
                    needs[pos]--;
                }
            }
        }
    });

    return needs;
}

function calculateOtherTeamsNeeds(excludeTeam, settings) {
    const totalNeeds = {
        qb: 0,
        rb: 0,
        wr: 0,
        te: 0,
        k: 0,
        dst: 0,
        flex: 0
    };

    // Calculate needs for all other teams
    for (let team = 1; team <= settings.numTeams; team++) {
        if (team === excludeTeam) continue;

        const teamNeeds = calculateTeamNeeds(team, settings);
        Object.keys(totalNeeds).forEach(pos => {
            totalNeeds[pos] += teamNeeds[pos];
        });
    }

    return totalNeeds;
}

// Fix the stepper inputs initialization function name
function initStepperInputs() {
    initStepperControls();
}
