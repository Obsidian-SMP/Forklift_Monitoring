# ==============================================================================
# File: app/positioning/trilateration.py
# Description: Unified Incenter Trilateration Engine (Park & Lee, IEEE ICTC 2021).
# Purpose: Replaces fragile, divergent Gauss-Newton non-linear solvers with a
#          closed-form geometric incenter algorithm that guarantees robust,
#          jump-free coordinate estimation whether circles intersect or not.
# ==============================================================================

import math
from typing import Dict, List, Optional, Tuple
from app.core.config import Config


def rssi_to_distance(
    rssi: float,
    tx_power: Optional[float] = None,
    path_loss_n: Optional[float] = None,
) -> float:
    """
    Converts RSSI (dBm) to distance (meters) using continuous log-distance path loss.
    Avoids discontinuous step functions to prevent mathematical coordinate jumping.
    """
    p0 = tx_power if tx_power is not None else Config.BLE_TX_POWER_1M
    n = path_loss_n if path_loss_n is not None else Config.BLE_PATH_LOSS_EXPONENT

    # d = 10 ^ ((P0 - RSSI) / (10 * n))
    exponent = (p0 - rssi) / (10.0 * n)
    distance = math.pow(10.0, exponent)

    # Clamp to warehouse physical limits (0.2m to 45m)
    return max(0.2, min(45.0, distance))


def calculate_triangle_incenter(
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    p3: Tuple[float, float],
) -> Tuple[float, float]:
    """
    Computes the geometric incenter of a triangle with vertices p1, p2, p3.
    Formula: Incenter = (a*p1 + b*p2 + c*p3) / (a + b + c)
    where a, b, c are the lengths of the opposing edges.
    """
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = p3

    # Side lengths
    a = math.hypot(x2 - x3, y2 - y3)  # Opposite p1
    b = math.hypot(x1 - x3, y1 - y3)  # Opposite p2
    c = math.hypot(x1 - x2, y1 - y2)  # Opposite p3

    perimeter = a + b + c
    if perimeter < 1e-6:
        # Collinear or degenerate: return centroid fallback
        return ((x1 + x2 + x3) / 3.0, (y1 + y2 + y3) / 3.0)

    incenter_x = (a * x1 + b * x2 + c * x3) / perimeter
    incenter_y = (a * y1 + b * y2 + c * y3) / perimeter

    return (incenter_x, incenter_y)


def unified_3point_incenter_trilateration(
    c_a: Tuple[float, float], r_a: float,
    c_b: Tuple[float, float], r_b: float,
    c_c: Tuple[float, float], r_c: float,
) -> Tuple[float, float]:
    """
    Implements Section II-B of Park & Lee (IEEE 2021):
    Consistently resolves position for all cases whether circles overlap or not.
    """
    circles = [(c_a, r_a), (c_b, r_b), (c_c, r_c)]
    sub_incenters: List[Tuple[float, float]] = []

    # Process all 3 pairwise combinations: (A, B) vs C, (B, C) vs A, (A, C) vs B
    pairs = [
        (0, 1, 2),  # Circle A, Circle B -> Circle C
        (1, 2, 0),  # Circle B, Circle C -> Circle A
        (0, 2, 1),  # Circle A, Circle C -> Circle B
    ]

    for idx_a, idx_b, idx_c in pairs:
        (xa, ya), ra = circles[idx_a]
        (xb, yb), rb = circles[idx_b]
        (xc, yc), rc = circles[idx_c]

        # Distance between circle centers A and B
        dab = math.hypot(xb - xa, yb - ya)
        if dab < 1e-6:
            dab = 1e-6

        # Unit vector from A to B
        u_ab_x = (xb - xa) / dab
        u_ab_y = (yb - ya) / dab

        # Intersection point on Circle A along center line towards B
        p_ab = (xa + ra * u_ab_x, ya + ra * u_ab_y)

        # Intersection point on Circle B along center line towards A
        p_ba = (xb - rb * u_ab_x, yb - rb * u_ab_y)

        # Midpoint of chord segment
        p_m_ab = ((p_ab[0] + p_ba[0]) / 2.0, (p_ab[1] + p_ba[1]) / 2.0)

        # Vector from opposite circle C center to midpoint
        dc_m = math.hypot(p_m_ab[0] - xc, p_m_ab[1] - yc)
        if dc_m < 1e-6:
            dc_m = 1e-6
        u_cm_x = (p_m_ab[0] - xc) / dc_m
        u_cm_y = (p_m_ab[1] - yc) / dc_m

        # Intersection point on Circle C along line towards midpoint
        p_m_ab_c = (xc + rc * u_cm_x, yc + rc * u_cm_y)

        # Incenter of triangle formed by p_ab, p_ba, and p_m_ab_c
        sub_incenter = calculate_triangle_incenter(p_ab, p_ba, p_m_ab_c)
        sub_incenters.append(sub_incenter)

    # Final position is the incenter of the triangle connecting the 3 incenters
    final_pos = calculate_triangle_incenter(
        sub_incenters[0], sub_incenters[1], sub_incenters[2]
    )
    return final_pos


class UnifiedTrilaterationSolver:
    """
    High-level trilateration engine managing 2, 3, or 4+ gateways dynamically.
    """

    @staticmethod
    def solve(
        gateways_data: List[Dict],
    ) -> Optional[Tuple[float, float, float]]:
        """
        Solves 2D target position given list of gateway records.
        
        Args:
            gateways_data: List of dicts, each containing:
                { 'x': float, 'y': float, 'rssi': float, 'tx_power': opt, 'path_loss_n': opt }
                
        Returns:
            Tuple (x, y, estimated_accuracy_meters) or None if insufficient gateways.
        """
        n_gw = len(gateways_data)
        if n_gw < 2:
            return None

        # Convert RSSIs to distances
        items = []
        for gw in gateways_data:
            dist = rssi_to_distance(
                gw["rssi"],
                tx_power=gw.get("tx_power"),
                path_loss_n=gw.get("path_loss_n"),
            )
            items.append(((gw["x"], gw["y"]), dist, gw["rssi"]))

        # Sort by distance ascending (strongest / nearest gateways first)
        items.sort(key=lambda item: item[1])

        # CASE 1: Exactly 2 Gateways (Linear Weighted Interpolation)
        if n_gw == 2:
            (x1, y1), d1, _ = items[0]
            (x2, y2), d2, _ = items[1]
            dist_between = math.hypot(x2 - x1, y2 - y1)
            ratio = d1 / (d1 + d2) if (d1 + d2) > 0 else 0.5
            ratio = max(0.05, min(0.95, ratio))
            est_x = x1 + ratio * (x2 - x1)
            est_y = y1 + ratio * (y2 - y1)
            accuracy = max(d1, d2) * 0.4
            return (est_x, est_y, accuracy)

        # CASE 2: Exactly 3 Gateways (Paper 1 Unified Incenter Trilateration)
        if n_gw == 3:
            pos = unified_3point_incenter_trilateration(
                items[0][0], items[0][1],
                items[1][0], items[1][1],
                items[2][0], items[2][1],
            )
            # Estimate accuracy as mean distance residual
            res = [abs(math.hypot(pos[0] - it[0][0], pos[1] - it[0][1]) - it[1]) for it in items]
            accuracy = float(math.sqrt(sum(r * r for r in res) / 3.0))
            return (pos[0], pos[1], accuracy)

        # CASE 3: 4 or more Gateways (Multi-Triplet Weighted Incenter Combination)
        # Select best 4 nearest gateways and solve all 4 triplet combinations
        selected_4 = items[:4]
        triplet_indices = [
            (0, 1, 2),
            (0, 1, 3),
            (0, 2, 3),
            (1, 2, 3),
        ]

        estimates = []
        weights = []

        for i1, i2, i3 in triplet_indices:
            p = unified_3point_incenter_trilateration(
                selected_4[i1][0], selected_4[i1][1],
                selected_4[i2][0], selected_4[i2][1],
                selected_4[i3][0], selected_4[i3][1],
            )
            # Calculate residual error of this estimate against all 4 gateways
            err = sum(
                abs(math.hypot(p[0] - gw[0][0], p[1] - gw[0][1]) - gw[1])
                for gw in selected_4
            ) / 4.0

            w = 1.0 / (err + 0.1)
            estimates.append(p)
            weights.append(w)

        total_w = sum(weights)
        final_x = sum(p[0] * w for p, w in zip(estimates, weights)) / total_w
        final_y = sum(p[1] * w for p, w in zip(estimates, weights)) / total_w

        # Final residual RMSE
        final_residuals = [
            abs(math.hypot(final_x - gw[0][0], final_y - gw[0][1]) - gw[1])
            for gw in selected_4
        ]
        accuracy = float(math.sqrt(sum(r * r for r in final_residuals) / len(final_residuals)))

        return (final_x, final_y, accuracy)
