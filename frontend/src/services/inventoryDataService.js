import { inventoryService, storeService } from '../api';

// Cache configuration
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000; // Increased to 5 minutes
const INACTIVE_TIMEOUT = 15 * 60 * 1000; // 15 minutes of inactivity before stopping refresh

class InventoryDataService {
    constructor() {
        this.cache = {
            records: new Map(),
            locations: new Map(),
            stores: null,
            duplicates: null,
            lastUpdate: {
                records: null,
                locations: null,
                stores: null,
                duplicates: null
            }
        };
        this.loadingPromises = new Map();
        this.loadingStates = new Set();
        this.backgroundInterval = null;
        this.lastActivityTime = Date.now();
        this.isActive = false;
    }

    // Track user activity
    updateActivityTime() {
        this.lastActivityTime = Date.now();
        if (!this.isActive) {
            this.startBackgroundRefresh();
        }
    }

    // Check if the service should be active
    shouldBeActive() {
        return Date.now() - this.lastActivityTime < INACTIVE_TIMEOUT;
    }

    // Initialize background refresh
    startBackgroundRefresh() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
        }

        this.isActive = true;
        this.lastActivityTime = Date.now();

        // Reduce refresh frequency and add conditions
        this.backgroundInterval = setInterval(() => {
            if (!this.shouldBeActive()) {
                this.stopBackgroundRefresh();
                return;
            }

            // Only refresh if there's cached data AND it's expired
            if (this.hasCachedData() && this.needsRefresh()) {
                this.refreshCache();
            }
        }, BACKGROUND_REFRESH_INTERVAL);
    }

    stopBackgroundRefresh() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
        this.isActive = false;
    }

    // Check if there's any cached data to refresh
    hasCachedData() {
        return this.cache.records.size > 0 || 
               this.cache.locations.size > 0 || 
               this.cache.stores !== null || 
               this.cache.duplicates !== null;
    }

    // Check if cache is valid
    isCacheValid(type) {
        const lastUpdate = this.cache.lastUpdate[type];
        return lastUpdate && (Date.now() - lastUpdate) < CACHE_EXPIRY;
    }

    // Check if a specific request is loading
    isLoading(key) {
        return this.loadingStates.has(key);
    }

    // Get records with caching and activity tracking
    async getRecords(params = {}) {
        try {
            // Set default pagination if not provided
            const defaultParams = {
                page: 1,
                pageSize: 20,
                ...params
            };

            const response = await inventoryService.getRecords(defaultParams);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch records');
            }

            // Cache the records
            this.recordsCache = response.records || [];
            this.lastRecordsFetch = Date.now();

            return {
                success: true,
                records: response.records || [],
                total: response.total
            };
        } catch (error) {
            console.error('Error in getRecords:', error);
            throw new Error(error.message || 'Failed to fetch records');
        }
    }

    // Get locations with caching and activity tracking
    async getLocation(serialNumber) {
        this.updateActivityTime();
        
        try {
            if (this.cache.locations.has(serialNumber) && this.isCacheValid('locations')) {
                return this.cache.locations.get(serialNumber);
            }

            const response = await inventoryService.checkItemLocation(serialNumber);
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to check item location');
            }

            // Store the location data in cache
            this.cache.locations.set(serialNumber, {
                location: response.location,
                store_name: response.store_name,
                store_id: response.store_id
            });
            this.cache.lastUpdate.locations = Date.now();
            return response;
        } catch (error) {
            console.error('Error checking location:', error);
            throw new Error(error.message || 'Failed to check item location');
        }
    }

    // Get stores with caching and activity tracking
    async getStores() {
        this.updateActivityTime();
        const loadingKey = 'stores';
        
        try {
            // Return existing promise if already loading
            if (this.loadingStates.has(loadingKey)) {
                console.log('Stores already loading, returning existing promise');
                const existingPromise = this.loadingPromises.get(loadingKey);
                if (existingPromise) {
                    return await existingPromise;
                }
            }

            // Check cache first
            if (this.cache.stores && this.isCacheValid('stores')) {
                console.log('Returning cached stores');
                return this.cache.stores;
            }

            // Set loading state and create promise
            this.loadingStates.add(loadingKey);
            const promise = (async () => {
                try {
                    const response = await storeService.getStores();

                    if (!response?.success) {
                        throw new Error(response?.error || 'Failed to fetch stores');
                    }

                    if (!Array.isArray(response.stores)) {
                        throw new Error('Invalid stores data format');
                    }

                    // Transform store data to ensure consistent format
                    const transformedStores = response.stores.map(store => ({
                        value: store.id?.toString() || store.value,
                        label: store.name || store.label || 'Unknown Store',
                        ...store
                    }));

                    const validResponse = {
                        success: true,
                        stores: transformedStores
                    };

                    this.cache.stores = validResponse;
                    this.cache.lastUpdate.stores = Date.now();
                    return validResponse;
                } catch (error) {
                    console.error('Error in store fetch:', error);
                    throw error;
                }
            })();

            // Store promise for concurrent requests
            this.loadingPromises.set(loadingKey, promise);

            try {
                return await promise;
            } finally {
                // Only clean up if this is the original promise
                if (this.loadingPromises.get(loadingKey) === promise) {
                    this.loadingStates.delete(loadingKey);
                    this.loadingPromises.delete(loadingKey);
                }
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            throw new Error(error.message || 'Failed to fetch stores');
        }
    }

    // Get duplicates with caching and activity tracking
    async getDuplicates() {
        this.updateActivityTime();
        
        try {
            if (this.cache.duplicates && this.isCacheValid('duplicates')) {
                return this.cache.duplicates;
            }

            const response = await inventoryService.getDuplicateRecords();
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch duplicate records');
            }

            this.cache.duplicates = response;
            this.cache.lastUpdate.duplicates = Date.now();
            return response;
        } catch (error) {
            console.error('Error fetching duplicates:', error);
            throw new Error(error.message || 'Failed to fetch duplicate records');
        }
    }

    // Batch check locations with optimized resource usage
    async batchCheckLocations(serialNumbers) {
        this.updateActivityTime();
        
        try {
            const uncachedSerialNumbers = [];
            const results = new Map();

            // Check cache first
            serialNumbers.forEach(sn => {
                if (this.cache.locations.has(sn) && this.isCacheValid('locations')) {
                    results.set(sn, this.cache.locations.get(sn));
                } else {
                    uncachedSerialNumbers.push(sn);
                }
            });

            if (uncachedSerialNumbers.length > 0) {
                const response = await inventoryService.checkItemLocations(uncachedSerialNumbers);
                if (!response?.success) {
                    throw new Error(response?.error || 'Failed to check item locations');
                }

                if (response.locations) {
                    Object.entries(response.locations).forEach(([sn, location]) => {
                        this.cache.locations.set(sn, location);
                        results.set(sn, location);
                    });
                    this.cache.lastUpdate.locations = Date.now();
                }
            }

            return {
                success: true,
                locations: Object.fromEntries(results)
            };
        } catch (error) {
            console.error('Error in batch location check:', error);
            throw new Error(error.message || 'Failed to check item locations');
        }
    }

    // Check if any cache needs refresh
    needsRefresh() {
        return !this.isCacheValid('records') ||
               !this.isCacheValid('locations') ||
               !this.isCacheValid('stores') ||
               !this.isCacheValid('duplicates');
    }

    // Refresh all cached data
    async refreshCache() {
        try {
            const refreshPromises = [];

            if (!this.isCacheValid('records') && this.cache.records.size > 0) {
                refreshPromises.push(this.getRecords());
            }

            if (!this.isCacheValid('stores') && this.cache.stores) {
                refreshPromises.push(this.getStores());
            }

            if (!this.isCacheValid('duplicates') && this.cache.duplicates) {
                refreshPromises.push(this.getDuplicates());
            }

            // Locations are refreshed on-demand

            await Promise.allSettled(refreshPromises);
        } catch (error) {
            console.error('Error refreshing cache:', error);
        }
    }

    // Clear all cached data
    clearCache() {
        this.cache = {
            records: new Map(),
            locations: new Map(),
            stores: null,
            duplicates: null,
            lastUpdate: {
                records: null,
                locations: null,
                stores: null,
                duplicates: null
            }
        };
    }

    // Update record with error handling
    async updateRecord(id, data) {
        try {
            const response = await inventoryService.updateRecord(id, data);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to update record');
            }

            // Invalidate relevant caches
            this.cache.lastUpdate.records = null;
            if (data.location) {
                this.cache.lastUpdate.locations = null;
            }

            return response;
        } catch (error) {
            console.error('Error updating record:', error);
            throw error;
        }
    }

    // Delete record with error handling
    async deleteRecord(id) {
        try {
            const response = await inventoryService.deleteRecord(id);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete record');
            }

            // Invalidate records cache
            this.cache.lastUpdate.records = null;

            return response;
        } catch (error) {
            console.error('Error deleting record:', error);
            throw error;
        }
    }
}

export default new InventoryDataService(); 