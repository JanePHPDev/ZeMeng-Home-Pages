<template>
  <div class="max-w-2xl mx-auto p-4 bg-white rounded-lg shadow-md dark:bg-gray-800 dark:text-gray-100">
    
    <div v-if="isLoading" class="text-center py-4">
            <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong class="font-bold">Error: </strong>
      <span class="block sm:inline">{{ errorMessage }}</span>
    </div>

    <ul v-if="!isLoading && !errorMessage" class="space-y-3">
      <li 
        v-for="(article, index) in articles" 
        :key="index"
        class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 p-3 rounded"
      >
        <a 
          :href="article.link" 
          target="_blank" 
          rel="noopener noreferrer"
          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline flex items-center"
        >
          <span class="mr-2 text-blue-400">#{{ index + 1 }}</span>
          {{ article.title }}
        </a>
        <p v-if="article.description" class="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {{ article.description }}
        </p>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import axios from 'axios'
import Parser from 'rss-parser'

const props = defineProps({
  rssUrl: {
    type: String,
    required: true
  }
})

const articles = ref([])
const isLoading = ref(true)
const errorMessage = ref(null)
let activeController = null

const createParser = () => new Parser({
  customFields: {
    item: ['description', 'pubDate', 'content:encoded']
  }
})

const fetchRSS = async () => {
  try {

    if (activeController) {
      activeController.abort()
    }
    
    isLoading.value = true
    errorMessage.value = null
    articles.value = []
    
    activeController = new AbortController()
    
    const response = await axios.get('', {
      params: {
        url: encodeURIComponent(props.rssUrl) 
      },
      signal: activeController.signal,
      timeout: 10000,
      validateStatus: (status) => status === 200
    })

    if (typeof response.data !== 'string' || !response.data.includes('<?xml')) {
      throw new Error('Invalid RSS format')
    }


    const parser = createParser()
    const feed = await parser.parseString(response.data)
    
    // 处理解析结果
    articles.value = (feed.items || [])
      .slice(0, 5)
      .map(item => ({
        title: item.title?.trim() || 'Untitled',
        link: item.link,
        description: item.description?.substring(0, 100) || '' // 限制描述长度
      }))

  } catch (err) {
    // 忽略请求取消的错误
    if (axios.isCancel(err)) return
    
    // 增强错误处理
    errorMessage.value = `Failed to load: ${err.message.replace('axios', '')}`
    
    // 处理特定解析错误
    if (err.message.includes('removeAllListeners')) {
      console.error('RSS 解析器兼容性问题，建议升级 rss-parser 包')
    }
    
  } finally {
    isLoading.value = false
  }
}

// 生命周期处理
onMounted(() => {
  fetchRSS().catch(() => { /* 错误已在函数内处理 */ })
})

watch(() => props.rssUrl, (newVal) => {
  if (newVal) {
    fetchRSS().catch(() => { /* 错误已在函数内处理 */ })
  }
})

onUnmounted(() => {
  // 清理操作
  if (activeController) {
    activeController.abort()
    activeController = null
  }
})
</script>