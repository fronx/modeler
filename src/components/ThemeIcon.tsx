'use client';

import React from 'react';
import Image from 'next/image';

interface ThemeIconProps {
  name: string;
  size?: number;
  className?: string;
  alt?: string;
}

// Icon mapping with light and dark variants
const iconMap: Record<string, { light: string; dark: string }> = {
  trash: {
    light: '/noun-trash-6826270.svg', // Black trash for light theme
    dark: '/noun-trash-6826270-FFFFFF.svg', // White trash for dark theme
  },
  // Add more icons here as needed
};

export const ThemeIcon: React.FC<ThemeIconProps> = ({
  name,
  size = 16,
  className = '',
  alt
}) => {
  const iconConfig = iconMap[name];

  if (!iconConfig) {
    console.warn(`Icon "${name}" not found in icon map`);
    return null;
  }

  return (
    <>
      {/* Light theme icon (hidden in dark mode) */}
      <Image
        src={iconConfig.light}
        alt={alt || `${name} icon`}
        width={size}
        height={size}
        className={`dark:hidden ${className}`}
      />

      {/* Dark theme icon (hidden in light mode) */}
      <Image
        src={iconConfig.dark}
        alt={alt || `${name} icon`}
        width={size}
        height={size}
        className={`hidden dark:block ${className}`}
      />
    </>
  );
};