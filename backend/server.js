const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json());

let db;

// ฟังก์ชันหาที่อยู่
async function getAddress(lat, lng) {
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'User-Agent': 'SmartLogisticsTest/1.1' },
            timeout: 3000
        });
        return response.data.display_name.split(',').slice(0, 3).join(',') || "Unknown Location";
    } catch (error) {
        return `Lat: ${lat}, Lng: ${lng}`;
    }
}

// เริ่มต้น Database
(async () => {
    db = await open({
        filename: './tracking.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS vehicle_locations (
            id TEXT PRIMARY KEY,
            name TEXT,
            lat REAL,
            lng REAL,
            address TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Database Connected & Ready');
})();

// เมื่อมีคนเปิดหน้าเว็บ (WebSocket Connect)
wss.on('connection', async (ws) => {
    console.log('📡 Client Connected: Sending latest data...');
    try {
        const rows = await db.all("SELECT * FROM vehicle_locations");
        rows.forEach(row => {
            // เช็คว่าข้อมูลอัปเดตล่าสุดเกิน 1 นาทีหรือไม่ (ถ้าเกินถือว่า Offline)
            const lastUpdate = new Date(row.updated_at);
            const now = new Date();
            const diffInSeconds = (now - lastUpdate) / 1000;
            
            ws.send(JSON.stringify({
                id: row.id,
                name: row.name,
                lat: row.lat,
                lng: row.lng,
                address: row.address,
                time: lastUpdate.toLocaleTimeString('th-TH'),
                status: diffInSeconds > 60 ? 'offline' : 'online'
            }));
        });
    } catch (err) {
        console.error(err);
    }
});

app.post('/api/track', async (req, res) => {
    try {
        const { id, vehicle_name, latitude, longitude } = req.body;
        const vehicleId = id || 'CAR001';
        const timestamp = new Date().toLocaleTimeString('th-TH');
        const address = await getAddress(latitude, longitude);

        // บันทึก/อัปเดตข้อมูลลง Database
        await db.run(
            `INSERT INTO vehicle_locations (id, name, lat, lng, address, updated_at) 
             VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
             ON CONFLICT(id) DO UPDATE SET 
             name = excluded.name, lat = excluded.lat, lng = excluded.lng, 
             address = excluded.address, updated_at = datetime('now', 'localtime')`,
            [vehicleId, vehicle_name, latitude, longitude, address]
        );

        const message = JSON.stringify({ 
            id: vehicleId, 
            name: vehicle_name, 
            lat: latitude, 
            lng: longitude, 
            address,
            time: timestamp,
            status: 'online' 
        });
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) client.send(message);
        });

        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 Server ready on port ${PORT}`));