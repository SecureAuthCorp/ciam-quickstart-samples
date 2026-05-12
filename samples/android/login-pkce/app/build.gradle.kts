import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

// Read local.properties at configure time so we can surface CIAM_* fields into
// BuildConfig (read at runtime) and into AndroidManifest.xml (intent filter).
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun localProp(key: String): String = localProps.getProperty(key, "")

android {
    namespace = "com.secureauth.quickstart"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.secureauth.quickstart.android.login"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "CIAM_CLIENT_ID",       "\"${localProp("CLIENT_ID")}\"")
        buildConfigField("String", "CIAM_ISSUER_HOST",     "\"${localProp("ISSUER_HOST")}\"")
        buildConfigField("String", "CIAM_ISSUER_PATH",     "\"${localProp("ISSUER_PATH")}\"")
        buildConfigField("String", "CIAM_REDIRECT_SCHEME", "\"${localProp("REDIRECT_SCHEME")}\"")
        buildConfigField("String", "CIAM_SCOPES",          "\"${localProp("SCOPES")}\"")

        // AppAuth-Android's RedirectUriReceiverActivity intent filter is parameterised
        // on ${appAuthRedirectScheme}. Tying both to the same source value (the
        // REDIRECT_SCHEME entry in local.properties) prevents drift between code and
        // manifest.
        manifestPlaceholders["appAuthRedirectScheme"] = localProp("REDIRECT_SCHEME")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
        isCoreLibraryDesugaringEnabled = false
    }

    buildTypes {
        debug { isMinifyEnabled = false }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

dependencies {
    implementation(libs.appauth)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    // org.json.JSONObject is part of the Android framework (android.jar) but stubbed
    // out in pure-JVM unit tests. The standalone Apache org.json JAR provides a
    // working implementation for unit tests; production code uses the framework one.
    testImplementation(libs.org.json)
}
