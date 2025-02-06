import React, { useEffect, useState } from 'react';
import { Table, Select, Button, Space, Tooltip, Tag, Alert, message, Drawer } from 'antd';
import { QuestionCircleOutlined, EyeOutlined } from '@ant-design/icons';

const { Option } = Select;

const ColumnMappingStep = ({
    columnMapping,
    onMappingUpdate,
    categories,
    sheetData
}) => {
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewColumn, setPreviewColumn] = useState(null);
    const [previewData, setPreviewData] = useState([]);

    // 自動匹配列
    useEffect(() => {
        if (columnMapping.length > 0) {
            const newMapping = columnMapping.map(mapping => {
                const excelColumn = mapping.excelColumn.toLowerCase().trim();
                
                // 基本字段匹配
                if (excelColumn.includes('serial') || excelColumn.includes('sn')) {
                    return { ...mapping, targetField: 'serialnumber', status: 'matched' };
                }
                if (excelColumn.includes('cost') || excelColumn.includes('price')) {
                    return { ...mapping, targetField: 'cost', status: 'matched' };
                }
                if (excelColumn.includes('so') || excelColumn.includes('sales order')) {
                    return { ...mapping, targetField: 'so', status: 'matched' };
                }
                if (excelColumn.includes('note') || excelColumn.includes('remark')) {
                    return { ...mapping, targetField: 'note', status: 'matched' };
                }

                // 分類匹配
                const matchedCategory = categories.find(category => 
                    excelColumn.includes(category.name.toLowerCase())
                );
                if (matchedCategory) {
                    return {
                        ...mapping,
                        targetField: `category_${matchedCategory.id}`,
                        type: 'category',
                        status: 'matched'
                    };
                }

                return mapping;
            });

            onMappingUpdate(newMapping);
        }
    }, [columnMapping.length]); // 只在初始化時運行

    // 處理映射變更
    const handleMappingChange = (excelColumn, targetField) => {
        const newMapping = columnMapping.map(mapping => {
            if (mapping.excelColumn === excelColumn) {
                const isCategory = targetField?.startsWith('category_');
                return {
                    ...mapping,
                    targetField,
                    type: isCategory ? 'category' : 'basic',
                    status: targetField ? 'matched' : 'unmatched'
                };
            }
            return mapping;
        });

        onMappingUpdate(newMapping);
    };

    // 處理忽略列
    const handleIgnoreColumn = (excelColumn) => {
        const newMapping = columnMapping.map(mapping => {
            if (mapping.excelColumn === excelColumn) {
                return {
                    ...mapping,
                    targetField: null,
                    type: 'basic',
                    status: 'ignored'
                };
            }
            return mapping;
        });

        onMappingUpdate(newMapping);
    };

    // 獲取目標字段選項
    const getTargetFieldOptions = () => {
        const basicFields = [
            { value: 'serialnumber', label: 'Serial Number' },
            { value: 'cost', label: 'Cost' },
            { value: 'so', label: 'SO' },
            { value: 'note', label: 'Note' }
        ];

        const categoryFields = categories.map(category => ({
            value: `category_${category.id}`,
            label: category.name,
            type: 'category'
        }));

        return [...basicFields, ...categoryFields];
    };

    // 處理預覽
    const handlePreview = (columnName) => {
        const preview = sheetData.slice(0, 5).map((row, index) => ({
            key: index,
            value: row[columnName]
        }));
        setPreviewData(preview);
        setPreviewColumn(columnName);
        setPreviewVisible(true);
    };

    // 表格列定義
    const columns = [
        {
            title: 'Excel Column',
            dataIndex: 'excelColumn',
            key: 'excelColumn',
            width: '30%',
            render: (text) => (
                <Space>
                    {text}
                    <Button 
                        type="link" 
                        icon={<EyeOutlined />}
                        onClick={() => handlePreview(text)}
                    />
                </Space>
            )
        },
        {
            title: 'Map To',
            dataIndex: 'targetField',
            key: 'targetField',
            width: '40%',
            render: (targetField, record) => (
                <Select
                    style={{ width: '100%' }}
                    value={targetField}
                    onChange={(value) => handleMappingChange(record.excelColumn, value)}
                    placeholder="Select a field"
                    allowClear
                >
                    {getTargetFieldOptions().map(option => (
                        <Option 
                            key={option.value} 
                            value={option.value}
                            disabled={columnMapping.some(m => 
                                m.targetField === option.value && 
                                m.excelColumn !== record.excelColumn
                            )}
                        >
                            {option.label}
                        </Option>
                    ))}
                </Select>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: '15%',
            render: (status) => {
                const statusColors = {
                    matched: 'success',
                    unmatched: 'warning',
                    ignored: 'default'
                };
                return <Tag color={statusColors[status]}>{status.toUpperCase()}</Tag>;
            }
        },
        {
            title: 'Action',
            key: 'action',
            width: '15%',
            render: (_, record) => (
                <Space>
                    {record.status !== 'ignored' ? (
                        <Button 
                            size="small" 
                            onClick={() => handleIgnoreColumn(record.excelColumn)}
                        >
                            Ignore
                        </Button>
                    ) : (
                        <Button 
                            size="small"
                            onClick={() => handleMappingChange(record.excelColumn, null)}
                        >
                            Include
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    // 預覽表格列定義
    const previewColumns = [
        {
            title: 'Row',
            dataIndex: 'key',
            key: 'key',
            width: '20%',
            render: (text) => `Row ${text + 1}`
        },
        {
            title: 'Value',
            dataIndex: 'value',
            key: 'value',
            width: '80%'
        }
    ];

    return (
        <div>
            <Alert
                message="Column Mapping"
                description="Map Excel columns to corresponding PO fields. Required fields are Serial Number and Cost."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />
            <Table
                dataSource={columnMapping}
                columns={columns}
                rowKey="excelColumn"
                pagination={false}
                size="middle"
            />

            <Drawer
                title={`Preview: ${previewColumn || ''}`}
                placement="right"
                onClose={() => setPreviewVisible(false)}
                open={previewVisible}
                width={400}
            >
                <Table
                    dataSource={previewData}
                    columns={previewColumns}
                    pagination={false}
                    size="small"
                />
                <div style={{ marginTop: 16 }}>
                    <Alert
                        message="Note"
                        description="Showing first 5 rows of data"
                        type="info"
                        showIcon
                    />
                </div>
            </Drawer>
        </div>
    );
};

export default ColumnMappingStep; 