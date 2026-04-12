import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faGaugeHigh,
  faPercent,
  faArrowTrendUp,
  faCoins,
  faArrowUp,
  faArrowDown,
  faArrowLeft,
  faArrowUpRightFromSquare,
  faMinus,
  faMagnifyingGlass,
  faCheck,
  faTrophy,
  faCircleNotch,
  faCircleInfo,
  faEarthEurope,
  faSun,
  faMoon,
  faBuilding,
  faUser,
  faThumbsUp,
  faThumbsDown,
} from '@fortawesome/free-solid-svg-icons'
import type { App } from 'vue'

library.add(
  faGaugeHigh,
  faPercent,
  faArrowTrendUp,
  faCoins,
  faArrowUp,
  faArrowDown,
  faArrowLeft,
  faArrowUpRightFromSquare,
  faMinus,
  faMagnifyingGlass,
  faCheck,
  faTrophy,
  faCircleNotch,
  faCircleInfo,
  faEarthEurope,
  faSun,
  faMoon,
  faBuilding,
  faUser,
  faThumbsUp,
  faThumbsDown,
)

export function registerFontAwesome(app: App) {
  app.component('FontAwesomeIcon', FontAwesomeIcon)
}
