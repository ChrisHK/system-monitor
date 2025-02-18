import React from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Tabs, Card } from 'antd';
import GroupManagement from '../components/settings/GroupManagement';
import StoreManagement from '../components/settings/StoreManagement';
import UserManagement from '../components/settings/UserManagement';
import TagManagement from '../components/settings/TagManagement';
import DataProcessPage from './DataProcessPage';

const SettingsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;

    const getActiveKey = () => {
        if (currentPath === '/settings/stores') return 'stores';
        if (currentPath === '/settings/groups') return 'groups';
        if (currentPath === '/settings/users') return 'users';
        if (currentPath === '/settings/tags') return 'tags';
        if (currentPath === '/settings/data-process') return 'data-process';
        return 'stores';
    };

    const items = [
        {
            key: 'stores',
            label: 'Store Management',
        },
        {
            key: 'groups',
            label: 'Group Management',
        },
        {
            key: 'users',
            label: 'User Management',
        },
        {
            key: 'tags',
            label: 'Tag Management',
        },
        {
            key: 'data-process',
            label: 'Data Process',
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card>
                <Tabs
                    activeKey={getActiveKey()}
                    items={items}
                    onChange={(key) => {
                        navigate(`/settings/${key}`);
                    }}
                />
                <div style={{ padding: '16px' }}>
                    <Routes>
                        <Route index element={<Navigate to="stores" replace />} />
                        <Route path="stores" element={<StoreManagement />} />
                        <Route path="groups" element={<GroupManagement />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="tags" element={<TagManagement />} />
                        <Route path="data-process" element={<DataProcessPage />} />
                    </Routes>
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage; 