import { getInventoryRecords, getDuplicateRecords, checkItemLocation, storeApi, updateRecord as apiUpdateRecord, deleteRecord as apiDeleteRecord } from './api';

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

            console.log('Fetching records with params:', defaultParams);
            const response = await getInventoryRecords(defaultParams);
            
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
            return {
                success: false,
                error: error.message,
                records: []
            };
        }
    }

    // Get locations with caching and activity tracking
    async getLocation(serialNumber) {
        this.updateActivityTime();
        if (this.cache.locations.has(serialNumber) && this.isCacheValid('locations')) {
            return this.cache.locations.get(serialNumber);
        }

        try {
            const response = await checkItemLocation(serialNumber);
            if (response?.success) {
                // Store the location data in cache
                this.cache.locations.set(serialNumber, {
                    location: response.location,
                    store_name: response.store_name,
                    store_id: response.store_id
                });
                this.cache.lastUpdate.locations = Date.now();
                return response;
            }
            return { success: false, location: 'inventory' };
        } catch (error) {
            console.error('Error checking location:', error);
            return { success: false, location: 'inventory' };
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
                    console.log('Fetching stores from API...');
                    const response = await storeApi.getStores();
                    console.log('Stores API response:', response);

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
            const fallbackResponse = {
                success: false,
                error: error.message || 'Failed to fetch stores',
                stores: [{ value: 'all', label: 'All Stores' }]
            };
            return fallbackResponse;
        }
    }

    // Get duplicates with caching and activity tracking
    async getDuplicates() {
        this.updateActivityTime();
        if (this.cache.duplicates && this.isCacheValid('duplicates')) {
            return this.cache.duplicates;
        }

        const response = await getDuplicateRecords();
        if (response?.success) {
            this.cache.duplicates = response;
            this.cache.lastUpdate.duplicates = Date.now();
        }
        return response;
    }

    // Batch check locations with optimized resource usage
    async batchCheckLocations(records, batchSize = 10) {
        const locations = new Map();
        const newRecords = records.filter(record => 
            record.serialnumber && !this.cache.locations.has(record.serialnumber)
        );
        
        // Return cached locations for records that are already cached
        const cachedLocations = new Map(
            records
                .filter(record => record.serialnumber && this.cache.locations.has(record.serialnumber))
                .map(record => [record.serialnumber, this.cache.locations.get(record.serialnumber)])
        );
        
        if (newRecords.length === 0) {
            return cachedLocations;
        }

        // Process in smaller batches to prevent resource exhaustion
        for (let i = 0; i < newRecords.length; i += batchSize) {
            const batch = newRecords.slice(i, i + batchSize);
            const locationPromises = batch.map(record => 
                this.getLocation(record.serialnumber)
                    .then(response => {
                        if (response?.success) {
                            const locationData = {
                                location: response.location,
                                store_name: response.store_name,
                                store_id: response.store_id
                            };
                            this.cache.locations.set(record.serialnumber, locationData);
                            locations.set(record.serialnumber, locationData);
                        } else {
                            const defaultLocation = { location: 'inventory' };
                            this.cache.locations.set(record.serialnumber, defaultLocation);
                            locations.set(record.serialnumber, defaultLocation);
                        }
                    })
                    .catch(() => {
                        const defaultLocation = { location: 'inventory' };
                        this.cache.locations.set(record.serialnumber, defaultLocation);
                        locations.set(record.serialnumber, defaultLocation);
                    })
            );

            await Promise.all(locationPromises);
            
            // Add a small delay between batches to prevent overwhelming the server
            if (i + batchSize < newRecords.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Update cache timestamp
        this.cache.lastUpdate.locations = Date.now();

        // Merge cached and new locations
        return new Map([...cachedLocations, ...locations]);
    }

    // Add method to check if refresh is needed
    needsRefresh() {
        const now = Date.now();
        return Object.values(this.cache.lastUpdate).some(lastUpdate => 
            lastUpdate && (now - lastUpdate) >= CACHE_EXPIRY
        );
    }

    // Modify refreshCache to be more efficient
    async refreshCache() {
        try {
            const now = Date.now();
            const tasks = [];

            // Only refresh expired caches
            if (this.cache.stores && 
                (!this.cache.lastUpdate.stores || 
                 now - this.cache.lastUpdate.stores >= CACHE_EXPIRY)) {
                tasks.push(this.getStores());
            }

            if (this.cache.duplicates && 
                (!this.cache.lastUpdate.duplicates || 
                 now - this.cache.lastUpdate.duplicates >= CACHE_EXPIRY)) {
                tasks.push(this.getDuplicates());
            }

            // Only refresh records that are expired
            for (const [cacheKey] of this.cache.records) {
                const lastUpdate = this.cache.lastUpdate.records;
                if (!lastUpdate || now - lastUpdate >= CACHE_EXPIRY) {
                    const params = JSON.parse(cacheKey);
                    tasks.push(this.getRecords(params));
                }
            }

            if (tasks.length > 0) {
                await Promise.all(tasks);
            }
        } catch (error) {
            console.error('Error refreshing cache:', error);
        }
    }

    // Clear cache and loading states
    clearCache() {
        this.cache.records.clear();
        this.cache.locations.clear();
        this.cache.stores = null;
        this.cache.duplicates = null;
        this.cache.lastUpdate = {
            records: null,
            locations: null,
            stores: null,
            duplicates: null
        };
        this.loadingStates.clear();
        this.loadingPromises.clear();
    }

    // Update record with cache invalidation
    async updateRecord(id, data) {
        try {
            const response = await apiUpdateRecord(id, data);
            if (response?.success) {
                // Invalidate records cache since data has changed
                this.cache.records.clear();
                this.cache.lastUpdate.records = null;
                
                // If the update includes a location change, invalidate locations cache
                if (data.location) {
                    this.cache.locations.clear();
                    this.cache.lastUpdate.locations = null;
                }
            }
            return response;
        } catch (error) {
            console.error('Error updating record:', error);
            throw error;
        }
    }

    // Delete record with cache invalidation
    async deleteRecord(id) {
        try {
            const response = await apiDeleteRecord(id);
            if (response?.success) {
                // Invalidate records cache since data has changed
                this.cache.records.clear();
                this.cache.lastUpdate.records = null;
                
                // Invalidate locations cache for the deleted record
                this.cache.locations.clear();
                this.cache.lastUpdate.locations = null;
            }
            return response;
        } catch (error) {
            console.error('Error deleting record:', error);
            throw error;
        }
    }
}

export const inventoryDataService = new InventoryDataService(); 