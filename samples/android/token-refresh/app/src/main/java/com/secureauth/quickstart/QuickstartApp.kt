package com.secureauth.quickstart

import android.app.Application
import java.util.concurrent.atomic.AtomicBoolean

class QuickstartApp : Application() {
    /** Set to true on process start if a refresh token is already in storage. The
     *  first AuthViewModel constructed in this process reads + clears the flag and
     *  fires bootstrapFromStoredToken(). compareAndSet ensures it doesn't re-fire
     *  if MainActivity is recreated within the same process. */
    val shouldBootstrap = AtomicBoolean(false)

    override fun onCreate() {
        super.onCreate()
        // Cheap synchronous prefs read. If a token is present, AuthViewModel.init
        // will pick up the flag and run bootstrapFromStoredToken() asynchronously.
        // Wrapped in try-catch because EncryptedSharedPreferences requires the
        // Android Keystore which is unavailable in Robolectric unit tests.
        try {
            shouldBootstrap.set(RefreshTokenStore(this).load() != null)
        } catch (_: Exception) {
            // Keystore unavailable (e.g. in Robolectric) — skip bootstrap, user signs in normally.
        }
    }
}
