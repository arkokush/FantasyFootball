/**
 * Fantasy Football Draft Assistant - Utility Functions
 * This file contains utility functions for dark mode, animations, and player rankings
 */

// Team bye week data for 2025 season
const NFL_TEAM_BYES = {
    'ARI': 8,  // Cardinals
    'ATL': 5,  // Falcons
    'BAL': 7,  // Ravens
    'BUF': 7,  // Bills
    'CAR': 14, // Panthers
    'CHI': 5,  // Bears
    'CIN': 10, // Bengals
    'CLE': 9,  // Browns
    'DAL': 10, // Cowboys
    'DEN': 12, // Broncos
    'DET': 8,  // Lions
    'GB': 5,   // Packers
    'HOU': 6,  // Texans
    'IND': 11, // Colts
    'JAC': 8,  // Jaguars
    'JAX': 8,  // Jaguars (alternative code)
    'KC': 10,  // Chiefs
    'LV': 8,   // Raiders
    'LVR': 8,  // Raiders (alternative code)
    'LAC': 12, // Chargers
    'LAR': 8,  // Rams
    'MIA': 12, // Dolphins
    'MIN': 6,  // Vikings
    'NE': 14,  // Patriots
    'NO': 11,  // Saints
    'NYG': 14, // Giants
    'NYJ': 9,  // Jets
    'PHI': 9,  // Eagles
    'PIT': 5,  // Steelers
    'SF': 14,  // 49ers
    'SEA': 8,  // Seahawks
    'TB': 9,   // Buccaneers
    'TEN': 10, // Titans
    'WAS': 12, // Commanders
    'WSH': 12  // Commanders (alternative code)
};

/**
 * Get bye week for a team based on abbreviation
 * @param {string} teamCode - Team abbreviation code
 * @returns {number|string} - Bye week number or 'N/A' if not found
 */
function getTeamBye(teamCode) {
    if (!teamCode) return 'N/A';

    // Handle some common variations in team codes
    const normalizedCode = teamCode.toUpperCase();

    return NFL_TEAM_BYES[normalizedCode] || 'N/A';
}

// Theme management
const themeUtils = {
    /**
     * Get the current theme from localStorage or default to light
     * @returns {string} The current theme name
     */
    getCurrentTheme() {
        return localStorage.getItem('fantasy-theme') || 'light';
    },

    /**
     * Set the theme and save it to localStorage
     * @param {string} theme - Theme name
     */
    setTheme(theme) {
        // Remove all existing theme data attributes
        const themes = ['light', 'dark', 'forest', 'midnight', 'sunset'];
        themes.forEach(t => document.body.classList.remove(`theme-${t}`));

        // Add the new theme class
        document.body.classList.add(`theme-${theme}`);

        // Store the theme preference
        localStorage.setItem('fantasy-theme', theme);

        // Update dropdown if it exists
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    },

    /**
     * Initialize theme functionality
     */
    initTheme() {
        // Apply saved theme
        const savedTheme = this.getCurrentTheme();
        this.setTheme(savedTheme);

        // Set up theme select dropdown
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }
    }
};

// Animation utilities
const animationUtils = {
    /**
     * Add fade-in animation to elements
     * @param {string} selector - CSS selector for elements to animate
     * @param {number} staggerDelay - Delay in ms between each element
     */
    fadeInElements(selector, staggerDelay = 100) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            setTimeout(() => {
                el.style.transition = 'opacity 0.5s ease-in-out';
                el.style.opacity = '1';
            }, index * staggerDelay);
        });
    },

    /**
     * Add slide-up animation to elements
     * @param {string} selector - CSS selector for elements to animate
     * @param {number} staggerDelay - Delay in ms between each element
     */
    slideUpElements(selector, staggerDelay = 100) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'all 0.5s ease-in-out';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * staggerDelay);
        });
    },

    /**
     * Add pulse animation to an element
     * @param {HTMLElement} element - Element to animate
     * @param {number} duration - Animation duration in ms
     */
    pulseElement(element, duration = 1000) {
        element.classList.add('pulse');
        setTimeout(() => {
            element.classList.remove('pulse');
        }, duration);
    }
};

// Player ranking functionality
const rankingUtils = {
    // Store current state
    state: {
        allPlayers: [], // All available players
        currentTab: 'all', // Current position tab
        sortField: 'vor', // Current sort field
        sortDirection: 'desc', // Current sort direction ('asc' or 'desc')
        searchQuery: '', // Current search query
        displayLimit: 50, // Number of players to display
        draftedPlayers: {}, // Object to track drafted players: { playerName: teamName }
        showDraftedPlayers: false // Flag to track whether to show drafted players
    },

    /**
     * Calculate VOR (Value Over Replacement) for players
     * @param {Array} players - Array of player objects
     * @param {Object} settings - League settings
     * @param {number} scoringType - 0 for standard, 0.5 for half-PPR, 1 for PPR
     * @returns {Array} Players with vor property added
     */
    calculateVOR(players, settings, scoringType) {
        // Group players by position
        const playersByPos = {};
        players.forEach(player => {
            const pos = player.position;
            if (!playersByPos[pos]) playersByPos[pos] = [];
            playersByPos[pos].push(player);
        });

        // Sort each position by projected points
        Object.keys(playersByPos).forEach(pos => {
            playersByPos[pos].sort((a, b) => {
                return getProjectedPoints(b, scoringType) - getProjectedPoints(a, scoringType);
            });
        });

        // Calculate base values for each position
        const baseValues = {};
        const positionCounts = {
            QB: settings.numQBs * settings.numTeams,
            RB: settings.numRBs * settings.numTeams,
            WR: settings.numWRs * settings.numTeams,
            TE: settings.numTEs * settings.numTeams,
            K: settings.numKs * settings.numTeams,
            DST: settings.numDST * settings.numTeams
        };

        Object.keys(positionCounts).forEach(pos => {
            const count = positionCounts[pos];
            const posPlayers = playersByPos[pos];
            if (posPlayers && posPlayers.length > count) {
                baseValues[pos] = getProjectedPoints(posPlayers[count], scoringType);
            } else {
                baseValues[pos] = 0;
            }
        });

        // Calculate VOR for each player
        return players.map(player => {
            const baseValue = baseValues[player.position] || 0;
            const projPoints = getProjectedPoints(player, scoringType);
            player.vor = projPoints - baseValue;
            return player;
        });
    },

    /**
     * Initialize the player ranking section
     */
    async initRankings() {
        try {
            // Set up event listeners for tabs
            const tabButtons = document.querySelectorAll('.tab-btn');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => this.changeTab(btn.dataset.tab));
            });

            // Set up search functionality
            const searchInput = document.getElementById('player-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    this.state.searchQuery = searchInput.value.toLowerCase();
                    this.renderPlayerTable();
                });
            }

            // Set up display limit dropdown
            const limitSelect = document.getElementById('ranking-limit');
            if (limitSelect) {
                limitSelect.addEventListener('change', () => {
                    this.state.displayLimit = limitSelect.value === 'all' ? Infinity : parseInt(limitSelect.value);
                    this.renderPlayerTable();
                });
            }

            // Set up sortable columns
            const sortableHeaders = document.querySelectorAll('th.sortable');
            sortableHeaders.forEach(th => {
                th.addEventListener('click', () => {
                    const field = th.dataset.sort;
                    this.toggleSort(field);
                });
            });

            // Load and display players
            await this.loadPlayers();

            // Show the rankings section
            document.getElementById('player-rankings').style.display = 'block';
        } catch (error) {
            console.error('Error initializing player rankings:', error);
        }
    },

    /**
     * Load player data
     */
    async loadPlayers() {
        try {
            // Wait for player data to be available
            await preloadAllPlayerNames();

            // Get all players from cache and add VOR
            const settings = getDraftSettings();
            const scoringType = getScoringType();
            const availablePlayers = await getAvailablePlayersAsync();

            // Combine all positions
            let allPlayers = [];
            const positions = ['qb', 'rb', 'wr', 'te', 'k', 'dst'];

            positions.forEach(pos => {
                if (availablePlayers[pos]) {
                    availablePlayers[pos].forEach(player => {
                        // Make sure each player has a position
                        player.position = pos.toUpperCase();
                        allPlayers.push(player);
                    });
                }
            });

            // Calculate VOR for all players
            this.state.allPlayers = this.calculateVOR(allPlayers, settings, scoringType);

            // Initial render
            this.renderPlayerTable();
        } catch (error) {
            console.error('Error loading players:', error);
        }
    },

    /**
     * Change the current position tab
     * @param {string} tab - Position tab to switch to
     */
    changeTab(tab) {
        if (!tab) return;

        // Update active tab UI
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        this.state.currentTab = tab;
        this.renderPlayerTable();
    },

    /**
     * Toggle sort field and direction
     * @param {string} field - Field to sort by
     */
    toggleSort(field) {
        if (this.state.sortField === field) {
            // Toggle direction if already sorting by this field
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New field, default to descending
            this.state.sortField = field;
            this.state.sortDirection = 'desc';
        }

        // Update sort icons
        document.querySelectorAll('th.sortable i').forEach(icon => {
            icon.className = 'fas fa-sort'; // Reset all
        });

        const currentHeader = document.querySelector(`th[data-sort="${field}"] i`);
        if (currentHeader) {
            currentHeader.className = `fas fa-sort-${this.state.sortDirection === 'asc' ? 'up' : 'down'}`;
        }

        this.renderPlayerTable();
    },

    /**
     * Filter players based on current tab and search query
     * @returns {Array} Filtered players
     */
    getFilteredPlayers() {
        return this.state.allPlayers.filter(player => {
            // Filter by position tab
            if (this.state.currentTab !== 'all' &&
                player.position.toLowerCase() !== this.state.currentTab &&
                !(this.state.currentTab === 'flex' && ['RB', 'WR', 'TE'].includes(player.position))) {
                return false;
            }

            // Filter by search query
            if (this.state.searchQuery && !player.name.toLowerCase().includes(this.state.searchQuery)) {
                return false;
            }

            // If showDraftedPlayers is false, hide drafted players
            if (!this.state.showDraftedPlayers && this.state.draftedPlayers[player.name]) {
                return false;
            }

            return true;
        });
    },

    /**
     * Draft a player to a team
     * @param {Object} player - Player object to draft
     */
    draftPlayer(player) {
        if (!player || !player.name) return;

        // Prompt for team name
        const teamName = prompt(`Select team for ${player.name}:`, `Team ${Object.keys(this.state.draftedPlayers).length + 1}`);
        if (!teamName) return; // User cancelled

        // Add to drafted players
        this.state.draftedPlayers[player.name] = teamName;

        // Update local storage to persist drafted players
        localStorage.setItem('fantasy-drafted-players', JSON.stringify(this.state.draftedPlayers));

        // Re-render the table to reflect the change
        this.renderPlayerTable();
    },

    /**
     * Initialize drafted players tracking
     */
    initDraftedPlayersTracking() {
        // Load drafted players from localStorage if available
        const savedDraftedPlayers = localStorage.getItem('fantasy-drafted-players');
        if (savedDraftedPlayers) {
            try {
                this.state.draftedPlayers = JSON.parse(savedDraftedPlayers);
            } catch (e) {
                console.error('Error parsing drafted players:', e);
                this.state.draftedPlayers = {};
            }
        }

        // Initialize "See drafted players" checkbox
        const showDraftedCheckbox = document.getElementById('show-drafted-players');
        if (showDraftedCheckbox) {
            // Set initial state
            showDraftedCheckbox.checked = this.state.showDraftedPlayers;

            // Add event listener
            showDraftedCheckbox.addEventListener('change', (e) => {
                this.state.showDraftedPlayers = e.target.checked;
                this.renderPlayerTable();
            });
        }
    },

    /**
     * Sort players based on current sort field and direction
     * @param {Array} players - Players to sort
     * @returns {Array} Sorted players
     */
    sortPlayers(players) {
        const field = this.state.sortField;
        const direction = this.state.sortDirection;

        return [...players].sort((a, b) => {
            let valA, valB;

            if (field === 'projected') {
                valA = getProjectedPoints(a, getScoringType());
                valB = getProjectedPoints(b, getScoringType());
            } else {
                valA = a[field] || 0;
                valB = b[field] || 0;
            }

            // Sort direction
            return direction === 'asc' ? valA - valB : valB - valA;
        });
    },

    /**
     * Render the player table with current filters and sorting
     */
    renderPlayerTable() {
        const tableBody = document.getElementById('ranking-table-body');
        if (!tableBody) return;

        // Get filtered and sorted players
        const filteredPlayers = this.getFilteredPlayers();
        const sortedPlayers = this.sortPlayers(filteredPlayers);

        // Apply display limit
        const playersToDisplay = sortedPlayers.slice(0, this.state.displayLimit);

        // Clear table
        tableBody.innerHTML = '';

        if (playersToDisplay.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        No players found matching your criteria
                    </td>
                </tr>
            `;
            return;
        }

        // Add player rows
        playersToDisplay.forEach((player, index) => {
            const projPoints = getProjectedPoints(player, getScoringType()).toFixed(1);
            const vorValue = player.vor ? player.vor.toFixed(1) : 'N/A';
            const isHighVOR = player.vor && player.vor > 20; // Threshold for highlighting high VOR

            // Get bye week directly from player data if available, otherwise use mapping
            let byeWeek = 'N/A';

            // First try to get from BYE field if it exists in data
            if (player.BYE !== undefined && player.BYE !== null) {
                // Convert to integer if it's a number
                byeWeek = !isNaN(player.BYE) ? parseInt(player.BYE, 10) : player.BYE;
            }
            // Fall back to using the team code and our bye week mapping
            else if (player.team) {
                byeWeek = getTeamBye(player.team);
            }

            // Create CSS class for highlighting bye weeks if in a critical week (e.g., playoffs)
            const byeClass = (parseInt(byeWeek) >= 13) ? 'playoff-bye' : '';

            // Properly check if player is drafted and get team name
            const isDrafted = this.state.draftedPlayers[player.name] ? true : false;
            const teamName = isDrafted ? this.state.draftedPlayers[player.name] : 'Undrafted';

            // Create draft status class based on draft status
            const draftStatusClass = isDrafted ? 'draft-status drafted' : 'draft-status undrafted';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${player.name}</td>
                <td>
                    <span class="position-badge position-${player.position.toLowerCase()}">
                        ${player.position}
                    </span>
                </td>
                <td>${player.team || 'N/A'}</td>
                <td class="bye-week ${byeClass}">
                    ${byeWeek !== 'N/A' ? `Week ${byeWeek}` : 'N/A'}
                </td>
                <td>${projPoints}</td>
                <td class="${isHighVOR ? 'high-vor' : ''}">${vorValue}</td>
                <td class="${draftStatusClass}">
                    ${isDrafted ? `<i class="fas fa-check"></i> ${teamName}` : 'Undrafted'}
                </td>
            `;

            // Make the row clickable to show player details
            row.classList.add('player-row');
            row.addEventListener('click', (e) => {
                // Show player details in a popover
                this.showPlayerDetails(player, e);
            });

            tableBody.appendChild(row);
        });
    },

    /**
     * Show player details in a popover
     * @param {Object} player - Player object with details
     * @param {Event} event - Click event that triggered this
     */
    showPlayerDetails(player, event) {
        // Create and position popover
        const popover = document.createElement('div');
        popover.className = 'player-detail-popover';

        // Get bye week information
        const byeWeek = player.BYE || getTeamBye(player.team) || 'N/A';
        const byeDisplay = byeWeek !== 'N/A' ? `Week ${byeWeek}` : 'N/A';

        // Calculate scoring type
        const scoringType = getScoringType();
        const scoringName = scoringType === 1 ? 'PPR' :
                           scoringType === 0.5 ? 'Half-PPR' : 'Standard';

        // Calculate projected points
        const projPoints = getProjectedPoints(player, scoringType).toFixed(1);

        // Build popover content
        popover.innerHTML = `
            <div class="popover-header">
                <h3>${player.name}</h3>
                <span class="position-badge position-${player.position.toLowerCase()}">${player.position}</span>
                <button class="close-popover"><i class="fas fa-times"></i></button>
            </div>
            <div class="popover-body">
                <div class="player-detail-row">
                    <span class="detail-label">Team:</span>
                    <span class="detail-value">${player.team || 'N/A'}</span>
                </div>
                <div class="player-detail-row">
                    <span class="detail-label">Bye Week:</span>
                    <span class="detail-value">${byeDisplay}</span>
                </div>
                <div class="player-detail-row">
                    <span class="detail-label">Projected (${scoringName}):</span>
                    <span class="detail-value">${projPoints} pts</span>
                </div>
                ${player.vor ? `
                <div class="player-detail-row">
                    <span class="detail-label">VOR:</span>
                    <span class="detail-value">${player.vor.toFixed(1)}</span>
                </div>` : ''}
            </div>
        `;

        // Position the popover near the click
        const rect = event.target.closest('tr').getBoundingClientRect();
        popover.style.top = `${rect.bottom + window.scrollY}px`;
        popover.style.left = `${rect.left + window.scrollX}px`;

        // Add to DOM
        document.body.appendChild(popover);

        // Add close handler
        popover.querySelector('.close-popover').addEventListener('click', () => {
            document.body.removeChild(popover);
        });

        // Close when clicking outside
        document.addEventListener('click', function closePopover(e) {
            if (!popover.contains(e.target) && !event.target.closest('tr').contains(e.target)) {
                if (document.body.contains(popover)) {
                    document.body.removeChild(popover);
                }
                document.removeEventListener('click', closePopover);
            }
        });
    },
};

// Initialize features when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    themeUtils.initTheme();

    // Initialize drafted players tracking
    rankingUtils.initDraftedPlayersTracking();

    // Set up form submission to initialize rankings after player data is loaded
    document.getElementById('draft-settings-form').addEventListener('submit', async function(e) {
        // Wait for existing form submission logic to complete
        setTimeout(async () => {
            // Initialize player rankings
            await rankingUtils.initRankings();

            // Initialize drafted players tracking again after rankings are loaded
            rankingUtils.initDraftedPlayersTracking();

            // Add animations to team boxes
            animationUtils.slideUpElements('.team-box', 150);
        }, 1000);
    });
});
