import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { colors, text } from "../../theme";

// TODO(orders): placeholder until the Orders tab is designed.
export default function Orders() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={text.title} accessibilityRole="header">
        Orders
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
