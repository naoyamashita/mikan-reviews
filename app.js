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

    // Show newest first
    const sorted = [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = sorted.map(r => `
        <div class="review-card" data-id="${r.id}">
            <div class="review-card-header">
                <div class="review-variety">${escapeHtml(r.variety)}</div>
                <div class="review-date">${formatDate(r.date)}</div>
            </div>
            <div class="review-ratings">
                <div class="review-rating-row">
                    <div class="review-rating-label">🍯 甘味</div>
                    ${starsHTML(r.sweetness)}
                </div>
                <div class="review-rating-row">
                    <div class="review-rating-label">🍋 酸味</div>
                    ${starsHTML(r.acidity)}
                </div>
                <div class="review-rating-row">
                    <div class="review-rating-label">👐 剥きやすさ</div>
                    ${starsHTML(r.peelability)}
                </div>
                <div class="review-rating-row">
                    <div class="review-rating-label">🌟 コク</div>
                    ${starsHTML(r.richness)}
                </div>
                <div class="review-rating-row">
                    <div class="review-rating-label">🫧 じょうのうの薄さ</div>
                    ${starsHTML(r.membrane)}
                </div>
            </div>
            ${r.memo ? `<div class="review-memo">💬 ${escapeHtml(r.memo)}</div>` : ''}
            <div class="review-card-footer">
                <button class="delete-btn" data-id="${r.id}">🗑 削除</button>
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

    updateStats(reviews);
}

function updateStats(reviews) {
    const section = document.getElementById('stats-section');
    if (reviews.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    const sums = { sweetness: 0, acidity: 0, peelability: 0, richness: 0, membrane: 0 };
    reviews.forEach(r => {
        sums.sweetness += (r.sweetness || 0);
        sums.acidity += (r.acidity || 0);
        sums.peelability += (r.peelability || 0);
        sums.richness += (r.richness || 0);
        sums.membrane += (r.membrane || 0);
    });

    const count = reviews.length;
    const stats = [
        { label: '🍯 甘味', key: 'sweetness' },
        { label: '🍋 酸味', key: 'acidity' },
        { label: '👐 剥きやすさ', key: 'peelability' },
        { label: '🌟 コク', key: 'richness' },
        { label: '🫧 じょうのう', key: 'membrane' }
    ];

    const grid = document.getElementById('stats-grid');
    grid.innerHTML = stats.map(s => {
        const avg = (sums[s.key] / count).toFixed(1);
        const percent = (avg / 5) * 100;
        return `
            <div class="stats-card">
                <div class="stats-label">${s.label}</div>
                <div class="stats-value">${avg}</div>
                <div class="stats-bar-bg">
                    <div class="stats-bar-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- Actions ---
function addReview() {
    const variety = document.getElementById('variety-input').value.trim();
    const sweetness = parseInt(document.getElementById('sweetness-input').value) || 0;
    const acidity = parseInt(document.getElementById('acidity-input').value) || 0;
    const peelability = parseInt(document.getElementById('peelability-input').value) || 0;
    const richness = parseInt(document.getElementById('richness-input').value) || 0;
    const membrane = parseInt(document.getElementById('membrane-input').value) || 0;
    const memo = document.getElementById('memo-input').value.trim();

    if (!variety) { showToast('品種名を入力してください 🍊'); return; }
    if (sweetness === 0 || acidity === 0 || peelability === 0 || richness === 0 || membrane === 0) {
        showToast('すべての評価項目を選択してください ⭐');
        return;
    }

    const review = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
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

    // Reset form
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

// --- CSV Export ---
function exportCSV() {
    const reviews = loadReviews();
    if (reviews.length === 0) { showToast('エクスポートするデータがありません'); return; }

    const header = ['ID', '日付', '品種', '甘味', '酸味', '剥きやすさ', 'コク', 'じょうのうの薄さ', '感想・メモ'];
    const rows = reviews.map(r => [
        r.id,
        formatDate(r.date),
        `"${r.variety.replace(/"/g, '""')}"`,
        r.sweetness,
        r.acidity,
        r.peelability,
        r.richness,
        r.membrane || 0,
        `"${(r.memo || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\r\n'); // BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mikan_reviews_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${reviews.length}件のデータをダウンロードしました ⬇️`);
}

// --- CSV Import ---
function importCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result.replace(/^\uFEFF/, ''); // strip BOM
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            // Skip header row
            const dataLines = lines.slice(1);
            if (dataLines.length === 0) { showToast('インポートするデータがありません'); return; }

            const existing = loadReviews();
            const existingIds = new Set(existing.map(r => r.id));
            let added = 0;

            dataLines.forEach(line => {
                // Simple CSV parse (handles quoted fields)
                const fields = parseCsvLine(line);
                if (fields.length < 8) return;
                const id = fields[0].trim();
                if (!id || existingIds.has(id)) return;

                const r = {
                    id,
                    date: new Date().toISOString(), // fallback
                    variety: fields[2],
                    sweetness: parseInt(fields[3]) || 0,
                    acidity: parseInt(fields[4]) || 0,
                    peelability: parseInt(fields[5]) || 0,
                    richness: parseInt(fields[6]) || 0,
                    membrane: parseInt(fields[7]) || 0,
                    memo: fields[8] || ''
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

// --- Init ---
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
            e.target.value = ''; // reset so same file can be loaded again
        }
    });

    // Enter key on variety input
    document.getElementById('variety-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('add-btn').click();
    });
});
