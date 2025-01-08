import React from 'react';

const StoresPage = () => {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Store Management</h1>
            
            <div className="bg-white shadow-md rounded-lg p-6">
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Store Information</h2>
                    <p className="text-gray-600">This feature is under development...</p>
                </div>
                
                <div className="grid gap-6 mb-8">
                    <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-2">Upcoming Features</h3>
                        <ul className="list-disc list-inside text-gray-600">
                            <li>Store Information Management</li>
                            <li>Store Inventory Query</li>
                            <li>Store Order Management</li>
                            <li>Store Statistics Reports</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoresPage; 