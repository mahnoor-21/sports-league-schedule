% schedule_constraints.pl

% Define basic predicates for schedule validation
:- dynamic game/6.  % game(HomeTeam, AwayTeam, Venue, Date, Time, RefereeID)
:- dynamic venue_availability/3.  % venue_availability(Venue, Date, TimeSlot)
:- dynamic team_strength/2.  % team_strength(Team, StrengthRating)
:- dynamic referee_availability/3.  % referee_availability(RefereeID, Date, TimeSlot)
:- dynamic local_rivalry/2.  % local_rivalry(Team1, Team2)

% Constraint 1: No team plays twice in same round
valid_schedule(Schedule) :-
    \+ (member(game(Home1, Away1, _, Date, _, _), Schedule),
        member(game(Home2, Away2, _, Date, _, _), Schedule),
        (Home1 = Home2; Home1 = Away2; Away1 = Home2; Away1 = Away2),
        \+ same_game(Home1, Away1, Home2, Away2)).

% Constraint 2: Home-Away balance
balanced_home_away(Schedule, Team) :-
    count_home_games(Schedule, Team, HomeCount),
    count_away_games(Schedule, Team, AwayCount),
    Diff is abs(HomeCount - AwayCount),
    Diff =< 1.

% Constraint 3: Venue conflicts
no_venue_conflicts(Schedule) :-
    \+ (member(game(_, _, Venue, Date, Time1, _), Schedule),
        member(game(_, _, Venue, Date, Time2, _), Schedule),
        Time1 = Time2,
        \+ same_game(Home1, Away1, Home2, Away2)).

% Constraint 4: Rest period
valid_rest_period(Schedule) :-
    \+ (member(game(Team, _, _, Date1, _, _), Schedule),
        member(game(Team, _, _, Date2, _, _), Schedule),
        date_difference(Date1, Date2, Diff),
        Diff < 3).

% Constraint 5: Local rivalry handling
handle_local_rivalries(Schedule) :-
    \+ (member(game(Home1, Away1, _, Date, _, _), Schedule),
        member(game(Home2, Away2, _, Date, _, _), Schedule),
        (local_rivalry(Home1, Away1); local_rivalry(Home2, Away2))).

% Helper predicates
same_game(H1, A1, H2, A2) :-
    (H1 = H2, A1 = A2);
    (H1 = A2, A1 = H2).

count_home_games(Schedule, Team, Count) :-
    findall(1, member(game(Team, _, _, _, _, _), Schedule), Games),
    length(Games, Count).

count_away_games(Schedule, Team, Count) :-
    findall(1, member(game(_, Team, _, _, _, _), Schedule), Games),
    length(Games, Count).

% Interface predicates for Python
validate_schedule(Schedule) :-
    valid_schedule(Schedule),
    no_venue_conflicts(Schedule),
    handle_local_rivalries(Schedule),
    forall(member(game(Home, Away, _, _, _, _), Schedule),
           (balanced_home_away(Schedule, Home),
            balanced_home_away(Schedule, Away))).

add_game(Home, Away, Venue, Date, Time, RefereeID) :-
    assertz(game(Home, Away, Venue, Date, Time, RefereeID)).

remove_all_games :-
    retractall(game(_, _, _, _, _, _)).