package com.secureauth.quickstart

import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Tests the [TokenStore] contract (save / load / clear).
 *
 * [RefreshTokenStore] uses EncryptedSharedPreferences / Android Keystore which is not
 * available in the host JVM. A [FakeTokenStore] backed by plain SharedPreferences is used
 * here to verify the behavioural contract; the production implementation is covered by
 * the snippet review and on-device testing.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RefreshTokenStoreTest {
    private lateinit var store: TokenStore

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<android.app.Application>()
        // FakeTokenStore uses plain SharedPreferences — no Keystore needed in tests.
        store = FakeTokenStore(ctx, fileName = "test_refresh_token")
        store.clear()
    }

    @After
    fun tearDown() {
        store.clear()
    }

    @Test
    fun load_returnsNull_whenNothingStored() {
        assertNull(store.load())
    }

    @Test
    fun save_thenLoad_roundTrips() {
        store.save("rt_abc123")
        assertEquals("rt_abc123", store.load())
    }

    @Test
    fun save_overwritesExisting() {
        store.save("rt_abc123")
        store.save("rt_xyz789")
        assertEquals("rt_xyz789", store.load())
    }

    @Test
    fun clear_removesEntry() {
        store.save("rt_abc123")
        store.clear()
        assertNull(store.load())
    }
}
