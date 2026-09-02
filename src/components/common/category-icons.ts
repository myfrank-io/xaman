import {
  BatteryChargingIcon,
  BedDoubleIcon,
  CableIcon,
  CircleDotIcon,
  CogIcon,
  CompassIcon,
  ContainerIcon,
  DropletsIcon,
  FuelIcon,
  GaugeIcon,
  HammerIcon,
  LifeBuoyIcon,
  PackageIcon,
  PlugIcon,
  RadarIcon,
  RefrigeratorIcon,
  ShipIcon,
  ShipWheelIcon,
  ThermometerIcon,
  WavesIcon,
  WindIcon,
  WrenchIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

// `boat_categories.icon` holds a kebab-case lucide name. The picker offers this
// closed list only (art-direction §5.3): a free text field would break rendering.
// `anchor` and `sailboat` are deliberately absent: they belong to the navigation
// (Sorties de l'eau, Bateau) and must not mean two things at once.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cog: CogIcon,
  "ship-wheel": ShipWheelIcon,
  wind: WindIcon,
  ship: ShipIcon,
  radar: RadarIcon,
  zap: ZapIcon,
  droplets: DropletsIcon,
  "life-buoy": LifeBuoyIcon,
  fuel: FuelIcon,
  "battery-charging": BatteryChargingIcon,
  wrench: WrenchIcon,
  hammer: HammerIcon,
  thermometer: ThermometerIcon,
  gauge: GaugeIcon,
  plug: PlugIcon,
  cable: CableIcon,
  container: ContainerIcon,
  package: PackageIcon,
  "bed-double": BedDoubleIcon,
  refrigerator: RefrigeratorIcon,
  waves: WavesIcon,
  compass: CompassIcon,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || CircleDotIcon;
}
