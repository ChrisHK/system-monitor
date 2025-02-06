import React, { useState, useEffect } from 'react';
import { Alert, Collapse, Table, Tag, Button, Space, Select, message } from 'antd';
import poService from '../../../services/poService';

const { Panel } = Collapse;
const { Option } = Select;

const TagMatchingStep = ({ 
    columnMapping,
    sheetData,
    categories,
    tagMatches: initialTagMatches,
    onTagMatchesUpdate
}) => {
    const [categoryTags, setCategoryTags] = useState({});
    const [tagMatches, setTagMatches] = useState(initialTagMatches || {});
    const [loading, setLoading] = useState({});

    // 加載分類的標籤
    const loadCategoryTags = async (categoryId) => {
        try {
            setLoading(prev => ({ ...prev, [categoryId]: true }));
            const response = await poService.getTagsByCategory(categoryId);
            if (response?.data?.tags) {
                const tags = response.data.tags;
                setCategoryTags(prev => ({
                    ...prev,
                    [categoryId]: tags
                }));
                // 自動匹配現有標籤
                autoMatchTags(categoryId, tags);
            }
        } catch (error) {
            message.error(`Failed to load tags for category ${categoryId}`);
        } finally {
            setLoading(prev => ({ ...prev, [categoryId]: false }));
        }
    };

    // 自動匹配標籤
    const autoMatchTags = (categoryId, tags) => {
        const currentMatches = tagMatches[categoryId] || [];
        if (currentMatches.length === 0) return;

        const newMatches = currentMatches.map(match => {
            // 查找完全匹配的標籤
            const exactMatch = tags.find(tag => 
                tag.name.toLowerCase() === match.value.toLowerCase()
            );
            if (exactMatch) {
                return {
                    ...match,
                    tagId: exactMatch.id,
                    status: 'matched'
                };
            }
            return match;
        });

        setTagMatches(prev => ({
            ...prev,
            [categoryId]: newMatches
        }));
    };

    // 自動匹配所有分類的標籤
    const autoMatchAllCategories = () => {
        columnMapping
            .filter(col => col.type === 'category' && col.status === 'matched')
            .forEach(col => {
                const categoryId = col.targetField.split('_')[1];
                const tags = categoryTags[categoryId] || [];
                if (tags.length > 0) {
                    autoMatchTags(categoryId, tags);
                }
            });
    };

    // 當組件掛載或重新進入時自動匹配
    useEffect(() => {
        if (Object.keys(categoryTags).length > 0) {
            autoMatchAllCategories();
        }
    }, [categoryTags]);

    // 初始化標籤匹配
    useEffect(() => {
        const categoryColumns = columnMapping.filter(
            col => col.type === 'category' && col.status === 'matched'
        );

        // 為每個分類加載標籤
        categoryColumns.forEach(col => {
            const categoryId = col.targetField.split('_')[1];
            
            // 獲取該列的唯一值
            const uniqueValues = [...new Set(
                sheetData.map(row => row[col.excelColumn])
            )].filter(Boolean);

            // 初始化匹配狀態（如果還沒有）
            if (!tagMatches[categoryId]) {
                setTagMatches(prev => ({
                    ...prev,
                    [categoryId]: uniqueValues.map(value => ({
                        value,
                        tagId: null,
                        status: 'unmatched'
                    }))
                }));
            }

            // 加載標籤
            loadCategoryTags(categoryId);
        });
    }, [columnMapping, sheetData]);

    // 當 tagMatches 更新時通知父組件
    useEffect(() => {
        onTagMatchesUpdate(tagMatches);
    }, [tagMatches]);

    // 處理標籤搜索和創建
    const handleTagSearch = (categoryId, searchValue, record) => {
        if (!searchValue) return;

        const tags = categoryTags[categoryId] || [];
        const exists = tags.some(
            tag => tag.name.toLowerCase() === searchValue.toLowerCase()
        );

        if (!exists) {
            // 添加創建新標籤的選項
            setCategoryTags(prev => ({
                ...prev,
                [categoryId]: [
                    ...(prev[categoryId] || []),
                    {
                        id: `new-${searchValue}`,
                        name: `Add "${searchValue}"`,
                        isNew: true,
                        value: searchValue
                    }
                ]
            }));
        }
    };

    // 處理標籤選擇
    const handleTagSelect = async (categoryId, value, tagId) => {
        try {
            // 檢查是否選擇了創建新標籤的選項
            if (typeof tagId === 'string' && tagId.startsWith('new-')) {
                const tagName = categoryTags[categoryId].find(t => t.id === tagId)?.value;
                if (tagName) {
                    // 創建新標籤
                    const response = await poService.createTag({
                        name: tagName,
                        category_id: categoryId
                    });

                    if (response?.data?.success) {
                        message.success('Tag created successfully');
                        // 重新加載該分類的標籤
                        await loadCategoryTags(categoryId);
                        // 使用新創建的標籤ID
                        tagId = response.data.tag.id;
                    } else {
                        throw new Error('Failed to create tag');
                    }
                }
            }

            // 更新匹配狀態
            setTagMatches(prev => ({
                ...prev,
                [categoryId]: (prev[categoryId] || []).map(match => 
                    match.value === value 
                        ? { ...match, tagId, status: tagId ? 'matched' : 'unmatched' }
                        : match
                )
            }));
        } catch (error) {
            message.error('Failed to create tag');
        }
    };

    // 獲取表格列定義
    const getColumns = (categoryId) => [
        {
            title: 'Value',
            dataIndex: 'value',
            key: 'value',
            width: '40%'
        },
        {
            title: 'Tag',
            key: 'tag',
            width: '40%',
            render: (_, record) => (
                <Select
                    style={{ width: '100%' }}
                    value={record.tagId}
                    onChange={(tagId) => handleTagSelect(categoryId, record.value, tagId)}
                    placeholder="Select a tag"
                    allowClear
                    showSearch
                    onSearch={(value) => handleTagSearch(categoryId, value, record)}
                    filterOption={(input, option) => {
                        if (option.isNew) return true;
                        return option.children.toLowerCase().includes(input.toLowerCase());
                    }}
                >
                    {(categoryTags[categoryId] || []).map(tag => (
                        <Option 
                            key={tag.id} 
                            value={tag.id}
                            isNew={tag.isNew}
                        >
                            {tag.name}
                        </Option>
                    ))}
                </Select>
            )
        },
        {
            title: 'Status',
            key: 'status',
            width: '20%',
            render: (_, record) => (
                <Tag color={record.status === 'matched' ? 'success' : 'warning'}>
                    {record.status.toUpperCase()}
                </Tag>
            )
        }
    ];

    // 獲取分類的匹配狀態
    const getCategoryStatus = (categoryId) => {
        const matches = tagMatches[categoryId] || [];
        const total = matches.length;
        const matched = matches.filter(m => m.status === 'matched').length;
        return { total, matched };
    };

    return (
        <div>
            <Alert
                message="Tag Matching"
                description="Match the values in category columns to corresponding tags."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />
            <Collapse defaultActiveKey={[]}>
                {columnMapping
                    .filter(col => col.type === 'category' && col.status === 'matched')
                    .map(col => {
                        const categoryId = col.targetField.split('_')[1];
                        const category = categories.find(c => c.id === parseInt(categoryId));
                        const { total, matched } = getCategoryStatus(categoryId);
                        
                        return (
                            <Panel 
                                key={categoryId}
                                header={
                                    <Space>
                                        {category?.name}
                                        <Tag color={matched === total ? 'success' : 'warning'}>
                                            {matched}/{total} Matched
                                        </Tag>
                                    </Space>
                                }
                            >
                                <Table
                                    dataSource={tagMatches[categoryId] || []}
                                    columns={getColumns(categoryId)}
                                    rowKey="value"
                                    pagination={false}
                                    size="small"
                                    loading={loading[categoryId]}
                                />
                            </Panel>
                        );
                    })
                }
            </Collapse>
        </div>
    );
};

export default TagMatchingStep; 