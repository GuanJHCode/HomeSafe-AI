#!/usr/bin/env python3
"""Recompute a downloaded scene snapshot using the current Python core.

No upload, import into the application, or challenge-session restoration.
"""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'reference'))
from homesafe_core.engine import RuleEngine
from homesafe_core.validation import validate_scene


def verify_snapshot(document):
    if not isinstance(document, dict) or document.get('format') != 'homesafe_scene_snapshot' or document.get('snapshot_version') != '1.0':
        raise ValueError('unsupported scene snapshot format')
    scene = validate_scene(document.get('scene'))
    if document.get('source_kind') != ('synthetic_demo' if scene.is_demo else 'user_provided'):
        raise ValueError('snapshot provenance does not match canonical scene')
    if document.get('includes_asset_bytes') is not False:
        raise ValueError('snapshot must explicitly exclude asset bytes')
    actual = RuleEngine().evaluate(scene)
    expected = {
        'scene_id': actual.scene_id,
        'scene_revision': actual.scene_revision,
        'input_hash': actual.input_hash,
        'ruleset_version': actual.ruleset_version,
    }
    if document.get('assessment') != expected:
        raise ValueError('snapshot identity/hash/ruleset differs from current core evaluation')
    return {
        'result': 'MATCHES_CURRENT_CORE', **expected,
        'source_kind': document['source_kind'],
        'scope': 'Local canonical input and rule-version verification only; no safety or challenge certification.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    args = parser.parse_args()
    try:
        if args.snapshot.stat().st_size > 1_000_000:
            raise ValueError('scene snapshot exceeds 1 MB limit')
        result = verify_snapshot(json.loads(args.snapshot.read_text(encoding='utf-8')))
    except (OSError, ValueError, TypeError, RecursionError) as error:
        raise SystemExit(f'INVALID_SNAPSHOT: {error}') from error
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
