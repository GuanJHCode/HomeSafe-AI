"""Meters, Y-up, XZ ground plane. Pure geometry, no safety certification."""
from typing import Any, Mapping
import math
Point = tuple[float, float]
Polygon = tuple[Point, ...]

class FootprintService:
    """Oriented rectangles in XZ. Boundary contact is treated as overlap."""
    @staticmethod
    def rectangle(x: float, z: float, width: float, depth: float, yaw: float) -> Polygon:
        c, s = math.cos(yaw), math.sin(yaw)
        return tuple((x + c*dx + s*dz, z - s*dx + c*dz)
                     for dx, dz in ((-width/2,-depth/2), (width/2,-depth/2), (width/2,depth/2), (-width/2,depth/2)))

    @staticmethod
    def corners(obj: Mapping[str, Any]) -> Polygon:
        p, d = obj["position"], obj["dimensions_m"]
        return FootprintService.rectangle(p["x"], p["z"], d["width"], d["depth"], obj["yaw_rad"])

    @staticmethod
    def overlaps(a: Polygon, b: Polygon) -> bool:
        for poly in (a, b):
            for i, p in enumerate(poly):
                q = poly[(i+1) % len(poly)]
                axis = (-(q[1]-p[1]), q[0]-p[0])
                aa = [v[0]*axis[0]+v[1]*axis[1] for v in a]
                bb = [v[0]*axis[0]+v[1]*axis[1] for v in b]
                if max(aa) < min(bb)-1e-12 or max(bb) < min(aa)-1e-12:
                    return False
        return True

    @staticmethod
    def _point_segment(p: Point, a: Point, b: Point) -> float:
        dx, dz = b[0]-a[0], b[1]-a[1]
        denom = dx*dx+dz*dz
        if denom == 0:
            return math.hypot(p[0]-a[0], p[1]-a[1])
        t = max(0., min(1., ((p[0]-a[0])*dx+(p[1]-a[1])*dz)/denom))
        return math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dz))

    @staticmethod
    def distance(a: Polygon, b: Polygon) -> float:
        if FootprintService.overlaps(a,b):
            return 0.
        return min(FootprintService._point_segment(p, other[i], other[(i+1)%len(other)])
                   for poly, other in ((a,b),(b,a)) for p in poly for i in range(len(other)))

    @staticmethod
    def on_route(obj: Mapping[str, Any], route: Mapping[str, Any]) -> bool:
        r = route["rect"]
        return FootprintService.overlaps(FootprintService.corners(obj),
            FootprintService.rectangle(r["x"], r["z"], r["width"], r["depth"], 0))


