import React from 'react';

const RecordList = ({ records }) => {
    const formatSystemSku = (sku) => {
        if (!sku) return '';
        try {
            const parts = sku.split('_');
            const thinkpadPart = parts.find(part => part.includes('ThinkPad'));
            if (thinkpadPart) {
                let model = parts.slice(parts.indexOf(thinkpadPart)).join(' ');
                return model.replace(/Gen (\d+)$/, 'Gen$1').trim();
            }
            return sku;
        } catch (e) {
            return sku;
        }
    };

    const formatOS = (os) => {
        if (!os) return '';
        try {
            const osLower = os.toLowerCase();
            if (osLower.includes('windows')) {
                const mainVersion = osLower.includes('11') ? '11' : 
                                  osLower.includes('10') ? '10' : '';
                const edition = osLower.includes('pro') ? 'Pro' :
                              osLower.includes('home') ? 'Home' : 
                              osLower.includes('enterprise') ? 'Enterprise' : '';
                return `Windows ${mainVersion} ${edition}`.trim()
                       .replace(/\s+\d+\.\d+\.\d+.*$/, '');
            }
            return os;
        } catch (e) {
            return os;
        }
    };

    const getBatteryHealthClass = (health) => {
        if (health >= 85) return 'battery-good';
        if (health >= 70) return 'battery-warning';
        return 'battery-critical';
    };

    return (
        <div className="record-list">
            <table>
                <thead>
                    <tr>
                        <th>Serial Number</th>
                        <th>Computer Name</th>
                        <th>Manufacturer</th>
                        <th>Model</th>
                        <th>System SKU</th>
                        <th>OS</th>
                        <th>CPU</th>
                        <th>Resolution</th>
                        <th>Graphics</th>
                        <th>Touch Screen</th>
                        <th>RAM (GB)</th>
                        <th>Disks</th>
                        <th>Design Capacity</th>
                        <th>Full Charge</th>
                        <th>Cycle Count</th>
                        <th>Battery Health</th>
                        <th>Last Update</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map(record => (
                        <tr key={record.id}>
                            <td>{record.serialnumber}</td>
                            <td>{record.computername}</td>
                            <td>{record.manufacturer}</td>
                            <td>{record.model}</td>
                            <td>{formatSystemSku(record.systemsku)}</td>
                            <td>{formatOS(record.operatingsystem)}</td>
                            <td>{record.cpu?.replace(/\s*\([^)]*\)/g, '')}</td>
                            <td>{record.resolution}</td>
                            <td>{record.graphicscard?.split('[')[0].trim()}</td>
                            <td>{record.touchscreen}</td>
                            <td>{record.ram_gb}</td>
                            <td>{record.disks}</td>
                            <td>{record.design_capacity}</td>
                            <td>{record.full_charge_capacity}</td>
                            <td>{record.cycle_count}</td>
                            <td className={`battery-health ${getBatteryHealthClass(record.battery_health)}`}>
                                {record.battery_health}%
                            </td>
                            <td>{record.created_at}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RecordList; 