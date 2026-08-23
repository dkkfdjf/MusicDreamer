<template>
  <el-dialog :model-value="modelValue" title="编辑歌曲信息" width="460px"
    @update:model-value="(v) => $emit('update:modelValue', v)">
    <el-form :model="form" label-width="80px">
      <el-form-item label="歌名"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="专辑"><el-input v-model="form.album" /></el-form-item>
      <el-form-item label="风格">
        <el-select v-model="form.style" style="width:180px">
          <el-option v-for="s in STYLES" :key="s" :label="s" :value="s" />
        </el-select>
      </el-form-item>
      <el-form-item label="语言">
        <el-select v-model="form.language" style="width:180px">
          <el-option v-for="l in LANGUAGES" :key="l" :label="l" :value="l" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
// 歌曲信息编辑弹窗：首页「全部内容」管理员态与后台「全量歌曲」共用
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import { STYLES, LANGUAGES } from '../utils'

const props = defineProps({
  modelValue: Boolean,
  song: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'saved'])

const form = ref({ name: '', album: '', style: '', language: '' })
const saving = ref(false)

watch(
  () => props.modelValue,
  async (v) => {
    if (!v || !props.song) return
    // 列表卡片不一定带全字段，以详情为准，失败时退回列表值
    form.value = {
      name: props.song.name || '',
      album: props.song.album || '',
      style: props.song.style || '',
      language: props.song.language || ''
    }
    try {
      const d = await api.songDetail(props.song.id)
      if (d) {
        form.value = { name: d.name || '', album: d.album || '', style: d.style || '', language: d.language || '' }
      }
    } catch (e) { /* 列表字段兜底 */ }
  }
)

async function save() {
  saving.value = true
  try {
    await api.songEdit(props.song.id, { ...form.value })
    ElMessage.success('已保存')
    emit('update:modelValue', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>
