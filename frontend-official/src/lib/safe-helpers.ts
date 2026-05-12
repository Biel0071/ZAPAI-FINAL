/**
 * Safe string helpers to prevent runtime crashes (e.g., from replaceAll on undefined or older browsers)
 */
export const safeString = (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value);
};

export const safeReplaceAll = (str: any, search: string | RegExp, replacement: string): string => {
    const safeStr = safeString(str);
    if (typeof safeStr.replaceAll === "function") {
        return safeStr.replaceAll(search, replacement);
    }
    // Fallback for environments where replaceAll is not available (older browsers)
    if (typeof search === "string") {
        return safeStr.split(search).join(replacement);
    } else if (search instanceof RegExp) {
        const globalRegex = new RegExp(search, search.flags.includes("g") ? search.flags : search.flags + "g");
        return safeStr.replace(globalRegex, replacement);
    }
    return safeStr;
};

export const safeToLowerCase = (str: any): string => safeString(str).toLowerCase();
export const safeToUpperCase = (str: any): string => safeString(str).toUpperCase();
export const safeTrim = (str: any): string => safeString(str).trim();

/**
 * Safe array helpers to prevent undefined.map() crashes
 */
export const safeArray = <T>(value: any): T[] => {
    return Array.isArray(value) ? value : [];
};