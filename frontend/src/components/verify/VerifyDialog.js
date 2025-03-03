import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, message, Row, Col, Select, Text } from 'antd';
import ColumnMappingStep from './steps/ColumnMappingStep';
import TagMatchingStep from './steps/TagMatchingStep';
import DataPreviewStep from './steps/DataPreviewStep';

const { Step } = Steps;

const VerifyDialog = ({ 
    visible, 
    onCancel, 
    onComplete,
    sheetData,
    categories
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [columnMapping, setColumnMapping] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processedData, setProcessedData] = useState(null);
    const [tagMatches, setTagMatches] = useState({});
    const [mappings, setMappings] = useState({});

    // 初始化時獲取Excel的列
    useEffect(() => {
        if (sheetData && sheetData.length > 0) {
            // 獲取Excel的列名
            const excelColumns = Object.keys(sheetData[0]);
            
            // 創建初始映射
            const initialMapping = excelColumns.map(column => ({
                excelColumn: column,
                targetField: null,
                type: 'basic',
                status: 'unmatched'
            }));

            setColumnMapping(initialMapping);
        }
    }, [sheetData]);

    useEffect(() => {
        if (visible && categories?.length > 0 && sheetData && sheetData.length > 0) {
            // 初始化映射
            const initialMappings = {};
            // Get headers from the first row's keys
            const headers = Object.keys(sheetData[0]);
            headers.forEach(header => {
                // 嘗試找到最匹配的分類
                const matchedCategory = categories.find(cat => 
                    cat.name.toLowerCase() === header.toLowerCase()
                );
                if (matchedCategory) {
                    initialMappings[header] = matchedCategory.id;
                }
            });
            setMappings(initialMappings);
        }
    }, [visible, categories, sheetData]);

    // 處理步驟變化
    const handleStepChange = (step) => {
        setCurrentStep(step);
    };

    // 處理列映射更新
    const handleMappingUpdate = (newMapping) => {
        setColumnMapping(newMapping);
    };

    // 處理標籤匹配更新
    const handleTagMatchesUpdate = (newMatches) => {
        setTagMatches(newMatches);
    };

    const handleMapping = (header, categoryId) => {
        setMappings(prev => ({
            ...prev,
            [header]: categoryId
        }));
    };

    // 處理下一步
    const handleNext = () => {
        if (currentStep === 0) {
            // 驗證是否完成必要的映射
            const requiredFields = ['serialnumber', 'cost'];
            const mapped = columnMapping.filter(m => m.status === 'matched');
            const hasMissingRequired = requiredFields.some(field => 
                !mapped.find(m => m.targetField === field)
            );

            if (hasMissingRequired) {
                message.error('Please map all required fields (Serial Number and Cost)');
                return;
            }
        } else if (currentStep === 1) {
            // 驗證是否所有分類都已匹配
            const categoryColumns = columnMapping.filter(
                col => col.type === 'category' && col.status === 'matched'
            );
            
            const hasUnmatched = categoryColumns.some(col => {
                const categoryId = col.targetField.split('_')[1];
                const matches = tagMatches[categoryId] || [];
                return matches.some(match => match.status === 'unmatched');
            });

            if (hasUnmatched) {
                message.warning('Some tags are not matched. Continue anyway?');
            }
        }
        setCurrentStep(currentStep + 1);
    };

    // 處理上一步
    const handlePrev = () => {
        setCurrentStep(currentStep - 1);
    };

    // 處理完成
    const handleComplete = () => {
        // 生成處理後的數據
        const processedItems = sheetData.map(row => {
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
                    if (value && tagMatches[categoryId]) {
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

        // 保存到 localStorage 以便在 AddEditPOPage 中使用
        localStorage.setItem('importedItems', JSON.stringify(processedItems));
        
        // 關閉對話框並導航到添加頁面
        onCancel();
        onComplete(processedItems);
    };

    // 渲染步驟內容
    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <ColumnMappingStep
                        columnMapping={columnMapping}
                        onMappingUpdate={handleMappingUpdate}
                        categories={categories}
                        sheetData={sheetData}
                    />
                );
            case 1:
                return (
                    <TagMatchingStep
                        columnMapping={columnMapping}
                        categories={categories}
                        sheetData={sheetData}
                        tagMatches={tagMatches}
                        onTagMatchesUpdate={handleTagMatchesUpdate}
                    />
                );
            case 2:
                return (
                    <DataPreviewStep
                        processedData={processedData}
                        columnMapping={columnMapping}
                        categories={categories}
                        sheetData={sheetData}
                        tagMatches={tagMatches}
                    />
                );
            default:
                return null;
        }
    };

    // 渲染底部按鈕
    const renderFooter = () => {
        return (
            <div style={{ marginTop: 24 }}>
                {currentStep > 0 && (
                    <Button style={{ marginRight: 8 }} onClick={handlePrev}>
                        Previous
                    </Button>
                )}
                {currentStep < 2 ? (
                    <Button type="primary" onClick={handleNext}>
                        Next
                    </Button>
                ) : (
                    <Button 
                        type="primary" 
                        onClick={handleComplete}
                        loading={loading}
                    >
                        Confirm
                    </Button>
                )}
            </div>
        );
    };

    return (
        <Modal
            title="Verify Import Data"
            open={visible}
            onCancel={onCancel}
            width={1000}
            footer={null}
            destroyOnClose
        >
            <Steps current={currentStep} onChange={handleStepChange}>
                <Step title="Column Mapping" description="Map Excel columns to PO fields" />
                <Step title="Tag Matching" description="Match category values to tags" />
                <Step title="Data Preview" description="Review and confirm" />
            </Steps>

            <div style={{ marginTop: 24 }}>
                {renderStepContent()}
            </div>

            {renderFooter()}
        </Modal>
    );
};

export default VerifyDialog; 