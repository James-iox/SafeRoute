"""SafeRoute MDP prototype: a local Flask app for graph-based evacuation simulation.

This is an academic simulation only. It is not certified life-safety software.
"""
from __future__ import annotations

from typing import Any

from flask import Flask, jsonify, render_template, request

from routing import EDGES, EXITS, NODES, START_ROOMS, find_best_route

app = Flask(__name__)


def _normalise_set(value: Any, allowed: set[str]) -> set[str]:
    """Safely filter a JSON list to the IDs allowed by the server."""
    if not isinstance(value, list):
        return set()
    return {item for item in value if isinstance(item, str) and item in allowed}


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/map")
def map_data():
    return jsonify({"nodes": NODES, "edges": EDGES, "start_rooms": START_ROOMS, "exits": EXITS})


@app.post("/api/route")
def calculate_route():
    payload = request.get_json(silent=True) or {}
    start = payload.get("start", "Room 1")
    if start not in START_ROOMS:
        return jsonify({"error": "Choose one of the four model rooms as the starting location."}), 400

    blocked_edges = _normalise_set(payload.get("blocked_edges", []), set(EDGES))
    blocked_exits = _normalise_set(payload.get("blocked_exits", []), set(EXITS))
    result = find_best_route(start, blocked_edges, blocked_exits)

    response = {
        "start": start,
        "blocked_edges": sorted(blocked_edges),
        "blocked_exits": sorted(blocked_exits),
        "route_found": result is not None,
        "route_nodes": result["route_nodes"] if result else [],
        "route_edges": result["route_edges"] if result else [],
        "selected_exit": result["selected_exit"] if result else None,
        "total_cost": result["total_cost"] if result else None,
        "visited_nodes": result["visited_nodes"] if result else 0,
        "mode": "simulation",
    }
    if result:
        response["message"] = f"Route found to {result['selected_exit']}. Costs are illustrative units."
    else:
        response["message"] = "No available exit is reachable from this room under the selected simulation conditions."
    return jsonify(response)


if __name__ == "__main__":
    # Local development only; do not expose this development server to the internet.
    app.run(host="127.0.0.1", port=5000, debug=True)
