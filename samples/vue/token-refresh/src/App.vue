<script setup lang="ts">
// @snippet:step4:start
// @description Build the token-refresh UI using the useAuth composable
import { computed } from "vue";
import { useAuth } from "./auth";

const {
  isLoading,
  isAuthenticated,
  user,
  error,
  expiresAt,
  refresh,
  signinRedirect,
  signoutRedirect,
} = useAuth();

const errorHint = computed(() =>
  new URLSearchParams(window.location.search).get("error_hint"),
);
// @snippet:step4:end
</script>

<template>
  <h1>SecureAuth Token Refresh Demo</h1>
  <p v-if="isLoading">Loading...</p>
  <div v-else-if="error" style="color: red">
    <p>Error: {{ error.message }}</p>
    <p v-if="errorHint">{{ errorHint }}</p>
    <button @click="signinRedirect">Try again</button>
  </div>
  <div v-else-if="isAuthenticated">
    <p>Welcome, {{ user?.profile.given_name }}</p>
    <p>Token expires at: {{ expiresAt }}</p>
    <button @click="refresh">Refresh token now</button>
    <br />
    <br />
    <button @click="signoutRedirect">Sign out</button>
  </div>
  <button v-else @click="signinRedirect">Sign in</button>
</template>
