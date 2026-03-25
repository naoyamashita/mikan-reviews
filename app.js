const DEFAULT_LOCAL_API = 'http://localhost:3000/api/reviews';
const STORAGE_KEY = 'mikan_reviews';
const PASSCODE_KEY = 'mikan_passcode';
const GAS_URL_KEY = 'mikan_gas_url';
const PENDING_SYNC_KEY = 'mikan_pending_sync';

let localReviews = null; 

function getApiUrl() {
    const url = localStorage.getItem(GAS_URL_KEY);
    if (!url) return DEFAULT_LOCAL_API;
    return url.trim();
}

function isGas() {
    const url = getApiUrl();
    return url && url.includes('script.google.com');
}

// --- Debug Logging ---
function debugLog(msg) {
    const logEl = document.getElementById('debug-log');
    if (!logEl) {
        console.log('[MikanLog]', msg);
        return;
    }
    const time = new Date().toLocaleTimeString();
    logEl.innerHTML = `<div style="border-bottom:1px solid rgba(255,255,255,0.1); padding:2px 0;">[${time}] ${msg}</div>` + logEl.innerHTML;
    if (logEl.children.length > 50) logEl.lastChild.remove();
}

// --- Helper: JSONP for GAS (Bypass CORS) ---
function loadJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'gasCallback_' + Math.round(Math.random() * 1000000);
        const script = document.createElement('script');
        
        window[callbackName] = (data) => {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };
        
        script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('通信環境またはURLが正しくありません'));
        };
        
        const jsonpUrl = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
        script.src = jsonpUrl;
        document.body.appendChild(script);
    });
}

// --- Data Layer ---
async function loadReviews(forceFetch = false) {
    const apiUrl = getApiUrl();
    if (!apiUrl && !isGas()) {
        updateSyncStatus('offline', 'ローカルモード');
        const raw = localStorage.getItem(STORAGE_KEY);
        localReviews = raw ? JSON.parse(raw) : [];
        return localReviews;
    }

    if (localReviews !== null && !forceFetch) return localReviews;

    updateSyncStatus('pending', '接続中...');
    debugLog(`読み込み開始 (${forceFetch ? '強制' : '通常'})`);
    
    try {
        const passcode = localStorage.getItem(PASSCODE_KEY) || '';
        let reviews = [];
        
        if (isGas()) {
            const fetchUrl = apiUrl + (apiUrl.includes('?') ? '&' : '?') + 'action=load&t=' + Date.now();
            const data = await loadJSONP(fetchUrl);
            
            if (data && data.error) throw new Error(data.error);
            reviews = Array.isArray(data) ? data : (data.reviews || []);
            debugLog(`GAS受信: ${reviews.length}件`);
        } else {
            const res = await fetch(apiUrl, { headers: { 'x-mikan-passcode': passcode }, cache: 'no-cache' });
            if (res && res.ok) {
                const data = await res.json();
                reviews = Array.isArray(data) ? data : (data.reviews || []);
            } else throw new Error(`HTTP ${res ? res.status : '?'}`);
        }

        // --- Data Protection ---
        // If background sync returns 0 but user has local items, don't overwrite!
        if (reviews.length === 0 && localReviews && localReviews.length > 0 && !forceFetch) {
            debugLog('警告: 空データを検知し同期スキップ');
            return localReviews;
        }

        localReviews = reviews;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
        updateSyncStatus('online', isGas() ? 'クラウド同期中' : 'サーバー同期中');
        return reviews;

    } catch (e) {
        debugLog(`読み込みエラー: ${e.message}`);
        updateSyncStatus('offline', isGas() ? `同期エラー: ${e.message}` : 'ローカルモード');
        if (localReviews === null) {
            const raw = localStorage.getItem(STORAGE_KEY);
            localReviews = raw ? JSON.parse(raw) : [];
        }
    }
    return localReviews || [];
}

async function saveReviews(reviews) {
    localReviews = reviews;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    
    const apiUrl = getApiUrl();
    const passcode = localStorage.getItem(PASSCODE_KEY) || '';
    if (!apiUrl && !isGas()) return false;

    debugLog(`保存開始: ${reviews.length}件`);
    try {
        if (isGas()) {
            const dataPayload = encodeURIComponent(JSON.stringify({ reviews, passcode }));
            const saveUrl = apiUrl + (apiUrl.includes('?') ? '&' : '?') + 'action=save&data=' + dataPayload;
            const result = await loadJSONP(saveUrl);
            if (result && result.success) {
                updateSyncStatus('online', 'クラウド同期完了');
                debugLog('保存成功');
                return true;
            } else throw new Error(result ? (result.error || '保存失敗') : '応答なし');
        } else {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-mikan-passcode': passcode },
                body: JSON.stringify(reviews)
            });
            if (res && res.ok) {
                updateSyncStatus('online', '同期完了');
                return true;
            } else throw new Error('Sync failed');
        }
    } catch (e) {
        debugLog(`保存エラー: ${e.message}`);
        updateSyncStatus('pending', isGas() ? `保存エラー: ${e.message}` : '未同期あり');
        return false;
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
    const radius = size * 0.32;
    const points = [
        { label: 'コク', val: data.richness || 0 },
        { label: '甘味', val: data.sweetness || 0 },
        { label: '食感', val: data.membrane || 0 },
        { label: '剥き', val: data.peelability || 0 },
        { label: '酸味', val: data.acidity || 0 }
    ];

    let bgs = '';
    for (let level = 1; level <= 5; level++) {
        const r = (level / 5) * radius;
        const pts = points.map((_, i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
        }).join(' ');
        bgs += `<polygon points="${pts}" class="chart-bg-line" style="fill:none; stroke:rgba(255,255,255,0.1); stroke-width:0.5;" />`;
    }

    let axes = '';
    points.forEach((_, i) => {
        const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
        axes += `<line x1="${center}" y1="${center}" x2="${center + radius * Math.cos(angle)}" y2="${center + radius * Math.sin(angle)}" style="stroke:rgba(255,255,255,0.1); stroke-width:0.5;" />`;
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
            
            let anchor = 'middle';
            if (x < center - 10) anchor = 'end';
            else if (x > center + 10) anchor = 'start';
            
            labels += `<text x="${x}" y="${y}" class="chart-label" text-anchor="${anchor}" dominant-baseline="middle" style="fill:#c4a882; font-size:9px; font-weight:600;">${p.label}</text>`;
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

    if (!member || !variety || sweetness === 0 || acidity === 0 || peelability === 0 || richness === 0 || membrane === 0) {
        showToast('項目をすべて選択してください ⭐'); return;
    }

    const review = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        member, variety, sweetness, acidity, peelability, richness, membrane, memo
    };

    if (localReviews === null) localReviews = [];
    localReviews.push(review);
    renderReviews(localReviews); 
    
    document.getElementById('variety-input').value = '';
    document.getElementById('memo-input').value = '';
    resetStars();
    showToast(`「${variety}」を保存中...`);
    saveReviews(localReviews);
}

async function deleteReview(id) {
    if (!localReviews) return;
    localReviews = localReviews.filter(r => r.id !== id);
    renderReviews(localReviews);
    saveReviews(localReviews);
}

async function renderReviews(dataToRender = null) {
    const reviews = dataToRender || await loadReviews();
    updateVarietySuggestions(reviews);
    
    const list = document.getElementById('review-list');
    const countEl = document.getElementById('review-count');
    countEl.textContent = reviews.length;

    if (!reviews || reviews.length === 0) {
        list.innerHTML = '<p class="empty-state">まだレビューがありません。<br>上のフォームから最初のレビューを追加しましょう！</p>';
        return;
    }

    try {
        const groups = {};
        reviews.forEach(r => {
            const v = r.variety || '不明';
            if (!groups[v]) {
                groups[v] = { variety: v, reviews: [], avg: { sweetness: 0, acidity: 0, peelability: 0, richness: 0, membrane: 0 } };
            }
            groups[v].reviews.push(r);
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
            Object.keys(g.avg).forEach(k => g.avg[k] /= count);
            g.latestDate = Math.max(...g.reviews.map(r => {
                const d = new Date(r.date || 0).getTime();
                return isNaN(d) ? 0 : d;
            }));
            return g;
        }).sort((a, b) => b.latestDate - a.latestDate);

        list.innerHTML = groupedList.map(g => `
            <div class="review-card" data-variety="${escapeHtml(g.variety)}">
                <div class="review-variety-header">
                    <div class="review-variety">${escapeHtml(g.variety)}</div>
                    <div class="review-count-badge">${g.reviews.length} 件</div>
                </div>
                <div class="review-body">
                    <div class="review-chart-container">${createRadarChart(g.avg, 180, true)}</div>
                    <div class="review-ratings-list">
                        <div class="review-rating-row"><span>甘味:</span> ${starsHTML(g.avg.sweetness)}</div>
                        <div class="review-rating-row"><span>酸味:</span> ${starsHTML(g.avg.acidity)}</div>
                        <div class="review-rating-row"><span>剥き:</span> ${starsHTML(g.avg.peelability)}</div>
                        <div class="review-rating-row"><span>コク:</span> ${starsHTML(g.avg.richness)}</div>
                        <div class="review-rating-row"><span>食感:</span> ${starsHTML(g.avg.membrane)}</div>
                    </div>
                </div>
                <div class="review-comments-section">
                    ${g.reviews.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => `
                        <div class="review-comment-item">
                            <div class="comment-header">
                                <span class="comment-author">👤 ${escapeHtml(r.member || '不明')}</span>
                                <span class="comment-date">${formatDate(r.date)}</span>
                                <button class="delete-btn mini" data-id="${r.id}">🗑</button>
                            </div>
                            <div class="comment-text">${r.memo ? escapeHtml(r.memo) : ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('削除しますか？')) deleteReview(btn.dataset.id);
            });
        });
    } catch (err) {
        debugLog(`描画エラー: ${err.message}`);
        list.innerHTML = `<p class="empty-state">表示エラーが発生しました (${err.message})</p>`;
    }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initStars();
    
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const passcodeUint = document.getElementById('passcode-input');
    const gasUrlInput = document.getElementById('gas-url-input');
    
    passcodeUint.value = localStorage.getItem(PASSCODE_KEY) || '';
    gasUrlInput.value = localStorage.getItem(GAS_URL_KEY) || '';

    settingsToggle.addEventListener('click', (e) => { e.stopPropagation(); settingsPanel.classList.toggle('hide'); });
    document.addEventListener('click', (e) => { if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) settingsPanel.classList.add('hide'); });

    passcodeUint.addEventListener('input', (e) => localStorage.setItem(PASSCODE_KEY, e.target.value));
    gasUrlInput.addEventListener('input', (e) => {
        localStorage.setItem(GAS_URL_KEY, e.target.value);
        debugLog('URL更新');
    });

    document.getElementById('add-btn').addEventListener('click', addReview);
    document.getElementById('export-btn').addEventListener('click', exportCSV);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', (e) => { if (e.target.files[0]) importCSV(e.target.files[0]); });

    document.getElementById('variety-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addReview();
    });

    loadReviews().then(reviews => renderReviews(reviews));

    setInterval(() => {
        loadReviews(true).then(reviews => {
            const count = parseInt(document.getElementById('review-count').textContent || "0");
            if (reviews && reviews.length !== count) renderReviews(reviews);
        });
    }, 25000); 
});

// --- Helpers ---
function formatDate(d) {
    if (!d) return '不明';
    try {
        const date = new Date(d);
        return isNaN(date.getTime()) ? '不明' : date.toLocaleDateString();
    } catch(e) { return '不明'; }
}

function updateVarietySuggestions(reviews) {
    const datalist = document.getElementById('variety-list');
    if (!datalist) return;
    const varieties = [...new Set(reviews.map(r => (r.variety || '').trim()))].filter(v => v).sort();
    datalist.innerHTML = varieties.map(v => `<option value="${escapeHtml(v)}">`).join('');
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initStars() {
    document.querySelectorAll('.stars-input').forEach(container => {
        const stars = container.querySelectorAll('.star');
        stars.forEach(star => {
            const handleSelect = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
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
    container.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= val);
    });
}

function resetStars() {
    document.querySelectorAll('.stars-input').forEach(container => {
        updateStars(container, 0);
        const input = document.getElementById(container.dataset.target);
        if (input) input.value = 0;
    });
}

function starsHTML(val) {
    let html = '<div class="stars-mini">';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star-s ${i <= Math.round(val) ? 'active' : ''}">★</span>`;
    }
    return html + '</div>';
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

function exportCSV() {
    loadReviews().then(reviews => {
        if (reviews.length === 0) return showToast('データがありません');
        const header = ['ID', '日付', '評価者', '品種', '甘味', '酸味', '剥き', 'コク', '食感', 'メモ'];
        const rows = reviews.map(r => [r.id, formatDate(r.date), `"${(r.member||'').replace(/"/g,'""')}"`, `"${(r.variety||'').replace(/"/g,'""')}"`, r.sweetness, r.acidity, r.peelability, r.richness, r.membrane, `"${(r.memo||'').replace(/"/g,'""')}"`].join(','));
        const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `mikan_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    });
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const lines = e.target.result.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim()).slice(1);
            const existing = await loadReviews();
            const ids = new Set(existing.map(r => r.id));
            lines.forEach(line => {
                const f = line.split(','); if (f.length < 8) return;
                const id = f[0].trim(); if (ids.has(id)) return;
                existing.push({ id, date: new Date().toISOString(), member: f[2], variety: f[3], sweetness: parseInt(f[4]), acidity: parseInt(f[5]), peelability: parseInt(f[6]), richness: parseInt(f[7]), membrane: parseInt(f[8]) || 0, memo: f[9] });
            });
            await saveReviews(existing);
            renderReviews();
            showToast('インポート完了');
        } catch (err) { showToast('インポート失敗'); }
    };
    reader.readAsText(file, 'UTF-8');
}
  e.target.value = '';
        }
    });
    document.getElementById('variety-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('add-btn').click();
    });

    // Periodic Server Sync
    setInterval(() => {
        // Only fetch from server if we are online
        loadReviews(true).then(reviews => {
            // Use a stable comparison to prevent flickering
            const currentCount = parseInt(document.getElementById('review-count').textContent);
            if (reviews && reviews.length !== currentCount) {
                renderReviews(reviews);
            }
        });
    }, 15000); // Check every 15 seconds to be gentle
});


