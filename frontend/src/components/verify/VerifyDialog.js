import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, message } from 'antd';
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

    // 處理步驟變化
    const handleStepChange = (step) => {
        setCurrentStep(step);
    };

    // 處理列映射更新
    const handleMappingUpdate = (newMapping) => {
        setColumnMapping(newMapping);
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
        }
        setCurrentStep(currentStep + 1);
    };

    // 處理上一步
    const handlePrev = () => {
        setCurrentStep(currentStep - 1);
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
                return <TagMatchingStep />;
            case 2:
                return <DataPreviewStep />;
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
                        onClick={onComplete}
                        loading={loading}
                    >
                        Create PO
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