import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { rmaApi } from '../services/api';

export const useRmaItems = (page = 1, limit = 50) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchItems = useCallback(async () => {
        try {
            console.log('Fetching RMA items with:', { page, limit });
            setLoading(true);
            setError(null);
            const response = await rmaApi.getInventoryRmaItems(page, limit);
            console.log('API Response:', response);
            
            // Set the response data directly
            setData(response);
            
            // Log the data that will be set to state
            console.log('Setting data to state:', response);
        } catch (err) {
            console.error('Error fetching RMA items:', err);
            setError(err);
            message.error('Failed to fetch RMA items');
        } finally {
            setLoading(false);
        }
    }, [page, limit]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    return {
        loading,
        data,
        error,
        refetch: fetchItems
    };
};

export const useRmaOperations = () => {
    const [loading, setLoading] = useState(false);

    const processRma = async (rmaId) => {
        try {
            setLoading(true);
            const response = await rmaApi.processRma(rmaId);
            if (response?.success) {
                message.success('RMA item processed successfully');
                return true;
            }
            return false;
        } catch (error) {
            message.error('Failed to process RMA item');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const completeRma = async (rmaId) => {
        try {
            setLoading(true);
            const response = await rmaApi.completeRma(rmaId);
            if (response?.success) {
                message.success('RMA item completed successfully');
                return true;
            }
            return false;
        } catch (error) {
            message.error('Failed to complete RMA item');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const failRma = async (rmaId, reason) => {
        try {
            setLoading(true);
            const response = await rmaApi.failRma(rmaId, reason);
            if (response?.success) {
                message.success('RMA item marked as failed');
                return true;
            }
            return false;
        } catch (error) {
            message.error('Failed to mark RMA item as failed');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const batchProcess = async (rmaIds) => {
        if (!rmaIds.length) return false;

        try {
            setLoading(true);
            const results = await Promise.allSettled(
                rmaIds.map(id => rmaApi.processRma(id))
            );

            const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
            const failed = rmaIds.length - successful;

            if (successful > 0) {
                message.success(`Successfully processed ${successful} RMA items`);
            }
            if (failed > 0) {
                message.warning(`Failed to process ${failed} RMA items`);
            }

            return successful > 0;
        } catch (error) {
            message.error('Failed to process RMA items');
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        processRma,
        completeRma,
        failRma,
        batchProcess
    };
};

export const useRmaStats = () => {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await rmaApi.getRmaStats();
            setStats(response.data);
        } catch (err) {
            setError(err);
            message.error('Failed to fetch RMA statistics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return {
        loading,
        stats,
        error,
        refetch: fetchStats
    };
}; 