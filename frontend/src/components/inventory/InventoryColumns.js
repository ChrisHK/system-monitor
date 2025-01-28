import { Tag } from 'antd';
import { formatDate, formatSystemSku, formatOS } from '../../utils/formatters';
import { useMemo } from 'react';

// Add modern forced colors mode styles
const tagStyle = {
    minWidth: '80px',
    textAlign: 'center'
};

export const createInventoryColumns = ({ 
    itemLocations, 
    duplicateSerials, 
    handleDelete, 
    handleEdit, 
    userRole 
}) => [
    {
        title: 'Location',
        dataIndex: 'serialnumber',
        key: 'location',
        width: 120,
        render: (serialnumber) => {
            const location = itemLocations[serialnumber];
            console.log('Rendering location for:', serialnumber, location);
            
            if (!location) {
                return <Tag color="default" style={tagStyle}>Unknown</Tag>;
            }
            
            if (location.location === 'store' && location.store_name) {
                return (
                    <Tag color="blue" style={tagStyle}>
                        {location.store_name}
                    </Tag>
                );
            }
            
            return (
                <Tag color="green" style={tagStyle}>
                    Inventory
                </Tag>
            );
        },
        sorter: (a, b) => {
            const locA = itemLocations[a.serialnumber]?.store_name || 'zzzz';
            const locB = itemLocations[b.serialnumber]?.store_name || 'zzzz';
            return locA.localeCompare(locB);
        }
    },
    {
        title: 'Serial Number',
        dataIndex: 'serialnumber',
        key: 'serialnumber',
        width: 150,
        filterable: true,
        render: (text) => {
            const isDuplicate = duplicateSerials.has(text);
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {text}
                    {isDuplicate && (
                        <Tag style={tagStyle} color="red">
                            Duplicate
                        </Tag>
                    )}
                </div>
            );
        }
    },
    {
        title: 'Computer Name',
        dataIndex: 'computername',
        key: 'computername',
        width: 150,
        filterable: true
    },
    {
        title: 'Manufacturer',
        dataIndex: 'manufacturer',
        key: 'manufacturer',
        width: 100,
        filterable: true
    },
    {
        title: 'Model',
        dataIndex: 'model',
        key: 'model',
        width: 120,
        filterable: true
    },
    {
        title: 'System SKU',
        dataIndex: 'systemsku',
        key: 'systemsku',
        width: 150,
        filterable: true,
        render: formatSystemSku
    },
    {
        title: 'Operating System',
        dataIndex: 'operatingsystem',
        key: 'operatingsystem',
        width: 150,
        render: formatOS
    },
    {
        title: 'CPU',
        dataIndex: 'cpu',
        key: 'cpu',
        width: 180,
        render: (text) => {
            if (!text || text === 'N/A') return 'N/A';
            return text.replace(/\s*\([^)]*\)/g, '').trim();
        }
    },
    {
        title: 'Resolution',
        dataIndex: 'resolution',
        key: 'resolution',
        width: 120
    },
    {
        title: 'Graphics Card',
        dataIndex: 'graphicscard',
        key: 'graphicscard',
        width: 150,
        render: (text) => {
            if (!text || text === 'N/A') return 'N/A';
            return text.split('[')[0].trim();
        }
    },
    {
        title: 'Touch Screen',
        dataIndex: 'touchscreen',
        key: 'touchscreen',
        width: 100,
        render: (value) => value ? 'Yes' : 'No'
    },
    {
        title: 'RAM (GB)',
        dataIndex: 'ram_gb',
        key: 'ram_gb',
        width: 100,
        render: (text) => text || 'N/A'
    },
    {
        title: 'Disks',
        dataIndex: 'disks',
        key: 'disks',
        width: 150,
        render: (text) => text || 'N/A'
    },
    {
        title: 'Design Capacity',
        dataIndex: 'design_capacity',
        key: 'design_capacity',
        width: 120,
        render: (text) => text || 'N/A'
    },
    {
        title: 'Full Charge',
        dataIndex: 'full_charge_capacity',
        key: 'full_charge_capacity',
        width: 120,
        render: (text) => text || 'N/A'
    },
    {
        title: 'Cycle Count',
        dataIndex: 'cycle_count',
        key: 'cycle_count',
        width: 100,
        render: (text) => text || 'N/A'
    },
    {
        title: 'Battery Health',
        dataIndex: 'battery_health',
        key: 'battery_health',
        width: 120,
        render: (health) => {
            let color = 'green';
            if (health < 50) color = 'red';
            else if (health < 80) color = 'orange';
            return health ? <Tag color={color}>{health}%</Tag> : 'N/A';
        }
    },
    {
        title: 'Created Time',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 150,
        render: formatDate
    }
];

const memoizedColumns = useMemo(() => 
  createInventoryColumns({/* 參數 */}),
  [itemLocations, duplicateSerials] // 依賴項
); 