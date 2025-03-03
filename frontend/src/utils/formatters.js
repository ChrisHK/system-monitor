import moment from 'moment';

// Date formatter - 主要的時間格式化函數
export const formatDate = (text) => {
    if (!text) return 'N/A';
    const date = moment(text);
    if (!date.isValid()) {
        return 'Invalid Date';
    }
    return date.format('YYYY-MM-DD HH:mm:ss');
};

// CSV Date formatter - 用於 CSV 導出
export const formatDateForCSV = (text) => {
    if (!text) return 'N/A';
    const date = moment(text);
    if (!date.isValid()) {
        return 'Invalid Date';
    }
    return date.format('YYYY-MM-DD HH:mm:ss');
};

// Sort Date - 用於表格排序
export const sortDate = (dateA, dateB) => {
    if (!dateA && !dateB) return 0;
    if (!dateA) return -1;
    if (!dateB) return 1;
    
    const momentA = moment(dateA);
    const momentB = moment(dateB);
    
    if (!momentA.isValid() && !momentB.isValid()) return 0;
    if (!momentA.isValid()) return -1;
    if (!momentB.isValid()) return 1;
    
    return momentA.valueOf() - momentB.valueOf();
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

// Disks formatter
export const formatDisks = (text) => {
    if (!text) return 'N/A';
    return text.replace(/"/g, '');
}; 