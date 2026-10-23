// Rider-wages explainer: compact info sheet opened from the checkout
// "Support for fair rider wages" help button.
import { InfoSheet } from "./InfoSheet";

// Icons8 illustration (img.icons8.com id IqOjfaWLBgco). Icons8 requires
// attribution or a paid licence before release.
const RIDER_WAGES_ILLUSTRATION = require("../../../assets/icons/checkout/rider-wages.png");

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function RiderWagesSheet({ visible, onClose }: Props) {
  return (
    <InfoSheet
      visible={visible}
      onClose={onClose}
      illustration={RIDER_WAGES_ILLUSTRATION}
      title="Fair rider wages"
      message="Everything you add here goes straight to your rider, on top of their delivery earnings."
    />
  );
}
