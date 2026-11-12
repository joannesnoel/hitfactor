import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';

const routes: RouteRecordRaw[] = [
  // Auth routes (no layout)
  {
    path: '/auth/login',
    component: () => import('src/pages/auth/LoginPage.vue'),
  },
  {
    path: '/auth/register',
    component: () => import('src/pages/auth/RegisterPage.vue'),
  },
  {
    // Public so logged-out users can reach it (and the guard doesn't bounce
    // them back to /auth/login).
    path: '/auth/forgot-password',
    component: () => import('src/pages/auth/ForgotPasswordPage.vue'),
    meta: { public: true },
  },
  {
    // Public: reached from an emailed link, typically while logged out.
    path: '/auth/reset-password',
    component: () => import('src/pages/auth/ResetPasswordPage.vue'),
    meta: { public: true },
  },
  {
    // Public: a logged-in user clicking their verify link must reach it too.
    path: '/auth/verify-email',
    component: () => import('src/pages/auth/VerifyEmailPage.vue'),
    meta: { public: true },
  },

  {
    // Private-match invite (QR / deep link). Public so a guest without an
    // account can see the preview; the page itself routes them through
    // login/register (carrying a redirect back here) before they can join.
    path: '/join/:token',
    component: () => import('src/pages/JoinMatchPage.vue'),
    props: true,
    meta: { public: true },
  },

  // Admin routes
  {
    path: '/admin',
    component: () => import('src/layouts/AdminLayout.vue'),
    children: [
      {
        path: 'dashboard',
        component: () => import('src/pages/admin/DashboardPage.vue'),
      },
      {
        path: 'officers',
        component: () => import('src/pages/admin/ManageOfficersPage.vue'),
      },
      {
        path: 'shooters',
        component: () => import('src/pages/admin/ShootersPage.vue'),
      },
      {
        path: 'accounts',
        component: () => import('src/pages/admin/AccountsPage.vue'),
      },
      {
        path: 'ranges',
        component: () => import('src/pages/admin/RangesPage.vue'),
      },
      {
        path: 'matches/create',
        component: () => import('src/pages/admin/MatchCreatePage.vue'),
      },
      {
        path: 'import',
        component: () => import('src/pages/admin/ImportMatchPage.vue'),
      },
    ],
  },

  // Match-specific admin routes (own layout with match sidebar)
  {
    path: '/admin/matches/:id',
    component: () => import('src/layouts/MatchLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('src/pages/admin/MatchInfoPage.vue'),
      },
      {
        path: 'stages',
        component: () => import('src/pages/admin/StageSetupPage.vue'),
      },
      {
        path: 'registrations',
        component: () => import('src/pages/admin/MatchRegistrationsPage.vue'),
      },
      {
        path: 'officers',
        component: () => import('src/pages/admin/OfficersPage.vue'),
      },
      {
        path: 'results',
        component: () => import('src/pages/admin/MatchResultsPage.vue'),
      },
    ],
  },

  // Officer routes
  {
    path: '/officer',
    component: () => import('src/layouts/AdminLayout.vue'),
    children: [
      {
        path: 'dashboard',
        component: () => import('src/pages/officer/OfficerDashboardPage.vue'),
      },
      {
        path: 'scoring/:matchId/:stageId',
        component: () => import('src/pages/officer/ScoreEntryPage.vue'),
        props: true,
      },
      {
        path: 'review/:matchId/:stageId',
        component: () => import('src/pages/officer/StageReviewPage.vue'),
        props: true,
      },
      {
        path: 'matches/:matchId/results',
        component: () => import('src/pages/officer/OfficerMatchResultsPage.vue'),
        props: true,
      },
    ],
  },

  // Shooter routes — the default experience, so they live at the root
  // (/dashboard, /matches/:id, …). Old /shooter/** links redirect (see below).
  {
    path: '/',
    component: () => import('src/layouts/ShooterLayout.vue'),
    children: [
      // Bare root: signed-in users land on their dashboard; guests see the
      // (public) matches list.
      {
        path: '',
        redirect: () => (useAuthStore().isAuthenticated ? '/dashboard' : '/public/matches'),
      },
      {
        path: 'dashboard',
        component: () => import('src/pages/shooter/DashboardPage.vue'),
      },
      {
        path: 'performance',
        component: () => import('src/pages/shooter/PerformancePage.vue'),
      },
      {
        path: 'matches/:id',
        component: () => import('src/pages/shooter/MatchViewPage.vue'),
        props: true,
      },
      {
        path: 'matches/:id/stages/:stageId',
        component: () => import('src/pages/shooter/StageScorePage.vue'),
        props: true,
      },
      // Scoring a stage as a scorer (or the host) — same page the host/officer
      // flows use, reached from the match page.
      {
        path: 'matches/:id/score/:stageId',
        component: () => import('src/pages/officer/ScoreEntryPage.vue'),
        props: true,
      },
      // The old "My Hosted Matches" list is gone — hosted matches show on the
      // dashboard's "Your matches". Kept as a redirect for old links/bookmarks.
      {
        path: 'host',
        redirect: '/dashboard',
      },
      {
        path: 'host/create',
        component: () => import('src/pages/shooter/host/HostMatchCreatePage.vue'),
      },
      {
        path: 'profile',
        component: () => import('src/pages/shooter/ProfilePage.vue'),
      },
    ],
  },

  // Shooter-hosted private match management (own layout; provides matchContext).
  // Deliberately separate from the admin match area — the host is the sole
  // authority (matches.created_by), with no admin/officer roles involved.
  {
    path: '/host/matches/:id',
    component: () => import('src/layouts/HostMatchLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('src/pages/shooter/host/HostMatchOverviewPage.vue'),
      },
      {
        path: 'stages',
        component: () => import('src/pages/admin/StageSetupPage.vue'),
      },
      {
        path: 'registrations',
        component: () => import('src/pages/admin/MatchRegistrationsPage.vue'),
      },
      {
        path: 'results',
        component: () => import('src/pages/admin/MatchResultsPage.vue'),
      },
      {
        path: 'score/:stageId',
        component: () => import('src/pages/officer/ScoreEntryPage.vue'),
        props: true,
      },
    ],
  },

  // Public (unauthenticated) browsing of matches + results
  {
    path: '/public',
    component: () => import('src/layouts/PublicLayout.vue'),
    meta: { public: true },
    children: [
      {
        path: 'matches',
        component: () => import('src/pages/public/PublicMatchesPage.vue'),
        meta: { public: true },
      },
      {
        path: 'matches/:id',
        component: () => import('src/pages/public/PublicMatchViewPage.vue'),
        props: true,
        meta: { public: true },
      },
    ],
  },

  // Legacy: everything used to live under /shooter (bookmarks, installed PWAs,
  // old invite/verify emails).
  {
    path: '/shooter/:rest(.*)*',
    redirect: (to) => ({
      path: '/' + ([] as string[]).concat(to.params.rest ?? []).join('/'),
      query: to.query,
      hash: to.hash,
    }),
  },

  // Catch-all 404
  {
    path: '/:catchAll(.*)*',
    component: () => import('src/pages/auth/LoginPage.vue'),
  },
];

export default routes;
