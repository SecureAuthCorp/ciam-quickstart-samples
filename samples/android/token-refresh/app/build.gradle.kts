import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun localProp(key: String): String = localProps.getProperty(key, "")

android {
    namespace = "com.secureauth.quickstart"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.secureauth.quickstart.android.refresh"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "CIAM_CLIENT_ID",       "\"${localProp("CLIENT_ID")}\"")
        buildConfigField("String", "CIAM_ISSUER_HOST",     "\"${localProp("ISSUER_HOST")}\"")
        buildConfigField("String", "CIAM_ISSUER_PATH",     "\"${localProp("ISSUER_PATH")}\"")
        buildConfigField("String", "CIAM_REDIRECT_SCHEME", "\"${localProp("REDIRECT_SCHEME")}\"")
        buildConfigField("String", "CIAM_SCOPES",          "\"${localProp("SCOPES")}\"")

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

    // Robolectric needs Android resources accessible from JVM unit tests.
    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation(libs.appauth)
    implementation(libs.androidx.security.crypto)

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
    // Robolectric provides a host-JVM Android runtime including the Keystore so
    // EncryptedSharedPreferences works in unit tests without an emulator.
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
}
