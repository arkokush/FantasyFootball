document.getElementById('draft-settings-form').addEventListener('submit', function(e) {
    e.preventDefault();

    document.getElementById('draft-settings-form').style.display = 'none';
    const numTeams = parseInt(document.getElementById('num-teams').value, 10);
    const numQBs = parseInt(document.getElementById('num-qbs').value, 10);
    const numRBs = parseInt(document.getElementById('num-rbs').value, 10);
    const numWRs = parseInt(document.getElementById('num-wrs').value, 10);
    const numTEs = parseInt(document.getElementById('num-tes').value, 10);
    const numKs = parseInt(document.getElementById('num-ks').value, 10);
    const numFlex = parseInt(document.getElementById('num-flex').value, 10);
    const numDST = parseInt(document.getElementById('num-dst').value, 10);
    const numBench = parseInt(document.getElementById('num-bench').value, 10);

    let teamsContainer = document.getElementById('teams-container');
    if (!teamsContainer) {
        teamsContainer = document.createElement('div');
        teamsContainer.id = 'teams-container';
        document.body.appendChild(teamsContainer);
    }
    teamsContainer.innerHTML = '';

    for (let t = 1; t <= numTeams; t++) {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'team-box';

        const h3 = document.createElement('h3');
        h3.textContent = `Team ${t}`;
        makeTeamNameEditable(h3, teamDiv);
        teamDiv.appendChild(h3);

        function addDropdowns(label, count) {
            for (let i = 1; i <= count; i++) {
                const select = document.createElement('select');
                select.name = `team${t}-${label}${i}`;
                select.innerHTML = `<option value="">Select ${label} ${i}</option>`;
                teamDiv.appendChild(select);
            }
        }

        addDropdowns('QB', numQBs);
        addDropdowns('RB', numRBs);
        addDropdowns('WR', numWRs);
        addDropdowns('TE', numTEs);
        addDropdowns('K', numKs);
        addDropdowns('FLEX', numFlex);
        addDropdowns('DST', numDST);
        addDropdowns('Bench', numBench);

        teamsContainer.appendChild(teamDiv);
    }
});

function makeTeamNameEditable(h3, teamDiv) {
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
        }

        input.addEventListener('blur', saveName);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    });
}