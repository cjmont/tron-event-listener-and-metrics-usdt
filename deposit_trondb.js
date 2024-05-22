import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import Bottleneck from 'bottleneck';
import TronWeb from 'tronweb';
import client from 'prom-client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3007;
const API_KEY = process.env.TRON_API_KEY;
const TRON_GRID_API_URL = process.env.TRON_NODE;

// Initialize Prometheus Metrics
client.collectDefaultMetrics();
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 500]
});

// funcion para medir el tiempo de las consultas a la base de datos en grafana
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 5]
});

// funcion para contar las consultas a la base de datos en grafana
const dbQueryCounter = new client.Counter({
  name: 'db_query_count',
  help: 'Total number of database queries executed'
});

// funcion para contar los errores en las consultas a la base de datos en grafana
const dbQueryErrorsCounter = new client.Counter({
  name: 'db_query_errors_count',
  help: 'Total number of database query errors'
});

// funcion para contar los eventos procesados de la blockchain y mostrar en grafana
const processedEventsCounter = new client.Counter({
  name: 'processed_events_count',
  help: 'Total number of processed blockchain events'
});

// funcion para contar los errores en el procesamiento de eventos de la blockchain y mostrar en grafana
const eventProcessingErrorsCounter = new client.Counter({
  name: 'event_processing_errors_count',
  help: 'Number of blockchain event processing errors'
});

// Métricas de uso de memoria
const memoryUsageGauge = new client.Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage of the application in bytes',
  labelNames: ['type']
});

// Métricas de latencia de red
const apiLatencyHistogram = new client.Histogram({
  name: 'api_latency_seconds',
  help: 'Latency of external API requests in seconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Métricas de tamaño de respuesta HTTP
const responseSizeHistogram = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000]
});

setInterval(() => {
  const memoryUsage = process.memoryUsage();
  memoryUsageGauge.labels('rss').set(memoryUsage.rss);
  memoryUsageGauge.labels('heapTotal').set(memoryUsage.heapTotal);
  memoryUsageGauge.labels('heapUsed').set(memoryUsage.heapUsed);
  memoryUsageGauge.labels('external').set(memoryUsage.external);
}, 5000); // Actualiza cada 5 segundos

app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const duration = process.hrtime(start);
    httpRequestDurationMicroseconds.labels(req.method, req.route ? req.route.path : req.path, res.statusCode).observe(duration[0] * 1000 + duration[1] / 1e6);
    responseSizeHistogram.labels(req.method, req.route ? req.route.path : req.path, res.statusCode).observe(Buffer.byteLength(res.get('Content-Length') || '0', 'utf8'));
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Wrap database queries to measure them
async function executeQuery(query, params) {
  const start = process.hrtime();
  try {
    const result = await db.query(query, params);
    dbQueryCounter.inc();
    const duration = process.hrtime(start);
    dbQueryDuration.observe(duration[0] + duration[1] / 1e9);
    return result;
  } catch (error) {
    dbQueryErrorsCounter.inc();
    throw error;
  }
}


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

let tronWeb;
import('tronweb').then(TronWebModule => {
  tronWeb = new TronWebModule.default({
    fullHost: TRON_GRID_API_URL,
    headers: { "TRON-PRO-API-KEY": API_KEY },
    privateKey: process.env.PRIVATE_KEY
  });
  console.log('TronWeb initialized successfully.');
  startEventListening();
}).catch(error => {
  console.error('Error loading TronWeb:', error);
});

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 67
});

async function fetchEvents() {
  const usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  const start = process.hrtime();
  try {
    const response = await axios.get(`${TRON_GRID_API_URL}/v1/contracts/${usdtContractAddress}/events`, {
      params: {
        event_name: 'Transfer',
        only_confirmed: true,
        limit: 100,
        order_by: 'block_timestamp,desc'
      },
      headers: {
        'TRON-PRO-API-KEY': API_KEY
      }
    });
    const duration = process.hrtime(start);
    apiLatencyHistogram.labels('GET', '/v1/contracts/events', response.status).observe(duration[0] + duration[1] / 1e9);

    const events = response.data.data;
    if (events.length === 0) {
      console.log('No new events found.');
      return;
    }
    events.forEach(event => {
      try {
        processTransaction(event);
        processedEventsCounter.inc();  // Increment for each processed event
      } catch (error) {
        console.error('Failed to process event:', error);
        eventProcessingErrorsCounter.inc();  // Increment for each error
      }
    });
  } catch (error) {
    const duration = process.hrtime(start);
    apiLatencyHistogram.labels('GET', '/v1/contracts/events', error.response ? error.response.status : 'unknown').observe(duration[0] + duration[1] / 1e9);

    console.error('Failed to fetch transfer events:', error);
    eventProcessingErrorsCounter.inc();  // Increment for errors during fetch
  }
}

function startEventListening() {
  limiter.schedule(fetchEvents).then(() => {
    setTimeout(startEventListening, 1000);
  });
}

async function isAddressMonitored(to_address_hex) {
  try {
    const [result] = await db.query("SELECT COUNT(*) as count FROM address WHERE user_id != 0 AND active = 1 AND address = ?", [tronWeb.address.fromHex(to_address_hex)]);
    return result[0].count > 0;
  } catch (error) {
    console.error('Error checking if address is monitored:', error);
    return false;
  }
}

async function processTransaction(event) {
  const tx_hash = event.transaction_id;
  const result = event.result || {};
  const to_address_hex = result.to;
  const amount = parseInt(result.value, 10) || 0;
  const contract = 'USDT';

  if (!to_address_hex || amount === 0) {
    console.error(`Invalid transaction data: to_address or amount is null for transaction ${tx_hash}`);
    return;
  }

  if (await isAddressMonitored(to_address_hex)) { // Solo procesa si la dirección está monitoreada
    try {
      const connection = await db.getConnection();
      await connection.beginTransaction();
      const [existingDeposits] = await connection.query('SELECT * FROM deposits WHERE tx_hash = ?', [tx_hash]);
      if (existingDeposits.length === 0) {
        const newDeposit = {
          to_address: tronWeb.address.fromHex(to_address_hex),
          contract: contract,
          amount: amount,
          tx_hash: tx_hash,
          confirmations: 4
        };
        await connection.query('INSERT INTO deposits SET ?', newDeposit);
        await connection.commit();
        console.log(`New deposit added:`, newDeposit);
        logDeposit(newDeposit);
      } else {
        await connection.rollback();
        console.log(`Deposit already exists for transaction: ${tx_hash}`);
      }
      connection.release();
    } catch (dbError) {
      console.error(`Error processing transaction ${tx_hash}:`, dbError.message);
      connection.rollback();
      connection.release();
    }
  } else {
    console.log(`Esta Address no es de ningun cliente: ${tronWeb.address.fromHex(to_address_hex)}`);
  }
}

function logDeposit(deposit) {
  const now = new Date();
  const filename = 'deposits-log.txt';
  const logMessage = `${now.toISOString()} - New deposit: Tx Hash ${deposit.tx_hash}, Address ${deposit.to_address}, Amount ${deposit.amount}\n`;

  fs.appendFile(path.join(__dirname, filename), logMessage, (err) => {
    if (err) {
      console.error('Failed to write deposit to log file:', err);
    } else {
      console.log('Deposit logged successfully:', filename);
    }
  });
}