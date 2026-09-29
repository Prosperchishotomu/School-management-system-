const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = require('./app');
const { attachRealtime } = require('./services/realtime');
const { connectCache } = require('./services/cache');
const { startDeliveryWorker } = require('./services/deliveryWorker');
const { startReconciliationJob } = require('./services/reconciliation');
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
attachRealtime(server);
connectCache();
startDeliveryWorker();
startReconciliationJob();
server.listen(PORT, () => {
  console.log(`server started at ${PORT}`);  
});
  
