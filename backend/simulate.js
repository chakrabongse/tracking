const axios = require('axios');

// พิกัดเริ่มต้น (กรุงเทพฯ) และจุดหมาย (ปราจีนบุรี)
const START_LAT = 13.7563;
const START_LNG = 100.5018;
const END_LAT = 14.0510; // ตัวเมืองปราจีนบุรี (โดยประมาณ)
const END_LNG = 101.3730;

// สร้างข้อมูลรถ 10 คัน
const vehicles = Array.from({ length: 10 }, (_, i) => ({
    id: `CAR${(i + 1).toString().padStart(3, '0')}`,
    name: `รถขนส่งคันที่ ${i + 1}`,
    progress: Math.random() * 0.1, // ให้แต่ละคันเริ่มที่จุดต่างกันเล็กน้อย (0-10% ของเส้นทาง)
    speed: 0.005 + Math.random() * 0.01 // ความเร็วในการเคลื่อนที่ต่อรอบ
}));

async function simulateGPS() {
    console.log("🚚 Starting Smart Logistics Simulation: Bangkok -> Prachinburi");

    while (true) {
        for (let vehicle of vehicles) {
            // คำนวณตำแหน่งปัจจุบันตาม Progress (0.0 ถึง 1.0)
            const currentLat = START_LAT + (END_LAT - START_LAT) * vehicle.progress;
            const currentLng = START_LNG + (END_LNG - START_LNG) * vehicle.progress;

            // เพิ่ม Noise เล็กน้อยให้รถดูไม่วิ่งเป็นเส้นตรงเป๊ะเกินไป
            const jitterLat = (Math.random() * 0.002 - 0.001);
            const jitterLng = (Math.random() * 0.002 - 0.001);

            const data = {
                id: vehicle.id,
                vehicle_name: vehicle.name,
                latitude: currentLat + jitterLat,
                longitude: currentLng + jitterLng
            };

            try {
                await axios.post('http://localhost:8080/api/track', data);
                console.log(`✅ Sent [${vehicle.id}]: Progress ${(vehicle.progress * 100).toFixed(1)}%`);
            } catch (error) {
                console.error(`❌ [${vehicle.id}] Connection Error`);
            }

            // อัปเดต Progress
            vehicle.progress += vehicle.speed;
            
            // ถ้าถึงปราจีนบุรีแล้ว (progress > 1) ให้กลับไปเริ่มใหม่ที่กรุงเทพฯ
            if (vehicle.progress > 1) {
                vehicle.progress = 0;
            }
        }

        console.log("-----------------------------------------");
        // รอ 3 วินาทีก่อนส่งข้อมูลชุดถัดไป
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

simulateGPS();