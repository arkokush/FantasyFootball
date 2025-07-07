// Get draft settings from form inputs
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

// Utility to fetch and parse a CSV file, returning an array of player names
async function loadPlayerNames(position) {
    const fileMap = {
        QB: 'qb_projections.csv',
        RB: 'rb_projections.csv',
        WR: 'wr_projections.csv',
        TE: 'te_projections.csv',
        K: 'k_projections.csv',
        DST: 'dst_projections.csv'
    };

    // FLEX: combine RB, WR, TE
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
        // Deduplicate
        return [...new Set(names)];
    }

    // BENCH: use projections_full.csv
    if (position === 'Bench') {
        const res = await fetch('../data/2025/projections_full.csv');
        const text = await res.text();
        const [header, ...rows] = text.trim().split('\n');
        const keys = header.split(',');
        const nameIdx = keys.indexOf('name');
        if (nameIdx === -1) return [];
        return rows.map(row => row.split(',')[nameIdx]).filter(Boolean);
    }

    // Default: single file
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

// Preload all player names by position
const playerNamesByPos = {};
async function preloadAllPlayerNames() {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'FLEX', 'DST', 'Bench'];
    for (const pos of positions) {
        playerNamesByPos[pos] = await loadPlayerNames(pos);
        if (pos === 'QB') {
            console.log('QB names loaded:', playerNamesByPos[pos]);
        }
    }
}

// Create the recommendation box UI
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

    recBox.querySelector('#assist-btn').onclick = function() {
        const selected = teamSelect.selectedIndex;
        const teamName = teamSelect.options[selected].textContent;
        recBox.querySelector('#assist-recommendation').textContent = `Recommended pick for ${teamName}: (feature coming soon)`;
    };
}

// Create the teams container
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

// Add dropdowns for a team box
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

// Make team name editable
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

// Create all team boxes
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

// Main form submit handler
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