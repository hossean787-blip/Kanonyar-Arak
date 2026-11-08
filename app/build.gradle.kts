plugins { id("com.android.application") }
android { namespace = "ir.kanonha.app"; compileSdk = 35; defaultConfig { applicationId = "ir.kanonha.app"; minSdk = 26; targetSdk = 35; versionCode = 14; versionName = "0.8.0-multi-role-beta" }; compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 } }
dependencies { implementation("androidx.webkit:webkit:1.12.1"); implementation("androidx.core:core:1.15.0") }
