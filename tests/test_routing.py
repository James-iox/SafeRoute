import unittest

from routing import find_best_route


class RouteEngineTests(unittest.TestCase):
    def test_normal_route_from_room_1_uses_exit_a(self):
        route = find_best_route("Room 1")
        self.assertIsNotNone(route)
        self.assertEqual(route["selected_exit"], "Exit A")
        self.assertEqual(route["route_nodes"], ["Room 1", "J1", "Exit A"])

    def test_blocking_exit_a_reroutes_to_exit_b(self):
        route = find_best_route("Room 1", blocked_exits={"Exit A"})
        self.assertIsNotNone(route)
        self.assertEqual(route["selected_exit"], "Exit B")
        self.assertNotIn("C4", route["route_edges"])

    def test_blocked_corridor_is_never_used(self):
        route = find_best_route("Room 1", blocked_edges={"C1"})
        self.assertIsNone(route)

    def test_both_exits_blocked_returns_no_route(self):
        route = find_best_route("Room 1", blocked_exits={"Exit A", "Exit B"})
        self.assertIsNone(route)

    def test_blocked_direct_exit_b_corridor_uses_alternate_corridor(self):
        route = find_best_route("Room 3", blocked_edges={"C5"}, blocked_exits={"Exit A"})
        self.assertIsNotNone(route)
        self.assertEqual(route["selected_exit"], "Exit B")
        self.assertIn("C6", route["route_edges"])
        self.assertIn("C7", route["route_edges"])
        self.assertNotIn("C5", route["route_edges"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
