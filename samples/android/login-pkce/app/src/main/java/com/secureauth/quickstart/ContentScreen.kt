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
    val state by viewModel.state.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val expired by viewModel.expired.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "SecureAuth Android PKCE Demo",
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
            state != null -> {
                SignedInView(state = state!!, onSignOut = { scope.launch { viewModel.signOut() } })
            }
            else -> {
                if (expired) {
                    Text(
                        text = "Session expired. Please sign in again.",
                        color = Color(0xFF990000),
                    )
                    Spacer(Modifier.height(12.dp))
                }
                Button(onClick = { scope.launch { viewModel.signIn()?.let(onSignIn) } }) {
                    Text("Sign in")
                }
            }
        }
    }
}

@Composable
private fun SignedInView(state: net.openid.appauth.AuthState, onSignOut: () -> Unit) {
    val tokens = state.lastTokenResponse
    Column(horizontalAlignment = Alignment.Start) {
        Text(
            text = welcomeText(idToken = tokens?.idToken),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        tokens?.accessTokenExpirationTime?.let { ms ->
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Access token expires: ${DateFormat.getDateTimeInstance().format(Date(ms))}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Spacer(Modifier.height(16.dp))
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

private fun welcomeText(idToken: String?): String {
    if (idToken.isNullOrEmpty()) return "Welcome, there!"
    val name = IDToken.welcomeName(IDToken.decode(idToken))
    return "Welcome, $name!"
}
