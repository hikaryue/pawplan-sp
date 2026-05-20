export default {
  "expo": {
    "name": "PawPlan",
    "slug": "PawPlan",
    "owner": "zullityfr",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "pawplan",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.hikaryue.PawPlan",
      "infoPlist": {
        "UIBackgroundModes": ["fetch", "remote-notification"]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "permissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "android.permission.WAKE_LOCK"
      ],
      "package": "com.hikaryue.PawPlan",
      "googleServicesFile": "./google-services.json"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "color": "#ffffff",
          "defaultChannel": "vaccine-reminders"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "The app accesses your photos to let you share them with your friends."
        }
      ],
      "@react-native-community/datetimepicker",
      "expo-font"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "apiUrl": process.env.API_URL,
      "firebaseKey": process.env.FIREBASE_KEY,
      "router": {},
      "eas": {
        "projectId": "71fed14b-7309-4924-be45-5396df772822"
      }
    }
  }
};