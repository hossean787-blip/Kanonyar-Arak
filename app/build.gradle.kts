plugins { id("com.android.application") }

// AndroidX Biometric 1.1 pulls old Kotlin JDK7/8 compatibility artifacts;
// resolve all stdlib variants to a single merged Kotlin release to avoid
// duplicate runtime classes. No Kotlin compiler plugin is used in this app.
configurations.configureEach {
    resolutionStrategy.force(
        "org.jetbrains.kotlin:kotlin-stdlib:1.8.22",
        "org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22",
        "org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22"
    )
}

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

// Firebase Android identifiers are public. The server private key is NEVER used here.
fun publicFirebaseField(env: String): String {
    val value = System.getenv(env) ?: ""
    return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}
android {\n    buildFeatures { buildConfig = true }
    namespace = "ir.kanonha.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "ir.kanonha.app"  // Do not change: preserves installed app identity.
        minSdk = 26
        targetSdk = 35
        versionCode = 44
        versionName = "0.9.31-fcm-prepared"
        manifestPlaceholders["appLabel"] = "کانون‌ها"
        buildConfigField("String", "FCM_PROJECT_ID", publicFirebaseField("KANONHA_FCM_PROJECT_ID"))
        buildConfigField("String", "FCM_APP_ID", publicFirebaseField("KANONHA_FCM_APP_ID"))
        buildConfigField("String", "FCM_API_KEY", publicFirebaseField("KANONHA_FCM_API_KEY"))
        buildConfigField("String", "FCM_SENDER_ID", publicFirebaseField("KANONHA_FCM_SENDER_ID"))
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
        getByName("debug") {
            // Keep the existing installed production app and its local data untouched.
            applicationIdSuffix = ".test"
            manifestPlaceholders["appLabel"] = "کانون‌ها آزمایشی"
        }
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
    implementation(platform("com.google.firebase:firebase-bom:35.1.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core:1.15.0")
    implementation("androidx.fragment:fragment:1.7.1")
    implementation("androidx.biometric:biometric:1.1.0")
}
