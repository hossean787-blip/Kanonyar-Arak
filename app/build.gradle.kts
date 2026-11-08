plugins { id("com.android.application") }

// Release keys are NEVER checked into the repository. If all four environment
// variables are absent, :app:assembleRelease creates an UNSIGNED artifact for
// offline signing and validation.
val releaseStorePath = System.getenv("KANONHA_SIGNING_STORE")
val releaseStorePassword = System.getenv("KANONHA_SIGNING_STORE_PASSWORD")
val releaseAlias = System.getenv("KANONHA_SIGNING_ALIAS")
val releaseKeyPassword = System.getenv("KANONHA_SIGNING_KEY_PASSWORD")
val releaseSigningConfigured = listOf(
    releaseStorePath, releaseStorePassword, releaseAlias, releaseKeyPassword
).all { !it.isNullOrBlank() }

android {
    namespace = "ir.kanonha.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "ir.kanonha.app"  // Do not change: preserves installed app identity.
        minSdk = 26
        targetSdk = 35
        versionCode = 16
        versionName = "0.9.1-release-rc1"
    }
    signingConfigs {
        if (releaseSigningConfigured) {
            create("projectRelease") {
                storeFile = file(releaseStorePath!!)
                storePassword = releaseStorePassword!!
                keyAlias = releaseAlias!!
                keyPassword = releaseKeyPassword!!
            }
        }
    }
    buildTypes {
        getByName("release") {
            isDebuggable = false
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("projectRelease")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core:1.15.0")
}
