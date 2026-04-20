<script setup lang="ts">
// @snippet:step4:start
// @description Build the sign-in / sign-out UI using the useAuth composable
import { computed } from "vue";
import { useAuth } from "./auth";

const {
  isLoading,
  isAuthenticated,
  user,
  error,
  signinRedirect,
  signoutRedirect,
} = useAuth();

const errorHint = computed(() =>
  new URLSearchParams(window.location.search).get("error_hint"),
);
// @snippet:step4:end
</script>

<template>
  <h1>SecureAuth Vue PKCE Demo</h1>
  <p v-if="isLoading">Loading...</p>
  <div v-else-if="error" style="color: red">
    <p>Error: {{ error.message }}</p>
    <p v-if="errorHint">{{ errorHint }}</p>
    <button @click="signinRedirect">Try again</button>
  </div>
  <div v-else-if="isAuthenticated">
    <p>
      Welcome, {{ user?.profile.given_name }}
      {{ user?.profile.family_name }} ({{ user?.profile.email }})
    </p>
    <button @click="signoutRedirect">Sign out</button>
  </div>
  <button v-else @click="signinRedirect">Sign in</button>
</template>
