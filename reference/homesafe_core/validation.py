"""2.5D input/placement validity, not physical or structural safety analysis."""
from __future__ import annotations
from .models import Scene, SceneObject, PlacementIssue
from .geometry import FootprintService as G

EPS = 1e-7

class PlacementValidationError(ValueError):
    def __init__(self, issues: list[PlacementIssue]):
        self.issues = issues
        super().__init__('; '.join(i.message for i in issues))

def issue(object_id, field, code, message, related=()):
    return PlacementIssue(object_id=object_id, field=field, code=code,
                          message=message, related_object_ids=list(related))


def poly(obj: SceneObject):
    return G.corners(obj.model_dump())

def positive_overlap(a, b) -> bool:
    """Interior penetration, unlike conservative route boundary contact."""
    for polygon in (a,b):
        for i,p in enumerate(polygon):
            q = polygon[(i+1)%len(polygon)]
            ax = (-(q[1]-p[1]), q[0]-p[0])
            size = (ax[0]**2+ax[1]**2)**.5
            ax = (ax[0]/size, ax[1]/size)
            aa=[x*ax[0]+z*ax[1] for x,z in a]
            bb=[x*ax[0]+z*ax[1] for x,z in b]
            if min(max(aa), max(bb))-max(min(aa),min(bb)) <= EPS:
                return False
    return True

def inside_convex(point, polygon) -> bool:
    signs=[]
    for i,p in enumerate(polygon):
        q=polygon[(i+1)%len(polygon)]
        signs.append((q[0]-p[0])*(point[1]-p[1])-(q[1]-p[1])*(point[0]-p[0]))
    return all(v>=-EPS for v in signs) or all(v<=EPS for v in signs)

class ObservationValidator:
    def validate_height_reference(self, scene: Scene, obj: SceneObject) -> list[PlacementIssue]:
        h=obj.properties.storage_height
        if h.value is None: return []
        if h.coordinate_reference not in {'object_base','world_floor'}:
            return [issue(obj.id, 'properties.storage_height.coordinate_reference', 'HEIGHT_REFERENCE_MISSING', f'{obj.id}.storage_height: coordinate_reference is required')]
        world=h.value+obj.position.y if h.coordinate_reference=='object_base' else h.value
        if not obj.position.y-EPS <= world <= min(scene.room.height,obj.position.y+obj.dimensions_m.height)+EPS:
            return [issue(obj.id, 'properties.storage_height.value', 'HEIGHT_OUTSIDE_CONTAINER', f'{obj.id}.storage_height: outside containing object / room')]
        return []

class PlacementValidator:
    def validate_transform(self, scene: Scene, obj: SceneObject) -> list[PlacementIssue]:
        issues=[]
        if any(not(-EPS<=x<=scene.room.width+EPS and -EPS<=z<=scene.room.depth+EPS) for x,z in poly(obj)):
            issues.append(issue(obj.id, 'position', 'FOOTPRINT_OUTSIDE_ROOM', f'{obj.id}: footprint outside room'))
        if obj.position.y < -EPS or obj.position.y+obj.dimensions_m.height>scene.room.height+EPS:
            issues.append(issue(obj.id, 'position.y', 'HEIGHT_OUTSIDE_ROOM', f'{obj.id}: vertical extent outside room'))
        return issues

    def validate_supported_height(self, scene: Scene, obj: SceneObject) -> list[PlacementIssue]:
        if obj.placement_mode=='floor' and abs(obj.position.y)>EPS:
            return [issue(obj.id, 'position.y', 'FLOOR_OBJECT_FLOATING', f'{obj.id}: floor object cannot float')]
        if obj.placement_mode!='supported': return []
        by_id={o.id:o for o in scene.objects}
        parent=by_id.get(obj.supported_by)
        if parent is None: return [issue(obj.id, 'supported_by', 'SUPPORT_MISSING', f'{obj.id}: missing support')]
        visited={obj.id}; cursor=parent
        while cursor is not None:
            if cursor.id in visited: return [issue(obj.id, 'supported_by', 'SUPPORT_CYCLE', f'{obj.id}: support cycle')]
            visited.add(cursor.id)
            cursor=by_id.get(cursor.supported_by)
        if parent.collision_layer!='solid': return [issue(obj.id, 'supported_by', 'SUPPORT_NOT_SOLID', f'{obj.id}: support is not a modeled solid', [parent.id])]
        if abs(obj.position.y-(parent.position.y+parent.dimensions_m.height))>EPS:
            return [issue(obj.id, 'position.y', 'SUPPORT_HEIGHT_MISMATCH', f'{obj.id}: not at support top', [parent.id])]
        if not all(inside_convex(p,poly(parent)) for p in poly(obj)):
            return [issue(obj.id, 'position', 'SUPPORT_OVERHANG', f'{obj.id}: footprint exceeds simplified support', [parent.id])]
        return []

    def find_solid_penetrations(self, scene: Scene) -> list[PlacementIssue]:
        solids=[o for o in scene.objects if o.collision_layer=='solid']
        errors=[]
        for i,a in enumerate(solids):
            for b in solids[i+1:]:
                vertical=min(a.position.y+a.dimensions_m.height,b.position.y+b.dimensions_m.height)-max(a.position.y,b.position.y)
                if vertical>EPS and positive_overlap(poly(a),poly(b)):
                    errors.append(issue(a.id, 'position', 'SOLID_PENETRATION', f'{a.id}/{b.id}: solid penetration', [b.id]))
        return errors

    def validate_scene(self, scene: Scene) -> None:
        issues=[]
        for o in scene.objects:
            issues.extend(self.validate_transform(scene,o))
            issues.extend(self.validate_supported_height(scene,o))
            issues.extend(ObservationValidator().validate_height_reference(scene,o))
        issues.extend(self.find_solid_penetrations(scene))
        for p in scene.profiles:
            if p.reach_height.value is not None and p.reach_height.value>scene.room.height:
                issues.append(issue(None, f'profiles.{p.id}.reach_height', 'PROFILE_REACH_OUTSIDE_ROOM', f'{p.id}: reach height outside room'))
        for r in scene.routes:
            for x,z in G.rectangle(r.rect.x,r.rect.z,r.rect.width,r.rect.depth,0):
                if not(-EPS<=x<=scene.room.width+EPS and -EPS<=z<=scene.room.depth+EPS):
                    issues.append(issue(None, f'routes.{r.id}.rect', 'ROUTE_OUTSIDE_ROOM', f'{r.id}: designated route outside room'))
        if issues: raise PlacementValidationError(issues)

def validate_scene(data: Scene | dict) -> Scene:
    # Revalidate model instances too: no unvalidated model_copy(update=...) escape.
    scene=Scene.model_validate(data.model_dump() if isinstance(data,Scene) else data)
    PlacementValidator().validate_scene(scene)
    return scene
