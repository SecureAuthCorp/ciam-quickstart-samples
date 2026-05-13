package com.secureauth.quickstart

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

class IDTokenTest {
    /**
     * Helper: assemble a JWT-shaped string with the given JSON payload.
     * Header and signature don't matter for the decode — IDToken only reads the middle segment.
     */
    private fun makeJwt(payloadJson: String): String {
        val payload = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(payloadJson.toByteArray(Charsets.UTF_8))
        return "header.$payload.signature"
    }

    @Test
    fun decode_givenAndFamilyName_populatesBoth() {
        val jwt = makeJwt("""{"given_name":"Jane","family_name":"Doe"}""")
        val claims = IDToken.decode(jwt)
        assertEquals("Jane", claims.givenName)
        assertEquals("Doe", claims.familyName)
        assertNull(claims.email)
    }

    @Test
    fun decode_emailOnly_populatesEmailLeavesNamesNull() {
        val jwt = makeJwt("""{"email":"jane@example.com"}""")
        val claims = IDToken.decode(jwt)
        assertEquals("jane@example.com", claims.email)
        assertNull(claims.givenName)
        assertNull(claims.familyName)
        assertNull(claims.name)
    }

    @Test
    fun decode_malformedReturnsAllNullClaims() {
        val claims = IDToken.decode("not-a-jwt")
        assertNull(claims.givenName)
        assertNull(claims.familyName)
        assertNull(claims.name)
        assertNull(claims.email)
        assertNull(claims.sub)
    }

    @Test
    fun decode_base64urlWithDashUnderscoreAndMissingPadding_decodesCorrectly() {
        // Hardcoded JWT whose payload segment exercises ALL base64url quirks at once:
        // - contains `_` (the base64url replacement for `/`)
        // - contains `-` (the base64url replacement for `+`)
        // - is not a multiple of 4 chars long (decoder must restore padding)
        //
        // The payload `eyJzdWIiOiI_Pz8-In0` decodes to {"sub":"???>"}.
        val jwt = "header.eyJzdWIiOiI_Pz8-In0.signature"
        assertTrue(
            "Hardcoded fixture must keep its URL-safe chars; don't 'tidy' it",
            jwt.contains("_") && jwt.contains("-"),
        )
        val claims = IDToken.decode(jwt)
        assertEquals("???>", claims.sub)
    }

    @Test
    fun welcomeName_precedence() {
        val bothNames = IDTokenClaims(givenName = "Jane", familyName = "Doe")
        assertEquals("Jane Doe", IDToken.welcomeName(bothNames))

        val nameOnly = IDTokenClaims(name = "Jane Doe")
        assertEquals("Jane Doe", IDToken.welcomeName(nameOnly))

        val emailOnly = IDTokenClaims(email = "j@x.com")
        assertEquals("j@x.com", IDToken.welcomeName(emailOnly))

        val subOnly = IDTokenClaims(sub = "u1")
        assertEquals("u1", IDToken.welcomeName(subOnly))

        val nothing = IDTokenClaims()
        assertEquals("there", IDToken.welcomeName(nothing))
    }
}
