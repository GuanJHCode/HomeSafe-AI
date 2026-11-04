<script setup lang="ts">
import { useLivingRoom } from './useLivingRoom.ts';

const {
  host, mode, role, view, busy, failure, renderFailure, stage, selected, selectedObject,
  layout, checks, comparison, progress, feedback, report, canUndo, canRedo,
  objectName, movable, canMove, select, useView, moveBy, rotate, history, switchMode, focus,
  retry, exportReport, printReport,
} = useLivingRoom();

const coverageLabels = {
  evaluated: '已评估', missing_input: '资料不足', not_applicable: '不适用',
  unsupported: '未覆盖', error: '评估错误',
};
const roleName = (value: 'child' | 'elder' | null) =>
  value === 'child' ? '儿童' : value === 'elder' ? '老人' : '通用';
const actionSections = [
  { key: 'layout', label: '本次布局变化' },
  { key: 'onSite', label: '仍已触发，现场核查' },
  { key: 'information', label: '待补充资料' },
] as const;
</script>

<template>
  <main class="shell">
    <header class="intro">
      <p class="eyebrow">安心屋 HOMESAFE AI <span>开发预览</span></p>
      <h1>客厅布置演练</h1>
      <p>给孩子留探索空间，也给老人留通道。拖动家具，看看同一次调整如何改变两种检查结果。</p>
    </header>

    <div class="notice">合成客厅 · 家具为程序占位模型 · 教学演练 · 无法用于安全认证</div>

    <div class="workspace">
      <section class="panel scene-panel" aria-label="三维客厅">
        <header class="section-head">
          <div>
            <p class="eyebrow">场景工作区</p>
            <h2>样例客厅</h2>
          </div>
          <div class="switches" aria-label="演练模式">
            <button :aria-pressed="mode === 'workspace'" :disabled="busy || !!failure" @click="switchMode('workspace')">自由布置</button>
            <button :aria-pressed="mode === 'challenge'" :disabled="busy || !!failure" @click="switchMode('challenge')">窗边挑战</button>
          </div>
        </header>
        <div class="switches views" aria-label="观察视角">
          <button :aria-pressed="view === 'overview'" @click="useView('overview')">俯看客厅</button>
          <button :aria-pressed="view === 'child'" @click="useView('child')">儿童视角</button>
          <button :aria-pressed="view === 'elder'" @click="useView('elder')">老人视角</button>
        </div>
        <div ref="host" class="viewport"></div>
        <p v-if="renderFailure" class="warning" role="alert">当前浏览器无法打开 3D。可用下面的家具按钮操作。{{ renderFailure }}</p>
        <p class="small">相机高度仅用于观察示意。实际触及能力需要独立确认。</p>

        <div v-if="layout" class="toolbar">
          <label>
            家具
            <select :value="selected ?? ''" @change="select(($event.target as HTMLSelectElement).value || null)">
              <option value="">请选择家具</option>
              <option v-for="object in layout.objects" :key="object.id" :value="object.id">
                {{ objectName(object.id) }}{{ movable(object.id) ? '' : '（固定）' }}
              </option>
            </select>
          </label>
          <div class="switches" aria-label="移动与旋转">
            <button aria-label="向左移动" :disabled="!selected || !canMove(selected)" @click="moveBy(-0.25, 0)">←</button>
            <button aria-label="向右移动" :disabled="!selected || !canMove(selected)" @click="moveBy(0.25, 0)">→</button>
            <button aria-label="向前移动" :disabled="!selected || !canMove(selected)" @click="moveBy(0, -0.25)">↑</button>
            <button aria-label="向后移动" :disabled="!selected || !canMove(selected)" @click="moveBy(0, 0.25)">↓</button>
            <button :disabled="!selected || !canMove(selected)" @click="rotate">旋转 45°</button>
          </div>
          <div class="switches" aria-label="布局历史">
            <button :disabled="!canUndo" @click="history('undo')">撤销</button>
            <button v-if="mode === 'workspace'" :disabled="!canRedo" @click="history('redo')">重做</button>
            <button :disabled="busy || !!failure" @click="history('reset')">重置</button>
          </div>
        </div>
        <p v-if="selectedObject" class="small" data-testid="selected-position">
          {{ objectName(selectedObject.id) }} · x {{ selectedObject.position.x.toFixed(2) }} 米 · z {{ selectedObject.position.z.toFixed(2) }} 米
        </p>
        <div v-if="feedback.issues.length" class="warning" role="alert" data-testid="placement-rejected">
          <strong>已恢复最后合法位置</strong>
          <ul>
            <li v-for="(issue, index) in feedback.issues" :key="index">
              {{ issue.label }} <span v-if="issue.object_id">· {{ objectName(issue.object_id) }}</span>
            </li>
          </ul>
        </div>
        <div v-if="mode === 'challenge'" class="challenge">
          <h3>给窗口和通道都留出空间</h3>
          <p>本关只允许移动、旋转椅子。将椅子移离窗口，并避开老人指定通道。</p>
          <p v-if="checks && progress" data-testid="challenge-summary">
            {{ progress.summary }} <span v-if="progress.uncovered !== null">未覆盖 {{ progress.uncovered }} 类。</span>
          </p>
        </div>
      </section>

      <section class="panel findings-panel" aria-label="检查结果" :aria-busy="busy">
        <header class="section-head">
          <div>
            <p class="eyebrow">同一布局 · 两类检查</p>
            <h2>{{ roleName(role) }}检查</h2>
          </div>
          <span v-if="layout" class="revision">布局 v{{ layout.revision }}</span>
        </header>
        <p v-if="busy" class="status" role="status">结果更新中 · {{ stage }}</p>
        <div v-else-if="failure" class="warning" role="alert">
          <p>规则暂不可用。{{ failure }}</p>
          <button @click="retry">重建 Worker 并重试</button>
          <p v-if="mode === 'challenge'" class="small">重试会从本关初始布局开始。</p>
        </div>
        <template v-else-if="checks">
          <div v-if="comparison" class="delta" :class="{ conflict: comparison.conflict }" data-testid="layout-comparison">
            <h3>{{ comparison.conflict ? '出现双角色取舍' : '与上一合法布局比较' }}</h3>
            <p v-if="!comparison.newTriggered.length && !comparison.noLongerTriggered.length">本次没有新增或解除已触发条件。</p>
            <p v-for="finding in comparison.newTriggered" :key="finding.key">新增已触发 · {{ roleName(finding.role) }} {{ finding.title }} · {{ finding.objectLabels.join('、') }}</p>
            <p v-for="finding in comparison.noLongerTriggered" :key="finding.key">当前条件不再触发 · {{ roleName(finding.role) }} {{ finding.title }} · {{ finding.objectLabels.join('、') }}</p>
            <p v-for="finding in comparison.becameUnknown" :key="finding.key">转为待核查 · {{ roleName(finding.role) }} {{ finding.title }}</p>
            <p v-for="finding in comparison.resolvedUnknown" :key="finding.key">资料状态变化 · {{ roleName(finding.role) }} {{ finding.title }}</p>
            <p v-for="finding in comparison.removedFromScope" :key="finding.key">离开当前检查范围 · {{ roleName(finding.role) }} {{ finding.title }}</p>
            <p v-if="comparison.interpretation" class="small">{{ comparison.interpretation }}</p>
          </div>

          <div class="finding-list">
            <article v-for="finding in checks.findings" :key="finding.key" class="finding">
              <button class="finding-title" @click="focus([...finding.object_ids, ...(finding.routeId ? [finding.routeId] : [])])">
                {{ finding.title }}
                <span class="badge" :class="finding.status">{{ finding.statusLabel }}</span>
              </button>
              <p>{{ finding.objectLabels.join('、') }} · {{ finding.action }}</p>
              <details v-if="finding.evidenceRows.length || finding.limitation">
                <summary>查看依据</summary>
                <dl>
                  <div v-for="entry in finding.evidenceRows" :key="entry.label"><dt>{{ entry.label }}</dt><dd>{{ entry.value }}</dd></div>
                </dl>
                <p v-if="finding.limitation" class="small">{{ finding.limitation }}</p>
              </details>
            </article>
          </div>

          <details class="scope" open>
            <summary>待补资料与检查覆盖</summary>
            <p v-for="item in checks.setupItems" :key="item.object_id">{{ item.objectLabel }} · {{ item.unknownLabels.join('、') }}</p>
            <p v-for="entry in checks.coverage" :key="`${entry.rule_id}:${entry.profile_id}`">
              {{ entry.rule_id }} · {{ coverageLabels[entry.state] }} · {{ entry.reason }}
            </p>
            <p>未覆盖 {{ checks.unsupportedDomains.length }} 类 · {{ checks.unsupportedDomains.join('、') }}</p>
          </details>
        </template>
      </section>
    </div>

    <section v-if="report" class="panel report">
      <header class="section-head">
        <div>
          <p class="eyebrow">当前布局记录</p>
          <h2>{{ report.title }}</h2>
        </div>
        <div class="switches report-buttons">
          <button @click="exportReport">导出 JSON</button>
          <button @click="printReport">打印清单</button>
        </div>
      </header>
      <p>合成样例 · 布局 v{{ report.scene_revision }} · 规则 {{ report.ruleset_version }}</p>
      <p class="hash">输入摘要 {{ report.input_hash }}</p>
      <div class="action-grid">
        <section v-for="section in actionSections" :key="section.key">
          <h3>{{ section.label }}</h3>
          <p v-if="!report.actions[section.key].length" class="small">当前清单无此项。</p>
          <ul v-else>
            <li v-for="finding in report.actions[section.key]" :key="finding.key">
              <strong>{{ roleName(finding.role) }} · {{ finding.title }} · {{ finding.statusLabel }}</strong>
              <p>{{ finding.objectLabels.join('、') }} · {{ finding.action }}</p>
              <p v-if="finding.reason" class="small">{{ finding.reason }}</p>
            </li>
          </ul>
        </section>
      </div>
      <h3>资料与覆盖范围</h3>
      <p v-for="item in report.setupItems" :key="item.object_id">{{ item.objectLabel }} · {{ item.unknownLabels.join('、') }}</p>
      <ul class="report-coverage">
        <li v-for="entry in report.coverage" :key="`${entry.rule_id}:${entry.profile_id}`">
          {{ entry.profile_id ?? '通用' }} · {{ entry.rule_id }} · {{ coverageLabels[entry.state] }} · {{ entry.reason }}
        </li>
      </ul>
      <p>未覆盖 {{ report.unsupportedDomains.length }} 类 · {{ report.unsupportedDomains.join('、') }}</p>
      <ul class="limits"><li v-for="item in report.limitations" :key="item">{{ item }}</li></ul>
    </section>
  </main>
</template>
