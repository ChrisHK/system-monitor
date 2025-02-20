const ChecksumCalculator = require('../utils/checksumCalculator');

// 簡化的測試數據
const testData = [{
    battery: {
        cycle_count: 50.0,
        design_capacity: 6000.0,
        health: 98.0
    },
    disks: [{
        size_gb: 512.0
    }],
    manufacturer: 'Dell',
    model: 'Latitude 5420',
    ram_gb: 16.0,
    serialnumber: 'TEST123'
}];

// 預期的校驗和（只使用 serialnumber）
const EXPECTED_CHECKSUM = 'd652fb5fb7401eb2c29935761df72dbbafaf78ea4268d9ef2875c1e8195a55b8';

console.log('\n=== Checksum Test (Only using serialnumber) ===\n');

// 1. 顯示原始數據
console.log('1. Original Data:');
console.log(JSON.stringify(testData, null, 2));

// 2. 顯示規範化後的數據
const normalizedItem = ChecksumCalculator.normalizeItem(testData[0]);
console.log('\n2. Normalized Item:');
console.log(JSON.stringify(normalizedItem, null, 2));

// 3. 顯示排序後的數據
const sortedItems = [normalizedItem].sort((a, b) => 
    a.serialnumber.localeCompare(b.serialnumber)
);
console.log('\n3. Sorted Items:');
console.log(JSON.stringify(sortedItems, null, 2));

// 4. 顯示 JSON 字符串
const jsonString = JSON.stringify(sortedItems);
console.log('\n4. JSON String for Checksum:');
console.log(jsonString);
console.log('String length:', jsonString.length);

// 5. 使用 ChecksumCalculator 計算校驗和
const calculatedChecksum = ChecksumCalculator.calculate(testData);

// 6. 顯示結果
console.log('\n5. Results:');
console.log('Expected: ', EXPECTED_CHECKSUM);
console.log('Calculated:', calculatedChecksum);
console.log('Match:', calculatedChecksum === EXPECTED_CHECKSUM);

// 7. 顯示完整請求格式
const fullRequest = {
    source: 'python_sync',
    timestamp: '2025-02-19T19:45:51.564804+00:00',
    batch_id: 'SYNC_20250219144551',
    items: testData,
    metadata: {
        total_items: 1,
        version: '1.0',
        checksum: calculatedChecksum
    }
};

console.log('\n6. Full Request Format:');
console.log(JSON.stringify(fullRequest, null, 2)); 