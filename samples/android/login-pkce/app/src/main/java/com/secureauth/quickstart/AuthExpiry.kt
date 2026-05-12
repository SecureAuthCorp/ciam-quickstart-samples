package com.secureauth.quickstart

object AuthExpiry {
    /**
     * `Valid(remainingMs)` — token is not expired. `remainingMs` is the number of
     * milliseconds until expiry, or `null` if no expiry was provided (treat as
     * non-expiring; matches the iOS sample's "no timer when no date" behavior).
     * `Expired` — the provided expiry has already elapsed.
     */
    sealed class Result {
        data class Valid(val remainingMs: Long?) : Result()
        data object Expired : Result()
    }

    fun evaluate(expiresAt: Long?): Result {
        if (expiresAt == null) return Result.Valid(null)
        val remaining = expiresAt - System.currentTimeMillis()
        return if (remaining <= 0L) Result.Expired else Result.Valid(remaining)
    }
}
