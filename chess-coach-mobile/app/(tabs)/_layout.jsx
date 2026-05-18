import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "../../src/components/PremiumUI";

const tabs = {
  dashboard: ["Dashboard", "view-dashboard"],
  games: ["Games", "chess-knight"],
  training: ["Training", "target"],
  coach: ["Coach", "account-tie-voice"],
  puzzles: ["Puzzles", "puzzle"],
  profile: ["Profile", "account-circle"],
};

function GlassTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const indicator = useRef(new Animated.Value(state.index)).current;
  const pressScales = useRef(state.routes.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.spring(indicator, {
      toValue: state.index,
      damping: 20,
      mass: 0.75,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  }, [indicator, state.index]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  const sideInset = Platform.OS === "web" ? 12 : 12;
  const barPadding = 7;
  const routeCount = state.routes.length;
  const itemWidth = barWidth > 0 ? (barWidth - barPadding * 2) / routeCount : 0;
  const indicatorWidth = Math.max(48, itemWidth - 8);
  const indicatorTranslateX = indicator.interpolate({
    inputRange: state.routes.map((_, index) => index),
    outputRange: state.routes.map((_, index) => barPadding + index * itemWidth + (itemWidth - indicatorWidth) / 2),
  });

  const animatePress = (index, toValue) => {
    Animated.spring(pressScales[index], {
      toValue,
      damping: 16,
      mass: 0.6,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View
      style={[
        styles.tabShell,
        {
          bottom: Platform.OS === "web" ? 12 : Math.max(10, insets.bottom + 2),
          left: sideInset,
          right: sideInset,
        },
      ]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {itemWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeLiquid,
            {
              transform: [{ translateX: indicatorTranslateX }],
              width: indicatorWidth,
            },
          ]}
        />
      ) : null}

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const [label, icon] = tabs[route.name] || tabs.dashboard;
        const focused = state.index === index;
        const color = focused ? palette.gold : palette.muted;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            android_ripple={{ color: "rgba(255,255,255,0.08)", borderless: false }}
            onPress={onPress}
            onPressIn={() => animatePress(index, 0.92)}
            onPressOut={() => animatePress(index, 1)}
            style={styles.tabItem}
          >
            <Animated.View style={[styles.tabInner, { transform: [{ scale: pressScales[index] }] }]}>
              <MaterialCommunityIcons name={icon} size={22} color={color} />
              <Text numberOfLines={1} style={[styles.tabLabel, { color }]}>
                {options.title || label}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.gold,
        tabBarInactiveTintColor: palette.muted,
        tabBarIcon: ({ color, size }) => {
          const [, icon] = tabs[route.name] || tabs.dashboard;

          return <MaterialCommunityIcons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: tabs.dashboard[0] }} />
      <Tabs.Screen name="games" options={{ title: tabs.games[0] }} />
      <Tabs.Screen name="training" options={{ title: tabs.training[0] }} />
      <Tabs.Screen name="coach" options={{ title: tabs.coach[0] }} />
      <Tabs.Screen name="puzzles" options={{ title: tabs.puzzles[0] }} />
      <Tabs.Screen name="profile" options={{ title: tabs.profile[0] }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    alignItems: "center",
    backgroundColor: Platform.OS === "ios" ? "rgba(24,27,34,0.78)" : "rgba(24,27,34,0.92)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 24,
    borderWidth: 1,
    elevation: 14,
    flexDirection: "row",
    height: Platform.OS === "ios" ? 76 : 70,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingTop: Platform.OS === "ios" ? 8 : 7,
    paddingBottom: Platform.OS === "ios" ? 16 : 8,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },
  activeLiquid: {
    backgroundColor: "rgba(215,179,90,0.16)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    borderWidth: 1,
    bottom: Platform.OS === "ios" ? 10 : 8,
    position: "absolute",
    top: 7,
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "center",
    zIndex: 1,
  },
  tabInner: {
    alignItems: "center",
    gap: 3,
    justifyContent: "center",
    minWidth: 44,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
