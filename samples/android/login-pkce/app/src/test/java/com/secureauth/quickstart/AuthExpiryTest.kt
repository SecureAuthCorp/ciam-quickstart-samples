package com.secureauth.quickstart

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class AuthExpiryTest {
    @Test
    fun evaluate_pastExpiry_returnsExpired() {
        val past = System.currentTimeMillis() - 60_000
        val result = AuthExpiry.evaluate(past)
        assertEquals(AuthExpiry.Result.Expired, result)
    }

    @Test
    fun evaluate_futureExpiry_returnsValidWithRemainingMs() {
        val future = System.currentTimeMillis() + 30_000
        val result = AuthExpiry.evaluate(future)
        when (result) {
            is AuthExpiry.Result.Valid -> {
                // Loose bounds — CI can stall hundreds of ms between System.currentTimeMillis()
                // and the call into evaluate. We only need the value to be roughly 30s.
                val remaining = result.remainingMs ?: run {
                    fail("Expected non-null remainingMs"); return
                }
                assertTrue("remainingMs > 25_000", remaining > 25_000)
                assertTrue("remainingMs <= 30_000", remaining <= 30_000)
            }
            AuthExpiry.Result.Expired -> fail("Future expiry should be Valid")
        }
    }

    @Test
    fun evaluate_nullExpiry_returnsValidWithNullRemainingMs() {
        val result = AuthExpiry.evaluate(null)
        when (result) {
            is AuthExpiry.Result.Valid -> assertNull(result.remainingMs)
            AuthExpiry.Result.Expired -> fail("Null expiry should be Valid (treat as non-expiring)")
        }
    }
}
