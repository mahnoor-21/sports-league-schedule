// static/script.js
let teams = [];
let venues = [];
let referees = [];
let timeSlots = [];
let charts = {};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeCharts();
});

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-items li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const section = item.dataset.section;
            document.querySelectorAll('main section').forEach(s => {
                s.classList.add('hidden');
            });
            document.getElementById(section).classList.remove('hidden');
        });
    });
}

function initializeCharts() {
    // Team Distribution Chart
    const teamCtx = document.getElementById('team-distribution-chart').getContext('2d');
    charts.teamDistribution = new Chart(teamCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Games per Team',
                data: [],
                backgroundColor: 'rgba(52, 152, 219, 0.6)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Venue Usage Chart
    const venueCtx = document.getElementById('venue-usage-chart').getContext('2d');
    charts.venueUsage = new Chart(venueCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(52, 152, 219, 0.6)',
                    'rgba(46, 204, 113, 0.6)',
                    'rgba(155, 89, 182, 0.6)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function addTeam() {
    const nameInput = document.getElementById('team-name');
    const strengthInput = document.getElementById('team-strength');
    
    if (nameInput.value.trim() && strengthInput.value) {
        teams.push({
            name: nameInput.value.trim(),
            strength: parseInt(strengthInput.value)
        });
        updateTeamsList();
        nameInput.value = '';
        strengthInput.value = '';
    }
}

function addVenue() {
    const nameInput = document.getElementById('venue-name');
    const capacityInput = document.getElementById('venue-capacity');
    
    if (nameInput.value.trim() && capacityInput.value) {
        venues.push({
            name: nameInput.value.trim(),
            capacity: parseInt(capacityInput.value)
        });
        updateVenuesList();
        nameInput.value = '';
        capacityInput.value = '';
    }
}

function addReferee() {
    const nameInput = document.getElementById('referee-name');
    const levelSelect = document.getElementById('referee-level');
    
    if (nameInput.value.trim()) {
        referees.push({
            name: nameInput.value.trim(),
            level: parseInt(levelSelect.value)
        });
        updateRefereesList();
        nameInput.value = '';
        levelSelect.value = '1';
    }
}

function addTimeSlot() {
    const dateInput = document.getElementById('slot-date');
    const timeInput = document.getElementById('slot-time');
    
    if (dateInput.value && timeInput.value) {
        const dateTime = `${dateInput.value}T${timeInput.value}`;
        timeSlots.push(dateTime);
        updateTimeSlotsList();
        dateInput.value = '';
        timeInput.value = '';
    }
}

function generateSchedule() {
    if (!validateInputs()) {
        alert('Please ensure you have added all required information.');
        return;
    }

    document.getElementById('loading-overlay').classList.remove('hidden');

    fetch('/generate_schedule', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            teams: teams.map(t => t.name),
            venues: venues.map(v => v.name),
            time_slots: timeSlots,
            referees: referees.map(r => r.name),
            team_strengths: Object.fromEntries(teams.map(t => [t.name, t.strength]))
        })
    })
    .then(response => response.json())
    .then(data => {
        displaySchedule(data);
        updateAnalytics(data);
        document.getElementById('loading-overlay').classList.add('hidden');
        // Switch to schedule view
        document.querySelector('[data-section="schedule"]').click();
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('loading-overlay').classList.add('hidden');
        alert('An error occurred while generating the schedule.');
    });
}

function displaySchedule(data) {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    data.schedule.forEach((daySchedule, dayIndex) => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        const dayHeader = document.createElement('h3');
        const date = new Date(timeSlots[dayIndex]);
        dayHeader.textContent = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        dayCard.appendChild(dayHeader);

        daySchedule.forEach(match => {
            const matchCard = createMatchCard(match, date);
            dayCard.appendChild(matchCard);
        });

        container.appendChild(dayCard);
    });
}

function createMatchCard(match, date) {
    const [home, away, venue] = match;
    const card = document.createElement('div');
    card.className = 'match-card';
    
    const teamStrengthDiff = Math.abs(
        teams.find(t => t.name === home).strength -
        teams.find(t => t.name === away).strength
    );
    
    if (teamStrengthDiff <= 2) {
        card.classList.add('balanced-match');
    }
    
    card.innerHTML = `
        <div class="match-teams">
            <span class="team home">${home}</span>
            <span class="vs">vs</span>
            <span class="team away">${away}</span>
        </div>
        <div class="match-details">
            <span class="venue"><i class="fas fa-map-marker-alt"></i> ${venue}</span>
            <span class="time"><i class="fas fa-clock"></i> ${date.toLocaleTimeString()}</span>
        </div>
    `;
    
    return card;
}

function updateAnalytics(data) {
    updateTeamDistributionChart(data);
    updateVenueUsageChart(data);
    updateOptimizationChart(data.stats);
    
    // Update quality scores
    document.getElementById('quality-score').textContent = 
        `${Math.round((1 - data.fitness / 1000) * 100)}%`;
    document.getElementById('balance-score').textContent =
        `${Math.round(calculateBalanceScore(data.schedule) * 100)}%`;
    document.getElementById('constraints-score').textContent =
        `${Math.round(calculateConstraintsScore(data.schedule) * 100)}%`;
}

function validateInputs() {
    return teams.length >= 2 &&
           venues.length >= 1 &&
           timeSlots.length >= 1 &&
           referees.length >= 1;
}

// Initialize the application