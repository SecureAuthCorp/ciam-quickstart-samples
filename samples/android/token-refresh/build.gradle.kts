// Top-level build file — sub-modules apply the plugins they need.
// Versions are pulled from gradle/libs.versions.toml.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
}
