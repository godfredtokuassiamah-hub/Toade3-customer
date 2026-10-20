import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { colors, text } from "../../theme";

// TODO(account): placeholder until the Account tab is designed.
export default function Account() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={text.title} accessibilityRole="header">
        Account
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
