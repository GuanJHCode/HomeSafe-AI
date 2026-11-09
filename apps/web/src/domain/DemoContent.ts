// Presentation only: conditions, comparisons and challenge results come from Python.
export const SCENE_BOUNDARY = '当前客厅由手工构建，按已输入的布局与资料执行规则检查；不提供家庭照片自动重建、视觉识别或医学评估。';
export const RULE_BOUNDARY = '本关达标只表示指定规则目标满足；资料未知仍需核查，不表示全屋安全。';
export const RISK_CASE_STEPS = [
  '观察初始条件：窗边椅子在样例规则中触发支点条件，先查看检查卡的对象与依据。',
  '尝试一次取舍：把椅子移到指定通道，比较儿童条件变化与老人通道新增占用。',
  '重新选择摆法：撤销或重新开始，再将椅子放到既离开窗边、又不占指定通道的位置。',
  '查看结果和行动：同时阅读两类检查、本关目标与行动清单；按当前结果处理仍触发和待核查事项。',
  '保留边界：导出这次布局的清单与快照；目标达成仍不代替窗口防护、柜体固定等现场核查。',
] as const;
type ModelState = 'loading' | 'error' | 'placeholder' | 'loaded' | undefined;
export function modelSourceLabel(state: ModelState, source?: string): string {
  if (state === 'loading') return '模型加载中，当前显示占位模型';
  if (state === 'error') return '模型加载失败，当前使用占位模型';
  if (state !== 'loaded') return '程序占位模型';
  if (source === 'lux3d_web' || source === 'lux3d_api') return 'Lux3D 模型已加载';
  return source === 'procedural' ? '程序生成模型已加载' : '模型已加载，来源未确认';
}
export function modelSourceBoundary(state: ModelState, source?: string): string {
  if (state !== 'loaded') return '当前显示占位形状，不能把它作为真实 Lux3D 模型已接入的证据。';
  if (source === 'lux3d_web' || source === 'lux3d_api') return 'Lux3D 是此资产的来源标签。参考图、平台任务记录、原始模型与本次导入/交互应分别核对；载入成功不等于生成记录或公开分发许可已完整核验。';
  return source === 'procedural' ? '这是程序生成资产，不是 Lux3D 生成证据。' : '模型载入成功，但不能仅凭外观确认来源。';
}
