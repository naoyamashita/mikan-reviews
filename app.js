const DEFAULT_LOCAL_API = 'http://localhost:3000/api/reviews';
const STORAGE_KEY = 'mikan_reviews';
const PASSCODE_KEY = 'mikan_passcode';
const GAS_URL_KEY = 'mikan_gas_url';
const PENDING_SYNC_KEY = 'mikan_pending_sync';

let isServerOnline = false;

function getApiUrl() {
    const url = localStorage.getItem(GAS_URL_KEY);
    if (!url) return DEFAULT_LOCAL_API;
    return url.trim();
}

function isGas() {
    const url = getApiUrl();
    return url && url.includes('script.google.com');
}

// --- Data Layer ---
async function loadReviews() {
    const apiUrl = getApiUrl();
    if (!apiUrl && !isGas()) {
        updateSyncStatus('offline', 'ローカルモード');
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    updateSyncStatus('pending', '接続中...');
    
    try {
        const passcode = localStorage.getItem(PASSCODE_KEY) || '';
        let reviews = [];
        
        if (isGas()) {
            // Now that CSP is fixed, use fetch again (more debuggable)
            const t = Date.now();
            const fetchUrl = apiUrl + (apiUrl.includes('?') ? '&' : '?') + 't=' + t;
            const res = await fetch(fetchUrl, {
                method: 'GET',
                mode: 'cors',
                redirect: 'follow'
            });

            if (res && res.ok) {
                const data = await res.json();
                reviews = Array.isArray(data) ? data : (data.reviews || []);
                isServerOnline = true;
            } else {
                throw new Error(`HTTP ${res ? res.status : '?'}`);
            }
        } else {
            const res = await fetch(apiUrl, {
                headers: { 'x-mikan-passcode': passcode },
                cache: 'no-cache'
            });
            if (res && res.ok) {
                const data = await res.json();
                reviews = Array.isArray(data) ? data : (data.reviews || []);
                isServerOnline = true;
            } else {
                throw new Error(`HTTP ${res ? res.status : '?'}`);
            }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
        updateSyncStatus('online', isGas() ? 'クラウド同期中' : 'サーバー同期中');
        
        if (localStorage.getItem(PENDING_SYNC_KEY) === 'true') {
            await syncOfflineData(reviews);
        }
        return reviews;

    } catch (e) {
        console.error('Load Error:', e);
        isServerOnline = false;
        const errMsg = e.message || '不明なエラー';
        updateSyncStatus('offline', isGas() ? `同期エラー: ${errMsg}` : 'ローカルモード');
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

async function saveReviews(reviews) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    const apiUrl = getApiUrl();
    const passcode = localStorage.getItem(PASSCODE_KEY) || '';

    if (!apiUrl && !isGas()) return false;

    try {
        let res;
        if (isGas()) {
            // Use cors mode to see the actual result (now that CSP is fixed)
            res = await fetch(apiUrl, {
                method: 'POST',
                mode: 'cors', 
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ reviews, passcode })
            });
            
            if (res && res.ok) {
                const result = await res.json();
                if (result.success) {
                    localStorage.setItem(PENDING_SYNC_KEY, 'false');
                    updateSyncStatus('online', 'クラウド同期完了');
                    return true;
                } else {
                    throw new Error(result.error || 'GAS Error');
                }
            } else {
                throw new Error(`HTTP ${res ? res.status : '?'}`);
            }
        } else {
            res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-mikan-passcode': passcode
                },
                body: JSON.stringify(reviews)
            });
            if (res && res.ok) {
                localStorage.setItem(PENDING_SYNC_KEY, 'false');
                updateSyncStatus('online', '同期完了');
                return true;
            } else {
                throw new Error('Sync failed');
            }
        }
    } catch (e) {
        console.error('Save Error:', e);
        localStorage.setItem(PENDING_SYNC_KEY, 'true');
        updateSyncStatus('pending', isGas() ? `保存エラー: ${e.message}` : '未同期あり');
        return false;
    }
}

async function syncOfflineData(serverData) {
    const localRaw = localStorage.getItem(STORAGE_KEY);
    if (!localRaw) return;
    const localData = JSON.parse(localRaw);
    
    // Simple merge: if local has more items, push to server
    if (localData.length > serverData.length) {
        updateSyncStatus('pending', '同期中...');
        await saveReviews(localData);
    } else {
        localStorage.setItem(PENDING_SYNC_KEY, 'false');
    }
}

function updateSyncStatus(state, text) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.className = `sync-status ${state}`;
    el.querySelector('.status-text').textContent = text;
}

function createRadarChart(data, size = 180, showLabels = false) {
    const center = size / 2;
    const radius = size * 0.32; // Slightly smaller to fit labels
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
        const r = (Math.max(0.3, p.val) / 5) * radius;
        const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');
    const dataPoly = `<polygon points="${dataPts}" class="chart-data-poly" />`;

    let labels = '';
    if (showLabels) {
        points.forEach((p, i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
            const dist = radius + 20;
            const x = center + dist * Math.cos(angle);
            const y = center + dist * Math.sin(angle);
            
            // Adjust label anchor based on position
            let anchor = 'middle';
            if (x < center - 10) anchor = 'end';
            else if (x > center + 10) anchor = 'start';
            
            labels += `<text x="${x}" y="${y}" class="chart-label" text-anchor="${anchor}" dominant-baseline="middle">${p.label}</text>`;
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

// --- Actions ---
async function addReview() {
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

    const reviews = await loadReviews();
    reviews.push(review);
    await saveReviews(reviews);
    await renderReviews();

    document.getElementById('variety-input').value = '';
    document.getElementById('memo-input').value = '';
    resetStars();

    showToast(`「${variety}」のレビューを保存しました ✅`);
}

async function deleteReview(id) {
    const reviews = (await loadReviews()).filter(r => r.id !== id);
    await saveReviews(reviews);
    await renderReviews();
    showToast('削除しました');
}

function updateVarietySuggestions(reviews) {
    const datalist = document.getElementById('variety-list');
    if (!datalist) return;
    
    const varieties = [...new Set(reviews.map(r => r.variety.trim()))].sort();
    datalist.innerHTML = varieties.map(v => `<option value="${escapeHtml(v)}">`).join('');
}

async function renderReviews() {
    const reviews = await loadReviews();
    updateVarietySuggestions(reviews);
    
    const list = document.getElementById('review-list');
    const countEl = document.getElementById('review-count');
    countEl.textContent = reviews.length;

    if (reviews.length === 0) {
        list.innerHTML = '<p class="empty-state">まだレビューがありません。<br>上のフォームから最初のレビューを追加しましょう！</p>';
        return;
    }

    // Grouping logic... [SAME as before, but ensure it's in the updated app.js]
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
        g.latestDate = Math.max(...g.reviews.map(r => new Date(r.date).getTime()));
        return g;
    }).sort((a, b) => b.latestDate - a.latestDate);

    list.innerHTML = groupedList.map(g => `
        <div class="review-card" data-variety="${escapeHtml(g.variety)}">
            <div class="review-variety-header">
                <div class="review-variety">${escapeHtml(g.variety)}</div>
                <div class="review-count-badge">${g.reviews.length} 件の評価</div>
            </div>
            <div class="review-body">
                <div class="review-chart-container">
                    ${createRadarChart(g.avg, 180, true)}
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
                        <span class="review-rating-label">👄 食感:</span> ${starsHTML(Math.round(g.avg.membrane))}
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
                        <div class="comment-text">${r.memo ? escapeHtml(r.memo) : ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('このレビューを削除しますか？')) {
                deleteReview(btn.dataset.id);
            }
        });
    });
}

function exportCSV() {
    loadReviews().then(reviews => {
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
    });
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result.replace(/^\uFEFF/, '');
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const dataLines = lines.slice(1);
            if (dataLines.length === 0) { showToast('インポートするデータがありません'); return; }

            const existing = await loadReviews();
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

            await saveReviews(existing);
            await renderReviews();
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

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function initStars() {
    const containers = document.querySelectorAll('.stars-input');
    containers.forEach(container => {
        const stars = container.querySelectorAll('.star');
        stars.forEach(star => {
            const handleSelect = (e) => {
                e.preventDefault(); // Prevents double firing (touch + click)
                const val = parseInt(star.dataset.val);
                const targetId = container.dataset.target;
                const input = document.getElementById(targetId);
                if (input) {
                    input.value = val;
                    updateStars(container, val);
                }
            };
            star.addEventListener('click', handleSelect);
            star.addEventListener('touchstart', handleSelect, { passive: false });
        });
    });
}

function updateStars(container, val) {
    const stars = container.querySelectorAll('.star');
    stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= val);
    });
}

function resetStars() {
    document.querySelectorAll('.stars-input').forEach(container => {
        updateStars(container, 0);
        const targetId = container.dataset.target;
        const input = document.getElementById(targetId);
        if (input) input.value = 0;
    });
}

function starsHTML(val) {
    let html = '<div class="stars-mini">';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star-s ${i <= Math.round(val) ? 'active' : ''}">★</span>`;
    }
    html += '</div>';
    return html;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    initStars();
    renderReviews();

    // Settings Toggle
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const passcodeUint = document.getElementById('passcode-input');

    const gasUrlInput = document.getElementById('gas-url-input');
    
    // Load saved settings
    passcodeUint.value = localStorage.getItem(PASSCODE_KEY) || '';
    gasUrlInput.value = localStorage.getItem(GAS_URL_KEY) || '';

    settingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('hide');
    });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) {
            settingsPanel.classList.add('hide');
        }
    });

    passcodeUint.addEventListener('input', (e) => {
        localStorage.setItem(PASSCODE_KEY, e.target.value);
        renderReviews();
    });

    gasUrlInput.addEventListener('input', (e) => {
        localStorage.setItem(GAS_URL_KEY, e.target.value);
        renderReviews();
    });

    const addBtn = document.getElementById('add-btn');
    const handleAdd = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        addReview();
    };
    addBtn.addEventListener('click', handleAdd);
    addBtn.addEventListener('touchstart', handleAdd, { passive: false });
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

    // Periodic Server Check
    setInterval(() => {
        loadReviews().then(reviews => {
            // Only re-render if count changed or we were offline and now online
            const count = parseInt(document.getElementById('review-count').textContent);
            if (reviews.length !== count) {
                renderReviews();
            }
        });
    }, 10000); // Check every 10 seconds
});


