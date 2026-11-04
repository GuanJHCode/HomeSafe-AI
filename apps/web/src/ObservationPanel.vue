<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ObservationEdit, ObservationOption } from '../../../contracts/frontend/domain.ts';

const props = defineProps<{ options: ObservationOption[]; busy: boolean; objectName: (id: string) => string }>();
const emit = defineEmits<{ apply: [edit: ObservationEdit]; close: [] }>();
const selected = ref('');
const choice = ref('unknown');
const acknowledged = ref(false);
const key = (option: ObservationOption) => `${option.object_id}:${option.field}`;
const current = computed(() => props.options.find(option => key(option) === selected.value));
const value = computed(() => choice.value === 'unknown' ? null : choice.value === 'yes');
const changed = computed(() => current.value && current.value.observation.value !== value.value);
const provenance = computed(() => current.value?.observation.source_kind === 'simulated' ? '演练模拟输入'
  : current.value?.observation.source_kind === 'demo' ? '合成样例预设' : '资料未知');
watch(() => props.options, options => {
  if (!options.some(option => key(option) === selected.value)) selected.value = options[0] ? key(options[0]) : '';
}, { immediate: true });
watch(current, option => {
  choice.value = option?.observation.value == null ? 'unknown' : option.observation.value ? 'yes' : 'no';
  acknowledged.value = false;
}, { immediate: true });
function submit() {
  if (props.busy || !current.value || !changed.value || !acknowledged.value) return;
  emit('apply', { object_id: current.value.object_id, field: current.value.field, value: value.value });
}
</script>

<template>
  <section class="observation-panel" aria-label="模拟资料补充">
    <h3>模拟资料补充</h3>
    <p>仅为合成客厅设置假设条件，不代表现场确认。未知可继续保留；不修改家具尺寸、特征、角色能力或通道。</p>
    <form @submit.prevent="submit">
      <label>资料项目
        <select v-model="selected" :disabled="busy" aria-label="资料项目">
          <option v-for="option in options" :key="key(option)" :value="key(option)">{{ objectName(option.object_id) }} · {{ option.label }}</option>
        </select>
      </label>
      <template v-if="current">
        <p class="small">当前来源：{{ provenance }}<span v-if="current.observation.observed_at"> · {{ current.observation.observed_at }}</span></p>
        <label>假设状态
          <select v-model="choice" :disabled="busy" aria-label="假设状态">
            <option value="unknown">未知，仍待核查</option>
            <option value="yes">是（模拟输入）</option>
            <option value="no">否（模拟输入）</option>
          </select>
        </label>
        <label class="small"><input v-model="acknowledged" type="checkbox" :disabled="busy" aria-label="确认重建资料基线">我理解：更新会清空此前布局的撤销/重做记录，建立新的自由演练基线；资料变化不算空间整改或挑战胜利。</label>
      </template>
      <p v-else>没有可补充的已确认特征对应资料；未知特征不会自动确认。</p>
      <div class="switches">
        <button type="submit" :disabled="busy || !changed || !acknowledged">保存资料并重建基线</button>
        <button type="button" :disabled="busy" @click="emit('close')">关闭资料面板</button>
      </div>
    </form>
  </section>
</template>
