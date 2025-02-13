// Date formatter
export const formatDate = (text) => {
    if (!text) return 'N/A';
    return new Date(text).toLocaleString();
};

// System SKU formatter
export const formatSystemSku = (text) => {
    if (!text) return 'N/A';
    const parts = text.split('_');
    const thinkpadPart = parts.find(part => part.includes('ThinkPad'));
    if (thinkpadPart) {
        return parts.slice(parts.indexOf(thinkpadPart)).join(' ')
            .replace(/Gen (\d+)$/, 'Gen$1').trim();
    }
    return text;
};

// Operating System formatter
export const formatOS = (text) => {
    if (!text || text === 'N/A') return 'N/A';
    const osLower = text.toLowerCase();
    if (osLower.includes('windows')) {
        const mainVersion = osLower.includes('11') ? '11' : 
                        osLower.includes('10') ? '10' : '';
        const edition = osLower.includes('pro') ? 'Pro' :
                    osLower.includes('home') ? 'Home' : 
                    osLower.includes('enterprise') ? 'Enterprise' : '';
        return `Windows ${mainVersion} ${edition}`.trim();
    }
    return text;
}; 