<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
    <main class="container mx-auto py-8 px-6 max-w-6xl">
      <!-- 暗色模式切换按钮 -->
      <button
        @click="toggleDarkMode"
        class="fixed top-4 right-4 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow z-50"
        aria-label="切换暗色模式"
        >
        <font-awesome-icon
          :icon="isDarkMode ? 'sun': 'moon'"
          class="text-gray-800 dark:text-gray-200 text-xl"
          />
      </button>

      <!-- 个人信息 -->
      <div class="flex justify-center animate-fade-in">
        <div class="text-center w-full md:max-w-2xl">
          <div class="rounded-full overflow-hidden w-[150px] h-[150px] mx-auto mb-6 shadow-lg ring-4 ring-white/20">
            <img
            src="https://cdn.mengze.vip/gh/YShenZe/Blog-Static-Resource@main/images/IMG_20250410_142254.jpg?format=webp&width=150"
            alt="ZeMeng Avatar"
            class="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            >
          </div>
          <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">梦泽</h1>
          <p class="text-lg text-gray-600 dark:text-gray-400">
            投诉科技，用代码丰富生活
          </p>
        </div>
      </div>

      <!-- 社交链接 -->
      <div class="my-8">
        <div class="mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors duration-300 hover:shadow-md max-w-4xl">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <a
              v-for="(link, index) in SOCIAL_LINKS"
              :key="index"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors group"
              @mouseenter="prefetchLink(link.url)"
              >
              <font-awesome-icon
                :icon="link.icon"
                class="text-gray-500 dark:text-gray-400 text-lg w-5 transition-colors group-hover:text-blue-500"
                />
              <span class="text-gray-700 dark:text-gray-200 font-medium">{{ link.title }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- 自我介绍 -->
      <div class="my-8">
        <div class="rounded-xl p-4 border-blue-200 block border bg-blue-50 dark:bg-blue-900/20">
          <div class="text-blue-600 text-sm mt-1 break-all dark:text-blue-400">
            你好！我是梦泽，一个来自中国湖南的全栈开发者。我从2023年开始 从HTML到Bootstrap再到Vue，从JavaScript到PHP到Nodejs，从CSS到SCSS再到Stylus，我总共花了两年时间 这一路上更多的是快乐，我一共换过6个博客域名 分别是：mengze.669.ink、mengze2.gay、mengze2.top、mengze2.cn、zeimg.top、mengze.vip。我并不需要什么收录啊、权重啊，我不在乎 我更爱折腾的那个过程。我搭建过博客、网盘、图床、Git，也做过内容农场、资源站，搞过虚拟化、云原生、Docker、Serverless、卖过服务器。如果你也像我一样爱折腾，那么加：940994905
          </div>
        </div>
      </div>

      <!-- 项目展示 -->
      <div class="my-8">
        <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">项目列表</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <a
            v-for="(project, index) in PROJECTS"
            :key="index"
            :href="project.url"
            target="_blank"
            rel="noopener"
            class="block border rounded-xl p-6 hover:shadow-md transition-shadow bg-white dark:bg-gray-800 dark:border-gray-700"
            >
            <div>
              <h3 class="text-lg font-medium text-gray-800 dark:text-gray-200">{{ project.name }}</h3>
              <p class="text-gray-500 mt-2 dark:text-gray-400 leading-relaxed">
                {{ project.description }}
              </p>
            </div>
          </a>
        </div>
      </div>

      <!-- 维护网站 -->
      <div class="my-8">
        <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">在维护的网站</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            v-for="(site, index) in MAINTAINED_SITES"
            :key="index"
            :href="site.url"
            target="_blank"
            rel="noopener"
            class="block bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors dark:bg-blue-900/20 dark:border-blue-800 dark:hover:bg-blue-900/30"
            >
            <div class="font-medium text-blue-800 dark:text-blue-200">
              {{ site.name }}
            </div>
            <div class="text-blue-600 text-sm mt-1 break-all dark:text-blue-400">
              {{ site.url }}
            </div>
          </a>
        </div>
      </div>

      <!-- 技术栈 -->
      <div class="my-8">
        <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">技术栈</h2>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(tech, index) in TECHNOLOGIES"
            :key="index"
            :class="[
              'inline-flex px-3 py-1 rounded-full text-sm font-medium transition-colors',
              tech.used
              ? 'bg-blue-500/90 text-white hover:bg-blue-600'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
              ]"
          >
              {{ tech.name }}
              </span>
            </div>
          </div>
        </main>
      </div>
    </template>

    <script setup>
      import {
        ref,
        onMounted
      } from 'vue'
      import {
        library
      } from '@fortawesome/fontawesome-svg-core'
      import {
        FontAwesomeIcon
      } from '@fortawesome/vue-fontawesome'
      import {
        faFileAlt,
        faGem,
        faTv,
        faMoon,
        faSun,
        faCube
      } from '@fortawesome/free-solid-svg-icons'
      import {
        faLinux,
        faQq,
        faBlogger,
        faGithub
      } from '@fortawesome/free-brands-svg-icons'

      library.add(faBlogger, faFileAlt, faGem, faTv, faLinux, faQq, faMoon, faSun, faGithub, faCube)

      const SOCIAL_LINKS = Object.freeze([
        {
          title: '个人博客',
          url: 'https://mengze.vip/',
          icon: ['fab', 'blogger']
        },
        {
          title: '英文博客',
          url: 'https://mengze.netlify.app/',
          icon: ['fas', 'file-alt']
        },
        {
          title: '掘金主页',
          url: 'https://juejin.cn/user/4369923451394153',
          icon: ['fas', 'gem']
        },
        {
          title: 'Bilibili',
          url: 'https://b23.tv/03bOcmR',
          icon: ['fas', 'tv']
        },
        {
          title: 'LinuxDO',
          url: 'https://linux.do/u/yshenze/activity',
          icon: ['fab', 'linux']
        },
        {
          title: 'QQ',
          url: 'https://qm.qq.com/q/LkLvkujFeK',
          icon: ['fab', 'qq']
        },
        {
          title: 'Github',
          url: 'https://github.com/YShenZe/',
          icon: ['fab', 'github']
        },
        {
          title: 'KlpBBS',
          url: 'https://klpbbs.com/home.php?mod=space&do=profile&mobile=2',
          icon: ['fas', 'cube']
        }
      ])

      const PROJECTS = Object.freeze([
        {
          name: 'Vercel-Netlify-JsDelivr-Mirror',
          description: '基于Vercel/Netlify ServerLess编写的Jsdelivr反向代理配置文件模板仓库',
          url: 'https://github.com/YShenZe/Vercel-Netlify-JsDelivr-Mirror'
        },
        {
          name: 'TurboFeLy',
          description: '现代化的界面无刷新加载库兼原生 SPA 加速库，提供比 Pjax 更现代的解决方案',
          url: 'https://github.com/YShenZe/TurboFeLy'
        },
        {
          name: 'TailDwon-PHP',
          description: 'PHP编写的多版本下载站程序，支持版本发布、公告功能',
          url: 'https://github.com/YShenZe/TailDwon-PHP'
        },
        {
          name: 'ZeMeng-Home-Pages',
          description: '使用Vuejs+TailwindCSS编写的个人主页，托管于Github使用Netlify构建部署',
          url: 'https://github.com/YShenZe/ZeMeng-Home-Pages'
        },
        {
          name: 'MengZe-Tool-Pro',
          description: '专业级网页调试工具套件，集成多种实用功能帮助开发者提升调试效率',
          url: 'https://github.com/YShenZe/MengZe-Tool-Pro'
        },
        {
          name: 'MengZe-Whois-Vue',
          description: '基于 Vue 3 + Element Plus 的 WHOIS 域名信息查询工具',
          url: 'https://github.com/YShenZe/MengZe-Whois-Vue'
        }
      ])

      const TECHNOLOGIES = Object.freeze([
        { name: 'PHP', used: true },
        { name: 'Vue2', used: true },
        { name: 'TailwindCSS', used: true },
        { name: 'Bootstrap5', used: true },
        { name: 'Nodejs', used: false }
      ])

      const MAINTAINED_SITES = Object.freeze([
        {
          name: '个人博客',
          url: 'https://mengze.vip'
        },
        {
          name: '短链接服务',
          url: 'https://mzurl.xyz'
        },
        {
          name: '状态监控',
          url: 'https://status.mengze.vip'
        },
        {
          name: '个人主页',
          url: 'https://i.mengze.vip'
        },
        {
          name: '通用反代',
          url: 'https://proxy.mengze.vip'
        },
        {
          name: 'Jsdelivr镜像',
          url: 'https://cdn.mengze.vip'
        },
        {
          name: '梗图库',
          url: 'https://meme.mengze.vip'
        },
        {
          name: '知识库',
          url: 'https://learn.mengze.vip'
        },
        {
          name: '爱徒的网站',
          url: 'https://movie.wunian.xyz'
        }
      ])

      const isDarkMode = ref(false)
      const toggleDarkMode = () => {
        isDarkMode.value = !isDarkMode.value
        document.documentElement.classList.toggle('dark', isDarkMode.value)
        localStorage.setItem('darkMode', isDarkMode.value)
      }

      const prefetchLink = (url) => {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = url
        document.head.appendChild(link)
      }

      onMounted(() => {
        const savedDarkMode = localStorage.getItem('darkMode')
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        isDarkMode.value = savedDarkMode ? JSON.parse(savedDarkMode): systemDark
        document.documentElement.classList.toggle('dark', isDarkMode.value)
      })
    </script>

    <style>
      @keyframes fade-in {
        from { opacity: 0;
          transform: translateY(20px);
        }
        to { opacity: 1;
          transform: translateY(0);
        }
      }

      .animate-fade-in {
        animation: fade-in 0.6s ease-out forwards;
      }

      ::-webkit-scrollbar {
        width: 8px;
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }

      .dark ::-webkit-scrollbar-thumb {
        background: #475569;
      }

      a, button {
        -webkit-tap-highlight-color: transparent;
      }
    </style>