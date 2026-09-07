/**
 * Loads a .gbtk file (which is a zip containing pack.json and assets)
 * @param {File} file 
 * @returns {Promise<TokenPack>}
 */
export const loadGBTKPack = async (file) => {
    try {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(file);

        // 1. Read pack.json
        const packFile = zip.file("pack.json");
        if (!packFile) {
            throw new Error("Invalid .gbtk file: custom pack manifest (pack.json) not found.");
        }

        const manifestText = await packFile.async("string");
        const manifest = JSON.parse(manifestText);

        // 2. Validate Manifest
        if (!manifest.name || !manifest.tokens) {
            throw new Error("Invalid pack.json format: missing name or tokens.");
        }

        // 3. Extract Tokens
        const loadedTokens = [];

        for (const tokenDef of manifest.tokens) {
            // Support both inline SVG (if we ever do that) or file paths
            // The python script creates a folder "tokens/" and puts files there.
            // The manifest token object likely has { id, name, file: "tokens/filename.svg" }

            if (tokenDef.file) {
                const svgFile = zip.file(tokenDef.file);
                if (svgFile) {
                    const svgContent = await svgFile.async("string");
                    loadedTokens.push({
                        id: tokenDef.id,
                        name: tokenDef.name,
                        sourcePack: manifest.name,
                        svgContent: sanitizeSVG(svgContent)
                    });
                }
            } else if (tokenDef.svgContent) {
                // If the pack was built with inline content (unlikely but possible)
                loadedTokens.push({
                    ...tokenDef,
                    sourcePack: manifest.name,
                    svgContent: sanitizeSVG(tokenDef.svgContent)
                });
            }
        }

        return {
            name: manifest.name,
            author: manifest.author || "Unknown",
            version: manifest.version || "1.0",
            tokens: loadedTokens,
            isInternal: false
        };

    } catch (error) {
        console.error("Failed to load GBTK pack:", error);
        throw error;
    }
};

/**
 * Basic SVG Sanitizer to remove scripts and potentially malicious tags
 * @param {string} svg 
 * @returns {string}
 */
const sanitizeSVG = (svg) => {
    // This is a naive sanitizer. for production, use DOMPurify
    // Remove <script> tags
    let clean = svg.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");

    // Remove onEvent attributes
    clean = clean.replace(/\son\w+="[^"]*"/gim, "");

    // Ensure namespace is present if missing
    if (!clean.includes('xmlns="http://www.w3.org/2000/svg"')) {
        clean = clean.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return clean;
};
