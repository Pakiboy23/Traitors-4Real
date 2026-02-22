import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { pageRevealVariants } from "../motion";

interface PremiumShellProps {
  children: React.ReactNode;
  className?: string;
}

const PremiumShell: React.FC<PremiumShellProps> = ({ children, className }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      {children}
    </motion.div>
  );
};

export default PremiumShell;
