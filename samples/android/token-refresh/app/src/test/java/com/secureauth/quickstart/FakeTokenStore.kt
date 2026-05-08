package com.secureauth.quickstart

import android.content.Context

/**
 * Test-only [TokenStore] implementation backed by plain [android.content.SharedPreferences].
 *
 * Robolectric does not provide the Android Keystore JCE provider required by
 * [RefreshTokenStore]'s EncryptedSharedPreferences. This fake exercises the exact same
 * save/load/clear contract without the Keystore dependency.
 */
class FakeTokenStore(context: Context, fileName: String = "fake_token_store") : TokenStore {
    private val prefs = context.getSharedPreferences(fileName, Context.MODE_PRIVATE)

    override fun save(token: String) {
        prefs.edit().putString(KEY, token).apply()
    }

    override fun load(): String? = prefs.getString(KEY, null)?.takeIf { it.isNotEmpty() }

    override fun clear() {
        prefs.edit().remove(KEY).apply()
    }

    private companion object {
        const val KEY = "refresh_token"
    }
}
