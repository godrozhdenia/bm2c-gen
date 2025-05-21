// pixel sorter (optimized to work on 3000+ images)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');


const inputFolder = './output'; // takes images from here

// sorts based on lightness, change these numbers to affect more pixels
const LIGHTNESS_THRESHOLD_MIN = 15; 
const LIGHTNESS_THRESHOLD_MAX = 90;

// it overlays sorted image with the orig, change this 0-1 to increase sorted image's opacity
const BLEND_OPACITY = 0.48;
const MAX_CONCURRENT_WORKERS = os.cpus().length;  // optimization

if (isMainThread) {
    const files = fs.readdirSync(inputFolder).filter(file => 
        fs.lstatSync(path.join(inputFolder, file)).isFile() && ['.jpg', '.png', '.jpeg'].includes(path.extname(file).toLowerCase())
    );

    let activeWorkers = 0;
    let index = 0;

    function startNextWorker() {
        if (index >= files.length) return;
        if (activeWorkers >= MAX_CONCURRENT_WORKERS) return;
        
        const file = files[index++];
        activeWorkers++;
        const worker = new Worker(__filename, { workerData: file });
        worker.on('exit', () => {
            activeWorkers--;
            startNextWorker();
        });
        worker.on('error', (err) => console.error(`Worker error on file ${file}:`, err));
    }

    for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
        startNextWorker();
    }
} else {
    (async () => {
        const file = workerData;
        const filePath = path.join(inputFolder, file);
        try {
            const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
            const { width, height, channels } = info;
            const sortedData = Buffer.from(data);

            // pixel sorting based on lightness (vertical sorting)
            for (let x = 0; x < width; x++) {
                let columnPixels = []; // switch up x and y here for horizontal sorting
                for (let y = 0; y < height; y++) {
                    const idx = (width * y + x) * channels;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 * 100 / 255;
                    columnPixels.push({ r, g, b, lightness, y });
                }
                
                // sort only the pixels within the threshold
                let sortedColumn = columnPixels.filter(p => p.lightness >= LIGHTNESS_THRESHOLD_MIN && p.lightness <= LIGHTNESS_THRESHOLD_MAX);
                sortedColumn.sort((a, b) => a.lightness - b.lightness);
                
                let sortedIndex = 0;
                for (let y = 0; y < height; y++) {
                    const idx = (width * y + x) * channels;
                    const originalPixel = columnPixels[y];
                    if (originalPixel.lightness >= LIGHTNESS_THRESHOLD_MIN && originalPixel.lightness <= LIGHTNESS_THRESHOLD_MAX) {
                        const sortedPixel = sortedColumn[sortedIndex++];
                        sortedData[idx] = sortedPixel.r;
                        sortedData[idx + 1] = sortedPixel.g;
                        sortedData[idx + 2] = sortedPixel.b;
                    } else {
                        sortedData[idx] = originalPixel.r;
                        sortedData[idx + 1] = originalPixel.g;
                        sortedData[idx + 2] = originalPixel.b;
                    }
                }
            }

            // convert sorted data back to image
            const sortedImageBuffer = await sharp(sortedData, { raw: { width, height, channels } }).png().toBuffer();

            // blend original and sorted image using linear light
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            const originalImg = await loadImage(filePath);
            const sortedImg = await loadImage(sortedImageBuffer);

            ctx.drawImage(originalImg, 0, 0);
            ctx.globalAlpha = BLEND_OPACITY;

            // overlays orig with sorted image using this blendmode. can add a var and change it
            ctx.globalCompositeOperation = 'linear-light';
            
            ctx.drawImage(sortedImg, 0, 0);

            const outStream = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream();
            stream.pipe(outStream);
            outStream.on('finish', () => console.log(`Processed ${file}`));
        } catch (error) { // error handling
            console.error(`Error processing file ${file}:`, error);
        }
    })();
} 
