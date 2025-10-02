/**
 * Theme definitions for the application
 * This file contains all the predefined themes
 */

import { createThemeFromCSS } from './theme-utils';

/**
 * Default theme (current theme)
 */
export const defaultTheme = createThemeFromCSS(
  'default',
  'Default',
  `
  --background: oklch(1 0 0);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.6231 0.188 259.8145);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.967 0.0029 264.5419);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9846 0.0017 247.8389);
  --muted-foreground: oklch(0.551 0.0234 264.3637);
  --accent: oklch(0.9514 0.025 236.8242);
  --accent-foreground: oklch(0.3791 0.1378 265.5222);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.9276 0.0058 264.5313);
  --input: oklch(0.9276 0.0058 264.5313);
  --ring: oklch(0.6231 0.188 259.8145);
  --chart-1: oklch(0.6231 0.188 259.8145);
  --chart-2: oklch(0.5461 0.2152 262.8809);
  --chart-3: oklch(0.4882 0.2172 264.3763);
  --chart-4: oklch(0.4244 0.1809 265.6377);
  --chart-5: oklch(0.3791 0.1378 265.5222);
  --sidebar: oklch(0.9846 0.0017 247.8389);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.6231 0.188 259.8145);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.9514 0.025 236.8242);
  --sidebar-accent-foreground: oklch(0.3791 0.1378 265.5222);
  --sidebar-border: oklch(0.9276 0.0058 264.5313);
  --sidebar-ring: oklch(0.6231 0.188 259.8145);
  --radius: 0.5rem;
  `,
  'The default OpenU theme',
);

/**
 * Black theme - minimalistic black and white theme
 */
export const blackTheme = createThemeFromCSS(
  'black',
  'Black',
  `
  --background: oklch(1 0 0);
  --foreground: oklch(0.1450 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.1450 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.1450 0 0);
  --primary: oklch(0.2050 0 0);
  --primary-foreground: oklch(0.9850 0 0);
  --secondary: oklch(0.9700 0 0);
  --secondary-foreground: oklch(0.2050 0 0);
  --muted: oklch(0.9700 0 0);
  --muted-foreground: oklch(0.5560 0 0);
  --accent: oklch(0.9700 0 0);
  --accent-foreground: oklch(0.2050 0 0);
  --destructive: oklch(0.5770 0.2450 27.3250);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.9220 0 0);
  --input: oklch(0.9220 0 0);
  --ring: oklch(0.7080 0 0);
  --chart-1: oklch(0.8100 0.1000 252);
  --chart-2: oklch(0.6200 0.1900 260);
  --chart-3: oklch(0.5500 0.2200 263);
  --chart-4: oklch(0.4900 0.2200 264);
  --chart-5: oklch(0.4200 0.1800 266);
  --sidebar: oklch(0.9850 0 0);
  --sidebar-foreground: oklch(0.1450 0 0);
  --sidebar-primary: oklch(0.2050 0 0);
  --sidebar-primary-foreground: oklch(0.9850 0 0);
  --sidebar-accent: oklch(0.9700 0 0);
  --sidebar-accent-foreground: oklch(0.2050 0 0);
  --sidebar-border: oklch(0.9220 0 0);
  --sidebar-ring: oklch(0.7080 0 0);
  --radius: 0.625rem;
  `,
  'Minimalistic black and white theme',
);

/**
 * Amber Minimal theme
 */
export const amberMinimalTheme = createThemeFromCSS(
  'amberminimal',
  'Amber Minimal',
  `
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0.2686 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.2686 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.2686 0 0);
  --primary: oklch(0.7686 0.1647 70.0804);
  --primary-foreground: oklch(0 0 0);
  --secondary: oklch(0.9670 0.0029 264.5419);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9846 0.0017 247.8389);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9869 0.0214 95.2774);
  --accent-foreground: oklch(0.4732 0.1247 46.2007);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9276 0.0058 264.5313);
  --input: oklch(0.9276 0.0058 264.5313);
  --ring: oklch(0.7686 0.1647 70.0804);
  --chart-1: oklch(0.7686 0.1647 70.0804);
  --chart-2: oklch(0.6658 0.1574 58.3183);
  --chart-3: oklch(0.5553 0.1455 48.9975);
  --chart-4: oklch(0.4732 0.1247 46.2007);
  --chart-5: oklch(0.4137 0.1054 45.9038);
  --sidebar: oklch(0.9846 0.0017 247.8389);
  --sidebar-foreground: oklch(0.2686 0 0);
  --sidebar-primary: oklch(0.7686 0.1647 70.0804);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9869 0.0214 95.2774);
  --sidebar-accent-foreground: oklch(0.4732 0.1247 46.2007);
  --sidebar-border: oklch(0.9276 0.0058 264.5313);
  --sidebar-ring: oklch(0.7686 0.1647 70.0804);
  --radius: 0.375rem;
  `,
  'Minimalistic amber theme',
);

/**
 * Amethyst Haze theme
 */
export const amethystHazeTheme = createThemeFromCSS(
  'amethysthaze',
  'Amethyst Haze',
  `
  --background: oklch(0.9777 0.0041 301.4256);
  --foreground: oklch(0.3651 0.0325 287.0807);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3651 0.0325 287.0807);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3651 0.0325 287.0807);
  --primary: oklch(0.6104 0.0767 299.7335);
  --primary-foreground: oklch(0.9777 0.0041 301.4256);
  --secondary: oklch(0.8957 0.0265 300.2416);
  --secondary-foreground: oklch(0.3651 0.0325 287.0807);
  --muted: oklch(0.8906 0.0139 299.7754);
  --muted-foreground: oklch(0.5288 0.0375 290.7895);
  --accent: oklch(0.7889 0.0802 359.9375);
  --accent-foreground: oklch(0.3394 0.0441 1.7583);
  --destructive: oklch(0.6332 0.1578 22.6734);
  --destructive-foreground: oklch(0.9777 0.0041 301.4256);
  --border: oklch(0.8447 0.0226 300.1421);
  --input: oklch(0.9329 0.0124 301.2783);
  --ring: oklch(0.6104 0.0767 299.7335);
  --chart-1: oklch(0.6104 0.0767 299.7335);
  --chart-2: oklch(0.7889 0.0802 359.9375);
  --chart-3: oklch(0.7321 0.0749 169.8670);
  --chart-4: oklch(0.8540 0.0882 76.8292);
  --chart-5: oklch(0.7857 0.0645 258.0839);
  --sidebar: oklch(0.9554 0.0082 301.3541);
  --sidebar-foreground: oklch(0.3651 0.0325 287.0807);
  --sidebar-primary: oklch(0.6104 0.0767 299.7335);
  --sidebar-primary-foreground: oklch(0.9777 0.0041 301.4256);
  --sidebar-accent: oklch(0.7889 0.0802 359.9375);
  --sidebar-accent-foreground: oklch(0.3394 0.0441 1.7583);
  --sidebar-border: oklch(0.8719 0.0198 302.1690);
  --sidebar-ring: oklch(0.6104 0.0767 299.7335);
  --radius: 0.5rem;
  `,
  'Soft purple haze theme with amethyst accents',
);

/**
 * Bold Tech theme
 */
export const boldTechTheme = createThemeFromCSS(
  'boldtech',
  'Bold Tech',
  `
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0.3588 0.1354 278.6973);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3588 0.1354 278.6973);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3588 0.1354 278.6973);
  --primary: oklch(0.6056 0.2189 292.7172);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9618 0.0202 295.1913);
  --secondary-foreground: oklch(0.4568 0.2146 277.0229);
  --muted: oklch(0.9691 0.0161 293.7558);
  --muted-foreground: oklch(0.5413 0.2466 293.0090);
  --accent: oklch(0.9319 0.0316 255.5855);
  --accent-foreground: oklch(0.4244 0.1809 265.6377);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9299 0.0334 272.7879);
  --input: oklch(0.9299 0.0334 272.7879);
  --ring: oklch(0.6056 0.2189 292.7172);
  --chart-1: oklch(0.6056 0.2189 292.7172);
  --chart-2: oklch(0.5413 0.2466 293.0090);
  --chart-3: oklch(0.4907 0.2412 292.5809);
  --chart-4: oklch(0.4320 0.2106 292.7591);
  --chart-5: oklch(0.3796 0.1783 293.7446);
  --sidebar: oklch(0.9691 0.0161 293.7558);
  --sidebar-foreground: oklch(0.3588 0.1354 278.6973);
  --sidebar-primary: oklch(0.6056 0.2189 292.7172);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9319 0.0316 255.5855);
  --sidebar-accent-foreground: oklch(0.4244 0.1809 265.6377);
  --sidebar-border: oklch(0.9299 0.0334 272.7879);
  --sidebar-ring: oklch(0.6056 0.2189 292.7172);
  --radius: 0.625rem;
  `,
  'Bold purple tech theme with vibrant accents',
);

/**
 * Bubblegum theme
 */
export const bubblegumTheme = createThemeFromCSS(
  'bubblegum',
  'Bubblegum',
  `
  --background: oklch(0.9399 0.0203 345.6985);
  --foreground: oklch(0.4712 0 0);
  --card: oklch(0.9498 0.0500 86.8891);
  --card-foreground: oklch(0.4712 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.4712 0 0);
  --primary: oklch(0.6209 0.1801 348.1385);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8095 0.0694 198.1863);
  --secondary-foreground: oklch(0.3211 0 0);
  --muted: oklch(0.8800 0.0504 212.0952);
  --muted-foreground: oklch(0.5795 0 0);
  --accent: oklch(0.9195 0.0801 87.6670);
  --accent-foreground: oklch(0.3211 0 0);
  --destructive: oklch(0.7091 0.1697 21.9551);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.6209 0.1801 348.1385);
  --input: oklch(0.9189 0 0);
  --ring: oklch(0.7002 0.1597 350.7532);
  --chart-1: oklch(0.7002 0.1597 350.7532);
  --chart-2: oklch(0.8189 0.0799 212.0892);
  --chart-3: oklch(0.9195 0.0801 87.6670);
  --chart-4: oklch(0.7998 0.1110 348.1791);
  --chart-5: oklch(0.6197 0.1899 353.9091);
  --sidebar: oklch(0.9140 0.0424 343.0913);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.6559 0.2118 354.3084);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8228 0.1095 346.0184);
  --sidebar-accent-foreground: oklch(0.3211 0 0);
  --sidebar-border: oklch(0.9464 0.0327 307.1745);
  --sidebar-ring: oklch(0.6559 0.2118 354.3084);
  --radius: 0.4rem;
  `,
  'Playful pink bubblegum theme with flat shadows',
);

/**
 * Caffeine theme
 */
export const caffeineTheme = createThemeFromCSS(
  'caffeine',
  'Caffeine',
  `
  --background: oklch(0.9821 0 0);
  --foreground: oklch(0.2435 0 0);
  --card: oklch(0.9911 0 0);
  --card-foreground: oklch(0.2435 0 0);
  --popover: oklch(0.9911 0 0);
  --popover-foreground: oklch(0.2435 0 0);
  --primary: oklch(0.4341 0.0392 41.9938);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9200 0.0651 74.3695);
  --secondary-foreground: oklch(0.3499 0.0685 40.8288);
  --muted: oklch(0.9521 0 0);
  --muted-foreground: oklch(0.5032 0 0);
  --accent: oklch(0.9310 0 0);
  --accent-foreground: oklch(0.2435 0 0);
  --destructive: oklch(0.6271 0.1936 33.3390);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8822 0 0);
  --input: oklch(0.8822 0 0);
  --ring: oklch(0.4341 0.0392 41.9938);
  --chart-1: oklch(0.4341 0.0392 41.9938);
  --chart-2: oklch(0.9200 0.0651 74.3695);
  --chart-3: oklch(0.9310 0 0);
  --chart-4: oklch(0.9367 0.0523 75.5009);
  --chart-5: oklch(0.4338 0.0437 41.6746);
  --sidebar: oklch(0.9881 0 0);
  --sidebar-foreground: oklch(0.2645 0 0);
  --sidebar-primary: oklch(0.3250 0 0);
  --sidebar-primary-foreground: oklch(0.9881 0 0);
  --sidebar-accent: oklch(0.9761 0 0);
  --sidebar-accent-foreground: oklch(0.3250 0 0);
  --sidebar-border: oklch(0.9401 0 0);
  --sidebar-ring: oklch(0.7731 0 0);
  --radius: 0.5rem;
  `,
  'Warm coffee-inspired theme with rich brown tones',
);

/**
 * Candyland theme
 */
export const candylandTheme = createThemeFromCSS(
  'candyland',
  'Candyland',
  `
   --background: oklch(0.9809 0.0025 228.7836);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.8677 0.0735 7.0855);
  --primary-foreground: oklch(0 0 0);
  --secondary: oklch(0.8148 0.0819 225.7537);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0.8828 0.0285 98.1033);
  --muted-foreground: oklch(0.5382 0 0);
  --accent: oklch(0.9680 0.2110 109.7692);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8699 0 0);
  --input: oklch(0.8699 0 0);
  --ring: oklch(0.8677 0.0735 7.0855);
  --chart-1: oklch(0.8677 0.0735 7.0855);
  --chart-2: oklch(0.8148 0.0819 225.7537);
  --chart-3: oklch(0.9680 0.2110 109.7692);
  --chart-4: oklch(0.8027 0.1355 349.2347);
  --chart-5: oklch(0.7395 0.2268 142.8504);
  --sidebar: oklch(0.9809 0.0025 228.7836);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.8677 0.0735 7.0855);
  --sidebar-primary-foreground: oklch(0 0 0);
  --sidebar-accent: oklch(0.9680 0.2110 109.7692);
  --sidebar-accent-foreground: oklch(0 0 0);
  --sidebar-border: oklch(0.8699 0 0);
  --sidebar-ring: oklch(0.8677 0.0735 7.0855);
  --radius: 0.5rem;
  `,
  'Sweet candy-colored theme with pastel rainbow accents',
);

/**
 * Catppuccin theme
 */
export const catppuccinTheme = createThemeFromCSS(
  'catppuccin',
  'Catppuccin',
  `
  --background: oklch(0.9578 0.0058 264.5321);
  --foreground: oklch(0.4355 0.0430 279.3250);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.4355 0.0430 279.3250);
  --popover: oklch(0.8575 0.0145 268.4756);
  --popover-foreground: oklch(0.4355 0.0430 279.3250);
  --primary: oklch(0.5547 0.2503 297.0156);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8575 0.0145 268.4756);
  --secondary-foreground: oklch(0.4355 0.0430 279.3250);
  --muted: oklch(0.9060 0.0117 264.5071);
  --muted-foreground: oklch(0.5471 0.0343 279.0837);
  --accent: oklch(0.6820 0.1448 235.3822);
  --accent-foreground: oklch(1.0000 0 0);
  --destructive: oklch(0.5505 0.2155 19.8095);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8083 0.0174 271.1982);
  --input: oklch(0.8575 0.0145 268.4756);
  --ring: oklch(0.5547 0.2503 297.0156);
  --chart-1: oklch(0.5547 0.2503 297.0156);
  --chart-2: oklch(0.6820 0.1448 235.3822);
  --chart-3: oklch(0.6250 0.1772 140.4448);
  --chart-4: oklch(0.6920 0.2041 42.4293);
  --chart-5: oklch(0.7141 0.1045 33.0967);
  --sidebar: oklch(0.9335 0.0087 264.5206);
  --sidebar-foreground: oklch(0.4355 0.0430 279.3250);
  --sidebar-primary: oklch(0.5547 0.2503 297.0156);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.6820 0.1448 235.3822);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.8083 0.0174 271.1982);
  --sidebar-ring: oklch(0.5547 0.2503 297.0156);
  --radius: 0.35rem;
  `,
  'Soothing pastel theme inspired by Catppuccin color palette',
);

/**
 * Claude theme
 */
export const claudeTheme = createThemeFromCSS(
  'claude',
  'Claude',
  `
  --background: oklch(0.9818 0.0054 95.0986);
  --foreground: oklch(0.3438 0.0269 95.7226);
  --card: oklch(0.9818 0.0054 95.0986);
  --card-foreground: oklch(0.1908 0.0020 106.5859);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.2671 0.0196 98.9390);
  --primary: oklch(0.6171 0.1375 39.0427);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9245 0.0138 92.9892);
  --secondary-foreground: oklch(0.4334 0.0177 98.6048);
  --muted: oklch(0.9341 0.0153 90.2390);
  --muted-foreground: oklch(0.6059 0.0075 97.4233);
  --accent: oklch(0.9245 0.0138 92.9892);
  --accent-foreground: oklch(0.2671 0.0196 98.9390);
  --destructive: oklch(0.1908 0.0020 106.5859);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8847 0.0069 97.3627);
  --input: oklch(0.7621 0.0156 98.3528);
  --ring: oklch(0.6171 0.1375 39.0427);
  --chart-1: oklch(0.5583 0.1276 42.9956);
  --chart-2: oklch(0.6898 0.1581 290.4107);
  --chart-3: oklch(0.8816 0.0276 93.1280);
  --chart-4: oklch(0.8822 0.0403 298.1792);
  --chart-5: oklch(0.5608 0.1348 42.0584);
  --sidebar: oklch(0.9663 0.0080 98.8792);
  --sidebar-foreground: oklch(0.3590 0.0051 106.6524);
  --sidebar-primary: oklch(0.6171 0.1375 39.0427);
  --sidebar-primary-foreground: oklch(0.9881 0 0);
  --sidebar-accent: oklch(0.9245 0.0138 92.9892);
  --sidebar-accent-foreground: oklch(0.3250 0 0);
  --sidebar-border: oklch(0.9401 0 0);
  --sidebar-ring: oklch(0.7731 0 0);
  --radius: 0.5rem;
  `,
  'Warm beige theme inspired by Claude AI with copper accents',
);

/**
 * Claymorphism theme
 */
export const claymorphismTheme = createThemeFromCSS(
  'claymorphism',
  'Claymorphism',
  `
  --background: oklch(0.9232 0.0026 48.7171);
  --foreground: oklch(0.2795 0.0368 260.0310);
  --card: oklch(0.9699 0.0013 106.4238);
  --card-foreground: oklch(0.2795 0.0368 260.0310);
  --popover: oklch(0.9699 0.0013 106.4238);
  --popover-foreground: oklch(0.2795 0.0368 260.0310);
  --primary: oklch(0.5854 0.2041 277.1173);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8687 0.0043 56.3660);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9232 0.0026 48.7171);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9376 0.0260 321.9388);
  --accent-foreground: oklch(0.3729 0.0306 259.7328);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8687 0.0043 56.3660);
  --input: oklch(0.8687 0.0043 56.3660);
  --ring: oklch(0.5854 0.2041 277.1173);
  --chart-1: oklch(0.5854 0.2041 277.1173);
  --chart-2: oklch(0.5106 0.2301 276.9656);
  --chart-3: oklch(0.4568 0.2146 277.0229);
  --chart-4: oklch(0.3984 0.1773 277.3662);
  --chart-5: oklch(0.3588 0.1354 278.6973);
  --sidebar: oklch(0.8687 0.0043 56.3660);
  --sidebar-foreground: oklch(0.2795 0.0368 260.0310);
  --sidebar-primary: oklch(0.5854 0.2041 277.1173);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9376 0.0260 321.9388);
  --sidebar-accent-foreground: oklch(0.3729 0.0306 259.7328);
  --sidebar-border: oklch(0.8687 0.0043 56.3660);
  --sidebar-ring: oklch(0.5854 0.2041 277.1173);
  --radius: 1.25rem;
  `,
  'Soft clay-textured theme with prominent rounded corners and depth',
);

/**
 * Clean Slate theme
 */
export const cleanSlateTheme = createThemeFromCSS(
  'cleanSlate',
  'Clean Slate',
  `
  --background: oklch(0.9842 0.0034 247.8575);
  --foreground: oklch(0.2795 0.0368 260.0310);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.2795 0.0368 260.0310);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.2795 0.0368 260.0310);
  --primary: oklch(0.5854 0.2041 277.1173);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9276 0.0058 264.5313);
  --secondary-foreground: oklch(0.3729 0.0306 259.7328);
  --muted: oklch(0.9670 0.0029 264.5419);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9299 0.0334 272.7879);
  --accent-foreground: oklch(0.3729 0.0306 259.7328);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8717 0.0093 258.3382);
  --input: oklch(0.8717 0.0093 258.3382);
  --ring: oklch(0.5854 0.2041 277.1173);
  --chart-1: oklch(0.5854 0.2041 277.1173);
  --chart-2: oklch(0.5106 0.2301 276.9656);
  --chart-3: oklch(0.4568 0.2146 277.0229);
  --chart-4: oklch(0.3984 0.1773 277.3662);
  --chart-5: oklch(0.3588 0.1354 278.6973);
  --sidebar: oklch(0.9670 0.0029 264.5419);
  --sidebar-foreground: oklch(0.2795 0.0368 260.0310);
  --sidebar-primary: oklch(0.5854 0.2041 277.1173);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9299 0.0334 272.7879);
  --sidebar-accent-foreground: oklch(0.3729 0.0306 259.7328);
  --sidebar-border: oklch(0.8717 0.0093 258.3382);
  --sidebar-ring: oklch(0.5854 0.2041 277.1173);
  --radius: 0.5rem;
  `,
  'Crisp minimalist theme with clean neutral tones',
);

/**
 * Cosmic Night theme
 */
export const cosmicNightTheme = createThemeFromCSS(
  'cosmicnight',
  'Cosmic Night',
  `
  --background: oklch(0.9730 0.0133 286.1503);
  --foreground: oklch(0.3015 0.0572 282.4176);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3015 0.0572 282.4176);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3015 0.0572 282.4176);
  --primary: oklch(0.5417 0.1790 288.0332);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9174 0.0435 292.6901);
  --secondary-foreground: oklch(0.4143 0.1039 288.1742);
  --muted: oklch(0.9580 0.0133 286.1454);
  --muted-foreground: oklch(0.5426 0.0465 284.7435);
  --accent: oklch(0.9221 0.0373 262.1410);
  --accent-foreground: oklch(0.3015 0.0572 282.4176);
  --destructive: oklch(0.6861 0.2061 14.9941);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9115 0.0216 285.9625);
  --input: oklch(0.9115 0.0216 285.9625);
  --ring: oklch(0.5417 0.1790 288.0332);
  --chart-1: oklch(0.5417 0.1790 288.0332);
  --chart-2: oklch(0.7042 0.1602 288.9880);
  --chart-3: oklch(0.5679 0.2113 276.7065);
  --chart-4: oklch(0.6356 0.1922 281.8054);
  --chart-5: oklch(0.4509 0.1758 279.3838);
  --sidebar: oklch(0.9580 0.0133 286.1454);
  --sidebar-foreground: oklch(0.3015 0.0572 282.4176);
  --sidebar-primary: oklch(0.5417 0.1790 288.0332);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9221 0.0373 262.1410);
  --sidebar-accent-foreground: oklch(0.3015 0.0572 282.4176);
  --sidebar-border: oklch(0.9115 0.0216 285.9625);
  --sidebar-ring: oklch(0.5417 0.1790 288.0332);
  --radius: 0.5rem;
  `,
  'Deep purple cosmic theme with starry night aesthetics',
);

/**
 * Cyberpunk theme
 */
export const cyberpunkTheme = createThemeFromCSS(
  'cyberpunk',
  'Cyberpunk',
  `
  --background: oklch(0.9816 0.0017 247.8390);
  --foreground: oklch(0.1649 0.0352 281.8285);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.1649 0.0352 281.8285);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.1649 0.0352 281.8285);
  --primary: oklch(0.6726 0.2904 341.4084);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9595 0.0200 286.0164);
  --secondary-foreground: oklch(0.1649 0.0352 281.8285);
  --muted: oklch(0.9595 0.0200 286.0164);
  --muted-foreground: oklch(0.1649 0.0352 281.8285);
  --accent: oklch(0.8903 0.1739 171.2690);
  --accent-foreground: oklch(0.1649 0.0352 281.8285);
  --destructive: oklch(0.6535 0.2348 34.0370);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9205 0.0086 225.0878);
  --input: oklch(0.9205 0.0086 225.0878);
  --ring: oklch(0.6726 0.2904 341.4084);
  --chart-1: oklch(0.6726 0.2904 341.4084);
  --chart-2: oklch(0.5488 0.2944 299.0954);
  --chart-3: oklch(0.8442 0.1457 209.2851);
  --chart-4: oklch(0.8903 0.1739 171.2690);
  --chart-5: oklch(0.9168 0.1915 101.4070);
  --sidebar: oklch(0.9595 0.0200 286.0164);
  --sidebar-foreground: oklch(0.1649 0.0352 281.8285);
  --sidebar-primary: oklch(0.6726 0.2904 341.4084);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8903 0.1739 171.2690);
  --sidebar-accent-foreground: oklch(0.1649 0.0352 281.8285);
  --sidebar-border: oklch(0.9205 0.0086 225.0878);
  --sidebar-ring: oklch(0.6726 0.2904 341.4084);
  --radius: 0.5rem;
  `,
  'Neon-infused futuristic theme with vibrant pink and cyan accents',
);

/**
 * Darkmatter theme
 */
export const darkmatterTheme = createThemeFromCSS(
  'darkmatter',
  'Darkmatter',
  `
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0.2101 0.0318 264.6645);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.2101 0.0318 264.6645);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.2101 0.0318 264.6645);
  --primary: oklch(0.6716 0.1368 48.5130);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.5360 0.0398 196.0280);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.9670 0.0029 264.5419);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9491 0 0);
  --accent-foreground: oklch(0.2101 0.0318 264.6645);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(0.9851 0 0);
  --border: oklch(0.9276 0.0058 264.5313);
  --input: oklch(0.9276 0.0058 264.5313);
  --ring: oklch(0.6716 0.1368 48.5130);
  --chart-1: oklch(0.5940 0.0443 196.0233);
  --chart-2: oklch(0.7214 0.1337 49.9802);
  --chart-3: oklch(0.8721 0.0864 68.5474);
  --chart-4: oklch(0.6268 0 0);
  --chart-5: oklch(0.6830 0 0);
  --sidebar: oklch(0.9670 0.0029 264.5419);
  --sidebar-foreground: oklch(0.2101 0.0318 264.6645);
  --sidebar-primary: oklch(0.6716 0.1368 48.5130);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(1.0000 0 0);
  --sidebar-accent-foreground: oklch(0.2101 0.0318 264.6645);
  --sidebar-border: oklch(0.9276 0.0058 264.5313);
  --sidebar-ring: oklch(0.6716 0.1368 48.5130);
  --radius: 0.75rem;
  `,
  'Deep space theme with mysterious dark matter aesthetics and golden accents',
);

/**
 * Doom 64 theme
 */
export const doom64Theme = createThemeFromCSS(
  'doom64',
  'Doom 64',
  `
  --background: oklch(0.8452 0 0);
  --foreground: oklch(0.2393 0 0);
  --card: oklch(0.7572 0 0);
  --card-foreground: oklch(0.2393 0 0);
  --popover: oklch(0.7572 0 0);
  --popover-foreground: oklch(0.2393 0 0);
  --primary: oklch(0.5016 0.1887 27.4816);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.4955 0.0896 126.1858);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.7826 0 0);
  --muted-foreground: oklch(0.4091 0 0);
  --accent: oklch(0.5880 0.0993 245.7394);
  --accent-foreground: oklch(1.0000 0 0);
  --destructive: oklch(0.7076 0.1975 46.4558);
  --destructive-foreground: oklch(0 0 0);
  --border: oklch(0.4313 0 0);
  --input: oklch(0.4313 0 0);
  --ring: oklch(0.5016 0.1887 27.4816);
  --chart-1: oklch(0.5016 0.1887 27.4816);
  --chart-2: oklch(0.4955 0.0896 126.1858);
  --chart-3: oklch(0.5880 0.0993 245.7394);
  --chart-4: oklch(0.7076 0.1975 46.4558);
  --chart-5: oklch(0.5656 0.0431 40.4319);
  --sidebar: oklch(0.7572 0 0);
  --sidebar-foreground: oklch(0.2393 0 0);
  --sidebar-primary: oklch(0.5016 0.1887 27.4816);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.5880 0.0993 245.7394);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.4313 0 0);
  --sidebar-ring: oklch(0.5016 0.1887 27.4816);
  --radius: 0px;
  `,
  'Retro gaming theme inspired by Doom 64 with sharp corners and bold colors',
);

/**
 * Elegant Luxury theme
 */
export const elegantLuxuryTheme = createThemeFromCSS(
  'elegantLuxury',
  'Elegant Luxury',
  `
  --background: oklch(0.9779 0.0042 56.3756);
  --foreground: oklch(0.2178 0 0);
  --card: oklch(0.9779 0.0042 56.3756);
  --card-foreground: oklch(0.2178 0 0);
  --popover: oklch(0.9779 0.0042 56.3756);
  --popover-foreground: oklch(0.2178 0 0);
  --primary: oklch(0.4650 0.1470 24.9381);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9625 0.0385 89.0943);
  --secondary-foreground: oklch(0.4847 0.1022 75.1153);
  --muted: oklch(0.9431 0.0068 53.4442);
  --muted-foreground: oklch(0.4444 0.0096 73.6390);
  --accent: oklch(0.9619 0.0580 95.6174);
  --accent-foreground: oklch(0.3958 0.1331 25.7230);
  --destructive: oklch(0.4437 0.1613 26.8994);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9355 0.0324 80.9937);
  --input: oklch(0.9355 0.0324 80.9937);
  --ring: oklch(0.4650 0.1470 24.9381);
  --chart-1: oklch(0.5054 0.1905 27.5181);
  --chart-2: oklch(0.4650 0.1470 24.9381);
  --chart-3: oklch(0.3958 0.1331 25.7230);
  --chart-4: oklch(0.5553 0.1455 48.9975);
  --chart-5: oklch(0.4732 0.1247 46.2007);
  --sidebar: oklch(0.9431 0.0068 53.4442);
  --sidebar-foreground: oklch(0.2178 0 0);
  --sidebar-primary: oklch(0.4650 0.1470 24.9381);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9619 0.0580 95.6174);
  --sidebar-accent-foreground: oklch(0.3958 0.1331 25.7230);
  --sidebar-border: oklch(0.9355 0.0324 80.9937);
  --sidebar-ring: oklch(0.4650 0.1470 24.9381);
  --radius: 0.375rem;
  `,
  'Sophisticated luxury theme with elegant cream tones and rich mahogany accents',
);

/**
 * Graphite theme
 */
export const graphiteTheme = createThemeFromCSS(
  'graphite',
  'Graphite',
  `
  --background: oklch(0.9551 0 0);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(0.9702 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(0.9702 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.4891 0 0);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9067 0 0);
  --secondary-foreground: oklch(0.3211 0 0);
  --muted: oklch(0.8853 0 0);
  --muted-foreground: oklch(0.5103 0 0);
  --accent: oklch(0.8078 0 0);
  --accent-foreground: oklch(0.3211 0 0);
  --destructive: oklch(0.5594 0.1900 25.8625);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8576 0 0);
  --input: oklch(0.9067 0 0);
  --ring: oklch(0.4891 0 0);
  --chart-1: oklch(0.4891 0 0);
  --chart-2: oklch(0.4863 0.0361 196.0278);
  --chart-3: oklch(0.6534 0 0);
  --chart-4: oklch(0.7316 0 0);
  --chart-5: oklch(0.8078 0 0);
  --sidebar: oklch(0.9370 0 0);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.4891 0 0);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8078 0 0);
  --sidebar-accent-foreground: oklch(0.3211 0 0);
  --sidebar-border: oklch(0.8576 0 0);
  --sidebar-ring: oklch(0.4891 0 0);
  --radius: 0.35rem;
  `,
  'Professional monochrome theme with smooth graphite gray tones',
);

/**
 * Kodama Grave theme
 */
export const kodamaGraveTheme = createThemeFromCSS(
  'kodamaGrave',
  'Kodama Grave',
  `
  --background: oklch(0.8798 0.0534 91.7893);
  --foreground: oklch(0.4265 0.0310 59.2153);
  --card: oklch(0.8937 0.0395 87.5676);
  --card-foreground: oklch(0.4265 0.0310 59.2153);
  --popover: oklch(0.9378 0.0331 89.8515);
  --popover-foreground: oklch(0.4265 0.0310 59.2153);
  --primary: oklch(0.6657 0.1050 118.9078);
  --primary-foreground: oklch(0.9882 0.0069 88.6415);
  --secondary: oklch(0.8532 0.0631 91.1493);
  --secondary-foreground: oklch(0.4265 0.0310 59.2153);
  --muted: oklch(0.8532 0.0631 91.1493);
  --muted-foreground: oklch(0.5761 0.0259 60.9323);
  --accent: oklch(0.8361 0.0713 90.3269);
  --accent-foreground: oklch(0.4265 0.0310 59.2153);
  --destructive: oklch(0.7136 0.0981 29.9827);
  --destructive-foreground: oklch(0.9790 0.0082 91.4818);
  --border: oklch(0.6918 0.0440 59.8448);
  --input: oklch(0.8361 0.0713 90.3269);
  --ring: oklch(0.7350 0.0564 130.8494);
  --chart-1: oklch(0.7350 0.0564 130.8494);
  --chart-2: oklch(0.6762 0.0567 132.4479);
  --chart-3: oklch(0.8185 0.0332 136.6539);
  --chart-4: oklch(0.5929 0.0464 137.6224);
  --chart-5: oklch(0.5183 0.0390 137.1892);
  --sidebar: oklch(0.8631 0.0645 90.5161);
  --sidebar-foreground: oklch(0.4265 0.0310 59.2153);
  --sidebar-primary: oklch(0.7350 0.0564 130.8494);
  --sidebar-primary-foreground: oklch(0.9882 0.0069 88.6415);
  --sidebar-accent: oklch(0.9225 0.0169 88.0027);
  --sidebar-accent-foreground: oklch(0.4265 0.0310 59.2153);
  --sidebar-border: oklch(0.9073 0.0170 88.0044);
  --sidebar-ring: oklch(0.7350 0.0564 130.8494);
  --radius: 0.425rem;
  `,
  'Nature-inspired theme with peaceful forest green and earthy tones',
);

/**
 * Midnight Bloom theme
 */
export const midnightBloomTheme = createThemeFromCSS(
  'midnightBloom',
  'Midnight Bloom',
  `
  --background: oklch(0.9821 0 0);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.5676 0.2021 283.0838);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8214 0.0720 249.3482);
  --secondary-foreground: oklch(0.3211 0 0);
  --muted: oklch(0.8202 0.0213 91.6163);
  --muted-foreground: oklch(0.5382 0 0);
  --accent: oklch(0.6475 0.0642 117.4260);
  --accent-foreground: oklch(1.0000 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8699 0 0);
  --input: oklch(0.8699 0 0);
  --ring: oklch(0.5676 0.2021 283.0838);
  --chart-1: oklch(0.5676 0.2021 283.0838);
  --chart-2: oklch(0.5261 0.1705 314.6534);
  --chart-3: oklch(0.3390 0.1793 301.6848);
  --chart-4: oklch(0.6746 0.1414 261.3380);
  --chart-5: oklch(0.5880 0.0993 245.7394);
  --sidebar: oklch(0.9821 0 0);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.5676 0.2021 283.0838);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.6475 0.0642 117.4260);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.8699 0 0);
  --sidebar-ring: oklch(0.5676 0.2021 283.0838);
  --radius: 0.5rem;
  `,
  'Elegant nighttime theme with rich purple blooms and soft shadows',
);

/**
 * Mocha Mousse theme
 */
export const mochaMousseTheme = createThemeFromCSS(
  'mochaMousse',
  'Mocha Mousse',
  `
  --background: oklch(0.9529 0.0146 102.4597);
  --foreground: oklch(0.4063 0.0255 40.3627);
  --card: oklch(0.9529 0.0146 102.4597);
  --card-foreground: oklch(0.4063 0.0255 40.3627);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.4063 0.0255 40.3627);
  --primary: oklch(0.6083 0.0623 44.3588);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.7473 0.0387 80.5476);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.8502 0.0389 49.0874);
  --muted-foreground: oklch(0.5416 0.0512 37.2132);
  --accent: oklch(0.8502 0.0389 49.0874);
  --accent-foreground: oklch(0.4063 0.0255 40.3627);
  --destructive: oklch(0.2225 0.0098 52.9636);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.7473 0.0387 80.5476);
  --input: oklch(0.7473 0.0387 80.5476);
  --ring: oklch(0.6083 0.0623 44.3588);
  --chart-1: oklch(0.6083 0.0623 44.3588);
  --chart-2: oklch(0.5416 0.0512 37.2132);
  --chart-3: oklch(0.7272 0.0539 52.3320);
  --chart-4: oklch(0.7473 0.0387 80.5476);
  --chart-5: oklch(0.6440 0.0405 52.3917);
  --sidebar: oklch(0.8903 0.0278 49.5658);
  --sidebar-foreground: oklch(0.4063 0.0255 40.3627);
  --sidebar-primary: oklch(0.6083 0.0623 44.3588);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.7272 0.0539 52.3320);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.6440 0.0405 52.3917);
  --sidebar-ring: oklch(0.6083 0.0623 44.3588);
  --radius: 0.5rem;
  `,
  'Warm coffee-inspired theme with rich mocha and cream tones',
);

/**
 * Mono theme
 */
export const monoTheme = createThemeFromCSS(
  'mono',
  'Mono',
  `
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0.1448 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.1448 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.1448 0 0);
  --primary: oklch(0.5555 0 0);
  --primary-foreground: oklch(0.9851 0 0);
  --secondary: oklch(0.9702 0 0);
  --secondary-foreground: oklch(0.2046 0 0);
  --muted: oklch(0.9702 0 0);
  --muted-foreground: oklch(0.5486 0 0);
  --accent: oklch(0.9702 0 0);
  --accent-foreground: oklch(0.2046 0 0);
  --destructive: oklch(0.5830 0.2387 28.4765);
  --destructive-foreground: oklch(0.9702 0 0);
  --border: oklch(0.9219 0 0);
  --input: oklch(0.9219 0 0);
  --ring: oklch(0.7090 0 0);
  --chart-1: oklch(0.5555 0 0);
  --chart-2: oklch(0.5555 0 0);
  --chart-3: oklch(0.5555 0 0);
  --chart-4: oklch(0.5555 0 0);
  --chart-5: oklch(0.5555 0 0);
  --sidebar: oklch(0.9851 0 0);
  --sidebar-foreground: oklch(0.1448 0 0);
  --sidebar-primary: oklch(0.2046 0 0);
  --sidebar-primary-foreground: oklch(0.9851 0 0);
  --sidebar-accent: oklch(0.9702 0 0);
  --sidebar-accent-foreground: oklch(0.2046 0 0);
  --sidebar-border: oklch(0.9219 0 0);
  --sidebar-ring: oklch(0.7090 0 0);
  --radius: 0rem;
  `,
  'Ultra-minimal monochrome theme with pure black and white, no shadows',
);

/**
 * Nature theme
 */
export const natureTheme = createThemeFromCSS(
  'nature',
  'Nature',
  `
  --background: oklch(0.9711 0.0074 80.7211);
  --foreground: oklch(0.3000 0.0358 30.2042);
  --card: oklch(0.9711 0.0074 80.7211);
  --card-foreground: oklch(0.3000 0.0358 30.2042);
  --popover: oklch(0.9711 0.0074 80.7211);
  --popover-foreground: oklch(0.3000 0.0358 30.2042);
  --primary: oklch(0.5234 0.1347 144.1672);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9571 0.0210 147.6360);
  --secondary-foreground: oklch(0.4254 0.1159 144.3078);
  --muted: oklch(0.9370 0.0142 74.4218);
  --muted-foreground: oklch(0.4495 0.0486 39.2110);
  --accent: oklch(0.8952 0.0504 146.0366);
  --accent-foreground: oklch(0.4254 0.1159 144.3078);
  --destructive: oklch(0.5386 0.1937 26.7249);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8805 0.0208 74.6428);
  --input: oklch(0.8805 0.0208 74.6428);
  --ring: oklch(0.5234 0.1347 144.1672);
  --chart-1: oklch(0.6731 0.1624 144.2083);
  --chart-2: oklch(0.5752 0.1446 144.1813);
  --chart-3: oklch(0.5234 0.1347 144.1672);
  --chart-4: oklch(0.4254 0.1159 144.3078);
  --chart-5: oklch(0.2157 0.0453 145.7256);
  --sidebar: oklch(0.9370 0.0142 74.4218);
  --sidebar-foreground: oklch(0.3000 0.0358 30.2042);
  --sidebar-primary: oklch(0.5234 0.1347 144.1672);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8952 0.0504 146.0366);
  --sidebar-accent-foreground: oklch(0.4254 0.1159 144.3078);
  --sidebar-border: oklch(0.8805 0.0208 74.6428);
  --sidebar-ring: oklch(0.5234 0.1347 144.1672);
  --radius: 0.5rem;
  `,
  'Fresh nature-inspired theme with organic green tones and earthy accents',
);

/**
 * Neo Brutalism theme
 */
export const neoBrutalismTheme = createThemeFromCSS(
  'neoBrutalism',
  'Neo Brutalism',
  `
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.6489 0.2370 26.9728);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9680 0.2110 109.7692);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0.9551 0 0);
  --muted-foreground: oklch(0.3211 0 0);
  --accent: oklch(0.5635 0.2408 260.8178);
  --accent-foreground: oklch(1.0000 0 0);
  --destructive: oklch(0 0 0);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0 0 0);
  --input: oklch(0 0 0);
  --ring: oklch(0.6489 0.2370 26.9728);
  --chart-1: oklch(0.6489 0.2370 26.9728);
  --chart-2: oklch(0.9680 0.2110 109.7692);
  --chart-3: oklch(0.5635 0.2408 260.8178);
  --chart-4: oklch(0.7323 0.2492 142.4953);
  --chart-5: oklch(0.5931 0.2726 328.3634);
  --sidebar: oklch(0.9551 0 0);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0.6489 0.2370 26.9728);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.5635 0.2408 260.8178);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0 0 0);
  --sidebar-ring: oklch(0.6489 0.2370 26.9728);
  --radius: 0px;
  `,
  'Bold brutalist design with thick black borders and strong shadows',
);

/**
 * Northern Lights theme
 */
export const northernLightsTheme = createThemeFromCSS(
  'northernLights',
  'Northern Lights',
  `
  --background: oklch(0.9824 0.0013 286.3757);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.6487 0.1538 150.3071);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.6746 0.1414 261.3380);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.8828 0.0285 98.1033);
  --muted-foreground: oklch(0.5382 0 0);
  --accent: oklch(0.8269 0.1080 211.9627);
  --accent-foreground: oklch(0.3211 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8699 0 0);
  --input: oklch(0.8699 0 0);
  --ring: oklch(0.6487 0.1538 150.3071);
  --chart-1: oklch(0.6487 0.1538 150.3071);
  --chart-2: oklch(0.6746 0.1414 261.3380);
  --chart-3: oklch(0.8269 0.1080 211.9627);
  --chart-4: oklch(0.5880 0.0993 245.7394);
  --chart-5: oklch(0.5905 0.1608 148.2409);
  --sidebar: oklch(0.9824 0.0013 286.3757);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.6487 0.1538 150.3071);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8269 0.1080 211.9627);
  --sidebar-accent-foreground: oklch(0.3211 0 0);
  --sidebar-border: oklch(0.8699 0 0);
  --sidebar-ring: oklch(0.6487 0.1538 150.3071);
  --radius: 0.5rem;
  `,
  'Magical aurora borealis theme with ethereal green and purple gradients',
);

/**
 * Notebook theme
 */
export const notebookTheme = createThemeFromCSS(
  'notebook',
  'Notebook',
  `
  --background: oklch(0.9821 0 0);
  --foreground: oklch(0.3485 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3485 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3485 0 0);
  --primary: oklch(0.4891 0 0);
  --primary-foreground: oklch(0.9551 0 0);
  --secondary: oklch(0.9006 0 0);
  --secondary-foreground: oklch(0.3485 0 0);
  --muted: oklch(0.9158 0 0);
  --muted-foreground: oklch(0.4313 0 0);
  --accent: oklch(0.9354 0.0456 94.8549);
  --accent-foreground: oklch(0.4015 0.0436 37.9587);
  --destructive: oklch(0.6627 0.0978 20.0041);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.5538 0.0025 17.2320);
  --input: oklch(1.0000 0 0);
  --ring: oklch(0.7058 0 0);
  --chart-1: oklch(0.3211 0 0);
  --chart-2: oklch(0.4495 0 0);
  --chart-3: oklch(0.5693 0 0);
  --chart-4: oklch(0.6830 0 0);
  --chart-5: oklch(0.7921 0 0);
  --sidebar: oklch(0.9551 0 0);
  --sidebar-foreground: oklch(0.3485 0 0);
  --sidebar-primary: oklch(0.4891 0 0);
  --sidebar-primary-foreground: oklch(0.9551 0 0);
  --sidebar-accent: oklch(0.9354 0.0456 94.8549);
  --sidebar-accent-foreground: oklch(0.4015 0.0436 37.9587);
  --sidebar-border: oklch(0.8078 0 0);
  --sidebar-ring: oklch(0.7058 0 0);
  --radius: 0.625rem;
  `,
  'Paper notebook theme with ruled lines aesthetic and handwritten font style',
);

/**
 * Ocean Breeze theme
 */
export const oceanBreezeTheme = createThemeFromCSS(
  'oceanBreeze',
  'Ocean Breeze',
  `
   --background: oklch(0.9751 0.0127 244.2507);
  --foreground: oklch(0.3729 0.0306 259.7328);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3729 0.0306 259.7328);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3729 0.0306 259.7328);
  --primary: oklch(0.7227 0.1920 149.5793);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9514 0.0250 236.8242);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9670 0.0029 264.5419);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9505 0.0507 163.0508);
  --accent-foreground: oklch(0.3729 0.0306 259.7328);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9276 0.0058 264.5313);
  --input: oklch(0.9276 0.0058 264.5313);
  --ring: oklch(0.7227 0.1920 149.5793);
  --chart-1: oklch(0.7227 0.1920 149.5793);
  --chart-2: oklch(0.6959 0.1491 162.4796);
  --chart-3: oklch(0.5960 0.1274 163.2254);
  --chart-4: oklch(0.5081 0.1049 165.6121);
  --chart-5: oklch(0.4318 0.0865 166.9128);
  --sidebar: oklch(0.9514 0.0250 236.8242);
  --sidebar-foreground: oklch(0.3729 0.0306 259.7328);
  --sidebar-primary: oklch(0.7227 0.1920 149.5793);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9505 0.0507 163.0508);
  --sidebar-accent-foreground: oklch(0.3729 0.0306 259.7328);
  --sidebar-border: oklch(0.9276 0.0058 264.5313);
  --sidebar-ring: oklch(0.7227 0.1920 149.5793);
  --radius: 0.5rem;
  `,
  'Refreshing ocean-inspired theme with cool turquoise and seafoam tones',
);

/**
 * Pastel Dreams theme
 */
export const pastelDreamsTheme = createThemeFromCSS(
  'pastelDreams',
  'Pastel Dreams',
  `
  --background: oklch(0.9689 0.0090 314.7819);
  --foreground: oklch(0.3729 0.0306 259.7328);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3729 0.0306 259.7328);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3729 0.0306 259.7328);
  --primary: oklch(0.7090 0.1592 293.5412);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9073 0.0530 306.0902);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9464 0.0327 307.1745);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9376 0.0260 321.9388);
  --accent-foreground: oklch(0.3729 0.0306 259.7328);
  --destructive: oklch(0.8077 0.1035 19.5706);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9073 0.0530 306.0902);
  --input: oklch(0.9073 0.0530 306.0902);
  --ring: oklch(0.7090 0.1592 293.5412);
  --chart-1: oklch(0.7090 0.1592 293.5412);
  --chart-2: oklch(0.6056 0.2189 292.7172);
  --chart-3: oklch(0.5413 0.2466 293.0090);
  --chart-4: oklch(0.4907 0.2412 292.5809);
  --chart-5: oklch(0.4320 0.2106 292.7591);
  --sidebar: oklch(0.9073 0.0530 306.0902);
  --sidebar-foreground: oklch(0.3729 0.0306 259.7328);
  --sidebar-primary: oklch(0.7090 0.1592 293.5412);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9376 0.0260 321.9388);
  --sidebar-accent-foreground: oklch(0.3729 0.0306 259.7328);
  --sidebar-border: oklch(0.9073 0.0530 306.0902);
  --sidebar-ring: oklch(0.7090 0.1592 293.5412);
  --radius: 1.5rem;
  `,
  'Dreamy pastel theme with soft lavender and pink cotton candy colors',
);

/**
 * Perpetuity theme
 */
export const perpetuityTheme = createThemeFromCSS(
  'perpetuity',
  'Perpetuity',
  `
  --background: oklch(0.9491 0.0085 197.0126);
  --foreground: oklch(0.3772 0.0619 212.6640);
  --card: oklch(0.9724 0.0053 197.0692);
  --card-foreground: oklch(0.3772 0.0619 212.6640);
  --popover: oklch(0.9724 0.0053 197.0692);
  --popover-foreground: oklch(0.3772 0.0619 212.6640);
  --primary: oklch(0.5624 0.0947 203.2755);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9244 0.0181 196.8450);
  --secondary-foreground: oklch(0.3772 0.0619 212.6640);
  --muted: oklch(0.9295 0.0107 196.9723);
  --muted-foreground: oklch(0.5428 0.0594 201.5662);
  --accent: oklch(0.9021 0.0297 201.8915);
  --accent-foreground: oklch(0.3772 0.0619 212.6640);
  --destructive: oklch(0.5732 0.1901 25.5409);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8931 0.0205 204.4136);
  --input: oklch(0.9244 0.0181 196.8450);
  --ring: oklch(0.5624 0.0947 203.2755);
  --chart-1: oklch(0.5624 0.0947 203.2755);
  --chart-2: oklch(0.6389 0.1029 201.5918);
  --chart-3: oklch(0.7124 0.1075 201.2486);
  --chart-4: oklch(0.7701 0.0979 201.1816);
  --chart-5: oklch(0.8336 0.0771 200.9702);
  --sidebar: oklch(0.9280 0.0183 205.3151);
  --sidebar-foreground: oklch(0.3772 0.0619 212.6640);
  --sidebar-primary: oklch(0.5624 0.0947 203.2755);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9021 0.0297 201.8915);
  --sidebar-accent-foreground: oklch(0.3772 0.0619 212.6640);
  --sidebar-border: oklch(0.8931 0.0205 204.4136);
  --sidebar-ring: oklch(0.5624 0.0947 203.2755);
  --radius: 0.125rem;
  `,
  'Timeless monospace terminal theme with cyan-tinted blue aesthetics',
);

/**
 * Quantum Rose theme
 */
export const quantumRoseTheme = createThemeFromCSS(
  'quantumRose',
  'Quantum Rose',
  `
  --background: oklch(0.9692 0.0192 343.9344);
  --foreground: oklch(0.4426 0.1653 352.3762);
  --card: oklch(0.9837 0.0107 339.3288);
  --card-foreground: oklch(0.4426 0.1653 352.3762);
  --popover: oklch(0.9837 0.0107 339.3288);
  --popover-foreground: oklch(0.4426 0.1653 352.3762);
  --primary: oklch(0.6002 0.2414 0.1348);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9230 0.0701 326.1273);
  --secondary-foreground: oklch(0.4426 0.1653 352.3762);
  --muted: oklch(0.9429 0.0363 344.2604);
  --muted-foreground: oklch(0.5740 0.1732 352.0544);
  --accent: oklch(0.8766 0.0828 344.8849);
  --accent-foreground: oklch(0.4426 0.1653 352.3762);
  --destructive: oklch(0.5831 0.1911 6.3410);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8881 0.0747 344.3866);
  --input: oklch(0.9230 0.0701 326.1273);
  --ring: oklch(0.6002 0.2414 0.1348);
  --chart-1: oklch(0.6002 0.2414 0.1348);
  --chart-2: oklch(0.5979 0.1750 345.0378);
  --chart-3: oklch(0.6009 0.1243 311.7958);
  --chart-4: oklch(0.5849 0.1178 283.2937);
  --chart-5: oklch(0.6479 0.1871 267.9684);
  --sidebar: oklch(0.9629 0.0227 345.7485);
  --sidebar-foreground: oklch(0.4426 0.1653 352.3762);
  --sidebar-primary: oklch(0.6002 0.2414 0.1348);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8766 0.0828 344.8849);
  --sidebar-accent-foreground: oklch(0.4426 0.1653 352.3762);
  --sidebar-border: oklch(0.9311 0.0448 343.3135);
  --sidebar-ring: oklch(0.6002 0.2414 0.1348);
  --radius: 0.5rem;
  `,
  'Futuristic rose-tinted theme with quantum-inspired pink and magenta hues',
);

/**
 * Retro Arcade theme
 */
export const retroArcadeTheme = createThemeFromCSS(
  'retroArcade',
  'Retro Arcade',
  `
  --background: oklch(0.9735 0.0261 90.0953);
  --foreground: oklch(0.3092 0.0518 219.6516);
  --card: oklch(0.9306 0.0260 92.4020);
  --card-foreground: oklch(0.3092 0.0518 219.6516);
  --popover: oklch(0.9306 0.0260 92.4020);
  --popover-foreground: oklch(0.3092 0.0518 219.6516);
  --primary: oklch(0.5924 0.2025 355.8943);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.6437 0.1019 187.3840);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.6979 0.0159 196.7940);
  --muted-foreground: oklch(0.3092 0.0518 219.6516);
  --accent: oklch(0.5808 0.1732 39.5003);
  --accent-foreground: oklch(1.0000 0 0);
  --destructive: oklch(0.5863 0.2064 27.1172);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.6537 0.0197 205.2618);
  --input: oklch(0.6537 0.0197 205.2618);
  --ring: oklch(0.5924 0.2025 355.8943);
  --chart-1: oklch(0.6149 0.1394 244.9273);
  --chart-2: oklch(0.6437 0.1019 187.3840);
  --chart-3: oklch(0.5924 0.2025 355.8943);
  --chart-4: oklch(0.5808 0.1732 39.5003);
  --chart-5: oklch(0.5863 0.2064 27.1172);
  --sidebar: oklch(0.9735 0.0261 90.0953);
  --sidebar-foreground: oklch(0.3092 0.0518 219.6516);
  --sidebar-primary: oklch(0.5924 0.2025 355.8943);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.6437 0.1019 187.3840);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.6537 0.0197 205.2618);
  --sidebar-ring: oklch(0.5924 0.2025 355.8943);
  --radius: 0.25rem;
  `,
  'Bold neon-inspired palette with playful contrasts, evoking the vibrant glow of 80s arcades',
);

/**
 * Soft Pop theme
 */
export const softPopTheme = createThemeFromCSS(
  'softPop',
  'Soft Pop',
  `
  --background: oklch(0.9789 0.0082 121.6272);
  --foreground: oklch(0 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.5106 0.2301 276.9656);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.7038 0.1230 182.5025);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.9551 0 0);
  --muted-foreground: oklch(0.3211 0 0);
  --accent: oklch(0.7686 0.1647 70.0804);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0 0 0);
  --input: oklch(0.5555 0 0);
  --ring: oklch(0.7853 0.1041 274.7134);
  --chart-1: oklch(0.5106 0.2301 276.9656);
  --chart-2: oklch(0.7038 0.1230 182.5025);
  --chart-3: oklch(0.7686 0.1647 70.0804);
  --chart-4: oklch(0.6559 0.2118 354.3084);
  --chart-5: oklch(0.7227 0.1920 149.5793);
  --sidebar: oklch(0.9789 0.0082 121.6272);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0.5106 0.2301 276.9656);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.7686 0.1647 70.0804);
  --sidebar-accent-foreground: oklch(0 0 0);
  --sidebar-border: oklch(0 0 0);
  --sidebar-ring: oklch(0.7853 0.1041 274.7134);
  --radius: 1rem;
  `,
  'Bright, bubbly theme with pastel accents and clean contrasts for a playful yet modern look',
);

/**
 * Solar Dusk theme
 */
export const solarDuskTheme = createThemeFromCSS(
  'solarDusk',
  'Solar Dusk',
  `
  --background: oklch(0.9885 0.0057 84.5659);
  --foreground: oklch(0.3660 0.0251 49.6085);
  --card: oklch(0.9686 0.0091 78.2818);
  --card-foreground: oklch(0.3660 0.0251 49.6085);
  --popover: oklch(0.9686 0.0091 78.2818);
  --popover-foreground: oklch(0.3660 0.0251 49.6085);
  --primary: oklch(0.5553 0.1455 48.9975);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8276 0.0752 74.4400);
  --secondary-foreground: oklch(0.4444 0.0096 73.6390);
  --muted: oklch(0.9363 0.0218 83.2637);
  --muted-foreground: oklch(0.5534 0.0116 58.0708);
  --accent: oklch(0.9000 0.0500 74.9889);
  --accent-foreground: oklch(0.4444 0.0096 73.6390);
  --destructive: oklch(0.4437 0.1613 26.8994);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8866 0.0404 89.6994);
  --input: oklch(0.8866 0.0404 89.6994);
  --ring: oklch(0.5553 0.1455 48.9975);
  --chart-1: oklch(0.5553 0.1455 48.9975);
  --chart-2: oklch(0.5534 0.0116 58.0708);
  --chart-3: oklch(0.5538 0.1207 66.4416);
  --chart-4: oklch(0.5534 0.0116 58.0708);
  --chart-5: oklch(0.6806 0.1423 75.8340);
  --sidebar: oklch(0.9363 0.0218 83.2637);
  --sidebar-foreground: oklch(0.3660 0.0251 49.6085);
  --sidebar-primary: oklch(0.5553 0.1455 48.9975);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.5538 0.1207 66.4416);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.8866 0.0404 89.6994);
  --sidebar-ring: oklch(0.5553 0.1455 48.9975);
  --radius: 0.3rem;
  `,
  'Warm, golden tones fading into deep shadows—captures the calm glow of dusk before nightfall',
);

/**
 * Starry Night theme
 */
export const starryNightTheme = createThemeFromCSS(
  'starryNight',
  'Starry Night',
  `
  --background: oklch(0.9755 0.0045 258.3245);
  --foreground: oklch(0.2558 0.0433 268.0662);
  --card: oklch(0.9341 0.0132 251.5628);
  --card-foreground: oklch(0.2558 0.0433 268.0662);
  --popover: oklch(0.9856 0.0278 98.0540);
  --popover-foreground: oklch(0.2558 0.0433 268.0662);
  --primary: oklch(0.4815 0.1178 263.3758);
  --primary-foreground: oklch(0.9856 0.0278 98.0540);
  --secondary: oklch(0.8567 0.1164 81.0092);
  --secondary-foreground: oklch(0.2558 0.0433 268.0662);
  --muted: oklch(0.9202 0.0080 106.5563);
  --muted-foreground: oklch(0.4815 0.1178 263.3758);
  --accent: oklch(0.6896 0.0714 234.0387);
  --accent-foreground: oklch(0.9856 0.0278 98.0540);
  --destructive: oklch(0.2611 0.0376 322.5267);
  --destructive-foreground: oklch(0.9856 0.0278 98.0540);
  --border: oklch(0.7791 0.0156 251.1926);
  --input: oklch(0.6896 0.0714 234.0387);
  --ring: oklch(0.8567 0.1164 81.0092);
  --chart-1: oklch(0.4815 0.1178 263.3758);
  --chart-2: oklch(0.8567 0.1164 81.0092);
  --chart-3: oklch(0.6896 0.0714 234.0387);
  --chart-4: oklch(0.7791 0.0156 251.1926);
  --chart-5: oklch(0.2611 0.0376 322.5267);
  --sidebar: oklch(0.9341 0.0132 251.5628);
  --sidebar-foreground: oklch(0.2558 0.0433 268.0662);
  --sidebar-primary: oklch(0.4815 0.1178 263.3758);
  --sidebar-primary-foreground: oklch(0.9856 0.0278 98.0540);
  --sidebar-accent: oklch(0.8567 0.1164 81.0092);
  --sidebar-accent-foreground: oklch(0.2558 0.0433 268.0662);
  --sidebar-border: oklch(0.7791 0.0156 251.1926);
  --sidebar-ring: oklch(0.8567 0.1164 81.0092);
  --radius: 0.5rem;
  `,
  'Deep midnight blues and luminous highlights, evoking a tranquil star-filled night sky',
);

/**
 * Sunset Horizon theme
 */
export const sunsetHorizonTheme = createThemeFromCSS(
  'sunsetHorizon',
  'Sunset Horizon',
  `
  --background: oklch(0.9856 0.0084 56.3169);
  --foreground: oklch(0.3353 0.0132 2.7676);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3353 0.0132 2.7676);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3353 0.0132 2.7676);
  --primary: oklch(0.7357 0.1641 34.7091);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9596 0.0200 28.9029);
  --secondary-foreground: oklch(0.5587 0.1294 32.7364);
  --muted: oklch(0.9656 0.0176 39.4009);
  --muted-foreground: oklch(0.5534 0.0116 58.0708);
  --accent: oklch(0.8278 0.1131 57.9984);
  --accent-foreground: oklch(0.3353 0.0132 2.7676);
  --destructive: oklch(0.6122 0.2082 22.2410);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9296 0.0370 38.6868);
  --input: oklch(0.9296 0.0370 38.6868);
  --ring: oklch(0.7357 0.1641 34.7091);
  --chart-1: oklch(0.7357 0.1641 34.7091);
  --chart-2: oklch(0.8278 0.1131 57.9984);
  --chart-3: oklch(0.8773 0.0763 54.9314);
  --chart-4: oklch(0.8200 0.1054 40.8859);
  --chart-5: oklch(0.6368 0.1306 32.0721);
  --sidebar: oklch(0.9656 0.0176 39.4009);
  --sidebar-foreground: oklch(0.3353 0.0132 2.7676);
  --sidebar-primary: oklch(0.7357 0.1641 34.7091);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8278 0.1131 57.9984);
  --sidebar-accent-foreground: oklch(0.3353 0.0132 2.7676);
  --sidebar-border: oklch(0.9296 0.0370 38.6868);
  --sidebar-ring: oklch(0.7357 0.1641 34.7091);
  --radius: 0.625rem;
  `,
  'Radiant oranges and glowing ambers that reflect the warmth of a summer sunset on the horizon',
);

/**
 * Supabase theme
 */
export const supabaseTheme = createThemeFromCSS(
  'supabase',
  'Supabase',
  `
  --background: oklch(0.9911 0 0);
  --foreground: oklch(0.2046 0 0);
  --card: oklch(0.9911 0 0);
  --card-foreground: oklch(0.2046 0 0);
  --popover: oklch(0.9911 0 0);
  --popover-foreground: oklch(0.4386 0 0);
  --primary: oklch(0.8348 0.1302 160.9080);
  --primary-foreground: oklch(0.2626 0.0147 166.4589);
  --secondary: oklch(0.9940 0 0);
  --secondary-foreground: oklch(0.2046 0 0);
  --muted: oklch(0.9461 0 0);
  --muted-foreground: oklch(0.2435 0 0);
  --accent: oklch(0.9461 0 0);
  --accent-foreground: oklch(0.2435 0 0);
  --destructive: oklch(0.5523 0.1927 32.7272);
  --destructive-foreground: oklch(0.9934 0.0032 17.2118);
  --border: oklch(0.9037 0 0);
  --input: oklch(0.9731 0 0);
  --ring: oklch(0.8348 0.1302 160.9080);
  --chart-1: oklch(0.8348 0.1302 160.9080);
  --chart-2: oklch(0.6231 0.1880 259.8145);
  --chart-3: oklch(0.6056 0.2189 292.7172);
  --chart-4: oklch(0.7686 0.1647 70.0804);
  --chart-5: oklch(0.6959 0.1491 162.4796);
  --sidebar: oklch(0.9911 0 0);
  --sidebar-foreground: oklch(0.5452 0 0);
  --sidebar-primary: oklch(0.8348 0.1302 160.9080);
  --sidebar-primary-foreground: oklch(0.2626 0.0147 166.4589);
  --sidebar-accent: oklch(0.9461 0 0);
  --sidebar-accent-foreground: oklch(0.2435 0 0);
  --sidebar-border: oklch(0.9037 0 0);
  --sidebar-ring: oklch(0.8348 0.1302 160.9080);
  --radius: 0.5rem;
  `,
  'Clean minimalism with fresh green accents, inspired by the signature Supabase brand identity',
);

/**
 * T3 Chat theme
 */
export const t3chatTheme = createThemeFromCSS(
  't3chat',
  'T3 Chat',
  `
  --background: oklch(0.9754 0.0084 325.6414);
  --foreground: oklch(0.3257 0.1161 325.0372);
  --card: oklch(0.9754 0.0084 325.6414);
  --card-foreground: oklch(0.3257 0.1161 325.0372);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3257 0.1161 325.0372);
  --primary: oklch(0.5316 0.1409 355.1999);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8696 0.0675 334.8991);
  --secondary-foreground: oklch(0.4448 0.1341 324.7991);
  --muted: oklch(0.9395 0.0260 331.5454);
  --muted-foreground: oklch(0.4924 0.1244 324.4523);
  --accent: oklch(0.8696 0.0675 334.8991);
  --accent-foreground: oklch(0.4448 0.1341 324.7991);
  --destructive: oklch(0.5248 0.1368 20.8317);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8568 0.0829 328.9110);
  --input: oklch(0.8517 0.0558 336.6002);
  --ring: oklch(0.5916 0.2180 0.5844);
  --chart-1: oklch(0.6038 0.2363 344.4657);
  --chart-2: oklch(0.4445 0.2251 300.6246);
  --chart-3: oklch(0.3790 0.0438 226.1538);
  --chart-4: oklch(0.8330 0.1185 88.3461);
  --chart-5: oklch(0.7843 0.1256 58.9964);
  --sidebar: oklch(0.9360 0.0288 320.5788);
  --sidebar-foreground: oklch(0.4948 0.1909 354.5435);
  --sidebar-primary: oklch(0.3963 0.0251 285.1962);
  --sidebar-primary-foreground: oklch(0.9668 0.0124 337.5228);
  --sidebar-accent: oklch(0.9789 0.0013 106.4235);
  --sidebar-accent-foreground: oklch(0.3963 0.0251 285.1962);
  --sidebar-border: oklch(0.9383 0.0026 48.7178);
  --sidebar-ring: oklch(0.5916 0.2180 0.5844);
  --radius: 0.5rem;
  `,
  'Modern chat-inspired design with vibrant magentas and cool contrasts for lively conversations',
);

/**
 * Tangerine theme
 */
export const tangerineTheme = createThemeFromCSS(
  'tangerine',
  'Tangerine',
  `
  --background: oklch(0.9383 0.0042 236.4993);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.6397 0.1720 36.4421);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9670 0.0029 264.5419);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9846 0.0017 247.8389);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9119 0.0222 243.8174);
  --accent-foreground: oklch(0.3791 0.1378 265.5222);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9022 0.0052 247.8822);
  --input: oklch(0.9700 0.0029 264.5420);
  --ring: oklch(0.6397 0.1720 36.4421);
  --chart-1: oklch(0.7156 0.0605 248.6845);
  --chart-2: oklch(0.7875 0.0917 35.9616);
  --chart-3: oklch(0.5778 0.0759 254.1573);
  --chart-4: oklch(0.5016 0.0849 259.4902);
  --chart-5: oklch(0.4241 0.0952 264.0306);
  --sidebar: oklch(0.9030 0.0046 258.3257);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.6397 0.1720 36.4421);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9119 0.0222 243.8174);
  --sidebar-accent-foreground: oklch(0.3791 0.1378 265.5222);
  --sidebar-border: oklch(0.9276 0.0058 264.5313);
  --sidebar-ring: oklch(0.6397 0.1720 36.4421);
  --radius: 0.75rem;
  `,
  'Juicy citrus tones blended with cool accents, delivering a fresh and energetic aesthetic',
);

/**
 * Twitter theme
 */
export const twitterTheme = createThemeFromCSS(
  'twitter',
  'Twitter',
  `
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0.1884 0.0128 248.5103);
  --card: oklch(0.9784 0.0011 197.1387);
  --card-foreground: oklch(0.1884 0.0128 248.5103);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.1884 0.0128 248.5103);
  --primary: oklch(0.6723 0.1606 244.9955);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.1884 0.0128 248.5103);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.9222 0.0013 286.3737);
  --muted-foreground: oklch(0.1884 0.0128 248.5103);
  --accent: oklch(0.9392 0.0166 250.8453);
  --accent-foreground: oklch(0.6723 0.1606 244.9955);
  --destructive: oklch(0.6188 0.2376 25.7658);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9317 0.0118 231.6594);
  --input: oklch(0.9809 0.0025 228.7836);
  --ring: oklch(0.6818 0.1584 243.3540);
  --chart-1: oklch(0.6723 0.1606 244.9955);
  --chart-2: oklch(0.6907 0.1554 160.3454);
  --chart-3: oklch(0.8214 0.1600 82.5337);
  --chart-4: oklch(0.7064 0.1822 151.7125);
  --chart-5: oklch(0.5919 0.2186 10.5826);
  --sidebar: oklch(0.9784 0.0011 197.1387);
  --sidebar-foreground: oklch(0.1884 0.0128 248.5103);
  --sidebar-primary: oklch(0.6723 0.1606 244.9955);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9392 0.0166 250.8453);
  --sidebar-accent-foreground: oklch(0.6723 0.1606 244.9955);
  --sidebar-border: oklch(0.9271 0.0101 238.5177);
  --sidebar-ring: oklch(0.6818 0.1584 243.3540);
  --radius: 1.3rem;
  `,
  'Clean whites with iconic Twitter blue highlights, optimized for clarity and social interaction',
);

/**
 * Vercel theme
 */
export const vercelTheme = createThemeFromCSS(
  'vercel',
  'Vercel',
  `
  --background: oklch(0.9900 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(0.9900 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0 0 0);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.9400 0 0);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0.9700 0 0);
  --muted-foreground: oklch(0.4400 0 0);
  --accent: oklch(0.9400 0 0);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0.6300 0.1900 23.0300);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.9200 0 0);
  --input: oklch(0.9400 0 0);
  --ring: oklch(0 0 0);
  --chart-1: oklch(0.8100 0.1700 75.3500);
  --chart-2: oklch(0.5500 0.2200 264.5300);
  --chart-3: oklch(0.7200 0 0);
  --chart-4: oklch(0.9200 0 0);
  --chart-5: oklch(0.5600 0 0);
  --sidebar: oklch(0.9900 0 0);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0 0 0);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.9400 0 0);
  --sidebar-accent-foreground: oklch(0 0 0);
  --sidebar-border: oklch(0.9400 0 0);
  --sidebar-ring: oklch(0 0 0);
  --radius: 0.5rem;
  `,
  'Minimalist monochrome design with sharp contrasts, reflecting Vercel’s sleek and modern aesthetic',
);

/**
 * Vintage Paper theme
 */
export const vintagePaperTheme = createThemeFromCSS(
  'vintagePaper',
  'Vintage Paper',
  `
  --background: oklch(0.9582 0.0152 90.2357);
  --foreground: oklch(0.3760 0.0225 64.3434);
  --card: oklch(0.9914 0.0098 87.4695);
  --card-foreground: oklch(0.3760 0.0225 64.3434);
  --popover: oklch(0.9914 0.0098 87.4695);
  --popover-foreground: oklch(0.3760 0.0225 64.3434);
  --primary: oklch(0.6180 0.0778 65.5444);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8846 0.0302 85.5655);
  --secondary-foreground: oklch(0.4313 0.0300 64.9288);
  --muted: oklch(0.9239 0.0190 83.0636);
  --muted-foreground: oklch(0.5391 0.0387 71.1655);
  --accent: oklch(0.8348 0.0426 88.8064);
  --accent-foreground: oklch(0.3760 0.0225 64.3434);
  --destructive: oklch(0.5471 0.1438 32.9149);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8606 0.0321 84.5881);
  --input: oklch(0.8606 0.0321 84.5881);
  --ring: oklch(0.6180 0.0778 65.5444);
  --chart-1: oklch(0.6180 0.0778 65.5444);
  --chart-2: oklch(0.5604 0.0624 68.5805);
  --chart-3: oklch(0.4851 0.0570 72.6827);
  --chart-4: oklch(0.6777 0.0624 64.7755);
  --chart-5: oklch(0.7264 0.0581 66.6967);
  --sidebar: oklch(0.9239 0.0190 83.0636);
  --sidebar-foreground: oklch(0.3760 0.0225 64.3434);
  --sidebar-primary: oklch(0.6180 0.0778 65.5444);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8348 0.0426 88.8064);
  --sidebar-accent-foreground: oklch(0.3760 0.0225 64.3434);
  --sidebar-border: oklch(0.8606 0.0321 84.5881);
  --sidebar-ring: oklch(0.6180 0.0778 65.5444);
  --radius: 0.25rem;
  `,
  'Soft parchment tones with muted contrasts, evoking the warmth and texture of aged paper',
);

/**
 * Violet Bloom theme
 */
export const violetBloomTheme = createThemeFromCSS(
  'violetBloom',
  'Violet Bloom',
  `
  --background: oklch(0.9940 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(0.9940 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(0.9911 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.5393 0.2713 286.7462);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9540 0.0063 255.4755);
  --secondary-foreground: oklch(0.1344 0 0);
  --muted: oklch(0.9702 0 0);
  --muted-foreground: oklch(0.4386 0 0);
  --accent: oklch(0.9393 0.0288 266.3680);
  --accent-foreground: oklch(0.5445 0.1903 259.4848);
  --destructive: oklch(0.6290 0.1902 23.0704);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9300 0.0094 286.2156);
  --input: oklch(0.9401 0 0);
  --ring: oklch(0 0 0);
  --chart-1: oklch(0.7459 0.1483 156.4499);
  --chart-2: oklch(0.5393 0.2713 286.7462);
  --chart-3: oklch(0.7336 0.1758 50.5517);
  --chart-4: oklch(0.5828 0.1809 259.7276);
  --chart-5: oklch(0.5590 0 0);
  --sidebar: oklch(0.9777 0.0051 247.8763);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0 0 0);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9401 0 0);
  --sidebar-accent-foreground: oklch(0 0 0);
  --sidebar-border: oklch(0.9401 0 0);
  --sidebar-ring: oklch(0 0 0);
  --radius: 1.4rem;
  `,
  'Radiant purples with soft highlights, capturing the elegance and freshness of blooming violets',
);

/**
 * All available themes
 */
export const themes = [
  defaultTheme,
  amberMinimalTheme,
  amethystHazeTheme,
  blackTheme,
  boldTechTheme,
  bubblegumTheme,
  caffeineTheme,
  candylandTheme,
  catppuccinTheme,
  claudeTheme,
  claymorphismTheme,
  cleanSlateTheme,
  cosmicNightTheme,
  cyberpunkTheme,
  darkmatterTheme,
  doom64Theme,
  elegantLuxuryTheme,
  graphiteTheme,
  kodamaGraveTheme,
  midnightBloomTheme,
  mochaMousseTheme,
  monoTheme,
  natureTheme,
  neoBrutalismTheme,
  northernLightsTheme,
  notebookTheme,
  oceanBreezeTheme,
  pastelDreamsTheme,
  perpetuityTheme,
  quantumRoseTheme,
  retroArcadeTheme,
  softPopTheme,
  solarDuskTheme,
  starryNightTheme,
  sunsetHorizonTheme,
  supabaseTheme,
  t3chatTheme,
  tangerineTheme,
  twitterTheme,
  vercelTheme,
  vintagePaperTheme,
  violetBloomTheme,
] as const;
