import React, { useContext } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthContext } from "../context/AuthContext";
import { LoadingState, palette } from "../components/PremiumUI";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import GamesScreen from "../screens/GamesScreen";
import DailyTrainingScreen from "../screens/DailyTrainingScreen";
import MistakeReplayScreen from "../screens/MistakeReplayScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { loading, isAuthenticated } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ backgroundColor: palette.ivory, flex: 1, justifyContent: "center" }}>
        <LoadingState panel={false} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Games" component={GamesScreen} />
            <Stack.Screen name="DailyTraining" component={DailyTrainingScreen} />
            <Stack.Screen name="MistakeReplay" component={MistakeReplayScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
