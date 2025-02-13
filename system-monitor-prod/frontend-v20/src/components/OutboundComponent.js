import React from 'react';
import { Modal, Button } from 'antd';

const OutboundComponent = ({ visible, onClose }) => {
    return (
        <Modal
            title="Outbound Functionality"
            visible={visible}
            onCancel={onClose}
            footer={[
                <Button key="back" onClick={onClose}>
                    Close
                </Button>,
                <Button key="submit" type="primary">
                    Submit
                </Button>,
            ]}
        >
            {/* 添加 outbound 相关的代码和逻辑 */}
            <h2>Outbound Functionality</h2>
        </Modal>
    );
};

export default OutboundComponent; 