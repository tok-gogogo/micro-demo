import Vue from 'vue';
import VueRouter from 'vue-router';
import Home from './pages/page1.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    // redirect: '/react17/'
    component: Home,

  },
  // {
  //   path: '/react17/*',
  //   name: 'react17',
  //   component: Home,
  // },

];

export default routes;
