const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const FILE_PATH = path.join(__dirname, 'mikan_reviews.csv');
const PASSCODE = 'mikan'; // Simple default passcode

app.use(cors());
app.use(express.json());

// Passcode middleware
const auth = (req, res, next) => {
    const clientPasscode = req.headers['x-mikan-passcode'];
    if (clientPasscode !== PASSCODE) {
        return res.status(401).json({ error: 'Unauthorized: Invalid passcode' });
    }
    next();
};

// Load reviews from CSV
app.get('/api/reviews', (req, res) => {
    if (!fs.existsSync(FILE_PATH)) return res.json([]);
    try {
        const content = fs.readFileSync(FILE_PATH, 'utf-8').replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length <= 1) return res.json([]);

        const data = lines.slice(1).map(line => {
            const fields = parseCsvLine(line);
            return {
                id: fields[0],
                date: fields[1],
                member: fields[2],
                variety: fields[3],
                sweetness: parseInt(fields[4]) || 0,
                acidity: parseInt(fields[5]) || 0,
                peelability: parseInt(fields[6]) || 0,
                richness: parseInt(fields[7]) || 0,
                membrane: parseInt(fields[8]) || 0,
                memo: fields[9] || ''
            };
        });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read CSV' });
    }
});

// Save reviews to CSV (Protected)
app.post('/api/reviews', auth, (req, res) => {
    const reviews = req.body;
    if (!Array.isArray(reviews)) return res.status(400).json({ error: 'Invalid data format' });

    try {
        const header = ['ID', '日付', '評価者', '品種', '甘味', '酸味', '剥きやすさ', 'コク', '食感', '感想・メモ'];
        const rows = reviews.map(r => [
            r.id,
            r.date,
            `"${(r.member || '').replace(/"/g, '""')}"`,
            `"${(r.variety || '').replace(/"/g, '""')}"`,
            r.sweetness,
            r.acidity,
            r.peelability,
            r.richness,
            r.membrane,
            `"${(r.memo || '').replace(/"/g, '""')}"`
        ].join(','));

        const content = '\uFEFF' + [header.join(','), ...rows].join('\n');
        fs.writeFileSync(FILE_PATH, content, 'utf-8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to write CSV' });
    }
});

// Simple health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

function parseCsvLine(line) {
    const result = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
