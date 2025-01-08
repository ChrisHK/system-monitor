import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'bg-blue-700' : '';
    };

    return (
        <nav className="bg-blue-600 text-white">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="font-bold text-xl">
                            System Monitor
                        </Link>
                    </div>
                    
                    <div className="flex space-x-4">
                        <Link
                            to="/inventory"
                            className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/inventory')}`}
                        >
                            Inventory
                        </Link>
                        <Link
                            to="/outbound"
                            className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/outbound')}`}
                        >
                            Outbound
                        </Link>
                        <Link
                            to="/stores"
                            className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/stores')}`}
                        >
                            Stores
                        </Link>
                        <Link
                            to="/settings"
                            className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/settings')}`}
                        >
                            Settings
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navigation; 