const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');

const config = {
    // opacity, blend mode, path for every trait. set up for bm2c art rn
    layers: [
        { name: 'background', path: './layers/background', opacity: 1, blendMode: 'source-over' },
        { name: 'logo', path: './layers/logo', opacity: 1, blendMode: 'source-over' },
        { name: 'questionable opinions', path: './layers/questionable opinions', opacity: 1, blendMode: 'source-over' },
        { name: 'funny shit', path: './layers/funny shit', opacity: 1, blendMode: 'source-over' },
        { name: 'bera', path: './layers/bera', opacity: 1, blendMode: 'source-over' },
        { name: 'oppressed minority', path: './layers/oppressed minority', opacity: 1, blendMode: 'source-over' },
        { name: 'messages', path: './layers/messages', opacity: 1, blendMode: 'source-over' },
        { name: 'stolen imagery', path: './layers/stolen imagery', opacity: 1, blendMode: 'source-over' },
        { name: 'bottom left meme', path: './layers/bottom left meme', opacity: 1, blendMode: 'source-over' },
        { name: 'curved', path: './layers/curved', opacity: 1, blendMode: 'source-over' },
        { name: 'tool', path: './layers/tool', opacity: 1, blendMode: 'source-over' },

    ],
    
    // layer for overlay, not included in metadata
    overlayLayer: { name: 'overlay', path: './layers/overlay', opacity: 0.5, blendMode: 'overlay' }, 

    outputFolder: './output', // generates both metadata and art
    metadataFile: './output/metadata.json', 
    imageCount: 3215, // supply
    width: 2000,
    height: 2000,
    qualityReductionFactor: 4,
    lightnessThresholdMin: 15,
    lightnessThresholdMax: 90,
    blendOpacity: 0.48
};





if (!fs.existsSync(config.outputFolder)) {
    fs.mkdirSync(config.outputFolder);
}

const getRandomFile = (folder) => {
    const files = fs.readdirSync(folder).filter(file => file.endsWith('.png'));
    return files.length ? path.join(folder, files[Math.floor(Math.random() * files.length)]) : null;
};

const generatedCombinations = new Set();

const generateUniqueNFT = async (index) => {
    let attributes;
    let combinationKey;
    do {
        attributes = [];
        combinationKey = '';
        for (let layer of config.layers) {
            const imgPath = getRandomFile(layer.path);
            if (!imgPath) continue;
            attributes.push({ trait_type: layer.name, value: path.basename(imgPath, '.png') });
            combinationKey += path.basename(imgPath, '.png') + '|';
        }
    } while (generatedCombinations.has(combinationKey));

    generatedCombinations.add(combinationKey);

    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    
    for (let attr of attributes) {
        const imgPath = path.join(`./layers/${attr.trait_type}`, `${attr.value}.png`);
        let imgBuffer = await sharp(imgPath).png().toBuffer();
        const originalImg = await loadImage(imgBuffer);
        ctx.drawImage(originalImg, 0, 0, config.width, config.height);
    }

    const overlayPath = getRandomFile(config.overlayLayer.path);
    if (overlayPath) {
        const overlay = await loadImage(overlayPath);
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(overlay, 0, 0, config.width, config.height);
    }

    const imageName = `${index}.png`;
    const imagePath = path.join(config.outputFolder, imageName);
    await sharp(canvas.toBuffer('image/png')).toFile(imagePath);

    return { 
        name: `Sample #${index}`, 
        description: "Sample", 
        image: imageName, 
        attributes 
    };
};

(async () => {
    let metadata = [];
    for (let i = 0; i < config.imageCount; i++) {
        metadata.push(await generateUniqueNFT(i));
    }
    fs.writeFileSync(config.metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`Generated ${config.imageCount} unique NFTs`);
})();
