import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { colors, text } from "../../theme";

// TODO(explore): placeholder until the Explore tab is designed.
export default function Explore() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={text.title} accessibilityRole="header">
        Explore
      </Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  subtitle: {
    ...text.subtitle,
    marginTop: 6,
  },
});
