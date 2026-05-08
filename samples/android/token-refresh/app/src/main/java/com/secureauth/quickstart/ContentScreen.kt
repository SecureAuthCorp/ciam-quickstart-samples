package com.secureauth.quickstart

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
fun ContentScreen(
    viewModel: AuthViewModel,
    onSignIn: (Intent) -> Unit,
) {
    val tokens by viewModel.tokens.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "SecureAuth Android Token Refresh Demo",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(24.dp))

        when {
            error != null -> {
                ErrorBanner(message = error!!)
                Spacer(Modifier.height(16.dp))
                Button(onClick = { scope.launch { viewModel.signIn()?.let(onSignIn) } }) {
                    Text("Try again")
                }
            }
            tokens != null -> {
                SignedInView(
                    tokens = tokens!!,
                    onRefresh = { scope.launch { viewModel.refreshTokens() } },
                    onSignOut = { scope.launch { viewModel.signOut() } },
                )
            }
            else -> {
                Button(onClick = { scope.launch { viewModel.signIn()?.let(onSignIn) } }) {
                    Text("Sign in")
                }
            }
        }
    }
}

@Composable
private fun SignedInView(tokens: Tokens, onRefresh: () -> Unit, onSignOut: () -> Unit) {
    Column(horizontalAlignment = Alignment.Start) {
        Text(
            text = welcomeText(idToken = tokens.idToken, accessToken = tokens.accessToken),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        tokens.accessTokenExpirationTime?.let { ms ->
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Access token expires: ${DateFormat.getDateTimeInstance().format(Date(ms))}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            text = "Refresh token stored: ${if (tokens.refreshToken == null) "no" else "yes"}",
            style = MaterialTheme.typography.bodySmall,
        )
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRefresh) {
            Text("Refresh token now")
        }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onSignOut) {
            Text("Sign out")
        }
    }
}

@Composable
private fun ErrorBanner(message: String) {
    Text(
        text = "Error: $message",
        color = Color(0xFF990000),
        modifier = Modifier
            .background(Color(0x14FF0000), RoundedCornerShape(8.dp))
            .padding(12.dp),
    )
}

/** Pick a friendly display name from id_token claims, falling back to access_token
 *  if the id_token is missing or unparseable. Mirrors the iOS+RN samples. */
private fun welcomeText(idToken: String?, accessToken: String?): String {
    for (candidate in listOf(idToken, accessToken)) {
        if (candidate.isNullOrEmpty()) continue
        val name = IDToken.welcomeName(IDToken.decode(candidate))
        if (name != "there") return "Welcome, $name!"
    }
    return "Welcome, there!"
}
