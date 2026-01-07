export const CorePack = {
    name: "Core Assets",
    author: "Gamebook Studio",
    version: "1.0.0",
    isInternal: true,
    tokens: [
        {
            id: "core_meeple",
            name: "Meeple",
            sourcePack: "Core Assets",
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 10 C 40 10, 40 25, 50 25 C 60 25, 60 10, 50 10 z M 30 35 L 70 35 L 70 60 C 70 65, 65 65, 65 60 L 60 60 L 60 85 L 75 90 L 75 95 L 25 95 L 25 90 L 40 85 L 40 60 L 35 60 C 35 65, 30 65, 30 60 z" fill="currentColor"/></svg>`
        },
        {
            id: "core_circle",
            name: "Circle",
            sourcePack: "Core Assets",
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="currentColor"/></svg>`
        },
        {
            id: "core_square",
            name: "Square",
            sourcePack: "Core Assets",
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="currentColor"/></svg>`
        },
        {
            id: "core_star",
            name: "Star",
            sourcePack: "Core Assets",
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50 15 61 38 86 38 66 53 74 77 50 63 26 77 34 53 14 38 39 38" fill="currentColor"/></svg>`
        },
        {
            id: "core_skull",
            name: "Skull",
            sourcePack: "Core Assets",
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 15 C30 15 15 30 15 50 C15 70 25 80 25 85 L75 85 C75 80 85 70 85 50 C85 30 70 15 50 15 Z M35 55 A5 5 0 0 1 45 55 A5 5 0 0 1 35 55 Z M55 55 A5 5 0 0 1 65 55 A5 5 0 0 1 55 55 Z" fill="currentColor"/></svg>`
        },
        {
            id: "core_shield",
            name: "Shield",
            sourcePack: "Core Assets",
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12c5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>`
        },
        {
            id: "core_swords",
            name: "Swords",
            sourcePack: "Core Assets",
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6.92 5c.38 0 .74.15 1.01.42l8.48 8.48c.55.55.55 1.45 0 2a1.44 1.44 0 0 1-2.02 0l-8.48-8.48A1.405 1.405 0 0 1 6.92 5M18.5 7.5L13 13l4.5 4.5l-1.5 1.5L11.5 14.5L7 19H5v-2l4.5-4.5L5 8l1.5-1.5L11 11l5.5-5.5l2 2Z"/></svg>`
        }
    ]
};
