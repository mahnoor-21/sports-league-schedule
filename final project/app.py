# app.py
from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import random
from deap import base, creator, tools, algorithms
import numpy as np
import subprocess
import os
import tempfile

app = Flask(__name__)

class PrologInterface:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def create_prolog_file(self, schedule):
        prolog_file = os.path.join(self.temp_dir, "schedule.pl")
        with open(prolog_file, "w") as f:
            # Write predicates
            f.write("""
:- dynamic game/6.
:- dynamic venue_availability/3.
:- dynamic team_strength/2.

% Constraint checking predicates
valid_schedule(Schedule) :-
    \+ (member(game(Home1, Away1, _, Date, _, _), Schedule),
        member(game(Home2, Away2, _, Date, _, _), Schedule),
        (Home1 = Home2; Home1 = Away2; Away1 = Home2; Away1 = Away2),
        \+ same_game(Home1, Away1, Home2, Away2)).

no_venue_conflicts(Schedule) :-
    \+ (member(game(_, _, Venue, Date, Time1, _), Schedule),
        member(game(_, _, Venue, Date, Time2, _), Schedule),
        Time1 = Time2,
        \+ same_game(Home1, Away1, Home2, Away2)).

% Helper predicates
same_game(H1, A1, H2, A2) :-
    (H1 = H2, A1 = A2);
    (H1 = A2, A1 = H2).
""")
            
            # Write schedule facts
            for day_idx, day_schedule in enumerate(schedule):
                for match in day_schedule:
                    home, away, venue = match
                    f.write(f"game('{home}', '{away}', '{venue}', {day_idx}, 1800, 1).\n")
        
        return prolog_file

    def validate_schedule(self, schedule):
        prolog_file = self.create_prolog_file(schedule)
        try:
            # Run SWI-Prolog with the schedule file
            result = subprocess.run(
                ['swipl', '-s', prolog_file, '-g', 'valid_schedule(Schedule),no_venue_conflicts(Schedule)', '-t', 'halt'],
                capture_output=True,
                text=True
            )
            # Check if Prolog returned successfully
            return result.returncode == 0
        except subprocess.CalledProcessError:
            return False
        finally:
            # Clean up
            if os.path.exists(prolog_file):
                os.remove(prolog_file)

class EnhancedLeagueScheduler:
    def __init__(self, teams, venues, time_slots, referees, team_strengths):
        self.teams = teams
        self.venues = venues
        self.time_slots = time_slots
        self.referees = referees
        self.team_strengths = team_strengths
        self.prolog = PrologInterface()

    def generate_initial_schedule(self):
        schedule = []
        for _ in range(len(self.time_slots)):
            day_schedule = []
            available_teams = self.teams.copy()
            while len(available_teams) >= 2:
                team1 = random.choice(available_teams)
                available_teams.remove(team1)
                team2 = random.choice(available_teams)
                available_teams.remove(team2)
                venue = random.choice(self.venues)
                day_schedule.append((team1, team2, venue))
            schedule.append(day_schedule)
        return schedule

    def evaluate_schedule(self, schedule):
        if not self.prolog.validate_schedule(schedule):
            return (float('inf'),)
            
        penalties = 0
        
        # Check strength balance
        for day_schedule in schedule:
            for match in day_schedule:
                home, away, _ = match
                strength_diff = abs(self.team_strengths[home] - self.team_strengths[away])
                if strength_diff > 2:
                    penalties += strength_diff
                    
        return (penalties,)

    def crossover(self, ind1, ind2):
        # Implement improved crossover
        crossover_points = sorted(random.sample(range(len(ind1)), 2))
        new_ind1 = ind1[:crossover_points[0]] + \
                   ind2[crossover_points[0]:crossover_points[1]] + \
                   ind1[crossover_points[1]:]
        new_ind2 = ind2[:crossover_points[0]] + \
                   ind1[crossover_points[0]:crossover_points[1]] + \
                   ind2[crossover_points[1]:]
        return new_ind1, new_ind2

    def mutate(self, individual):
        if random.random() < 0.2:  # 20% chance of mutation
            # Swap two random matches
            day1, day2 = random.sample(range(len(individual)), 2)
            match1 = random.randint(0, len(individual[day1])-1)
            match2 = random.randint(0, len(individual[day2])-1)
            
            individual[day1][match1], individual[day2][match2] = \
                individual[day2][match2], individual[day1][match1]
                
            # Potentially change venue
            if random.random() < 0.5:
                individual[day1][match1] = (
                    individual[day1][match1][0],
                    individual[day1][match1][1],
                    random.choice(self.venues)
                )
        return individual,

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/generate_schedule', methods=['POST'])
def generate_schedule():
    data = request.get_json()
    
    # Process input data
    teams = data['teams']
    venues = data['venues']
    time_slots = [datetime.strptime(ts, '%Y-%m-%dT%H:%M') 
                 for ts in data['time_slots']]
    referees = data['referees']
    team_strengths = data['team_strengths']
    
    scheduler = EnhancedLeagueScheduler(teams, venues, time_slots, 
                                      referees, team_strengths)
    
    # GA Parameters
    POPULATION_SIZE = 100
    GENERATIONS = 50
    
    toolbox = base.Toolbox()
    toolbox.register("individual", tools.initIterate, creator.Individual,
                     scheduler.generate_initial_schedule)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)
    toolbox.register("evaluate", scheduler.evaluate_schedule)
    toolbox.register("mate", scheduler.crossover)
    toolbox.register("mutate", scheduler.mutate)
    toolbox.register("select", tools.selTournament, tournsize=3)
    
    population = toolbox.population(n=POPULATION_SIZE)
    stats = tools.Statistics(lambda ind: ind.fitness.values)
    stats.register("min", np.min)
    stats.register("avg", np.mean)
    
    result, logbook = algorithms.eaSimple(population, toolbox,
                                        cxpb=0.7, mutpb=0.2,
                                        ngen=GENERATIONS,
                                        stats=stats,
                                        verbose=True)
    
    best_schedule = tools.selBest(result, k=1)[0]
    
    return jsonify({
        'schedule': best_schedule,
        'fitness': scheduler.evaluate_schedule(best_schedule)[0],
        'stats': logbook
    })

if __name__ == '__main__':
    app.run(debug=True)