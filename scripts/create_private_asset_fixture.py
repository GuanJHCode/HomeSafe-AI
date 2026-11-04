"""Create two clearly procedural, embedded-texture boxes for CI tooling tests only."""
import argparse
import binascii
import json
import struct
import zlib
from pathlib import Path


def fixture(width, height, depth):
    positions = [(x * width / 2, y * height / 2, z * depth / 2)
                 for x, y, z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                                 (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    indices = [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', binascii.crc32(kind + data) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(b'\x00\xb0\x80\x50\xff')) + chunk(b'IEND', b''))
    blocks = [struct.pack('<24f', *(n for p in positions for n in p)), struct.pack('<36H', *indices),
              struct.pack('<16f', *([0, 0] * 8)), png, png]
    binary = b''; views = []
    for block in blocks:
        views.append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(block)})
        binary += block + bytes((-len(block)) % 4)
    document = {
        'asset': {'version': '2.0', 'generator': 'HomeSafe procedural CI fixture, not Lux3D'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'TEXCOORD_0': 2}, 'indices': 1, 'material': 0}]}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 8, 'type': 'VEC3',
             'min': [-width/2,-height/2,-depth/2], 'max': [width/2,height/2,depth/2]},
            {'bufferView': 1, 'componentType': 5123, 'count': 36, 'type': 'SCALAR'},
            {'bufferView': 2, 'componentType': 5126, 'count': 8, 'type': 'VEC2'}],
        'bufferViews': views, 'buffers': [{'byteLength': len(binary)}],
        'images': [{'bufferView': 3, 'mimeType': 'image/png'}, {'bufferView': 4, 'mimeType': 'image/png'}],
        'textures': [{'source': 0}, {'source': 1}],
        'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0},
                       'metallicRoughnessTexture': {'index': 1}, 'metallicFactor': 0}}],
    }
    payload = json.dumps(document).encode(); payload += b' ' * ((-len(payload)) % 4)
    return (struct.pack('<III', 0x46546c67, 2, 28 + len(payload) + len(binary))
            + struct.pack('<II', len(payload), 0x4e4f534a) + payload
            + struct.pack('<II', len(binary), 0x004e4942) + binary)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    # CI owns the explicit new directory; never overwrite actual source assets.
    args.output.mkdir(parents=True, exist_ok=False)
    for name, dimensions in [('chair', (0.5, 0.8, 0.5)), ('cabinet', (0.7, 1.6, 0.5))]:
        (args.output / f'{name}.glb').write_bytes(fixture(*dimensions))
    print('Created PROCEDURAL test boxes; these are not Lux3D models.')
