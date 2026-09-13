// Icon font loader for Expo apps. Fonts are loaded from the local node_modules
// package under Expo Go (StoreClient) — where @expo/vector-icons' .ttf files
// come back as 0 bytes from Metro's asset resolver on Android.
// Native dev/prod builds and web pass an empty map so useFonts resolves to
// [true, null] immediately via react-native-vector-icons autolinking / web stubs.
// Usage: const [loaded, error] = useIconFonts();

import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";

// Statically require every .ttf so Metro can bundle them without a network call.
const localFontMap = {
  anticon: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.ttf"),
  entypo: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.ttf"),
  evilicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/EvilIcons.ttf"),
  feather: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf"),
  FontAwesome: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf"),
  Fontisto: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Fontisto.ttf"),
  foundation: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Foundation.ttf"),
  ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  "material-community": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf"),
  material: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf"),
  octicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Octicons.ttf"),
  "simple-line-icons": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/SimpleLineIcons.ttf"),
  zocial: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Zocial.ttf"),
  "FontAwesome5Free-Regular": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.ttf"),
  "FontAwesome5Free-Solid": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.ttf"),
  "FontAwesome5Free-Brand": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.ttf"),
  "FontAwesome6Free-Regular": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Regular.ttf"),
  "FontAwesome6Free-Solid": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Solid.ttf"),
  "FontAwesome6Free-Brand": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Brands.ttf"),
};

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts(
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? localFontMap
      : {},
  );
