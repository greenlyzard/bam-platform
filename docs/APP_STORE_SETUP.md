# App Store Setup — Capacitor Native Wrapper

Guide for wrapping the BAM portal as a native iOS and Android app using Capacitor.

## Prerequisites

- Node.js 18+
- Xcode 15+ (for iOS builds)
- Android Studio Hedgehog or later (for Android builds)
- Apple Developer account ($99/year) — enrolled at [developer.apple.com](https://developer.apple.com)
- Google Play Developer account ($25 one-time) — enrolled at [play.google.com/console](https://play.google.com/console)
- Firebase project (for Android push notifications via FCM)

## 1. Install Capacitor

From the project root:

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/push-notifications @capacitor/splash-screen @capacitor/status-bar
```

## 2. Initialize Capacitor

```bash
npx cap init "Ballet Academy and Movement" "com.greenlyzard.bam"
```

This creates `capacitor.config.ts` in the project root.

## 3. Configure capacitor.config.ts

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.greenlyzard.bam",
  appName: "Ballet Academy and Movement",
  webDir: "out",
  server: {
    // For development, point to your local Next.js server:
    // url: "http://192.168.1.XXX:3000",
    // For production, leave commented to use the bundled web assets,
    // or point to the production URL:
    url: "https://portal.balletacademyandmovement.com",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#FAF8F3",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FAF8F3",
    },
  },
};

export default config;
```

## 4. Add Native Platforms

```bash
npx cap add ios
npx cap add android
```

This creates `ios/` and `android/` directories. Add both to `.gitignore` if you prefer to regenerate them, or commit them for reproducible builds.

## 5. Build the Web App

Before syncing to native, build the Next.js app:

```bash
# If using server-side URL (production mode):
# No build needed — Capacitor loads from the server URL.

# If bundling static assets (offline mode):
npm run build
npx next export  # outputs to "out/" directory
npx cap sync
```

For the BAM platform (server-rendered Next.js), use the server URL approach. The app loads from `portal.balletacademyandmovement.com` inside a native WebView.

## 6. iOS Configuration

### Bundle Identifier

Open `ios/App/App.xcodeproj` in Xcode. Set:

- **Bundle Identifier:** `com.greenlyzard.bam`
- **Display Name:** Ballet Academy and Movement
- **Deployment Target:** iOS 16.0+
- **Team:** Select your Apple Developer team

### Push Notifications (APNs)

1. In Xcode, go to **Signing & Capabilities** > **+ Capability** > **Push Notifications**
2. Also add **Background Modes** > check **Remote notifications**
3. In Apple Developer portal, create an APNs key:
   - Go to **Keys** > **Create a Key**
   - Enable **Apple Push Notifications service (APNs)**
   - Download the `.p8` file — store securely, you cannot re-download it
4. Note the **Key ID** and your **Team ID**
5. Configure your server (Supabase Edge Function or API route) with the APNs key

### App Icons and Splash Screen

Place app icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`. Required sizes:

- 1024x1024 (App Store)
- 180x180 (iPhone @3x)
- 120x120 (iPhone @2x)
- 167x167 (iPad Pro @2x)
- 152x152 (iPad @2x)

Use the BAM logo on cream (#FAF8F3) background. Generate all sizes with a tool like [appicon.co](https://appicon.co).

### Safe Area and Notch Handling

The web app already uses `pb-[env(safe-area-inset-bottom)]` in the mobile bottom nav. Ensure the viewport meta tag in `app/layout.tsx` includes:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

## 7. Android Configuration

### Package Name

Edit `android/app/build.gradle`:

```groovy
android {
    namespace "com.greenlyzard.bam"
    defaultConfig {
        applicationId "com.greenlyzard.bam"
        minSdkVersion 24
        targetSdkVersion 34
    }
}
```

### Firebase Cloud Messaging (FCM)

1. Go to [Firebase Console](https://console.firebase.google.com) > Create or select project
2. Add an Android app with package name `com.greenlyzard.bam`
3. Download `google-services.json` and place in `android/app/`
4. Firebase Gradle plugin is already included by Capacitor

### App Icons

Place icons in `android/app/src/main/res/mipmap-*` directories:

- `mipmap-mdpi`: 48x48
- `mipmap-hdpi`: 72x72
- `mipmap-xhdpi`: 96x96
- `mipmap-xxhdpi`: 144x144
- `mipmap-xxxhdpi`: 192x192

Use Android Studio's Image Asset tool for adaptive icons.

## 8. Push Notification Integration

The web app already handles push subscription in the notification preferences page. For native push via Capacitor:

```typescript
// lib/capacitor-push.ts
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export async function initNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    // Send native device token to your server
    await fetch("/api/push/subscribe-native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: Capacitor.getPlatform(), // "ios" or "android"
        token: token.value,
      }),
    });
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    // Handle foreground notification
    console.log("Push received:", notification);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    // Handle notification tap — navigate to relevant page
    const data = action.notification.data;
    if (data?.url) {
      window.location.href = data.url;
    }
  });
}
```

Call `initNativePush()` in your root layout or app initialization.

## 9. Building for Release

### iOS

```bash
npx cap sync ios
npx cap open ios
```

In Xcode:
1. Select **Any iOS Device** as build target
2. **Product** > **Archive**
3. In Organizer, click **Distribute App** > **App Store Connect**
4. Upload and submit for review in App Store Connect

### Android

```bash
npx cap sync android
npx cap open android
```

In Android Studio:
1. **Build** > **Generate Signed Bundle / APK**
2. Select **Android App Bundle (.aab)**
3. Create or select a keystore (store securely — you need it for every update)
4. Upload the `.aab` to Google Play Console

## 10. App Store Submission Checklist

### Apple App Store

- [ ] App name: "Ballet Academy and Movement"
- [ ] Subtitle: "Classical Ballet Training"
- [ ] Category: Education (primary), Health & Fitness (secondary)
- [ ] Screenshots: 6.7" (iPhone 15 Pro Max), 6.5" (iPhone 14), 12.9" (iPad Pro)
- [ ] Privacy Policy URL: `https://balletacademyandmovement.com/privacy`
- [ ] App Privacy: declare data collection (email, name, push tokens, usage analytics)
- [ ] Review notes: provide a test account for Apple reviewers
- [ ] Age rating: 4+ (no objectionable content)

### Google Play Store

- [ ] App name: "Ballet Academy and Movement"
- [ ] Short description (80 chars): "Classical ballet training for students of all levels"
- [ ] Full description (4000 chars): studio overview, features, class info
- [ ] Feature graphic: 1024x500
- [ ] Screenshots: phone + 7" tablet + 10" tablet
- [ ] Content rating: complete the IARC questionnaire
- [ ] Privacy Policy URL (required)
- [ ] Target audience: General (not children-directed to avoid COPPA complexity)

## 11. Post-Launch

### Over-the-Air Updates

Since the app loads from a server URL, web updates deploy instantly without app store review. Only native-layer changes (new Capacitor plugins, splash screen, icons) require a new app store build.

### Monitoring

- Use Firebase Crashlytics for native crash reporting
- Monitor WebView performance with Vercel Analytics (already integrated)
- Track app installs and ratings in App Store Connect / Google Play Console

### Version Strategy

- Semantic versioning: `MAJOR.MINOR.PATCH`
- Increment `MINOR` for new Capacitor plugins or native features
- Increment `PATCH` for config changes (icons, splash, metadata)
- Web features do not require version bumps since they load from the server

### Deep Linking

Configure universal links (iOS) and app links (Android) so that `portal.balletacademyandmovement.com` URLs open in the native app when installed:

**iOS** — add to `ios/App/App/App.entitlements`:
```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:portal.balletacademyandmovement.com</string>
</array>
```

**Android** — add to `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="portal.balletacademyandmovement.com" />
</intent-filter>
```

Host a `.well-known/apple-app-site-association` and `.well-known/assetlinks.json` on the production domain to complete the verification.
