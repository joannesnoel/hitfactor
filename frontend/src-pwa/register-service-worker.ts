import { register } from 'register-service-worker';
import { Notify } from 'quasar';

register(process.env.SERVICE_WORKER_FILE as string, {
  ready(/* registration */) {
    console.log('App is being served from cache by a service worker.');
  },

  registered(/* registration */) {
    console.log('Service worker has been registered.');
  },

  cached(/* registration */) {
    console.log('Content has been cached for offline use.');
  },

  updatefound(/* registration */) {
    console.log('New content is downloading.');
  },

  updated(/* registration */) {
    // The SW uses skipWaiting()+clientsClaim(), so the new version is already
    // active — a reload swaps the running app to it. Offer a one-tap reload
    // rather than silently waiting for the user to refresh.
    console.log('New content is available; prompting reload.');
    Notify.create({
      message: 'A new version of HitFactor is available.',
      caption: 'Reload to update.',
      color: 'primary',
      icon: 'system_update',
      position: 'bottom',
      timeout: 0, // stay until acted on
      multiLine: true,
      actions: [
        {
          label: 'Reload',
          color: 'white',
          handler: () => window.location.reload(),
        },
        { label: 'Later', color: 'white' },
      ],
    });
  },

  offline() {
    console.log('No internet connection found. App is running in offline mode.');
  },

  error(err) {
    console.error('Error during service worker registration:', err);
  },
});
