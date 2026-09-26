import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            AudioTour
          </Text>
          <Text style={styles.subtitle}>Khám phá hành trình theo cách của bạn</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FDF9",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#173B2A",
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#456253",
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
  },
});