import test from 'node:test';
import assert from 'node:assert/strict';
import { modelSourceLabel, modelSourceBoundary } from '../src/domain/DemoContent.ts';
test('a Lux3D tag cannot turn a failed/loading/missing model into an actual loaded model', () => {
  for (const state of ['error', 'loading', 'placeholder', undefined] as const) {
    assert.doesNotMatch(modelSourceLabel(state, 'lux3d_web'), /Lux3D 模型已加载/);
    assert.match(modelSourceBoundary(state, 'lux3d_web'), /占位/);
  }
});
test('loaded source labels preserve unknown/procedural distinctions and evidence limits', () => {
  assert.match(modelSourceLabel('loaded', 'lux3d_web'), /Lux3D 模型已加载/);
  assert.match(modelSourceBoundary('loaded', 'lux3d_web'), /来源标签.*分别核对/);
  assert.match(modelSourceLabel('loaded', 'procedural'), /程序生成/);
  assert.match(modelSourceBoundary('loaded', 'procedural'), /不是 Lux3D/);
  assert.match(modelSourceLabel('loaded', 'unrecognised-provider'), /来源未确认/);
  assert.doesNotMatch(modelSourceLabel('loaded'), /程序生成|Lux3D/);
});
