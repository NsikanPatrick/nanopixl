// Defines constraints for each platform
export const PLATFORM_CONSTRAINTS = {
    amazon: { titleMaxLength: 200, bulletPoints: 5, descriptionMaxLength: 2000 },
    shopify: { titleMaxLength: 255, bulletPoints: 0, descriptionMaxLength: 5000 },
    woocommerce: { titleMaxLength: 255, bulletPoints: 0, descriptionMaxLength: 5000 },
    etsy: { titleMaxLength: 140, bulletPoints: 0, descriptionMaxLength: 5000 },
} as const;

export type SupportedPlatform = keyof typeof PLATFORM_CONSTRAINTS;