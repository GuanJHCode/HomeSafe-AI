import { createApp } from 'vue';
import App from './App.vue';
import type { PreparedStartup } from './domain/PreparedStartup.ts';
import { mountOwnedUi } from './domain/entry-lifecycle.ts';

export function mountApp(startup: PreparedStartup) {
  const app = createApp(App, {startup});
  mountOwnedUi(startup,{config:app.config,mount:()=>app.mount('#app'),unmount:()=>app.unmount()});
}
