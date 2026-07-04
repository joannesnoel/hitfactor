<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-dark text-white">
      <q-toolbar>
        <img
          src="/logo.png"
          alt="HitFactor"
          class="q-mr-sm cursor-pointer"
          style="height: 30px"
          @click="$router.push('/public/matches')"
        />
        <q-toolbar-title
          class="cursor-pointer"
          @click="$router.push('/public/matches')"
        >
          HitFactor
        </q-toolbar-title>
        <q-btn
          v-if="auth.isAuthenticated"
          flat
          no-caps
          icon="dashboard"
          label="Dashboard"
          to="/shooter/dashboard"
        />
        <q-btn v-else flat no-caps icon="login" label="Login" to="/auth/login" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
// Public layout: usable by guests and signed-in users. The only auth touch is
// swapping the Login button for a Dashboard link when a session exists.
import { useAuthStore } from 'src/stores/auth.store';

const auth = useAuthStore();
</script>
