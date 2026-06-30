/**
 * Live HLS Player Widget
 * A clean, deobfuscated HLS video player for embedding live streams.
 * 
 * Usage:
 * <div id="live-player-widget" 
 *      data-stream="https://example.com/stream.m3u8"
 *      data-title="Match Title">
 *   <div class="lp-match" data-url="https://example.com/stream1.m3u8" data-time="LIVE NOW">Team A vs Team B</div>
 *   <div class="lp-match" data-url="https://example.com/stream2.m3u8" data-time="20:00 UTC">Team C vs Team D</div>
 * </div>
 * 
 * Then include this script.
 */

(function(window, document) {
    'use strict';

    // ========== CONFIGURATION ==========
    const CONFIG = {
        // Primary CDN for HLS.js (jsDelivr - more reliable than cdnjs)
        HLS_CDN: 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js',
        // Fallback CDN
        HLS_CDN_FALLBACK: 'https://unpkg.com/hls.js@1.5.15/dist/hls.min.js',
        // Widget container ID
        WIDGET_ID: 'live-player-widget',
        // Match item class
        MATCH_CLASS: 'lp-match',
        // Popup delay (ms)
        POPUP_DELAY: 180000, // 3 minutes
        // Default stream (test stream from Mux - replace with your own)
        DEFAULT_STREAM: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
    };

    // ========== STATE ==========
    let hlsInstance = null;
    let videoElement = null;
    let hdEnabled = false;
    let popupTimer = null;

    // ========== UTILITY FUNCTIONS ==========
    function createElement(tag, attributes, innerHTML) {
        const el = document.createElement(tag);
        if (attributes) {
            for (const key in attributes) {
                el.setAttribute(key, attributes[key]);
            }
        }
        if (innerHTML) el.innerHTML = innerHTML;
        return el;
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            // Check if HLS.js is already loaded
            if (window.Hls) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ========== STYLES ==========
    function injectStyles() {
        if (document.getElementById('lp-styles')) return;

        const style = createElement('style', { id: 'lp-styles' });
        style.textContent = `
            .lp-container {
                width: 100%;
                max-width: 100%;
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Arial, sans-serif;
                background: #f8f9fa;
                overflow: hidden;
                border: 1px solid #dee2e6;
                border-radius: 8px;
            }
            .lp-hd-btn {
                width: 100%;
                padding: 14px 20px;
                background: linear-gradient(135deg, #1a5f1a 0%, #2e8b2e 100%);
                color: #fff;
                border: none;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: all 0.3s ease;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin: 0;
            }
            .lp-hd-btn:hover {
                background: linear-gradient(135deg, #226622 0%, #36a136 100%);
            }
            .lp-hd-btn.hd-on {
                background: linear-gradient(135deg, #c9a000 0%, #ffd700 100%);
                color: #1a1a1a;
            }
            .lp-hd-badge {
                background: rgba(255,255,255,0.25);
                padding: 3px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 700;
            }
            .lp-hd-btn.hd-on .lp-hd-badge {
                background: rgba(0,0,0,0.15);
            }
            .lp-player-wrap {
                position: relative;
                background: #000;
                width: 100%;
                margin: 0;
                padding: 0;
            }
            .lp-player-wrap video {
                width: 100%;
                height: auto;
                max-height: 75vh;
                background: #000;
                display: block;
                margin: 0;
                padding: 0;
                border: none;
            }
            .lp-live-badge {
                position: absolute;
                top: 12px;
                left: 12px;
                background: #e10600;
                color: #fff;
                padding: 4px 14px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                animation: lpPulse 2s infinite;
                z-index: 10;
                pointer-events: none;
            }
            @keyframes lpPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            .lp-status {
                color: #444;
                text-align: center;
                padding: 10px;
                font-size: 13px;
                background: #fff;
                border-top: 1px solid #e0e4e8;
                border-bottom: 1px solid #e0e4e8;
                margin: 0;
            }
            .lp-matches {
                padding: 12px;
                background: #f0f2f5;
                border-top: 1px solid #e0e4e8;
            }
            .lp-matches-title {
                color: #1a1a1a;
                font-size: 14px;
                font-weight: 700;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .lp-matches-title::before {
                content: "⚽";
            }
            .lp-match-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 8px;
            }
            .lp-match-btn {
                background: #fff;
                border: 1px solid #d0d4d8;
                color: #333;
                padding: 12px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
                text-align: left;
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            }
            .lp-match-btn:hover {
                background: #f8fafc;
                border-color: #4a90d9;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.08);
            }
            .lp-match-btn.active {
                background: #1a3a5c;
                border-color: #1a3a5c;
                color: #fff;
            }
            .lp-match-btn.active .lp-match-teams { color: #fff; }
            .lp-match-btn.active .lp-match-time { color: #b0c8e0; }
            .lp-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .lp-dot.live { background: #e10600; animation: lpPulse 2s infinite; }
            .lp-dot.upcoming { background: #888; }
            .lp-match-info {
                display: flex;
                flex-direction: column;
                line-height: 1.3;
            }
            .lp-match-teams { font-weight: 600; color: #1a1a1a; }
            .lp-match-time { font-size: 11px; color: #666; }
            .lp-popup-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 100;
                flex-direction: column;
                gap: 14px;
                padding: 20px;
                box-sizing: border-box;
                text-align: center;
            }
            .lp-popup-overlay.show { display: flex; }
            .lp-popup-text {
                color: #fff;
                font-size: 20px;
                font-weight: 700;
                line-height: 1.4;
                margin-bottom: 8px;
            }
            .lp-popup-btn {
                background: linear-gradient(135deg, #e10600 0%, #ff3333 100%);
                color: #fff;
                border: none;
                padding: 14px 40px;
                border-radius: 50px;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(225,6,0,0.4);
            }
            .lp-popup-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 20px rgba(225,6,0,0.6);
            }
            @media (max-width: 600px) {
                .lp-hd-btn { font-size: 13px; padding: 12px; }
                .lp-match-grid { grid-template-columns: 1fr; }
                .lp-match-btn { font-size: 12px; }
                .lp-status { font-size: 12px; }
                .lp-popup-text { font-size: 16px; }
                .lp-popup-btn { padding: 12px 28px; font-size: 14px; }
            }
        `;
        document.head.appendChild(style);
    }

    // ========== BUILD WIDGET ==========
    function buildWidget(container) {
        container.innerHTML = '';
        container.className = 'lp-container';

        // HD Toggle Button
        const hdBtn = createElement('button', { class: 'lp-hd-btn' });
        hdBtn.innerHTML = '<span>🎥</span><span>HD Display</span><span class="lp-hd-badge">AUTO</span>';
        hdBtn.onclick = function() {
            hdEnabled = !hdEnabled;
            const badge = hdBtn.querySelector('.lp-hd-badge');
            if (hdEnabled) {
                hdBtn.classList.add('hd-on');
                badge.textContent = 'ON';
                if (hlsInstance && hlsInstance.levels.length > 0) {
                    hlsInstance.currentLevel = hlsInstance.levels.length - 1;
                }
            } else {
                hdBtn.classList.remove('hd-on');
                badge.textContent = 'AUTO';
                if (hlsInstance) hlsInstance.currentLevel = -1;
            }
        };
        container.appendChild(hdBtn);

        // Video Player Wrapper
        const playerWrap = createElement('div', { class: 'lp-player-wrap' });
        playerWrap.innerHTML = '<div class="lp-live-badge">● LIVE</div>';

        const video = createElement('video', { 
            id: 'lp-video', 
            controls: '', 
            autoplay: '', 
            playsinline: '' 
        });
        playerWrap.appendChild(video);

        // Popup Overlay (optional - for user engagement)
        const popup = createElement('div', { 
            class: 'lp-popup-overlay', 
            id: 'lp-popup' 
        });
        popup.innerHTML = `
            <div class="lp-popup-text">📡 Stream interrupted?<br>Try refreshing or select another match</div>
            <button class="lp-popup-btn" onclick="document.getElementById('lp-popup').classList.remove('show')">✕ Close</button>
        `;
        playerWrap.appendChild(popup);
        container.appendChild(playerWrap);

        // Status Bar
        const status = createElement('div', { class: 'lp-status', id: 'lp-status' });
        status.textContent = 'Loading stream…';
        container.appendChild(status);

        // Matches Section
        const matchesSection = createElement('div', { class: 'lp-matches' });
        matchesSection.innerHTML = '<div class="lp-matches-title">Live Matches</div>';

        const matchGrid = createElement('div', { 
            class: 'lp-match-grid', 
            id: 'lp-match-grid' 
        });
        matchesSection.appendChild(matchGrid);
        container.appendChild(matchesSection);

        videoElement = video;
        return { matchGrid, status, popup };
    }

    // ========== PARSE MATCHES ==========
    function parseMatches(container) {
        const matchElements = container.querySelectorAll('.' + CONFIG.MATCH_CLASS);
        const matches = [];

        matchElements.forEach(function(el) {
            const url = el.getAttribute('data-url') || el.getAttribute('data-stream') || '';
            const time = el.getAttribute('data-time') || el.getAttribute('data-status') || 'LIVE NOW';
            const teams = el.textContent.trim();
            if (url && teams) {
                matches.push({ teams: teams, time: time, url: url });
            }
        });

        // Fallback to default if no matches found
        if (matches.length === 0) {
            matches.push({ 
                teams: 'Test Stream', 
                time: 'LIVE NOW', 
                url: CONFIG.DEFAULT_STREAM 
            });
        }

        return matches;
    }

    // ========== RENDER MATCH BUTTONS ==========
    function renderMatches(grid, matches, video, status, popup) {
        grid.innerHTML = '';

        matches.forEach(function(match, index) {
            const btn = createElement('button', { 
                class: 'lp-match-btn' + (index === 0 ? ' active' : '') 
            });
            const isLive = match.time.toLowerCase().includes('live');

            btn.innerHTML = `
                <span class="lp-dot ${isLive ? 'live' : 'upcoming'}"></span>
                <span class="lp-match-info">
                    <span class="lp-match-teams">${match.teams}</span>
                    <span class="lp-match-time">${match.time}</span>
                </span>
            `;

            btn.onclick = function() {
                grid.querySelectorAll('.lp-match-btn').forEach(function(b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                status.textContent = 'Loading ' + match.teams + '…';
                loadStream(match.url, video, status, popup);
            };

            grid.appendChild(btn);
        });
    }

    // ========== LOAD STREAM ==========
    function loadStream(url, video, status, popup) {
        // Cleanup previous instance
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        if (popupTimer) {
            clearTimeout(popupTimer);
            popupTimer = null;
        }
        if (popup) popup.classList.remove('show');

        if (!url) {
            status.textContent = 'No stream URL provided.';
            return;
        }

        function setStatus(msg) {
            status.textContent = msg;
        }

        // Use HLS.js if supported
        if (window.Hls && window.Hls.isSupported && window.Hls.isSupported()) {
            hlsInstance = new window.Hls({
                maxBufferLength: 30,
                liveSyncDurationCount: 3,
                startLevel: -1
            });

            hlsInstance.loadSource(url);
            hlsInstance.attachMedia(video);

            hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function() {
                setStatus('● Live');
                video.play().catch(function() {
                    setStatus('Click play to start the stream');
                });

                if (hdEnabled && hlsInstance.levels.length > 0) {
                    hlsInstance.currentLevel = hlsInstance.levels.length - 1;
                }

                if (popup) {
                    popupTimer = setTimeout(function() {
                        popup.classList.add('show');
                    }, CONFIG.POPUP_DELAY);
                }
            });

            hlsInstance.on(window.Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                        setStatus('Network error, trying to recover…');
                        hlsInstance.startLoad();
                    } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                        setStatus('Media error, trying to recover…');
                        hlsInstance.recoverMediaError();
                    } else {
                        setStatus('Unrecoverable error. Try another match.');
                        hlsInstance.destroy();
                        hlsInstance = null;
                    }
                }
            });
        } 
        // Fallback to native HLS (Safari)
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', function() {
                setStatus('● Live');
                video.play();
                if (popup) {
                    popupTimer = setTimeout(function() {
                        popup.classList.add('show');
                    }, CONFIG.POPUP_DELAY);
                }
            });
        } 
        // No support
        else {
            setStatus('Your browser does not support HLS playback.');
        }
    }

    // ========== INITIALIZE ==========
    function init() {
        const container = document.getElementById(CONFIG.WIDGET_ID);
        if (!container) {
            console.warn('live-player-widget: #' + CONFIG.WIDGET_ID + ' not found');
            return;
        }

        const matches = parseMatches(container);

        // Try primary CDN, fallback to secondary
        loadScript(CONFIG.HLS_CDN)
            .catch(function() {
                console.warn('Primary CDN failed, trying fallback...');
                return loadScript(CONFIG.HLS_CDN_FALLBACK);
            })
            .then(function() {
                injectStyles();
                const elements = buildWidget(container);
                renderMatches(elements.matchGrid, matches, videoElement, elements.status, elements.popup);
                loadStream(matches[0].url, videoElement, elements.status, elements.popup);
            })
            .catch(function() {
                container.innerHTML = `
                    <div style="padding:20px;background:#fff;color:#e10600;text-align:center;border:1px solid #e0e4e8;">
                        Failed to load HLS player library. Please check your connection.
                    </div>
                `;
            });
    }

    // ========== BOOT ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window, document);
