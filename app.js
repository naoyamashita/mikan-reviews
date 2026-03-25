'use strict';

const STORAGE_KEY = 'mikan_reviews';

// --- Data Layer ---
function loadReviews() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveReviews(reviews) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

// --- UI: Toast ---
let toastTimer = null;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hide');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hide'), 2500);
}

// --- UI: Star Ratings ---
function initStars() {
    document.querySelectorAll('.stars-input').forEach(group => {
        const targetId = group.dataset.target;
        const hiddenInput = document.getElementById(targetId);
        const valSpan = document.getElementById(targetId.replace('-input', '-val'));
        const stars = group.querySelectorAll('.star');

        const updateStars = (val) => {
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.val) <= val);
            });
            valSpan.textContent = val > 0 ? `${val} / 5` : '-';
        };

        stars.forEach(star => {
            star.addEventListener('click', () => {
                const val = parseInt(star.dataset.val);
                hiddenInput.value = val;
                updateStars(val);
            });

            star.addEventListener('mouseover', () => {
                updateStars(parseInt(star.dataset.val));
            });

            star.addEventListener('mouseout', () => {
                updateStars(parseInt(hiddenInput.value) || 0);
            });
        });
    });
}

function resetStars() {
    document.querySelectorAll('.stars-input').forEach(group => {
        const targetId = group.dataset.target;
        const hiddenInput = document.getElementById(targetId);
        const valSpan = document.getElementById(targetId.replace('-input', '-val'));
        hiddenInput.value = 0;
        group.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
        valSpan.textContent = '-';
    });
}

// --- UI: Render Reviews ---
function starsHTML(val) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= val) html += '<span>★</span>';
        else html += '<span class="empty-star">★</span>';
    }
    return `<span class="review-stars">${html}</span>`;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function renderReviews() {
    const reviews = loadReviews();
    const list = document.getElementById('review-list');
    const countEl = document.getElementById('review-count');
    countEl.textContent = reviews.length;

    if (reviews.length === 0) {
        list.innerHTML = '<p class="empty-state">まだレビューがありません。<br>上のフォームから最初のレビューを追加しましょう！</p>';
        return;
    }

    // Group by variety
    const groups = {};
    reviews.forEach(r => {
        if (!groups[r.variety]) {
            groups[r.variety] = {
                variety: r.variety,
                reviews: [],
                avg: { sweetness: 0, acidity: 0, peelability: 0, richness: 0, membrane: 0 }
            };
        }
        groups[r.variety].reviews.push(r);
    });

    // Calculate averages and sort groups by newest review date
    const groupedList = Object.values(groups).map(g => {
        const count = g.reviews.length;
        g.reviews.forEach(r => {
            g.avg.sweetness += (r.sweetness || 0);
            g.avg.acidity += (r.acidity || 0);
            g.avg.peelability += (r.peelability || 0);
            g.avg.richness += (r.richness || 0);
            g.avg.membrane += (r.membrane || 0);
        });
        g.avg.sweetness /= count;
        g.avg.acidity /= count;
        g.avg.peelability /= count;
        g.avg.richness /= count;
        g.avg.membrane /= count;

        // Latest date for sorting
        g.latestDate = Math.max(...g.reviews.map(r => new Date(r.date).getTime()));
        return g;
    }).sort((a, b) => (b.latestDate || 0) - (a.latestDate || 0));

    list.innerHTML = groupedList.map(g => `
        <div class="review-card" data-variety="${escapeHtml(g.variety)}">
            <div class="review-variety-header">
                <div class="review-variety">${escapeHtml(g.variety)}</div>
                <div class="review-count-badge">${g.reviews.length} 件の評価</div>
            </div>
            <div class="review-body">
                <div class="review-chart-container">
                    ${createRadarChart(g.avg, 140, false)}
                </div>
                <div class="review-ratings-list">
                    <div class="review-avg-label">平均スコア</div>
                    <div class="review-rating-row">
                        <span class="review-rating-label">🍯 甘味:</span> ${starsHTML(Math.round(g.avg.sweetness))}
                    </div>
                    <div class="review-rating-row">
                        <span class="review-rating-label">🍋 酸味:</span> ${starsHTML(Math.round(g.avg.acidity))}
                    </div>
                    <div class="review-rating-row">
                        <span class="review-rating-label">👐 剥き:</span> ${starsHTML(Math.round(g.avg.peelability))}
                    </div>
                    <div class="review-rating-row">
                        <span class="review-rating-label">🌟 コク:</span> ${starsHTML(Math.round(g.avg.richness))}
                    </div>
                    <div class="review-rating-row">
                        <span class="review-rating-label">🦷 食感:</span> ${starsHTML(Math.round(g.avg.membrane))}
                    </div>
                </div>
            </div>
            
            <div class="review-comments-section">
                ${g.reviews.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => `
                    <div class="review-comment-item">
                        <div class="comment-header">
                            <span class="comment-author">👤 ${escapeHtml(r.member || '匿名')}</span>
                            <span class="comment-date">${formatDate(r.date)}</span>
                            <button class="delete-btn mini" data-id="${r.id}" title="削除">🗑</button>
                        </div>
                        <div class="comment-text">${escapeHtml(r.memo || '(コメントなし)')}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Bind delete buttons
    list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('このレビューを削除しますか？')) {
                deleteReview(btn.dataset.id);
            }
        });
    });
}

function createRadarChart(data, size = 100, showLabels = false) {
    const center = size / 2;
    const radius = size * 0.35;
    const points = [
        { label: 'コク', val: data.richness || 0 },
        { label: '甘味', val: data.sweetness || 0 },
        { label: '食感', val: data.membrane || 0 },
        { label: '剥きやすさ', val: data.peelability || 0 },
        { label: '酸味', val: data.acidity || 0 }
    ];

    let bgs = '';
    for (let level = 1; level <= 5; level++) {
        const r = (level / 5) * radius;
        const pts = points.map((_, i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
        }).join(' ');
        bgs += `<polygon points="${pts}" class="chart-bg-line" />`;
    }

    let axes = '';
    points.forEach((_, i) => {
        const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
        axes += `<line x1="${center}" y1="${center}" x2="${center + radius * Math.cos(angle)}" y2="${center + radius * Math.sin(angle)}" class="chart-axis-line" />`;
    });

    const dataPts = points.map((p, i) => {
        const r = (Math.max(0.5, p.val) / 5) * radius;
        const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');
    const dataPoly = `<polygon points="${dataPts}" class="chart-data-poly" />`;

    let labels = '';
    if (showLabels) {
        points.forEach((p, i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
            const x = center + (radius + 15) * Math.cos(angle);
            const y = center + (radius + 15) * Math.sin(angle);
            labels += `<text x="${x}" y="${y}" class="chart-label" text-anchor="middle" dominant-baseline="middle">${p.label}</text>`;
        });
    }

    return `
        <svg viewBox="0 0 ${size} ${size}" class="radar-chart">
            ${bgs}
            ${axes}
            ${dataPoly}
            ${labels}
        </svg>
    `;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function addReview() {
    const member = document.getElementById('member-input').value.trim();
    const variety = document.getElementById('variety-input').value.trim();
    const sweetness = parseInt(document.getElementById('sweetness-input').value) || 0;
    const acidity = parseInt(document.getElementById('acidity-input').value) || 0;
    const peelability = parseInt(document.getElementById('peelability-input').value) || 0;
    const richness = parseInt(document.getElementById('richness-input').value) || 0;
    const membrane = parseInt(document.getElementById('membrane-input').value) || 0;
    const memo = document.getElementById('memo-input').value.trim();

    if (!member) { showToast('評価者名を入力してください 👤'); return; }
    if (!variety) { showToast('品種名を入力してください 🍊'); return; }
    if (sweetness === 0 || acidity === 0 || peelability === 0 || richness === 0 || membrane === 0) {
        showToast('すべての評価項目を選択してください ⭐');
        return;
    }

    const review = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        member,
        variety,
        sweetness,
        acidity,
        peelability,
        richness,
        membrane,
        memo
    };

    const reviews = loadReviews();
    reviews.push(review);
    saveReviews(reviews);
    renderReviews();

    // Reset variety and memo, but keep member name
    document.getElementById('variety-input').value = '';
    document.getElementById('memo-input').value = '';
    resetStars();

    showToast(`「${variety}」のレビューを保存しました ✅`);
}

function deleteReview(id) {
    const reviews = loadReviews().filter(r => r.id !== id);
    saveReviews(reviews);
    renderReviews();
    showToast('削除しました');
}

function exportCSV() {
    const reviews = loadReviews();
    if (reviews.length === 0) { showToast('エクスポートするデータがありません'); return; }

    const header = ['ID', '日付', '評価者', '品種', '甘味', '酸味', '剥きやすさ', 'コク', '食感', '感想・メモ'];
    const rows = reviews.map(r => [
        r.id,
        formatDate(r.date),
        `"${(r.member || '').replace(/"/g, '""')}"`,
        `"${r.variety.replace(/"/g, '""')}"`,
        r.sweetness,
        r.acidity,
        r.peelability,
        r.richness,
        r.membrane || 0,
        `"${(r.memo || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mikan_reviews_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${reviews.length}件のデータをダウンロードしました ⬇️`);
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result.replace(/^\uFEFF/, '');
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const dataLines = lines.slice(1);
            if (dataLines.length === 0) { showToast('インポートするデータがありません'); return; }

            const existing = loadReviews();
            const existingIds = new Set(existing.map(r => r.id));
            let added = 0;

            dataLines.forEach(line => {
                const fields = parseCsvLine(line);
                if (fields.length < 8) return;
                const id = fields[0].trim();
                if (!id || existingIds.has(id)) return;

                const r = {
                    id,
                    date: new Date().toISOString(),
                    member: fields[2] || '不明',
                    variety: fields[3] || '不明',
                    sweetness: parseInt(fields[4]) || 0,
                    acidity: parseInt(fields[5]) || 0,
                    peelability: parseInt(fields[6]) || 0,
                    richness: parseInt(fields[7]) || 0,
                    membrane: parseInt(fields[8]) || 0,
                    memo: fields[9] || ''
                };
                existing.push(r);
                added++;
            });

            saveReviews(existing);
            renderReviews();
            showToast(`${added}件のレビューを読み込みました ✅`);
        } catch (err) {
            showToast('CSVの読み込みに失敗しました');
        }
    };
    reader.readAsText(file, 'UTF-8');
}

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

document.addEventListener('DOMContentLoaded', () => {
    initStars();
    renderReviews();

    document.getElementById('add-btn').addEventListener('click', addReview);
    document.getElementById('export-btn').addEventListener('click', exportCSV);

    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importCSV(e.target.files[0]);
            e.target.value = '';
        }
    });

    document.getElementById('variety-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('add-btn').click();
    });
});

