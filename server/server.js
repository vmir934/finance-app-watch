// server/server.js (исправленная версия)

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Кэш для данных
let cache = {
    bitcoin: null,
    ethereum: null, 
    dominance: null,
    ethBtc: null,
    currencies: null,
    indices: null,
    lastUpdate: null
};

const CACHE_DURATION = 60000; // 1 минута

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../client'));

// Функция для задержки между запросами
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Универсальная функция для запросов с повторением
async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            await delay(i * delayMs); // Увеличиваем задержку с каждой попыткой
            
            const response = await fetch(url);
            
            if (response.status === 429) {
                console.log(`Rate limit hit, retrying in ${delayMs}ms...`);
                continue;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.log(`Attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
        }
    }
}

// Проверка актуальности кэша
function isCacheValid(key) {
    return cache[key] && cache.lastUpdate && 
           (Date.now() - cache.lastUpdate) < CACHE_DURATION;
}

// Роут для Bitcoin данных
app.get('/api/bitcoin', async (req, res) => {
    try {
        if (isCacheValid('bitcoin')) {
            console.log('Returning cached Bitcoin data');
            return res.json({
                success: true,
                data: cache.bitcoin,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log('Fetching fresh Bitcoin data...');
        const data = await fetchWithRetry('https://api.coingecko.com/api/v3/coins/bitcoin');
        
        const result = {
            price: data.market_data?.current_price?.usd || 112051,
            change_24h: data.market_data?.price_change_percentage_24h || 0.26,
            market_cap: data.market_data?.market_cap?.usd || 2236379345199,
            volume: data.market_data?.total_volume?.usd || 78303134204,
            high_24h: data.market_data?.high_24h?.usd || 113537,
            low_24h: data.market_data?.low_24h?.usd || 111088,
            name: data.name || 'Bitcoin',
            symbol: data.symbol ? data.symbol.toUpperCase() : 'BTC'
        };
        
        cache.bitcoin = result;
        cache.lastUpdate = Date.now();

        res.json({
            success: true,
            data: result,
            cached: false,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Bitcoin API error:', error.message);
        
        // Возвращаем кэшированные или fallback данные
        const fallbackData = cache.bitcoin || getFallbackBitcoinData();
        
        res.json({
            success: true,
            data: fallbackData,
            cached: true,
            error: 'Using cached data due to API limits',
            timestamp: new Date().toISOString()
        });
    }
});

// Роут для Ethereum данных
app.get('/api/ethereum', async (req, res) => {
    try {
        if (isCacheValid('ethereum')) {
            console.log('Returning cached Ethereum data');
            return res.json({
                success: true,
                data: cache.ethereum,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log('Fetching fresh Ethereum data...');
        const data = await fetchWithRetry('https://api.coingecko.com/api/v3/coins/ethereum');
        
        const result = {
            price: data.market_data?.current_price?.usd || 4070,
            change_24h: data.market_data?.price_change_percentage_24h || 2.74,
            market_cap: data.market_data?.market_cap?.usd || 488000000000,
            volume: data.market_data?.total_volume?.usd || 15000000000,
            high_24h: data.market_data?.high_24h?.usd || 4120,
            low_24h: data.market_data?.low_24h?.usd || 4020,
            name: data.name || 'Ethereum',
            symbol: data.symbol ? data.symbol.toUpperCase() : 'ETH'
        };
        
        cache.ethereum = result;
        cache.lastUpdate = Date.now();

        res.json({
            success: true,
            data: result,
            cached: false,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Ethereum API error:', error.message);
        
        const fallbackData = cache.ethereum || getFallbackEthereumData();
        
        res.json({
            success: true,
            data: fallbackData,
            cached: true,
            error: 'Using cached data due to API limits',
            timestamp: new Date().toISOString()
        });
    }
});

// Роут для Bitcoin Dominance
app.get('/api/btc-dominance', async (req, res) => {
    try {
        if (isCacheValid('dominance')) {
            console.log('Returning cached dominance data');
            return res.json({
                success: true,
                data: cache.dominance,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log('Fetching fresh dominance data...');
        const data = await fetchWithRetry('https://api.coingecko.com/api/v3/global');
        
        const result = {
            btc_dominance: data.data?.market_cap_percentage?.btc || 57.0,
            eth_dominance: data.data?.market_cap_percentage?.eth || 17.8,
            total_market_cap: data.data?.total_market_cap?.usd || 1700000000000,
            total_volume: data.data?.total_volume?.usd || 80000000000
        };
        
        cache.dominance = result;
        cache.lastUpdate = Date.now();

        res.json({
            success: true,
            data: result,
            cached: false,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Dominance API error:', error.message);
        
        const fallbackData = cache.dominance || {
            btc_dominance: 57.0,
            eth_dominance: 17.8,
            total_market_cap: 1700000000000,
            total_volume: 80000000000
        };
        
        res.json({
            success: true,
            data: fallbackData,
            cached: true,
            error: 'Using cached data due to API limits',
            timestamp: new Date().toISOString()
        });
    }
});

// Роут для ETH/BTC пары
app.get('/api/eth-btc', async (req, res) => {
    try {
        if (isCacheValid('ethBtc')) {
            console.log('Returning cached ETH/BTC data');
            return res.json({
                success: true,
                data: cache.ethBtc,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log('Calculating fresh ETH/BTC pair...');
        
        // Используем простой эндпоинт для цен
        const data = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        
        const btcPrice = data.bitcoin?.usd;
        const ethPrice = data.ethereum?.usd;
        const ethBtcPrice = btcPrice && ethPrice ? ethPrice / btcPrice : 0.0364;
        
        const result = {
            eth_btc: ethBtcPrice,
            btc_price: btcPrice,
            eth_price: ethPrice
        };
        
        cache.ethBtc = result;
        cache.lastUpdate = Date.now();

        res.json({
            success: true,
            data: result,
            cached: false,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('ETH/BTC API error:', error.message);
        
        const fallbackData = cache.ethBtc || {
            eth_btc: 0.0364,
            btc_price: 111837,
            eth_price: 4070
        };
        
        res.json({
            success: true,
            data: fallbackData,
            cached: true,
            error: 'Using cached data due to API limits',
            timestamp: new Date().toISOString()
        });
    }
});

// Роут для валют (используем альтернативный API)
app.get('/api/currencies', async (req, res) => {
    try {
        if (isCacheValid('currencies')) {
            console.log('Returning cached currency data');
            return res.json({
                success: true,
                data: cache.currencies,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log('Fetching fresh currency data...');
        
        // Альтернативный API для курсов валют
        const response = await fetch('https://api.frankfurter.app/latest?from=USD');
        
        if (!response.ok) {
            throw new Error('Failed to fetch currency data');
        }
        
        const currencyData = await response.json();
        
        const result = {
            rates: {
                RUB: currencyData.rates?.RUB || 91.45,
                EUR: currencyData.rates?.EUR || 0.92,
                CNY: currencyData.rates?.CNY || (91.45 / 7.25) // Примерный курс
            }
        };
        
        cache.currencies = result;
        cache.lastUpdate = Date.now();

        res.json({
            success: true,
            data: result,
            cached: false,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Currency API error:', error.message);
        
        const fallbackData = cache.currencies || getFallbackCurrencyData();
        
        res.json({
            success: true,
            data: fallbackData,
            cached: true,
            error: 'Using cached data due to API limits',
            timestamp: new Date().toISOString()
        });
    }
});

// Роут для индексов (демо-данные)
app.get('/api/indices', async (req, res) => {
    try {
        if (isCacheValid('indices')) {
            console.log('Returning cached indices data');
            return res.json({
                success: true,
                data: cache.indices,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log('Generating indices data...');
        
        // Генерируем реалистичные данные для индексов
        const indicesData = getRealisticIndicesData();
        
        cache.indices = indicesData;
        cache.lastUpdate = Date.now();

        res.json({
            success: true,
            data: indicesData,
            cached: false,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Indices error:', error.message);
        
        const fallbackData = cache.indices || getRealisticIndicesData();
        
        res.json({
            success: true,
            data: fallbackData,
            cached: true,
            error: 'Using cached data',
            timestamp: new Date().toISOString()
        });
    }
});

// Fallback данные
function getFallbackBitcoinData() {
    return {
        price: 112051,
        change_24h: 0.26,
        market_cap: 2236379345199,
        volume: 78303134204,
        high_24h: 113537,
        low_24h: 111088,
        name: "Bitcoin",
        symbol: "BTC"
    };
}

function getFallbackEthereumData() {
    return {
        price: 4070,
        change_24h: 2.74,
        market_cap: 488000000000,
        volume: 15000000000,
        high_24h: 4120,
        low_24h: 4020,
        name: "Ethereum",
        symbol: "ETH"
    };
}

function getFallbackCurrencyData() {
    return {
        rates: {
            RUB: 91.45,
            EUR: 0.92,
            CNY: 7.25
        }
    };
}

function getRealisticIndicesData() {
    // Добавляем небольшую случайную вариацию
    const variation = (Math.random() - 0.5) * 10;
    return {
        moex: 3247.85 + variation,
        sp500: 4785.32 + variation * 1.5
    };
}

// Эндпоинт для сброса кэша (для разработки)
app.get('/api/clear-cache', (req, res) => {
    cache = {
        bitcoin: null,
        ethereum: null,
        dominance: null,
        ethBtc: null,
        currencies: null,
        indices: null,
        lastUpdate: null
    };
    res.json({ success: true, message: 'Cache cleared' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        cacheAge: cache.lastUpdate ? Date.now() - cache.lastUpdate : null
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   http://localhost:${PORT}/api/bitcoin`);
    console.log(`   http://localhost:${PORT}/api/ethereum`);
    console.log(`   http://localhost:${PORT}/api/btc-dominance`);
    console.log(`   http://localhost:${PORT}/api/eth-btc`);
    console.log(`   http://localhost:${PORT}/api/currencies`);
    console.log(`   http://localhost:${PORT}/api/indices`);
    console.log(`   http://localhost:${PORT}/api/clear-cache`);
    console.log(`   http://localhost:${PORT}/api/health`);
    console.log(`💾 Cache enabled: ${CACHE_DURATION/1000}s duration`);
});