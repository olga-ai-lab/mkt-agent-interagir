import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { 
      delay: i * 0.05, 
      duration: 0.4,
      ease: "easeOut"
    }
  }),
  hover: { 
    y: -8, 
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

interface AnimatedCardProps {
  children: ReactNode;
  index?: number;
  className?: string;
  enableHover?: boolean;
}

export function AnimatedCard({ 
  children, 
  index = 0, 
  className,
  enableHover = true 
}: AnimatedCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={enableHover ? "hover" : undefined}
      whileTap={enableHover ? { scale: 0.98 } : undefined}
      custom={index}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const MotionDiv = motion.div;
