"""A narrow zero-normal repair must preserve every other asset byte range."""
import json
from pathlib import Path
import struct
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import repair_private_glb_normals as repair


def fixture(*, normals=None, duplicate=True, indices=None):
    positions = [(0., 0., 0.), (1., 0., 0.), (0., 1., 0.),
                 (0., 0., 0.) if duplicate else (2., 2., 2.)]
    normals = normals or [(0., 0., 1.)] * 3 + [(0., 0., 0.)]
    indices = indices or [0, 1, 2, 3, 3, 3]
    pieces = [struct.pack('<' + 'I' * len(indices), *indices),
              b''.join(struct.pack('<3f', *v) for v in positions),
              b''.join(struct.pack('<2f', 0., 0.) for _ in positions),
              b''.join(struct.pack('<3f', *v) for v in normals), b'image-private-bytes!']
    views, offset = [], 0
    for piece in pieces:
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(piece)})
        offset += len(piece)
    document = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': offset}],
                'bufferViews': views, 'accessors': [
                    {'bufferView': 0, 'componentType': 5125, 'type': 'SCALAR', 'count': len(indices)},
                    {'bufferView': 1, 'componentType': 5126, 'type': 'VEC3', 'count': 4},
                    {'bufferView': 2, 'componentType': 5126, 'type': 'VEC2', 'count': 4},
                    {'bufferView': 3, 'componentType': 5126, 'type': 'VEC3', 'count': 4}],
                'meshes': [{'primitives': [{'attributes': {'POSITION': 1, 'TEXCOORD_0': 2, 'NORMAL': 3},
                                          'indices': 0, 'mode': 4}]}],
                'images': [{'bufferView': 4, 'mimeType': 'image/png'}]}
    binary = b''.join(pieces)
    return repair.encode_glb(document, binary), document, binary


def test_zero_normal_uses_same_position_without_changing_other_bytes():
    raw, before, binary = fixture()
    result, receipt = repair.repair_glb(raw)
    after, repaired = repair.decode_glb(result)
    normal_offset = before['bufferViews'][3]['byteOffset']
    changed_offset = normal_offset + 3 * 12
    assert repaired[:changed_offset] == binary[:changed_offset]
    assert repaired[changed_offset + 12:len(binary)] == binary[changed_offset + 12:]
    assert struct.unpack_from('<3f', repaired, changed_offset) == (0., 0., 1.)
    assert receipt['normal_repairs'] == [{'vertex': 3, 'method': 'coincident_vertex', 'donor': 0}]
    assert after['bufferViews'][0]['target'] == 34963
    assert [after['bufferViews'][i]['target'] for i in [1, 2, 3]] == [34962] * 3
    assert after['images'] == before['images']
    assert receipt['protected_binary_bytes_unchanged'] is True


def test_nonzero_face_normal_can_recover_missing_donors():
    raw, before, _ = fixture(normals=[(0., 0., 0.)] * 3 + [(0., 0., 1.)], duplicate=False)
    result, receipt = repair.repair_glb(raw)
    _, binary = repair.decode_glb(result)
    offset = before['bufferViews'][3]['byteOffset']
    assert [struct.unpack_from('<3f', binary, offset + i * 12) for i in range(3)] == [(0., 0., 1.)] * 3
    assert all(item['method'] == 'incident_face' for item in receipt['normal_repairs'])


def test_no_geometric_evidence_rejects_instead_of_inventing_normal():
    raw, _, _ = fixture(duplicate=False)
    with pytest.raises(ValueError, match='No geometric normal'):
        repair.repair_glb(raw)


def test_nonzero_invalid_normal_is_not_silently_recomputed():
    raw, _, _ = fixture(normals=[(0., 0., 2.)] * 4)
    with pytest.raises(ValueError, match='Nonzero non-unit normal'):
        repair.repair_glb(raw)


def test_image_bytes_cannot_alias_normal_storage():
    _, document, binary = fixture()
    document['images'][0]['bufferView'] = 3
    with pytest.raises(ValueError, match='Image'):
        repair.repair_glb(repair.encode_glb(document, binary))


def test_position_cannot_share_the_normal_buffer_view():
    _, document, binary = fixture(normals=[(1., 0., 0.), (0., 1., 0.), (0., 0., 1.), (0., 0., 0.)],
                                  indices=[3, 0, 1])
    document['accessors'][1]['bufferView'] = 3
    with pytest.raises(ValueError, match='Shared normal'):
        repair.repair_glb(repair.encode_glb(document, binary))


def test_external_images_are_outside_the_self_contained_scope():
    _, document, binary = fixture()
    document['images'] = [{'uri': 'https://example.invalid/private.png'}]
    with pytest.raises(ValueError, match='Image'):
        repair.repair_glb(repair.encode_glb(document, binary))


def test_invalid_indices_and_sparse_accessors_are_rejected():
    raw, document, binary = fixture(indices=[0, 1, 5])
    with pytest.raises(ValueError, match='Index outside'):
        repair.repair_glb(raw)
    document['accessors'][3]['sparse'] = {}
    with pytest.raises(ValueError, match='Sparse'):
        repair.repair_glb(repair.encode_glb(document, binary))


def test_cli_output_is_private_new_and_original_stays_unchanged(tmp_path):
    raw, _, _ = fixture()
    source = tmp_path / 'original.glb'
    source.write_bytes(raw)
    with pytest.raises(ValueError, match='evidence/private'):
        repair.repair_to_directory(source, tmp_path / 'public', tmp_path)
    dest = tmp_path / 'evidence/private/derived'
    receipt = repair.repair_to_directory(source, dest, tmp_path)
    assert source.read_bytes() == raw
    assert (dest / 'model.glb').exists()
    assert receipt['original_bytes_unchanged'] is True
    with pytest.raises(ValueError, match='must not exist'):
        repair.repair_to_directory(source, dest, tmp_path)
    link = tmp_path / 'evidence/private/link'
    link.symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(ValueError, match='symlink'):
        repair.repair_to_directory(source, link / 'derived', tmp_path)
