import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { rmaService } from '../api';

export const useRmaItems = (storeId = null, page = 1, limit = 50) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchItems = useCallback(async () => {
        try {
            console.log('Fetching RMA items with:', { storeId, page, limit });
            setLoading(true);
            setError(null);
            
            const response = await rmaService.getRmaItems(
                storeId, 
                { page, limit }
            );
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
    }, [storeId, page, limit]);

    useEffect(() => {
        if (storeId) {
            fetchItems();
        }
    }, [fetchItems, storeId]);

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
            const response = await rmaService.processRma(rmaId);
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
            const response = await rmaService.completeRma(rmaId);
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
            const response = await rmaService.failRma(rmaId, reason);
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
                rmaIds.map(id => rmaService.processRma(id))
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
            const response = await rmaService.getRmaStats();
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

export const useRma = (storeId) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [rmaItems, setRmaItems] = useState([]);

    const fetchRmaItems = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await rmaService.getRmaItems(storeId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch RMA items');
            }
            
            setRmaItems(response.rma_items);
        } catch (error) {
            console.error('Error fetching RMA items:', error);
            setError(error.message || 'Failed to fetch RMA items');
            message.error('Failed to fetch RMA items');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const addToRma = useCallback(async (data) => {
        try {
            setLoading(true);
            setError(null);
            const response = await rmaService.addToRma(storeId, data);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to add item to RMA');
            }
            
            message.success('Item added to RMA successfully');
            await fetchRmaItems();
            return true;
        } catch (error) {
            console.error('Error adding to RMA:', error);
            setError(error.message || 'Failed to add item to RMA');
            message.error('Failed to add item to RMA');
            return false;
        } finally {
            setLoading(false);
        }
    }, [storeId, fetchRmaItems]);

    const removeFromRma = useCallback(async (rmaId) => {
        try {
            setLoading(true);
            setError(null);
            const response = await rmaService.removeFromRma(storeId, rmaId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to remove item from RMA');
            }
            
            message.success('Item removed from RMA successfully');
            await fetchRmaItems();
            return true;
        } catch (error) {
            console.error('Error removing from RMA:', error);
            setError(error.message || 'Failed to remove item from RMA');
            message.error('Failed to remove item from RMA');
            return false;
        } finally {
            setLoading(false);
        }
    }, [storeId, fetchRmaItems]);

    return {
        loading,
        error,
        rmaItems,
        fetchRmaItems,
        addToRma,
        removeFromRma
    };
}; 