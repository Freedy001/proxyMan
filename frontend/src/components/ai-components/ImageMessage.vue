<template>
  <div class="image-message">
    <!-- 图片容器 -->
    <div class="image-container" v-for="(image, index) in images" :key="index">
      <div class="image-wrapper" @click="openPreview(image, index)">
        <img
          :src="image.url"
          :alt="image.alt || 'AI generated image'"
          class="message-image"
          :class="{ 'loading': imageLoadingStates[index], 'error': imageErrorStates[index] }"
          @load="handleImageLoad(index)"
          @error="handleImageError(index)"
          loading="lazy"
        />
        
        <!-- 加载状态 -->
        <div v-if="imageLoadingStates[index]" class="image-loading">
          <div class="loading-spinner"></div>
          <span class="loading-text">Loading...</span>
        </div>
        
        <!-- 错误状态 -->
        <div v-if="imageErrorStates[index]" class="image-error">
          <div class="error-icon">📷</div>
          <span class="error-text">Failed to load image</span>
        </div>
        
        <!-- 预览提示 -->
        <div class="image-overlay">
          <div class="overlay-icon">🔍</div>
          <span class="overlay-text">Click to preview</span>
        </div>
      </div>
      
      <!-- 图片信息 -->
      <div v-if="image.detail" class="image-info">
        <span class="image-detail">Detail: {{ image.detail }}</span>
      </div>
    </div>
    
    <!-- 图片预览模态框 -->
    <div v-if="previewVisible" class="preview-modal" @click="closePreview">
      <div class="preview-container">
        <button class="preview-close" @click="closePreview" title="Close preview">×</button>
        <img
          :src="previewImage?.url"
          :alt="previewImage?.alt || 'Preview'"
          class="preview-image"
          @click.stop
        />
        <div class="preview-info" v-if="previewImage">
          <span class="preview-index">{{ previewIndex + 1 }} / {{ images.length }}</span>
          <div class="preview-navigation" v-if="images.length > 1">
            <button @click.stop="prevImage" :disabled="previewIndex === 0" class="nav-button">‹</button>
            <button @click.stop="nextImage" :disabled="previewIndex === images.length - 1" class="nav-button">›</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { ContentPart } from '@/utils/LLMSModels.ts'

interface ImageData {
  url: string
  alt?: string
  detail?: 'low' | 'high' | 'auto'
}

const props = defineProps<{
  content: string | ContentPart[]
}>()

// 提取图片数据
const images = computed<ImageData[]>(() => {
  if (typeof props.content === 'string') {
    return []
  }
  
  if (!Array.isArray(props.content)) {
    return []
  }
  
  return props.content
    .filter(part => part.type === 'image_url')
    .map(part => ({
      url: part.image_url?.url || '',
      detail: part.image_url?.detail,
      alt: `Image with ${part.image_url?.detail || 'auto'} detail`
    }))
    .filter(img => img.url) // 过滤掉空 URL
})

// 图片加载状态
const imageLoadingStates = ref<boolean[]>([])
const imageErrorStates = ref<boolean[]>([])

// 预览相关
const previewVisible = ref(false)
const previewImage = ref<ImageData | null>(null)
const previewIndex = ref(0)

// 初始化加载状态
onMounted(() => {
  imageLoadingStates.value = new Array(images.value.length).fill(true)
  imageErrorStates.value = new Array(images.value.length).fill(false)
})

// 图片加载完成
const handleImageLoad = (index: number) => {
  imageLoadingStates.value[index] = false
  imageErrorStates.value[index] = false
}

// 图片加载错误
const handleImageError = (index: number) => {
  imageLoadingStates.value[index] = false
  imageErrorStates.value[index] = true
}

// 打开预览
const openPreview = (image: ImageData, index: number) => {
  if (imageErrorStates.value[index]) return // 错误的图片不能预览
  
  previewImage.value = image
  previewIndex.value = index
  previewVisible.value = true
  document.body.style.overflow = 'hidden' // 禁止背景滚动
}

// 关闭预览
const closePreview = () => {
  previewVisible.value = false
  previewImage.value = null
  document.body.style.overflow = '' // 恢复背景滚动
}

// 上一张图片
const prevImage = () => {
  if (previewIndex.value > 0) {
    previewIndex.value--
    previewImage.value = images.value[previewIndex.value]
  }
}

// 下一张图片
const nextImage = () => {
  if (previewIndex.value < images.value.length - 1) {
    previewIndex.value++
    previewImage.value = images.value[previewIndex.value]
  }
}

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  if (!previewVisible.value) return
  
  switch (event.key) {
    case 'Escape':
      closePreview()
      break
    case 'ArrowLeft':
      prevImage()
      break
    case 'ArrowRight':
      nextImage()
      break
  }
}

// 添加键盘事件监听
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

// 清理事件监听
import { onUnmounted } from 'vue'
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = '' // 确保清理样式
})
</script>

<style scoped>
.image-message {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.image-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.image-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: var(--color-background-elevation-1);
}

.image-wrapper:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.message-image {
  width: 100%;
  max-width: 400px;
  height: auto;
  display: block;
  transition: opacity 0.3s ease;
}

.message-image.loading {
  opacity: 0;
}

.message-image.error {
  display: none;
}

.image-loading,
.image-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-background-elevation-2);
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  gap: var(--spacing-xs);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 24px;
  opacity: 0.5;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  //flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  gap: var(--spacing-xs);
  font-size: var(--font-size-small);
}

.image-wrapper:hover .image-overlay {
  opacity: 1;
}

.overlay-icon {
  margin-right: 10px;
  font-size: 24px;
}

.image-info {
  display: flex;
  justify-content: flex-start;
  padding: var(--spacing-xs);
}

.image-detail {
  font-size: var(--font-size-small);
  color: var(--color-foreground-secondary);
  font-style: italic;
}

/* 预览模态框 */
.preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: pointer;
}

.preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.preview-close {
  position: absolute;
  top: -50px;
  right: -10px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  z-index: 1001;
}

.preview-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.preview-image {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 4px;
  cursor: default;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  color: white;
  font-size: var(--font-size-small);
}

.preview-navigation {
  display: flex;
  gap: var(--spacing-xs);
}

.nav-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 18px;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.nav-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .message-image {
    max-width: 100%;
  }
  
  .preview-container {
    max-width: 95vw;
    max-height: 95vh;
  }
  
  .preview-close {
    top: -40px;
    right: 0;
    font-size: 20px;
    width: 36px;
    height: 36px;
  }
  
  .image-overlay {
    font-size: var(--font-size-tiny);
  }
  
  .overlay-icon {
    font-size: 20px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .image-wrapper {
    background: var(--color-background-elevation-3);
  }
  
  .image-loading,
  .image-error {
    background: var(--color-background-elevation-3);
  }
}
</style>