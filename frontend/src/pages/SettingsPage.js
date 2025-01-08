import React from 'react';

const SettingsPage = () => {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">System Settings</h1>
            
            <div className="bg-white shadow-md rounded-lg p-6">
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Settings</h2>
                    <p className="text-gray-600">This feature is under development...</p>
                </div>
                
                <div className="grid gap-6 mb-8">
                    <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-2">Upcoming Features</h3>
                        <ul className="list-disc list-inside text-gray-600">
                            <li>User Management</li>
                            <li>Permission Settings</li>
                            <li>System Configuration</li>
                            <li>Log Query</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage; 