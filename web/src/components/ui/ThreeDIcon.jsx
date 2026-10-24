import React from 'react';

/**
 * ThreeDIcon renders rich isometric 3D icons with volumetric lighting,
 * specular gradients, and gentle floating micro-animations.
 */
export const ThreeDIcon = ({
  name = 'students',
  size = 48,
  className = '',
  animate = true,
  glow = true,
}) => {
  const isAnimate = animate ? 'animate-float-3d' : '';
  const filterGlow = glow ? 'drop-shadow(0 8px 16px rgba(99, 102, 241, 0.25))' : '';

  switch (name) {
    case 'students':
    case 'users':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-stu-base" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="50%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#312E81" />
            </linearGradient>
            <linearGradient id="g-stu-cap" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C7D2FE" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="g-stu-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          {/* Base 3D Torso Cylinder */}
          <path d="M12 46 C12 36, 20 32, 32 32 C44 32, 52 36, 52 46 L52 52 C52 57, 44 60, 32 60 C20 60, 12 57, 12 52 Z" fill="url(#g-stu-base)" />
          {/* Torso Top Ellipse */}
          <ellipse cx="32" cy="46" rx="20" ry="8" fill="url(#g-stu-cap)" opacity="0.6" />
          {/* 3D Head Sphere */}
          <circle cx="32" cy="22" r="14" fill="url(#g-stu-base)" />
          <ellipse cx="28" cy="18" rx="6" ry="4" fill="#FFFFFF" opacity="0.35" />
          {/* 3D Mortarboard Cap */}
          <path d="M32 4 L56 14 L32 24 L8 14 Z" fill="#1E1B4B" />
          <path d="M32 6 L52 14 L32 22 L12 14 Z" fill="url(#g-stu-cap)" />
          {/* Tassel */}
          <circle cx="32" cy="14" r="2.5" fill="url(#g-stu-gold)" />
          <path d="M32 14 Q46 16 46 26" stroke="url(#g-stu-gold)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <rect x="44" y="26" width="4" height="6" rx="1.5" fill="url(#g-stu-gold)" />
        </svg>
      );

    case 'fees':
    case 'money':
    case 'finance':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-coin-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="45%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#854D0E" />
            </linearGradient>
            <linearGradient id="g-coin-edge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CA8A04" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#713F12" />
            </linearGradient>
            <linearGradient id="g-coin-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="70%" stopColor="#059669" />
              <stop offset="100%" stopColor="#064E3B" />
            </linearGradient>
          </defs>
          {/* Bottom Coin */}
          <path d="M12 40 C12 34 21 30 32 30 C43 30 52 34 52 40 L52 48 C52 54 43 58 32 58 C21 58 12 54 12 48 Z" fill="url(#g-coin-emerald)" />
          <ellipse cx="32" cy="40" rx="20" ry="8" fill="#10B981" />
          {/* Middle Coin */}
          <path d="M12 30 C12 24 21 20 32 20 C43 20 52 24 52 30 L52 38 C52 44 43 48 32 48 C21 48 12 44 12 38 Z" fill="url(#g-coin-edge)" />
          <ellipse cx="32" cy="30" rx="20" ry="8" fill="url(#g-coin-gold)" />
          {/* Top Coin */}
          <path d="M12 20 C12 14 21 10 32 10 C43 10 52 14 52 20 L52 28 C52 34 43 38 32 38 C21 38 12 34 12 28 Z" fill="url(#g-coin-edge)" />
          <ellipse cx="32" cy="20" rx="20" ry="8" fill="url(#g-coin-gold)" />
          {/* Currency Symbol on top coin */}
          <text x="32" y="24" textAnchor="middle" fontSize="13" fontWeight="900" fill="#713F12" fontFamily="system-ui">$</text>
          <ellipse cx="26" cy="17" rx="7" ry="2.5" fill="#FFFFFF" opacity="0.4" />
        </svg>
      );

    case 'calculator':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-calc-body" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
            <linearGradient id="g-calc-screen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
          </defs>
          {/* 3D Beveled Calculator Body */}
          <rect x="10" y="8" width="44" height="50" rx="10" fill="#0C4A6E" />
          <rect x="10" y="6" width="44" height="50" rx="10" fill="url(#g-calc-body)" />
          {/* Display screen */}
          <rect x="16" y="12" width="32" height="12" rx="4" fill="url(#g-calc-screen)" />
          <text x="44" y="21" textAnchor="end" fontSize="8" fill="#38BDF8" fontFamily="monospace" fontWeight="bold">97,260</text>
          {/* 3D Keypad buttons */}
          <rect x="16" y="28" width="8" height="6" rx="2" fill="#E0F2FE" />
          <rect x="28" y="28" width="8" height="6" rx="2" fill="#E0F2FE" />
          <rect x="40" y="28" width="8" height="6" rx="2" fill="#F59E0B" />

          <rect x="16" y="37" width="8" height="6" rx="2" fill="#E0F2FE" />
          <rect x="28" y="37" width="8" height="6" rx="2" fill="#E0F2FE" />
          <rect x="40" y="37" width="8" height="6" rx="2" fill="#F59E0B" />

          <rect x="16" y="46" width="20" height="6" rx="2" fill="#10B981" />
          <rect x="40" y="46" width="8" height="6" rx="2" fill="#F43F5E" />
          {/* Light Glare */}
          <path d="M12 10 L30 10 L16 34 L12 28 Z" fill="#FFFFFF" opacity="0.2" />
        </svg>
      );

    case 'sciences':
    case 'science':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-sci-core" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0E7490" />
            </linearGradient>
            <linearGradient id="g-sci-ring1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
          {/* 3D Isometric Flask / Atom */}
          <path d="M28 8 L36 8 L36 20 L48 42 C51 47 48 54 42 54 L22 54 C16 54 13 47 16 42 L28 20 Z" fill="#164E63" />
          <path d="M28 6 L36 6 L36 18 L48 40 C51 45 48 52 42 52 L22 52 C16 52 13 45 16 40 L28 18 Z" fill="url(#g-sci-core)" opacity="0.85" />
          {/* Liquid Level */}
          <path d="M20 44 C24 42 30 46 36 43 C40 41 43 43 45 44 L43 50 C41 51 25 51 21 50 Z" fill="#0891B2" />
          {/* Glowing Bubbles */}
          <circle cx="28" cy="36" r="3.5" fill="#A5F3FC" opacity="0.8" />
          <circle cx="36" cy="28" r="2.5" fill="#E0F2FE" opacity="0.9" />
          <circle cx="32" cy="46" r="4" fill="#FFFFFF" opacity="0.6" />
          {/* Electron Orbitals */}
          <ellipse cx="32" cy="32" rx="24" ry="9" stroke="url(#g-sci-ring1)" strokeWidth="2.5" transform="rotate(-30 32 32)" strokeDasharray="6 3" />
          <circle cx="48" cy="22" r="3.5" fill="#C084FC" />
        </svg>
      );

    case 'commercial':
    case 'commercials':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-com-case" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="60%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id="g-com-arrow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          {/* 3D Briefcase Body */}
          <rect x="12" y="24" width="40" height="30" rx="6" fill="#78350F" />
          <rect x="12" y="22" width="40" height="30" rx="6" fill="url(#g-com-case)" />
          {/* Handle */}
          <path d="M26 22 L26 14 C26 12 28 10 32 10 C36 10 38 12 38 14 L38 22" stroke="#B45309" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* Metal Corner Straps */}
          <rect x="18" y="22" width="6" height="30" fill="#92400E" opacity="0.4" />
          <rect x="40" y="22" width="6" height="30" fill="#92400E" opacity="0.4" />
          <rect x="29" y="32" width="6" height="6" rx="1.5" fill="#FDE68A" />
          {/* 3D Trending Arrow Overlay */}
          <path d="M28 46 L38 34 L44 38 L54 22" stroke="url(#g-com-arrow)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="56,22 47,21 54,29" fill="#059669" />
        </svg>
      );

    case 'arts':
    case 'art':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-art-pal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          {/* 3D Palette Shape */}
          <path d="M32 8 C18 8 10 18 10 32 C10 46 20 54 32 54 C36 54 40 50 40 46 C40 43 38 41 38 38 C38 34 42 30 46 30 C52 30 56 36 56 32 C56 16 46 8 32 8 Z" fill="#92400E" />
          <path d="M32 6 C18 6 10 16 10 30 C10 44 20 52 32 52 C36 52 40 48 40 44 C40 41 38 39 38 36 C38 32 42 28 46 28 C52 28 56 34 56 30 C56 14 46 6 32 6 Z" fill="url(#g-art-pal)" />
          {/* Thumbhole */}
          <ellipse cx="44" cy="40" rx="4" ry="5" fill="#78350F" />
          {/* Color Pigments */}
          <circle cx="22" cy="18" r="4.5" fill="#EF4444" />
          <circle cx="34" cy="16" r="4.5" fill="#3B82F6" />
          <circle cx="44" cy="22" r="4.5" fill="#10B981" />
          <circle cx="20" cy="30" r="4.5" fill="#8B5CF6" />
          <circle cx="24" cy="42" r="4.5" fill="#EC4899" />
          {/* Paint brush piercing palette */}
          <path d="M12 56 L52 12" stroke="#451A03" strokeWidth="3" strokeLinecap="round" />
          <path d="M50 14 L56 8 L54 6 L48 12 Z" fill="#E2E8F0" />
        </svg>
      );

    case 'ecd':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-ecd-red" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
            <linearGradient id="g-ecd-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient id="g-ecd-yel" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          {/* Cube 1 (Bottom Left - Red) */}
          <path d="M12 36 L26 28 L40 36 L26 44 Z" fill="#EF4444" />
          <path d="M12 36 L26 44 L26 58 L12 50 Z" fill="#DC2626" />
          <path d="M26 44 L40 36 L40 50 L26 58 Z" fill="#991B1B" />
          <text x="26" y="53" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FFFFFF">A</text>

          {/* Cube 2 (Top - Blue) */}
          <path d="M26 18 L40 10 L54 18 L40 26 Z" fill="#3B82F6" />
          <path d="M26 18 L40 26 L40 40 L26 32 Z" fill="#2563EB" />
          <path d="M40 26 L54 18 L54 32 L40 40 Z" fill="#1D4ED8" />
          <text x="40" y="35" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FFFFFF">B</text>
        </svg>
      );

    case 'primary':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-prim-book" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          {/* 3D Open Book Base */}
          <path d="M8 42 C18 38 28 42 32 46 C36 42 46 38 56 42 L56 22 C46 18 36 22 32 26 C28 22 18 18 8 22 Z" fill="#065F46" />
          <path d="M8 40 C18 36 28 40 32 44 C36 40 46 36 56 40 L56 20 C46 16 36 20 32 24 C28 20 18 16 8 20 Z" fill="url(#g-prim-book)" />
          {/* Pages */}
          <path d="M12 36 C20 32 26 34 31 38 L31 22 C26 18 20 16 12 20 Z" fill="#FFFFFF" opacity="0.9" />
          <path d="M52 36 C44 32 38 34 33 38 L33 22 C38 18 44 16 52 20 Z" fill="#F8FAFC" opacity="0.9" />
          {/* Bookmark Ribbon */}
          <path d="M32 24 L32 48 L28 44 L32 24" fill="#F59E0B" />
        </svg>
      );

    case 'olevel':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-olevel-scroll" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          {/* 3D Rolled Diploma Scroll */}
          <ellipse cx="20" cy="20" rx="8" ry="12" fill="#D97706" />
          <path d="M20 8 L50 20 L50 44 L20 32 Z" fill="url(#g-olevel-scroll)" />
          <ellipse cx="50" cy="32" rx="8" ry="12" fill="#FEF3C7" />
          {/* Red Ribbon with Wax Seal */}
          <path d="M32 15 L38 17 L38 40 L32 38 Z" fill="#EF4444" />
          <circle cx="35" cy="28" r="5" fill="#DC2626" />
          <circle cx="35" cy="28" r="3" fill="#FDE047" />
        </svg>
      );

    case 'alevel':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-alevel-trophy" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#A16207" />
            </linearGradient>
          </defs>
          {/* 3D Pedestal */}
          <rect x="20" y="48" width="24" height="10" rx="3" fill="#1E293B" />
          <rect x="22" y="46" width="20" height="6" rx="2" fill="#475569" />
          {/* Stem */}
          <rect x="29" y="38" width="6" height="10" fill="url(#g-alevel-trophy)" />
          {/* Trophy Cup */}
          <path d="M16 14 C16 32 24 38 32 38 C40 38 48 32 48 14 Z" fill="url(#g-alevel-trophy)" />
          <ellipse cx="32" cy="14" rx="16" ry="6" fill="#FEF08A" />
          {/* Handles */}
          <path d="M16 18 C10 18 10 28 18 30" stroke="#CA8A04" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M48 18 C54 18 54 28 46 30" stroke="#CA8A04" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Star Crest */}
          <polygon points="32,20 34,25 39,25 35,28 37,33 32,30 27,33 29,28 25,25 30,25" fill="#FFFFFF" />
        </svg>
      );

    case 'charts':
    case 'analytics':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          className={`${isAnimate} ${className}`}
          style={{ filter: filterGlow }}
        >
          <defs>
            <linearGradient id="g-bar1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
            <linearGradient id="g-bar2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="g-bar3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#DB2777" />
            </linearGradient>
          </defs>
          {/* 3D Pedestal Base */}
          <path d="M8 50 L32 38 L56 50 L32 60 Z" fill="#1E293B" opacity="0.4" />
          {/* Bar 1 (Left) */}
          <path d="M12 36 L20 32 L20 52 L12 56 Z" fill="#3730A3" />
          <path d="M20 32 L28 36 L28 56 L20 52 Z" fill="url(#g-bar1)" />
          <path d="M12 36 L20 32 L28 36 L20 40 Z" fill="#A5B4FC" />
          {/* Bar 2 (Middle - Tallest) */}
          <path d="M24 16 L32 12 L32 48 L24 52 Z" fill="#065F46" />
          <path d="M32 12 L40 16 L40 52 L32 48 Z" fill="url(#g-bar2)" />
          <path d="M24 16 L32 12 L40 16 L32 20 Z" fill="#6EE7B7" />
          {/* Bar 3 (Right) */}
          <path d="M36 26 L44 22 L44 50 L36 54 Z" fill="#9D174D" />
          <path d="M44 22 L52 26 L52 54 L44 50 Z" fill="url(#g-bar3)" />
          <path d="M36 26 L44 22 L52 26 L44 30 Z" fill="#FBCFE8" />
        </svg>
      );
  }
};

export default ThreeDIcon;
