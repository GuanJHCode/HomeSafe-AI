// GENERATED from reference/homesafe_core/models.py. Do not hand-edit.
// TS types do not validate untrusted input; Python models + spatial validator do.

export type Assessment = {
  "scene_id": string;
  "scene_revision": number;
  "input_hash": string;
  "ruleset_version": string;
  "comparison_basis": ComparisonBasis;
  "findings": Array<Finding>;
  "coverage": Array<Coverage>;
  "unsupported_domains": Array<string>;
  "setup_items"?: Array<SetupItem>;
};

export type AssessmentRequest = {
  "revision": number;
};

export type AssetCalibration = {
  "revision": number;
  "orientation": Quaternion;
  "pivot_offset_after_rotation": Vec3;
  "normalized_bounds_m": Dimensions;
  "reviewed": boolean;
  "strategy": "runtime_axis_fit" | "baked_standard_glb";
  "notes"?: string;
};

export type AssetRenderDTO = {
  "asset_id": string;
  "content_hash": string;
  "render_url": string;
  "calibration": AssetCalibration;
  "provenance_summary": "lux3d_web" | "lux3d_api" | "procedural" | "unverified";
};

export type BoolObservation = {
  "value"?: boolean | null;
  "source_kind"?: "unknown" | "demo" | "user_reported" | "measurement" | "simulated";
  "observed_at"?: string | null;
  "verification_state"?: "unknown" | "provided" | "owner_checked";
  "evidence_ref"?: string | null;
};

export type ChallengeGoal = {
  "rule_id": string;
  "profile_id": string;
  "object_id": string;
};

export type ChallengeProgress = {
  "status": "goal_met" | "in_progress";
  "goal_results": Array<boolean>;
  "steps": number;
  "conflict_events": number;
  "invalid_attempts": number;
  "remaining_triggered": number;
  "remaining_needs_review": number;
  "setup_objects": number;
  "label": string;
};

export type ChallengeResult = {
  "scene": Scene;
  "assessment": Assessment;
  "comparison": Comparison | null;
  "challenge": ChallengeProgress;
};

export type CompareRequest = {
  "before_assessment_id": string;
  "after_assessment_id": string;
};

export type Comparison = {
  "before_input_hash": string;
  "after_input_hash": string;
  "new_triggered": Array<string>;
  "no_longer_triggered": Array<string>;
  "still_triggered": Array<string>;
  "became_unknown": Array<string>;
  "needs_review": Array<string>;
  "removed_from_scope": Array<string>;
  "added_to_scope": Array<string>;
  "resolved_unknown"?: Array<string>;
  "change_kinds"?: Array<"layout" | "observation" | "scope" | "visual_or_metadata">;
  "change_interpretation"?: string;
};

export type ComparisonBasis = {
  "scene_id": string;
  "ruleset_version": string;
  "context_hash": string;
  "object_scope": Record<string, string>;
  "layout_hash"?: string;
  "observation_hash"?: string;
};

export type Coverage = {
  "rule_id": string;
  "profile_id": string | null;
  "state": "evaluated" | "missing_input" | "not_applicable" | "unsupported" | "error";
  "evaluated_count"?: number;
  "pending_count"?: number;
  "reason": string;
};

export type DemoEvaluationRequest = {
  "template_id": string;
  "client_revision": number;
  "transforms": Record<string, TransformInput>;
};

export type Dimensions = {
  "width": number;
  "height": number;
  "depth": number;
};

export type ErrorDTO = {
  "code": string;
  "message": string;
  "request_id": string;
  "issues"?: Array<PlacementIssue>;
};

export type FileEvidence = {
  "path": string;
  "sha256": string;
};

export type Finding = {
  "key": string;
  "rule_id": string;
  "profile_id": string;
  "object_ids": Array<string>;
  "scope_id": string;
  "status": "triggered" | "needs_review" | "not_triggered";
  "evidence": Record<string, string | number | boolean | null>;
  "limitation"?: string;
};

export type GenerationRequest = {
  "input_asset_id": string;
  "version": "G1" | "G1-Turbo";
  "face_count": number;
  "approved_ceiling": number;
};

export type HealthDTO = {
  "status": "ok";
  "product_mode": "local" | "public_demo" | "public_sandbox";
};

export type JobDTO = {
  "job_id": string;
  "status": "queued" | "submitting" | "submitting_unknown" | "polling" | "downloading" | "validation_pending" | "completed" | "stalled" | "failed" | "manual_review";
  "asset_id"?: string | null;
  "error_code"?: string | null;
};

export type NumberObservation = {
  "value"?: number | null;
  "source_kind"?: "unknown" | "demo" | "user_reported" | "measurement" | "simulated";
  "observed_at"?: string | null;
  "verification_state"?: "unknown" | "provided" | "owner_checked";
  "evidence_ref"?: string | null;
  "coordinate_reference"?: "world_floor" | "object_base" | "not_applicable";
};

export type ObjectPatch = {
  "expected_revision": number;
  "transform": TransformInput;
};

export type PlacementIssue = {
  "object_id"?: string | null;
  "related_object_ids"?: Array<string>;
  "field": string;
  "code": string;
  "message": string;
};

export type Profile = {
  "id": string;
  "role": "child" | "elder";
  "can_climb"?: BoolObservation;
  "reach_height"?: NumberObservation;
};

export type Properties = {
  "anchored"?: BoolObservation;
  "protection_reported"?: BoolObservation;
  "locked"?: BoolObservation;
  "accessible"?: BoolObservation;
  "secured"?: BoolObservation;
  "raised_threshold_present"?: BoolObservation;
  "storage_height"?: NumberObservation;
};

export type PublicAssetCatalog = {
  "manifest_version": "2.0";
  "assets": Array<PublishedAsset>;
};

export type PublishedAsset = {
  "asset_id": string;
  "content_hash": string;
  "render_url": string;
  "calibration": AssetCalibration;
  "provenance_summary": "lux3d_web" | "lux3d_api" | "procedural" | "unverified";
  "object_ids": Array<string>;
  "rights_scope": "public";
  "generation_evidence": FileEvidence;
};

export type Quaternion = {
  "x": number;
  "y": number;
  "z": number;
  "w": number;
};

export type Rect = {
  "x": number;
  "z": number;
  "width": number;
  "depth": number;
};

export type ReportDTO = {
  "report_id": string;
  "assessment_hash": string;
  "download_url": string;
  "format": "html" | "json";
};

export type ReportRequest = {
  "assessment_id": string;
  "comparison_id"?: string | null;
};

export type Route = {
  "id": string;
  "label": string;
  "rect": Rect;
  "confirmed": boolean;
};

export type RuleConfig = {
  "near_window_m"?: number;
  "parameter_source"?: "demo_heuristic" | "owner_defined";
};

export type Scene = {
  "schema_version"?: "2.0";
  "scene_id": string;
  "revision": number;
  "is_demo": boolean;
  "room": Dimensions;
  "profiles": Array<Profile>;
  "routes": Array<Route>;
  "rule_config": RuleConfig;
  "objects": Array<SceneObject>;
};

export type SceneCreate = {
  "template_id": string;
};

export type SceneObject = {
  "id": string;
  "asset_id"?: string | null;
  "label"?: string;
  "category": string;
  "position": Vec3;
  "yaw_rad": number;
  "dimensions_m": Dimensions;
  "dimensions_confirmed": boolean;
  "position_confirmed": boolean;
  "collision_layer": "solid" | "surface" | "fixture" | "marker";
  "placement_mode": "floor" | "wall" | "surface" | "supported";
  "supported_by"?: string | null;
  "traits": Traits;
  "properties": Properties;
};

export type SceneReplace = {
  "expected_revision": number;
  "snapshot": Scene;
};

export type SetupItem = {
  "object_id": string;
  "unknown_traits": Array<string>;
  "suggested_true_traits": Array<string>;
  "suggestion_source"?: "category_hint_unconfirmed";
};

export type Traits = {
  "possible_climb_support"?: BoolObservation;
  "requires_anchor_check"?: BoolObservation;
  "contains_hazardous_items"?: BoolObservation;
  "blocks_floor_route"?: BoolObservation;
  "window_opening"?: BoolObservation;
  "loose_cord"?: BoolObservation;
  "rug"?: BoolObservation;
  "child_gate"?: BoolObservation;
};

export type TransformInput = {
  "position": Vec3;
  "yaw_rad": number;
};

export type Vec3 = {
  "x": number;
  "y": number;
  "z": number;
};
