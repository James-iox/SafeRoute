"""Dependency-free graph model and route-selection algorithm for SafeRoute."""
from __future__ import annotations

import heapq
from typing import Any

# Schematic node coordinates are used only to draw the web dashboard.
NODES: dict[str, dict[str, Any]] = {
    "Room 1": {"label": "ROOM 1", "kind": "room", "x": 100, "y": 95, "w": 92, "h": 58},
    "Room 2": {"label": "ROOM 2", "kind": "room", "x": 100, "y": 285, "w": 92, "h": 58},
    "J1": {"label": "J1", "kind": "junction", "x": 280, "y": 190},
    "J2": {"label": "J2", "kind": "junction", "x": 460, "y": 190},
    "Room 3": {"label": "ROOM 3", "kind": "room", "x": 475, "y": 105, "w": 92, "h": 58},
    "J3": {"label": "J3", "kind": "junction", "x": 620, "y": 300},
    "Room 4": {"label": "ROOM 4", "kind": "room", "x": 625, "y": 390, "w": 92, "h": 58},
    "Exit A": {"label": "EXIT A", "kind": "exit", "x": 280, "y": 55, "w": 100, "h": 48},
    "Exit B": {"label": "EXIT B", "kind": "exit", "x": 765, "y": 190, "w": 92, "h": 48},
}

# Each edge stands for a corridor. Costs are illustrative units, not metres or seconds.
EDGES: dict[str, dict[str, Any]] = {
    "C1": {"from": "Room 1", "to": "J1", "cost": 3},
    "C2": {"from": "Room 2", "to": "J1", "cost": 3},
    "C3": {"from": "J1", "to": "J2", "cost": 3},
    "C4": {"from": "J1", "to": "Exit A", "cost": 2},
    "C5": {"from": "J2", "to": "Exit B", "cost": 4},
    "C6": {"from": "J2", "to": "J3", "cost": 3},
    "C7": {"from": "J3", "to": "Exit B", "cost": 3},
    "C8": {"from": "J2", "to": "Room 3", "cost": 2},
    "C9": {"from": "J3", "to": "Room 4", "cost": 2},
}
EXITS = ("Exit A", "Exit B")
START_ROOMS = ("Room 1", "Room 2", "Room 3", "Room 4")


def find_best_route(
    start: str,
    blocked_edges: set[str] | None = None,
    blocked_exits: set[str] | None = None,
) -> dict[str, Any] | None:
    """Return the least-cost route from start to any available exit using Dijkstra.

    A blocked corridor is omitted from the graph. An unavailable exit cannot be
    entered. The function returns None when no available exit can be reached.
    """
    blocked_edges = blocked_edges or set()
    blocked_exits = blocked_exits or set()

    adjacency: dict[str, list[tuple[str, int, str]]] = {node: [] for node in NODES}
    for edge_id, edge in EDGES.items():
        if edge_id in blocked_edges:
            continue
        left, right = edge["from"], edge["to"]
        if right in blocked_exits or left in blocked_exits:
            continue
        cost = int(edge["cost"])
        adjacency[left].append((right, cost, edge_id))
        adjacency[right].append((left, cost, edge_id))

    # Heap entries: (total cost, node). All corridor costs are non-negative.
    queue: list[tuple[int, str]] = [(0, start)]
    best_cost: dict[str, int] = {start: 0}
    previous: dict[str, tuple[str, str]] = {}
    visited: set[str] = set()

    while queue:
        cost_so_far, current = heapq.heappop(queue)
        if current in visited:
            continue
        visited.add(current)

        if current in EXITS and current not in blocked_exits:
            route_nodes = [current]
            route_edges: list[str] = []
            cursor = current
            while cursor != start:
                parent, edge_id = previous[cursor]
                route_nodes.append(parent)
                route_edges.append(edge_id)
                cursor = parent
            route_nodes.reverse()
            route_edges.reverse()
            return {
                "route_nodes": route_nodes,
                "route_edges": route_edges,
                "selected_exit": current,
                "total_cost": cost_so_far,
                "visited_nodes": len(visited),
            }

        for neighbour, edge_cost, edge_id in adjacency[current]:
            candidate_cost = cost_so_far + edge_cost
            if candidate_cost < best_cost.get(neighbour, float("inf")):
                best_cost[neighbour] = candidate_cost
                previous[neighbour] = (current, edge_id)
                heapq.heappush(queue, (candidate_cost, neighbour))

    return None


