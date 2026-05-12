package com.secureauth.quickstart

import org.json.JSONObject
import java.util.Base64

/**
 * The id_token claims we render in the welcome message. Same precedence as the
 * iOS sample: given+family → name → email → sub → "there".
 */
data class IDTokenClaims(
    val givenName: String? = null,
    val familyName: String? = null,
    val name: String? = null,
    val email: String? = null,
    val sub: String? = null,
)

object IDToken {
    /**
     * Decode the middle segment of a JWT and return the claims we care about for
     * display. Returns an all-null struct on any failure (malformed token, missing
     * payload, invalid JSON). Signature is NOT verified — that's the IdP's job.
     * This is for UX, not auth.
     */
    fun decode(token: String): IDTokenClaims {
        val parts = token.split(".")
        if (parts.size < 2) return IDTokenClaims()
        val data = base64UrlDecode(parts[1]) ?: return IDTokenClaims()
        return try {
            val json = JSONObject(String(data, Charsets.UTF_8))
            IDTokenClaims(
                givenName = json.optStringOrNull("given_name"),
                familyName = json.optStringOrNull("family_name"),
                name = json.optStringOrNull("name"),
                email = json.optStringOrNull("email"),
                sub = json.optStringOrNull("sub"),
            )
        } catch (_: Throwable) {
            IDTokenClaims()
        }
    }

    /**
     * Pick a friendly display name from the claims. Same precedence as the iOS sample.
     */
    fun welcomeName(claims: IDTokenClaims): String {
        val combined = listOfNotNull(claims.givenName, claims.familyName).joinToString(" ")
        if (combined.isNotEmpty()) return combined
        return claims.name ?: claims.email ?: claims.sub ?: "there"
    }

    private fun base64UrlDecode(s: String): ByteArray? = try {
        val b64 = s.replace('-', '+').replace('_', '/')
        val padded = b64 + "=".repeat((4 - b64.length % 4) % 4)
        Base64.getDecoder().decode(padded)
    } catch (_: IllegalArgumentException) {
        null
    }

    private fun JSONObject.optStringOrNull(key: String): String? =
        if (has(key) && !isNull(key)) optString(key) else null
}
