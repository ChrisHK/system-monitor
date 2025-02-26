const moment = require('moment');

// Date formatter - 主要的時間格式化函數
exports.formatDate = (text) => {
    if (!text) return 'N/A';
    return moment(text).format('YYYY-MM-DD HH:mm:ss');
};

// CSV Date formatter - 用於 CSV 導出
exports.formatDateForCSV = (text) => {
    if (!text) return 'N/A';
    return moment(text).format('YYYY-MM-DD HH:mm:ss');
}; 