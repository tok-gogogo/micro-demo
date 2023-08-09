import Vue from 'vue'
import VueRouter from 'vue-router'
import routes from './router'
import App from './App.vue'
import MicroDemo from '../../../src/method1/index'
// import {register} from '../../../src/method2/index'


// register([{
//   url:"http://localhost:3001/",
//   container:'#my-container',
//   path:"/"
// }])
MicroDemo.start()

window.testStr='parent'


Vue.config.productionTip = false

const router = new VueRouter({
  mode: 'history',
  routes,
})

new Vue({
  router,
  render: h => h(App),
}).$mount('#app')


