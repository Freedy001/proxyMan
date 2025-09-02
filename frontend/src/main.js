import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'

// Monaco Editor Worker配置 - 禁用Worker以避免错误
window.MonacoEnvironment = {
  getWorker: function () {
    return {
      postMessage: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      terminate: function () {},
      onmessage: null,
      onerror: null
    }
  }
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')