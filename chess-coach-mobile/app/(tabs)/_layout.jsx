import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { palette } from "../../src/components/PremiumUI";

const tabs = {
  dashboard: ["Dashboard", "view-dashboard"],
  games: ["Games", "chess-knight"],
  training: ["Training", "target"],
  coach: ["Coach", "account-tie-voice"],
  puzzles: ["Puzzles", "puzzle"],
  profile: ["Profile", "account-circle"],
};

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.gold,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "900",
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: palette.paper,
          borderColor: palette.line,
          borderRadius: 8,
          borderTopWidth: 1,
          bottom: Platform.OS === "web" ? 12 : 8,
          height: 72,
          left: 10,
          paddingBottom: Platform.OS === "ios" ? 15 : 9,
          paddingHorizontal: 4,
          paddingTop: 7,
          position: "absolute",
          right: 10,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.14,
          shadowRadius: 22,
          elevation: 10,
        },
        tabBarItemStyle: {
          borderRadius: 8,
          minWidth: 48,
        },
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
