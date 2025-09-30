import { createApp } from 'vue'
import App from './App.vue'
import './styles/tailwind.css'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

console.log('Vue版本:', createApp.version)
console.log('开始初始化Vue应用...')

const app = createApp(App)
app.component('font-awesome-icon', FontAwesomeIcon)
app.mount('#app')

console.log('Vue挂载完成!')