package com.secureauth.quickstart

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

// @snippet:step4:start
// @description Persist the refresh token in EncryptedSharedPreferences (AES-GCM, key in Android Keystore)
class RefreshTokenStore(context: Context, fileName: String = DEFAULT_FILE) : TokenStore {
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context.applicationContext,
        fileName,
        MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    override fun save(token: String) {
        prefs.edit().putString(KEY_REFRESH_TOKEN, token).apply()
    }

    override fun load(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)?.takeIf { it.isNotEmpty() }

    override fun clear() {
        prefs.edit().remove(KEY_REFRESH_TOKEN).apply()
    }

    companion object {
        const val DEFAULT_FILE = "secureauth_refresh_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
    }
}
// @snippet:step4:end
