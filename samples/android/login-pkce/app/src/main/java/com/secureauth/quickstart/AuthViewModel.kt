package com.secureauth.quickstart

import android.app.Application
import android.content.Intent
// @snippet:step1:start
// @description Import AppAuth-Android types
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
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
// @description Configure the OIDC client with your SecureAuth app settings
object AuthConfig {
    /** java.net.URI here so JVM unit tests can exercise buildIssuerUri without
     *  needing a device runtime. The device-side AppAuth call converts via
     *  android.net.Uri.parse(issuer.toString()) at the boundary. */
    val issuer: URI? = buildIssuerUri(BuildConfig.CIAM_ISSUER_HOST, BuildConfig.CIAM_ISSUER_PATH)
    val clientId: String = BuildConfig.CIAM_CLIENT_ID
    val redirectUri: android.net.Uri? by lazy {
        BuildConfig.CIAM_REDIRECT_SCHEME
            .takeIf { it.isNotEmpty() }
            ?.let { android.net.Uri.parse("$it://oauthredirect") }
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

class AuthViewModel(app: Application) : AndroidViewModel(app) {
    private val authService = AuthorizationService(app)

    private val _state = MutableStateFlow<AuthState?>(null)
    val state: StateFlow<AuthState?> = _state.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _expired = MutableStateFlow(false)
    val expired: StateFlow<Boolean> = _expired.asStateFlow()

    private var expiryJob: Job? = null
    private var pendingAuthState: AuthState? = null

    // @snippet:step3:start
    // @description Open Chrome Custom Tabs, run Auth Code + PKCE, and receive tokens
    suspend fun signIn(): Intent? {
        _error.value = null
        _expired.value = false
        val issuerJavaUri = AuthConfig.issuer
            ?: run { _error.value = "CIAM_ISSUER_HOST is missing — fill in local.properties"; return null }
        if (AuthConfig.clientId.isEmpty()) {
            _error.value = "CIAM_CLIENT_ID is missing — fill in local.properties"; return null
        }
        val redirect = AuthConfig.redirectUri
            ?: run { _error.value = "CIAM_REDIRECT_SCHEME is missing — fill in local.properties"; return null }
        return try {
            val issuerAndroidUri = android.net.Uri.parse(issuerJavaUri.toString())
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
     *  Intent, exchanges the auth code for tokens, and updates [state]. */
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
                _state.value = pending
                scheduleExpiryTimer()
            } catch (e: Exception) {
                _error.value = e.localizedMessage ?: "Token exchange failed"
            } finally {
                pendingAuthState = null
            }
        }
    }

    // @snippet:step4:start
    // @description Revoke the access token at the IdP and clear local auth state
    suspend fun signOut() {
        _state.value?.lastTokenResponse?.accessToken?.let { token ->
            try { revokeToken(token) } catch (_: Exception) { /* best-effort */ }
        }
        _state.value = null
        _expired.value = false
        _error.value = null
        expiryJob?.cancel()
    }
    // @snippet:step4:end

    private fun scheduleExpiryTimer() {
        expiryJob?.cancel()
        val expiresAt = _state.value?.lastTokenResponse?.accessTokenExpirationTime
        when (val result = AuthExpiry.evaluate(expiresAt)) {
            AuthExpiry.Result.Expired -> {
                _state.value = null
                _expired.value = true
            }
            is AuthExpiry.Result.Valid -> {
                val remaining = result.remainingMs ?: return
                expiryJob = viewModelScope.launch {
                    delay(remaining)
                    _state.value = null
                    _expired.value = true
                }
            }
        }
    }

    // ── async wrappers around AppAuth-Android's callback APIs (kept outside snippet
    // tags so dashboard readers see only the OIDC essentials in step3/step4) ───────

    private suspend fun discoverConfiguration(issuer: android.net.Uri): AuthorizationServiceConfiguration =
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
        // If we got here we already signed in successfully, so issuer was non-null at sign-in time.
        val issuerJavaUri = AuthConfig.issuer ?: return
        val issuerAndroidUri = android.net.Uri.parse(issuerJavaUri.toString())
        val config = discoverConfiguration(issuerAndroidUri)
        val revokeUrl = config.discoveryDoc?.docJson?.optString("revocation_endpoint")
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
        expiryJob?.cancel()
        authService.dispose()
        super.onCleared()
    }
}
