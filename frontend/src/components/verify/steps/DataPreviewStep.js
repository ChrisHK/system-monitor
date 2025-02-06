import React from 'react';
import { Alert, Table, Card, Descriptions, Space, Tag } from 'antd';
import moment from 'moment';

const DataPreviewStep = ({
    processedData,
    columnMapping,
    categories,
    sheetData,
    tagMatches
}) => {
    // 生成預覽數據
    const generatePreviewData = () => {
        if (!sheetData || !columnMapping) return [];

        return sheetData.map(row => {
            const item = {};

            // 處理基本字段
            columnMapping.forEach(mapping => {
                if (mapping.status === 'matched') {
                    if (mapping.type === 'basic') {
                        item[mapping.targetField] = row[mapping.excelColumn];
                    }
                }
            });

            // 處理分類標籤
            item.categories = [];
            columnMapping
                .filter(mapping => mapping.type === 'category' && mapping.status === 'matched')
                .forEach(mapping => {
                    const categoryId = mapping.targetField.split('_')[1];
                    const value = row[mapping.excelColumn];
                    if (value && tagMatches?.[categoryId]) {
                        const match = tagMatches[categoryId].find(m => m.value === value);
                        if (match?.tagId) {
                            item.categories.push({
                                category_id: parseInt(categoryId),
                                tag_id: match.tagId
                            });
                        }
                    }
                });

            return item;
        });
    };

    // 獲取表格列定義
    const getColumns = () => {
        const columns = [
            {
                title: 'Serial Number',
                dataIndex: 'serialnumber',
                key: 'serialnumber',
                width: 150,
                fixed: 'left'
            }
        ];

        // 添加分類列
        categories.forEach(category => {
            columns.push({
                title: category.name,
                key: `category_${category.id}`,
                width: 120,
                render: (_, record) => {
                    const categoryData = record.categories.find(
                        cat => cat.category_id === category.id
                    );
                    if (!categoryData) return '-';
                    
                    // 找到對應的標籤名稱
                    const tagMatch = tagMatches[category.id]?.find(
                        m => m.tagId === categoryData.tag_id
                    );
                    return tagMatch ? (
                        <Tag color="blue">{tagMatch.value}</Tag>
                    ) : '-';
                }
            });
        });

        // 添加其他基本列
        columns.push(
            {
                title: 'Cost',
                dataIndex: 'cost',
                key: 'cost',
                width: 100,
                render: (cost) => cost ? `$${Number(cost).toFixed(2)}` : '-'
            },
            {
                title: 'SO',
                dataIndex: 'so',
                key: 'so',
                width: 100
            },
            {
                title: 'Note',
                dataIndex: 'note',
                key: 'note',
                width: 150
            }
        );

        return columns;
    };

    // 計算總成本
    const calculateTotalCost = (data) => {
        return data.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
    };

    const previewData = generatePreviewData();
    const totalCost = calculateTotalCost(previewData);

    return (
        <div>
            <Alert
                message="Data Preview"
                description="Review the processed data before creating the purchase order."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* PO 基本信息 */}
                <Card title="Purchase Order Information">
                    <Descriptions column={2}>
                        <Descriptions.Item label="PO Number">
                            {moment().format('YYYYMMDD')}001
                        </Descriptions.Item>
                        <Descriptions.Item label="Date">
                            {moment().format('YYYY-MM-DD')}
                        </Descriptions.Item>
                        <Descriptions.Item label="Total Amount">
                            ${totalCost.toFixed(2)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Total Items">
                            {previewData.length}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* 項目列表 */}
                <Card title="Item List">
                    <Table
                        dataSource={previewData}
                        columns={getColumns()}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        size="small"
                        rowKey={(record, index) => index}
                        summary={pageData => {
                            const total = calculateTotalCost(pageData);
                            return (
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={categories.length + 1}>
                                        <strong>Total Cost</strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={categories.length + 1}>
                                        <strong>${total.toFixed(2)}</strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={categories.length + 2} colSpan={2} />
                                </Table.Summary.Row>
                            );
                        }}
                    />
                </Card>
            </Space>
        </div>
    );
};

export default DataPreviewStep; 