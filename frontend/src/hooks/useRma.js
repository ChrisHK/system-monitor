import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { rmaService } from '../api';
import { formatApiError } from '../api/utils/apiUtils';

export const useRmaItems = (storeId = 'inventory', page = 1, limit = 50) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchItems = useCallback(async () => {
        try {
            console.log('Fetching RMA items with:', { storeId, page, limit });
            setLoading(true);
            setError(null);
            
            const response = await rmaService.getRmaItems({ 
                storeId,
                page,
                limit
            });
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch RMA items');
            }
            
            setData(response);
            console.log('RMA items fetched successfully:', response);
        } catch (err) {
            console.error('Error fetching RMA items:', err);
            setError(err);
            message.error(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [storeId, page, limit]);

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

    const processRma = async (rmaId, diagnosis) => {
        try {
            setLoading(true);
            const response = await rmaService.processRma(rmaId, diagnosis);
            if (response?.success) {
                message.success('RMA item processed successfully');
                return true;
            }
            throw new Error(response?.error || 'Failed to process RMA item');
        } catch (error) {
            message.error(formatApiError(error));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const completeRma = async (rmaId, solution) => {
        try {
            setLoading(true);
            const response = await rmaService.completeRma(rmaId, solution);
            if (response?.success) {
                message.success('RMA item completed successfully');
                return true;
            }
            throw new Error(response?.error || 'Failed to complete RMA item');
        } catch (error) {
            message.error(formatApiError(error));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const failRma = async (rmaId, reason) => {
        try {
            setLoading(true);
            const response = await rmaService.failRmaItem(rmaId, reason);
            if (response?.success) {
                message.success('RMA item marked as failed');
                return true;
            }
            throw new Error(response?.error || 'Failed to mark RMA item as failed');
        } catch (error) {
            message.error(formatApiError(error));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const batchProcess = async (items) => {
        if (!items.length) return false;

        try {
            setLoading(true);
            const results = await Promise.allSettled(
                items.map(item => rmaService.processRma(item.id, item.diagnosis))
            );

            const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
            const failed = items.length - successful;

            if (successful > 0) {
                message.success(`Successfully processed ${successful} RMA items`);
            }
            if (failed > 0) {
                message.warning(`Failed to process ${failed} RMA items`);
            }

            return successful > 0;
        } catch (error) {
            message.error(formatApiError(error));
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
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch RMA statistics');
            }
            
            setStats(response.data);
        } catch (err) {
            setError(err);
            message.error(formatApiError(err));
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

export const useRmaItem = (rmaId) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchItem = useCallback(async () => {
        if (!rmaId) return;

        try {
            setLoading(true);
            setError(null);
            const response = await rmaService.getRmaItem(rmaId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch RMA item');
            }
            
            setData(response.item);
        } catch (err) {
            setError(err);
            message.error(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [rmaId]);

    useEffect(() => {
        fetchItem();
    }, [fetchItem]);

    const updateItem = async (data) => {
        try {
            setLoading(true);
            const response = await rmaService.updateRmaItem(rmaId, data);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to update RMA item');
            }
            
            setData(response.item);
            message.success('RMA item updated successfully');
            return true;
        } catch (error) {
            message.error(formatApiError(error));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async () => {
        try {
            setLoading(true);
            const response = await rmaService.deleteRmaItem(rmaId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete RMA item');
            }
            
            message.success('RMA item deleted successfully');
            return true;
        } catch (error) {
            message.error(formatApiError(error));
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        data,
        error,
        refetch: fetchItem,
        updateItem,
        deleteItem
    };
};

export const useRmaSearch = () => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);

    const searchItems = async (serialNumber) => {
        try {
            setLoading(true);
            setError(null);
            const response = await rmaService.searchRmaItems(serialNumber);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to search RMA items');
            }
            
            setResults(response.items);
            return response.items;
        } catch (err) {
            setError(err);
            message.error(formatApiError(err));
            return [];
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        results,
        error,
        searchItems
    };
}; 