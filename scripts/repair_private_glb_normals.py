#!/usr/bin/env python3
"""Make a private derivative of the simple intake GLB; never rewrite its original.

Only zero normals are repaired. Prefer an existing normal at the exact same
position; otherwise use the area's vector of incident faces. Unsupported layouts
or normals without geometric evidence fail closed. This is not topology repair,
physical calibration, or permission to publish an asset.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]


def decode_glb(raw):
    if len(raw) < 28 or struct.unpack_from('<III', raw) != (0x46546C67, 2, len(raw)):
        raise ValueError('Expected a complete GLB 2 file')
    chunks, offset = [], 12
    while offset + 8 <= len(raw):
        length, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if length % 4 or offset + length > len(raw):
            raise ValueError('Invalid GLB chunk length')
        chunks.append((kind, raw[offset:offset + length]))
        offset += length
    if offset != len(raw) or [kind for kind, _ in chunks] != [0x4E4F534A, 0x004E4942]:
        raise ValueError('Only one JSON and one BIN chunk are supported')
    document = json.loads(chunks[0][1])
    buffers = document.get('buffers', [])
    if (len(buffers) != 1 or 'uri' in buffers[0]
            or not 0 <= len(chunks[1][1]) - buffers[0]['byteLength'] <= 3):
        raise ValueError('Expected one self-contained buffer')
    return document, chunks[1][1]


def encode_glb(document, binary):
    text = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    binary += b'\0' * (-len(binary) % 4)
    return (struct.pack('<III', 0x46546C67, 2, 28 + len(text) + len(binary))
            + struct.pack('<II', len(text), 0x4E4F534A) + text
            + struct.pack('<II', len(binary), 0x004E4942) + binary)


def read_accessor(document, binary, index, kind, component_types):
    accessor = document['accessors'][index]
    if 'sparse' in accessor:
        raise ValueError('Sparse accessors are not supported')
    if accessor['type'] != kind or accessor['componentType'] not in component_types:
        raise ValueError('Unsupported accessor format')
    if accessor.get('normalized'):
        raise ValueError('Normalized integer accessors are outside this repair scope')
    view = document['bufferViews'][accessor['bufferView']]
    if view['buffer'] != 0 or 'byteStride' in view:
        raise ValueError('Only packed accessors in the embedded buffer are supported')
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[kind]
    fmt = '<' + {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[accessor['componentType']] * components
    stride = struct.calcsize(fmt)
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    end = start + stride * accessor['count']
    if (accessor['count'] <= 0 or accessor.get('byteOffset', 0) < 0
            or view.get('byteOffset', 0) < 0 or end > len(binary)
            or end > view.get('byteOffset', 0) + view['byteLength']):
        raise ValueError('Accessor range outside its buffer view')
    values = list(struct.iter_unpack(fmt, binary[start:end]))
    if any(not math.isfinite(x) for vector in values for x in vector):
        raise ValueError('Non-finite accessor value')
    return values, start, accessor


def triangle_primitive(document):
    meshes = document.get('meshes', [])
    if len(meshes) != 1 or len(meshes[0].get('primitives', [])) != 1:
        raise ValueError('Only a single mesh and primitive are supported')
    primitive = meshes[0]['primitives'][0]
    if (primitive.get('mode', 4) != 4 or primitive.get('targets')
            or set(primitive['attributes']) != {'POSITION', 'NORMAL', 'TEXCOORD_0'}):
        raise ValueError('Expected POSITION/NORMAL/TEXCOORD_0 indexed triangles')
    indices = list(primitive['attributes'].values()) + [primitive['indices']]
    if len(document['accessors']) != 4 or set(indices) != set(range(4)):
        raise ValueError('Shared or additional accessors are not supported')
    return primitive


def face_vectors(positions, indices, needed):
    vectors = {index: [0., 0., 0.] for index in needed}
    for start in range(0, len(indices), 3):
        ids = indices[start:start + 3]
        affected = needed.intersection(ids)
        if not affected:
            continue
        a, b, c = [positions[index] for index in ids]
        u, v = [[point[k] - a[k] for k in range(3)] for point in (b, c)]
        normal = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
                  u[0] * v[1] - u[1] * v[0])
        for index in affected:
            vectors[index] = [vectors[index][k] + normal[k] for k in range(3)]
    return vectors


def zero_normal_replacements(positions, normals, indices):
    donors, missing = {}, []
    for index, (position, normal) in enumerate(zip(positions, normals)):
        length = math.sqrt(sum(value * value for value in normal))
        if length == 0:
            missing.append(index)
        elif abs(length - 1) > 1e-4:
            raise ValueError('Nonzero non-unit normal is outside this repair scope')
        else:
            donors.setdefault(position, index)
    needed = {index for index in missing if positions[index] not in donors}
    faces = face_vectors(positions, indices, needed)
    changes = []
    for index in missing:
        donor = donors.get(positions[index])
        if donor is not None:
            changes.append((index, normals[donor], {'vertex': index, 'method': 'coincident_vertex', 'donor': donor}))
            continue
        vector = faces[index]
        length = math.sqrt(sum(value * value for value in vector))
        if not math.isfinite(length) or length == 0:
            raise ValueError(f'No geometric normal for vertex {index}')
        changes.append((index, tuple(value / length for value in vector),
                        {'vertex': index, 'method': 'incident_face'}))
    return changes


def repair_glb(raw):
    document, binary = decode_glb(raw)
    primitive = triangle_primitive(document)
    attributes = primitive['attributes']
    positions, _, _ = read_accessor(document, binary, attributes['POSITION'], 'VEC3', {5126})
    normals, normal_start, normal_accessor = read_accessor(document, binary, attributes['NORMAL'], 'VEC3', {5126})
    uv, _, _ = read_accessor(document, binary, attributes['TEXCOORD_0'], 'VEC2', {5126})
    index_rows, _, _ = read_accessor(document, binary, primitive['indices'], 'SCALAR', {5121, 5123, 5125})
    indices = [row[0] for row in index_rows]
    if len(indices) % 3 or any(index >= len(positions) for index in indices):
        raise ValueError('Index outside positions or incomplete triangle')
    if len(normals) != len(positions) or len(uv) != len(positions):
        raise ValueError('Attribute counts differ')
    if any(accessor is not normal_accessor and accessor.get('bufferView') == normal_accessor['bufferView']
           for accessor in document['accessors']):
        raise ValueError('Shared normal buffer view is outside this repair scope')
    if any('uri' in image or image.get('bufferView') == normal_accessor['bufferView']
           for image in document.get('images', [])):
        raise ValueError('Image resource must be embedded and separate from normals')
    normal_end = normal_start + len(normals) * 12
    for index, view in enumerate(document['bufferViews']):
        start = view.get('byteOffset', 0)
        if index != normal_accessor['bufferView'] and start < normal_end and start + view['byteLength'] > normal_start:
            raise ValueError('Normal bytes overlap another buffer view')
    changes = zero_normal_replacements(positions, normals, indices)
    repaired = bytearray(binary)
    previous_end = 0
    for index, vector, _ in changes:
        offset = normal_start + index * 12
        assert binary[previous_end:offset] == repaired[previous_end:offset]
        struct.pack_into('<3f', repaired, offset, *vector)
        normals[index] = struct.unpack_from('<3f', repaired, offset)
        previous_end = offset + 12
    assert binary[previous_end:] == repaired[previous_end:]
    for accessor_index in [*attributes.values(), primitive['indices']]:
        view = document['bufferViews'][document['accessors'][accessor_index]['bufferView']]
        target = 34963 if accessor_index == primitive['indices'] else 34962
        if view.get('target', target) != target:
            raise ValueError('Conflicting buffer view target')
        view['target'] = target
    normal_accessor['min'] = [min(vector[k] for vector in normals) for k in range(3)]
    normal_accessor['max'] = [max(vector[k] for vector in normals) for k in range(3)]
    result = encode_glb(document, bytes(repaired))
    receipt = {'scope': 'PRIVATE_ZERO_NORMAL_DERIVATIVE', 'normal_repairs': [entry for _, _, entry in changes],
               'source_sha256': hashlib.sha256(raw).hexdigest(), 'derived_sha256': hashlib.sha256(result).hexdigest(),
               'protected_binary_bytes_unchanged': True, 'vertices': len(positions), 'triangles': len(indices) // 3,
               'rights_status': 'PENDING', 'publication_approved': False, 'topology_repair': False}
    return result, receipt


def repair_to_directory(source, output, root=ROOT):
    source, output, root = Path(source), Path(output).absolute(), Path(root).resolve()
    if any(path.is_symlink() for path in [output, *output.parents]):
        raise ValueError('Output symlink is forbidden')
    private = root / 'evidence/private'
    if output.resolve() == private or not output.resolve().is_relative_to(private):
        raise ValueError('Output must be under evidence/private')
    if output.exists():
        raise ValueError('Output directory must not exist')
    original = source.read_bytes()
    result, receipt = repair_glb(original)
    if source.read_bytes() != original:
        raise ValueError('Original changed during repair')
    output.mkdir(parents=True, exist_ok=False)
    with (output / 'model.glb').open('xb') as target:
        target.write(result)
    receipt['original_bytes_unchanged'] = source.read_bytes() == original
    if not receipt['original_bytes_unchanged']:
        raise ValueError('Original changed during derivative write')
    with (output / 'repair.json').open('x') as target:
        target.write(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    arguments = parser.parse_args()
    try:
        print(json.dumps(repair_to_directory(arguments.input, arguments.output), indent=2))
    except (OSError, ValueError, KeyError, IndexError, TypeError, struct.error) as error:
        raise SystemExit('STOP: ' + str(error)) from error
