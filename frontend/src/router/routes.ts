import type { RouteRecordRaw } from 'vue-router';

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
    ],
  },

  // Shooter routes
  {
    path: '/shooter',
    component: () => import('src/layouts/ShooterLayout.vue'),
    children: [
      {
        path: 'dashboard',
        component: () => import('src/pages/shooter/DashboardPage.vue'),
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
      {
        path: 'profile',
        component: () => import('src/pages/shooter/ProfilePage.vue'),
      },
    ],
  },

  // Root redirect
  {
    path: '/',
    redirect: '/shooter/dashboard',
  },

  // Catch-all 404
  {
    path: '/:catchAll(.*)*',
    component: () => import('src/pages/auth/LoginPage.vue'),
  },
];

export default routes;
