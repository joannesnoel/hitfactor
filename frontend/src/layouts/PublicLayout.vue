<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title
          class="cursor-pointer"
          @click="$router.push('/public/matches')"
        >
          HitFactor
        </q-toolbar-title>
        <q-btn flat no-caps icon="login" label="Login" to="/auth/login" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
// Public, unauthenticated layout — no auth store, no sync, no nav.
</script>
