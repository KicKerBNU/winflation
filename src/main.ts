import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/styles/main.css'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { registerFontAwesome } from './plugins/fontawesome'
import { registerFirebase } from './plugins/firebase'
import { useAuthStore } from './modules/auth/store/auth.store'
import { useFollowStore } from './modules/follow/store/follow.store'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

registerFontAwesome(app)
registerFirebase(app)

// Start listening to Firebase auth state before mount so the UI boots with the right user.
useAuthStore().init()
useFollowStore().start()

app.mount('#app')
