import { TargetAndTransition, Variants } from "framer-motion";

export const MOTION_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const pageRevealVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: MOTION_EASE,
      when: "beforeChildren",
      staggerChildren: 0.08,
    },
  },
};

export const sectionStaggerVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.34,
      ease: MOTION_EASE,
      staggerChildren: 0.05,
    },
  },
};

export const cardRevealVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.992 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: MOTION_EASE,
    },
  },
};

export const ctaPulseAnimation: TargetAndTransition = {
  scale: [1, 1.02, 1],
  boxShadow: [
    "0 0 0 rgba(0,0,0,0)",
    "0 0 20px rgba(16, 216, 231, 0.24)",
    "0 0 0 rgba(0,0,0,0)",
  ],
};

export const ctaPulseTransition = {
  duration: 2.2,
  ease: "easeInOut",
  repeat: Infinity,
  repeatDelay: 0.8,
};
