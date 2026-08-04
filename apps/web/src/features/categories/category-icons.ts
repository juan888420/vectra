import { CATEGORY_ICON_NAMES, DEFAULT_CATEGORY_ICON, type CategoryIcon } from "@vectra/types";
import {
  Banknote,
  Bike,
  Book,
  Briefcase,
  Building2,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Dog,
  Droplet,
  Dumbbell,
  Film,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Headphones,
  HeartPulse,
  House,
  Laptop,
  Lightbulb,
  Monitor,
  Music,
  Package,
  Palette,
  Pill,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Tag,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// The only place that binds the icon vocabulary from @vectra/types to actual
// components, so neither the types package nor the API depends on lucide.
// Typed as a total Record: adding a name to CATEGORY_ICON_NAMES without a
// component here is a compile error, not a blank square at runtime.
const CATEGORY_ICON_COMPONENTS: Record<CategoryIcon, LucideIcon> = {
  tag: Tag,
  house: House,
  lightbulb: Lightbulb,
  wifi: Wifi,
  droplet: Droplet,
  flame: Flame,
  utensils: Utensils,
  coffee: Coffee,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  car: Car,
  bus: Bus,
  plane: Plane,
  fuel: Fuel,
  bike: Bike,
  "heart-pulse": HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  stethoscope: Stethoscope,
  "gamepad-2": Gamepad2,
  music: Music,
  film: Film,
  tv: Tv,
  book: Book,
  palette: Palette,
  laptop: Laptop,
  smartphone: Smartphone,
  monitor: Monitor,
  headphones: Headphones,
  wallet: Wallet,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  banknote: Banknote,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
  "building-2": Building2,
  "graduation-cap": GraduationCap,
  shirt: Shirt,
  dog: Dog,
  gift: Gift,
  wrench: Wrench,
  package: Package,
};

/** Falls back instead of returning undefined: an icon id retired from the
 * vocabulary must never break a category that still references it. */
export function categoryIcon(icon: string): LucideIcon {
  return (
    CATEGORY_ICON_COMPONENTS[icon as CategoryIcon] ??
    CATEGORY_ICON_COMPONENTS[DEFAULT_CATEGORY_ICON]
  );
}

/** Picker order, straight from the shared vocabulary so the two never drift. */
export const CATEGORY_ICON_OPTIONS: readonly CategoryIcon[] = CATEGORY_ICON_NAMES;
