# SafeRoute — Interactive MDP Website

**Project:** Adaptive Indoor Emergency Evacuation Guidance System Using Real-Time Hazard Detection

SafeRoute is a local, interactive website for exploring graph-based indoor route selection. It combines a Flask API, a Python Dijkstra route engine, and a responsive dashboard.

## Dashboard features

- Interactive floor-network map with four rooms, three junctions, nine corridors, and two exits.
- Selectable starting room.
- Clickable map corridors and individual corridor controls to simulate a blockage.
- Quick scenarios for normal conditions, unavailable Exit A, a blocked central corridor, a disconnected Room 1, and both exits unavailable.
- Dijkstra route calculation through the Python API.
- Route highlighting, path steps, selected exit, illustrative path cost, and no-route result.
- Session activity list and one-click reset.
- Responsive layout for laptop and mobile screens.

## Run on Windows

**Recommended:** Double-click `run_windows.bat`. The script creates a virtual environment if needed, installs Flask, and starts the website.

Then open `http://127.0.0.1:5000` in your browser. Keep the terminal window open while you use SafeRoute. Press `Ctrl+C` to stop the server.

Alternatively, open this folder in VS Code and run these commands in the terminal:

```powershell
py -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
python app.py
```

Then visit `http://127.0.0.1:5000`.

## Run the route-engine tests

Activate the virtual environment and run:

```powershell
python -m unittest discover -s tests -v
```

The current route-engine test suite contains five tests for normal routing, exit fallback, blocked corridors, disconnected routes, and alternate corridor selection.

## Project structure

```text
saferoute_mdp/
├── app.py                 # Flask website and JSON API
├── routing.py             # Floor graph and Dijkstra route engine
├── requirements.txt       # Flask dependency
├── run_windows.bat        # Windows setup and launch helper
├── templates/
│   └── index.html         # Dashboard structure
├── static/
│   ├── app.js             # Interactive controls, map rendering, and API calls
│   └── style.css          # Responsive visual design
└── tests/
    └── test_routing.py   # Route-engine tests
```

## Current model

The map uses rooms 1–4, junctions J1–J3, Exit A, Exit B, and corridors C1–C9. Corridor costs are illustrative graph units; they do not represent measured distances, travel times, or validated evacuation costs. The schematic layout should be updated to match the team's final physical model.

## Important

This is an academic simulation prototype, not certified life-safety software. It does not currently read real sensors or control LEDs. Do not use it to direct a real evacuation. Hardware integration and testing must be completed separately before describing those features as operational.
