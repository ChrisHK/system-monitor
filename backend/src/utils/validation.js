// 驗證群組數據
const validateGroupData = (data) => {
    const { name, description, permitted_stores, store_permissions } = data;

    if (!name) {
        return 'Group name is required';
    }

    if (name.length < 2 || name.length > 50) {
        return 'Group name must be between 2 and 50 characters';
    }

    if (description && description.length > 500) {
        return 'Description cannot exceed 500 characters';
    }

    // 檢查名稱格式（只允許字母、數字、下劃線和連字符）
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return 'Group name can only contain letters, numbers, underscores and hyphens';
    }

    // 檢查 permitted_stores 或 store_permissions
    if ((!permitted_stores || !Array.isArray(permitted_stores) || permitted_stores.length === 0) &&
        (!store_permissions || Object.keys(store_permissions).length === 0)) {
        return 'At least one store must be selected';
    }

    // 如果有 permitted_stores，檢查每個 store ID 是否為有效的數字
    if (permitted_stores && Array.isArray(permitted_stores) && 
        !permitted_stores.every(id => Number.isInteger(id) && id > 0)) {
        return 'Invalid store ID format';
    }

    return null;
};

// RMA Status Flow definition
const RMA_STATUS_FLOW = {
    'pending': ['sent_to_inventory'],
    'sent_to_inventory': ['receive'],
    'receive': ['process', 'failed'],
    'process': ['complete', 'failed'],
    'complete': ['sent_to_store'],
    'failed': []
};

// Validate RMA status transition
const validateRmaStatus = (currentStatus, newStatus) => {
    const allowedTransitions = RMA_STATUS_FLOW[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
    return true;
};

module.exports = {
    validateGroupData,
    validateRmaStatus,
    RMA_STATUS_FLOW
}; 