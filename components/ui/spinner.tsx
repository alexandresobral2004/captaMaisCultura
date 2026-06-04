import React from "react"
import { cn } from "@/lib/utils"

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
}

const Spinner: React.FC<SpinnerProps> = ({ className, size = "md", ...props }) => {
  return (
    <div
      className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-gray-600", sizeClasses[size], className)}
      {...props}
    />
  )
}

Spinner.displayName = "Spinner"

export { Spinner }