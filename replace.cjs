const fs = require('fs');
const path = require('path');

const directory = 'src';

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Replacements
    const replacements = [
        { from: /monadTestnet/g, to: 'botchain' },
        { from: /Monad Testnet/g, to: 'Botchain' },
        { from: /Monad/g, to: 'Botchain' },
        { from: /switchToMonad/g, to: 'switchToBotchain' },
        { from: /monadExplorer/g, to: 'botchainExplorer' },
        { from: /https:\/\/testnet\.monadexplorer\.com/g, to: 'https://scan.botchain.ai' }
    ];

    for (let r of replacements) {
        if (content.match(r.from)) {
            content = content.replace(r.from, r.to);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.html')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directory);
files.forEach(f => replaceInFile(f));
