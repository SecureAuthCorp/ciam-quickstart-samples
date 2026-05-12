package com.secureauth.quickstart

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.net.URI

// Note: buildIssuerUri returns java.net.URI (not android.net.Uri) so these tests
// run on the JVM without requiring the Android framework mock.
class AuthConfigTest {
    @Test
    fun buildIssuerUri_saasFormatHostAndPath() {
        val uri = AuthConfig.buildIssuerUri(
            "your-tenant.us.connect.secureauth.com",
            "your-workspace",
        )
        assertEquals("https://your-tenant.us.connect.secureauth.com/your-workspace", uri.toString())
    }

    @Test
    fun buildIssuerUri_localDevHostWithPortNoPath_noTrailingSlash() {
        val uri = AuthConfig.buildIssuerUri("sth.localhost:8443", "")
        assertEquals("https://sth.localhost:8443", uri.toString())
    }

    @Test
    fun buildIssuerUri_pathWithLeadingOrTrailingSlash_normalized() {
        // Users may paste "/your-workspace" or "your-workspace/" — handle gracefully so
        // the well-known discovery URL doesn't end up with double slashes.
        val uri = AuthConfig.buildIssuerUri("host.example", "/your-workspace/")
        assertEquals("https://host.example/your-workspace", uri.toString())
    }

    @Test
    fun buildIssuerUri_pathOnlySlash_treatedAsEmpty() {
        val uri = AuthConfig.buildIssuerUri("host.example", "/")
        assertEquals("https://host.example", uri.toString())
    }

    @Test
    fun buildIssuerUri_emptyHost_returnsNull() {
        assertNull(AuthConfig.buildIssuerUri("", ""))
        assertNull(AuthConfig.buildIssuerUri("", "your-workspace"))
    }
}
