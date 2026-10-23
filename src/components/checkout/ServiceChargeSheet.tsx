// Service-charge explainer: compact info sheet opened from the checkout
// summary's "Service charge" help button.
import { InfoSheet } from "./InfoSheet";

// Icons8 illustration (img.icons8.com id 3tassueOr44a). Icons8 requires
// attribution or a paid licence before release.
const SERVICE_CHARGE_ILLUSTRATION = require("../../../assets/icons/checkout/service-charge.png");

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ServiceChargeSheet({ visible, onClose }: Props) {
  return (
    <InfoSheet
      visible={visible}
      onClose={onClose}
      illustration={SERVICE_CHARGE_ILLUSTRATION}
      title="Service charge"
      message="A small fee that keeps Toade3 running."
    />
  );
}
