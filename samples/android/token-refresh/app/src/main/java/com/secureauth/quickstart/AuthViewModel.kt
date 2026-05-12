package com.secureauth.quickstart

import android.app.Application
import android.content.Intent
import android.net.Uri
// @snippet:step1:start
// @description Import AppAuth-Android, Foundation, and the secure-storage backend
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.GrantTypeValues
import net.openid.appauth.ResponseTypeValues
import net.openid.appauth.TokenRequest
import net.openid.appauth.TokenResponse
// @snippet:step1:end
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

// @snippet:step2:start
// @description Configure the OIDC client — `offline_access` (set in local.properties) enables refresh tokens
object AuthConfig {
    /** java.net.URI here so JVM unit tests can exercise buildIssuerUri without
     *  needing a device runtime. The device-side AppAuth call converts via
     *  android.net.Uri.parse(issuer.toString()) at the boundary. */
    val issuer: URI? = buildIssuerUri(BuildConfig.CIAM_ISSUER_HOST, BuildConfig.CIAM_ISSUER_PATH)
    val clientId: String = BuildConfig.CIAM_CLIENT_ID
    val redirectUri: Uri? by lazy {
        BuildConfig.CIAM_REDIRECT_SCHEME
            .takeIf { it.isNotEmpty() }
            ?.let { Uri.parse("$it://oauthredirect") }
    }
    val scopes: List<String> = BuildConfig.CIAM_SCOPES
        .split(" ")
        .filter { it.isNotEmpty() }

    /** Combine an issuer host (which may include a port) with an optional workspace path.
     *  Returns null if host is empty. Avoids a trailing slash so that
     *  `<issuer>/.well-known/openid-configuration` doesn't become `//.well-known/...`. */
    fun buildIssuerUri(host: String, path: String): URI? {
        if (host.isEmpty()) return null
        val trimmedPath = path.trim('/')
        val urlString = if (trimmedPath.isEmpty()) "https://$host" else "https://$host/$trimmedPath"
        return try { URI.create(urlString) } catch (_: IllegalArgumentException) { null }
    }
}
// @snippet:step2:end

/** A flat data class published by AuthViewModel so the UI can render the auth state
 *  without depending on AppAuth-Android types. Mirrors RN's `type Tokens` and the iOS
 *  sample's `Tokens` struct. */
data class Tokens(
    val accessToken: String,
    val accessTokenExpirationTime: Long?,
    val refreshToken: String?,
    val idToken: String?,
)

class AuthViewModel(app: Application) : AndroidViewModel(app) {
    private val authService = AuthorizationService(app)
    private val store: TokenStore = RefreshTokenStore(app)

    private val _tokens = MutableStateFlow<Tokens?>(null)
    val tokens: StateFlow<Tokens?> = _tokens.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var refreshJob: Job? = null
    private var pendingAuthState: AuthState? = null

    init {
        val app = getApplication<QuickstartApp>()
        if (app.shouldBootstrap.compareAndSet(true, false)) {
            viewModelScope.launch { bootstrapFromStoredToken() }
        }
    }

    // @snippet:step3:start
    // @description Trigger login with offline_access and capture the refresh token
    suspend fun signIn(): Intent? {
        _error.value = null
        val issuerJavaUri = AuthConfig.issuer
            ?: run { _error.value = "CIAM_ISSUER_HOST is missing — fill in local.properties"; return null }
        if (AuthConfig.clientId.isEmpty()) {
            _error.value = "CIAM_CLIENT_ID is missing — fill in local.properties"; return null
        }
        val redirect = AuthConfig.redirectUri
            ?: run { _error.value = "CIAM_REDIRECT_SCHEME is missing — fill in local.properties"; return null }
        return try {
            val issuerAndroidUri = Uri.parse(issuerJavaUri.toString())
            val config = discoverConfiguration(issuerAndroidUri)
            val request = AuthorizationRequest.Builder(
                config,
                AuthConfig.clientId,
                ResponseTypeValues.CODE,
                redirect,
            )
                .setScopes(AuthConfig.scopes)
                .build()
            val intent = authService.getAuthorizationRequestIntent(request)
            pendingAuthState = AuthState(config)
            intent
        } catch (e: Exception) {
            _error.value = e.localizedMessage ?: "Authorization failed"
            null
        }
    }
    // @snippet:step3:end

    /** Called by MainActivity from the ActivityResult callback. Validates the redirect
     *  Intent, exchanges the auth code for tokens, persists the refresh token, and
     *  updates [tokens]. */
    fun handleAuthorizationResponse(intent: Intent) {
        val response = AuthorizationResponse.fromIntent(intent)
        val ex = AuthorizationException.fromIntent(intent)
        val pending = pendingAuthState
        if (response == null || pending == null) {
            pendingAuthState = null
            _error.value = ex?.localizedMessage ?: "Authorization failed"
            return
        }
        pending.update(response, ex)
        viewModelScope.launch {
            try {
                val tokenResponse = performTokenRequest(response.createTokenExchangeRequest())
                pending.update(tokenResponse, null)
                val next = toTokens(tokenResponse, fallback = null)
                _tokens.value = next
                next.refreshToken?.let { persistRefreshToken(it) }
                scheduleRefreshTimer()
            } catch (e: Exception) {
                _error.value = e.localizedMessage ?: "Token exchange failed"
            } finally {
                pendingAuthState = null
            }
        }
    }

    // @snippet:step5:start
    // @description Exchange the refresh token for a new access token; on failure clear local state and require re-login
    suspend fun refreshTokens() {
        _error.value = null
        val issuerJavaUri = AuthConfig.issuer
            ?: run { _error.value = "CIAM_ISSUER_HOST is missing — fill in local.properties"; return }
        if (AuthConfig.clientId.isEmpty()) {
            _error.value = "CIAM_CLIENT_ID is missing — fill in local.properties"; return
        }
        val storedRefresh = _tokens.value?.refreshToken?.takeIf { it.isNotEmpty() }
            ?: store.load()
            ?: run { _error.value = "No refresh token available. Sign in first."; return }
        try {
            val config = discoverConfiguration(Uri.parse(issuerJavaUri.toString()))
            val request = TokenRequest.Builder(config, AuthConfig.clientId)
                .setGrantType(GrantTypeValues.REFRESH_TOKEN)
                .setRefreshToken(storedRefresh)
                .build()
            val response = performTokenRequest(request)
            val next = toTokens(response, fallback = _tokens.value)
            _tokens.value = next
            // If the IdP rotated the refresh token, persist the new one.
            if (next.refreshToken != null && next.refreshToken != storedRefresh) {
                persistRefreshToken(next.refreshToken)
            }
            scheduleRefreshTimer()
        } catch (e: Exception) {
            // Refresh tokens can be revoked or expire — clear local state and force re-login.
            store.clear()
            _tokens.value = null
            refreshJob?.cancel()
            _error.value = "Refresh failed (${e.localizedMessage}). Sign in again."
        }
    }
    // @snippet:step5:end

    suspend fun signOut() {
        _tokens.value?.accessToken?.let { token ->
            try { revokeToken(token) } catch (_: Exception) { /* best-effort */ }
        }
        store.clear()
        refreshJob?.cancel()
        _tokens.value = null
        _error.value = null
    }

    /** Best-effort silent re-login on launch. If a refresh token is in storage,
     *  exchange it for a new access token without going through the system browser.
     *  On failure, clear storage and stay signed-out (no error displayed). */
    suspend fun bootstrapFromStoredToken() {
        if (_tokens.value != null) return
        val stored = store.load()?.takeIf { it.isNotEmpty() } ?: return
        val issuerJavaUri = AuthConfig.issuer ?: return
        if (AuthConfig.clientId.isEmpty()) return
        try {
            val config = discoverConfiguration(Uri.parse(issuerJavaUri.toString()))
            val request = TokenRequest.Builder(config, AuthConfig.clientId)
                .setGrantType(GrantTypeValues.REFRESH_TOKEN)
                .setRefreshToken(stored)
                .build()
            val response = performTokenRequest(request)
            // Re-check after the network round-trip — the user may have tapped Sign In meanwhile.
            if (_tokens.value != null) return
            val next = toTokens(response, fallback = null)
            _tokens.value = next
            if (next.refreshToken != null && next.refreshToken != stored) {
                persistRefreshToken(next.refreshToken)
            }
            scheduleRefreshTimer()
        } catch (_: Exception) {
            // Stored token is no longer valid — let the user sign in.
            store.clear()
        }
    }

    // MARK: - Auto-refresh timer (replaces login-pkce's "session expired" behavior)

    private fun scheduleRefreshTimer() {
        refreshJob?.cancel()
        val expiresAt = _tokens.value?.accessTokenExpirationTime
        when (val result = AuthExpiry.evaluate(expiresAt)) {
            AuthExpiry.Result.Expired -> {
                refreshJob = viewModelScope.launch { refreshTokens() }
            }
            is AuthExpiry.Result.Valid -> {
                val remaining = result.remainingMs ?: return
                refreshJob = viewModelScope.launch {
                    delay(remaining)
                    refreshTokens()
                }
            }
        }
    }

    /** Save the refresh token to EncryptedSharedPreferences. If the write fails (e.g.,
     *  Keystore unavailable), surface a warning so the user knows the README's silent
     *  re-login promise won't hold on next launch — but keep the in-memory token so
     *  the current session still refreshes the access token. */
    private fun persistRefreshToken(refresh: String) {
        try {
            store.save(refresh)
        } catch (e: Exception) {
            _error.value = "Sign-in succeeded but refresh token could not be saved to secure storage (${e.localizedMessage}). Silent re-login on next launch will not work."
        }
    }

    /** Project an AppAuth TokenResponse onto our flat Tokens data class. Refresh
     *  responses sometimes omit a fresh refresh_token or id_token — when missing,
     *  fall back to the previously-known values so display state stays populated. */
    private fun toTokens(response: TokenResponse, fallback: Tokens?): Tokens =
        Tokens(
            accessToken = response.accessToken ?: fallback?.accessToken ?: "",
            accessTokenExpirationTime = response.accessTokenExpirationTime ?: fallback?.accessTokenExpirationTime,
            refreshToken = response.refreshToken ?: fallback?.refreshToken,
            idToken = response.idToken ?: fallback?.idToken,
        )

    // MARK: - async wrappers around AppAuth-Android's callback APIs

    private suspend fun discoverConfiguration(issuer: Uri): AuthorizationServiceConfiguration =
        suspendCancellableCoroutine { cont ->
            AuthorizationServiceConfiguration.fetchFromIssuer(issuer) { config, ex ->
                if (config != null) cont.resume(config)
                else cont.resumeWithException(ex ?: RuntimeException("Discovery failed"))
            }
        }

    private suspend fun performTokenRequest(request: TokenRequest): TokenResponse =
        suspendCancellableCoroutine { cont ->
            authService.performTokenRequest(request) { response, ex ->
                if (response != null) cont.resume(response)
                else cont.resumeWithException(ex ?: RuntimeException("Token request failed"))
            }
        }

    private suspend fun revokeToken(token: String) {
        val issuer = AuthConfig.issuer ?: return
        val config = discoverConfiguration(Uri.parse(issuer.toString()))
        // AppAuth-Android 0.11.1's AuthorizationServiceDiscovery doesn't expose
        // revocationEndpoint as a typed property — read it from the raw discovery JSON.
        val revokeUrl = config.discoveryDoc?.docJson
            ?.optString("revocation_endpoint")
            ?.takeIf { it.isNotEmpty() } ?: return
        withContext(Dispatchers.IO) {
            val conn = (URL(revokeUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 5_000
                readTimeout = 5_000
                setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            }
            try {
                val body = "token=${URLEncoder.encode(token, "UTF-8")}" +
                    "&client_id=${URLEncoder.encode(AuthConfig.clientId, "UTF-8")}"
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                stream?.use { it.readBytes() }
            } finally {
                conn.disconnect()
            }
        }
    }

    override fun onCleared() {
        refreshJob?.cancel()
        authService.dispose()
        super.onCleared()
    }
}
