(function () {
    'use strict';

    // ==================== STATE ====================
    let songsData = [];
    let currentFilters = {
        voice: 'all',
        type: 'all',
        tag: null,
        search: '',
        hideUnisono: false
    };
    let currentTrack = null;
    let playableTracksList = [];

    // ==================== SHEET MUSIC STATE ====================
    let currentSheets = null;
    let currentSheetPage = 0;
    let sheetZoomed = false;

    // ==================== DOM REFS ====================
    const dom = {
        search: document.getElementById('search'),
        voiceFilters: document.getElementById('voice-filters'),
        typeFilters: document.getElementById('type-filters'),
        tagFilters: document.getElementById('tag-filters'),
        hideUnisono: document.getElementById('hide-unisono'),
        songsGrid: document.getElementById('songs-grid'),
        emptyState: document.getElementById('empty-state'),
        audioPlayer: document.getElementById('audio-player'),
        audioElement: document.getElementById('audio-element'),
        playerTitle: document.getElementById('player-title'),
        playerTrack: document.getElementById('player-track'),
        playerPlay: document.getElementById('player-play'),
        playerPrev: document.getElementById('player-prev'),
        playerNext: document.getElementById('player-next'),
        playerSeek: document.getElementById('player-seek'),
        playerCurrentTime: document.getElementById('player-current-time'),
        playerDuration: document.getElementById('player-duration'),
        playerVolume: document.getElementById('player-volume'),
        playerClose: document.getElementById('player-close'),
        hamburger: document.getElementById('hamburger'),
        hamburgerBadge: document.getElementById('hamburger-badge'),
        filters: document.getElementById('filters'),
        filtersClose: document.getElementById('filters-close'),
        filtersOverlay: document.getElementById('filters-overlay'),
        activeFilters: document.getElementById('active-filters'),
        activeFiltersList: document.getElementById('active-filters-list'),
        clearFilters: document.getElementById('clear-filters'),
        // Sheet modal
        sheetsModal: document.getElementById('sheets-modal'),
        sheetsModalTitle: document.getElementById('sheets-modal-title'),
        sheetsModalClose: document.getElementById('sheets-modal-close'),
        sheetsImage: document.getElementById('sheets-image'),
        sheetsImageContainer: document.getElementById('sheets-image-container'),
        sheetsCounter: document.getElementById('sheets-counter'),
        sheetsPrev: document.getElementById('sheets-prev'),
        sheetsNext: document.getElementById('sheets-next'),
        sheetsPagination: document.getElementById('sheets-pagination')
    };

    // ==================== CONFIG ====================
    const voiceConfig = { /* ... (bez zmian - zostaw całe voiceConfig i voiceOrder) ... */ };
    const voiceOrder = { /* ... (bez zmian) ... */ };

    function getVoiceInfo(voice) {
        return voiceConfig[voice] || { emoji: '🎵', label: voice, cssClass: 'mix' };
    }

    function getTrackIconClass(track) {
        if (track.type === 'mix') return 'mix';
        return getVoiceInfo(track.voice).cssClass;
    }

    function getTrackEmoji(track) {
        if (track.type === 'mix') return '🎛️';
        return getVoiceInfo(track.voice).emoji;
    }

    // ==================== TAG NORMALIZATION ====================
    function normalizeTag(tag) {
        return tag.toLowerCase().replace(/[^a-z0-9ąćęłńóśźżàâäéèêëïîôùûüÿœæ]/gi, '');
    }

    function getNormalizedTags(song) {
        return (song.tags || []).map(t => normalizeTag(t));
    }

    // ==================== SORTING ====================
    function compareTracks(a, b) {
        const groupA = a.type === 'mix' ? 1 : 0;
        const groupB = b.type === 'mix' ? 1 : 0;
        if (groupA !== groupB) return groupA - groupB;
        const orderA = voiceOrder[a.voice] ?? 999;
        const orderB = voiceOrder[b.voice] ?? 999;
        return orderA - orderB;
    }

    function compareSongs(a, b) {
        return a.title.localeCompare(b.title, 'pl', { sensitivity: 'base' });
    }

    // ==================== URL PARAMS ====================
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            tag: params.get('tag'),
            voice: params.get('voice'),
            type: params.get('type'),
            search: params.get('search') || params.get('q')
        };
    }

    function updateUrl() {
        const params = new URLSearchParams();

        if (currentFilters.tag && currentFilters.tag !== 'all') {
            params.set('tag', currentFilters.tag);
        }
        if (currentFilters.voice && currentFilters.voice !== 'all') {
            params.set('voice', currentFilters.voice);
        }
        if (currentFilters.type && currentFilters.type !== 'all') {
            params.set('type', currentFilters.type);
        }
        if (currentFilters.search) {
            params.set('q', currentFilters.search);
        }

        const newUrl = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.replaceState({}, '', newUrl);
    }

    function applyUrlParams() {
        const params = getUrlParams();

        if (params.tag) {
            const normalizedTag = normalizeTag(params.tag);
            currentFilters.tag = normalizedTag;
            setActiveFilterButton(dom.tagFilters, 'tag', normalizedTag);
        }

        if (params.voice) {
            currentFilters.voice = params.voice;
            setActiveFilterButton(dom.voiceFilters, 'voice', params.voice);
        }

        if (params.type) {
            currentFilters.type = params.type;
            setActiveFilterButton(dom.typeFilters, 'type', params.type);
        }

        if (params.search) {
            currentFilters.search = params.search;
            dom.search.value = params.search;
        }
    }

    function setActiveFilterButton(container, dataAttr, value) {
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset[dataAttr] === value) {
                btn.classList.add('active');
            }
        });
    }

    // ==================== DRAWER ====================
    function openFiltersDrawer() {
        dom.filters.classList.add('open');
        dom.filtersOverlay.classList.add('visible');
        dom.hamburger.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeFiltersDrawer() {
        dom.filters.classList.remove('open');
        dom.filtersOverlay.classList.remove('visible');
        dom.hamburger.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ==================== ACTIVE FILTERS ====================
    function countActiveFilters() {
        let count = 0;
        if (currentFilters.voice && currentFilters.voice !== 'all') count++;
        if (currentFilters.type && currentFilters.type !== 'all') count++;
        if (currentFilters.tag && currentFilters.tag !== 'all') count++;
        if (currentFilters.hideUnisono) count++;
        return count;
    }

    function updateHamburgerBadge() {
        const count = countActiveFilters();
        if (count > 0) {
            dom.hamburgerBadge.textContent = count;
            dom.hamburgerBadge.style.display = 'flex';
        } else {
            dom.hamburgerBadge.style.display = 'none';
        }
    }

    function updateActiveFiltersDisplay() {
        const activeFilters = [];

        if (currentFilters.voice && currentFilters.voice !== 'all') {
            const info = getVoiceInfo(currentFilters.voice);
            activeFilters.push({ type: 'voice', label: `Głos: ${info.label}`, value: currentFilters.voice });
        }

        if (currentFilters.type && currentFilters.type !== 'all') {
            const labels = { single: 'Pojedyncze', mix: 'Miksy', unisono: 'Unisono' };
            activeFilters.push({ type: 'type', label: `Typ: ${labels[currentFilters.type] || currentFilters.type}`, value: currentFilters.type });
        }

        if (currentFilters.tag && currentFilters.tag !== 'all') {
            activeFilters.push({ type: 'tag', label: `Tag: ${currentFilters.tag}`, value: currentFilters.tag });
        }

        if (currentFilters.hideUnisono) {
            activeFilters.push({ type: 'hideUnisono', label: 'Ukryte unisono', value: true });
        }

        updateHamburgerBadge();

        if (activeFilters.length === 0) {
            dom.activeFilters.style.display = 'none';
            return;
        }

        dom.activeFilters.style.display = 'flex';
        dom.activeFiltersList.innerHTML = activeFilters.map(f => `
            <span class="active-filter-tag">
                ${f.label}
                <button data-filter-type="${f.type}" aria-label="Usuń filtr">✕</button>
            </span>
        `).join('');
    }

    function clearSingleFilter(filterType) {
        switch (filterType) {
            case 'voice':
                currentFilters.voice = 'all';
                setActiveFilterButton(dom.voiceFilters, 'voice', 'all');
                break;
            case 'type':
                currentFilters.type = 'all';
                setActiveFilterButton(dom.typeFilters, 'type', 'all');
                break;
            case 'tag':
                currentFilters.tag = 'all';
                setActiveFilterButton(dom.tagFilters, 'tag', 'all');
                break;
            case 'hideUnisono':
                currentFilters.hideUnisono = false;
                dom.hideUnisono.checked = false;
                break;
        }
        updateUrl();
        updateActiveFiltersDisplay();
        render();
    }

    function clearAllFilters() {
        currentFilters.voice = 'all';
        currentFilters.type = 'all';
        currentFilters.tag = 'all';
        currentFilters.hideUnisono = false;
        currentFilters.search = '';

        dom.search.value = '';
        dom.hideUnisono.checked = false;

        setActiveFilterButton(dom.voiceFilters, 'voice', 'all');
        setActiveFilterButton(dom.typeFilters, 'type', 'all');
        setActiveFilterButton(dom.tagFilters, 'tag', 'all');

        updateUrl();
        updateActiveFiltersDisplay();
        render();
    }

    // ==================== LOAD DATA ====================
    async function loadSongs() {
        try {
            const resp = await fetch('songs.json?v=' + Date.now());
            const data = await resp.json();
            songsData = data.songs || [];
            buildFilters();
            applyUrlParams();
            updateActiveFiltersDisplay();
            render();
        } catch (e) {
            console.error('Błąd ładowania songs.json:', e);
            dom.songsGrid.innerHTML = '<p style="color: var(--text-dim); padding: 40px; text-align:center;">Nie udało się załadować danych. Sprawdź plik songs.json.</p>';
        }
    }

    // ==================== BUILD DYNAMIC FILTERS ====================
    function buildFilters() {
        const voices = new Set();
        const tagsSet = new Set();

        songsData.forEach(song => {
            song.tracks.forEach(t => voices.add(t.voice));
            (song.tags || []).forEach(t => tagsSet.add(normalizeTag(t)));
        });

        const sortedVoices = Array.from(voices).sort((a, b) => {
            const order = ['soprano', 'soprano1', 'soprano2', 'alto', 'alto1', 'alto2', 'tenor', 'tenor1', 'tenor2', 'bass', 'bass1', 'bass2', 'unisono'];
            return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
        });

        sortedVoices.forEach(voice => {
            const info = getVoiceInfo(voice);
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.voice = voice;
            btn.textContent = `${info.emoji} ${info.label}`;
            dom.voiceFilters.appendChild(btn);
        });

        if (tagsSet.size > 0) {
            const allTagBtn = document.createElement('button');
            allTagBtn.className = 'filter-btn active';
            allTagBtn.dataset.tag = 'all';
            allTagBtn.textContent = 'Wszystkie';
            dom.tagFilters.appendChild(allTagBtn);

            Array.from(tagsSet).sort((a, b) => a.localeCompare(b, 'pl')).forEach(tag => {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.dataset.tag = tag;
                btn.textContent = tag;
                dom.tagFilters.appendChild(btn);
            });
        } else {
            dom.tagFilters.parentElement.style.display = 'none';
        }
    }

    // ==================== FILTERING LOGIC ====================
    function getFilteredSongs() {
        const filtered = songsData.map(song => {
            if (currentFilters.search) {
                const q = currentFilters.search.toLowerCase();
                const match = song.title.toLowerCase().includes(q) ||
                    (song.composer || '').toLowerCase().includes(q) ||
                    (song.tags || []).some(t => normalizeTag(t).includes(normalizeTag(q)));
                if (!match) return null;
            }

            if (currentFilters.tag && currentFilters.tag !== 'all') {
                const normalizedFilterTag = normalizeTag(currentFilters.tag);
                const songNormalizedTags = getNormalizedTags(song);
                if (!songNormalizedTags.includes(normalizedFilterTag)) return null;
            }

            let tracks = song.tracks.filter(track => {
                if (currentFilters.voice !== 'all') {
                    if (track.voice !== currentFilters.voice) return false;
                }
                if (currentFilters.type !== 'all') {
                    if (track.type !== currentFilters.type) return false;
                }
                if (currentFilters.hideUnisono && track.type === 'unisono') {
                    return false;
                }
                return true;
            });

            tracks.sort(compareTracks);
            if (tracks.length === 0) return null;
            return { ...song, tracks };
        }).filter(Boolean);

        filtered.sort(compareSongs);
        return filtered;
    }

    // ==================== RENDER ====================
    function render() {
        const filtered = getFilteredSongs();

        playableTracksList = [];
        filtered.forEach(song => {
            song.tracks.forEach(track => {
                playableTracksList.push({ song, track });
            });
        });

        if (filtered.length === 0) {
            dom.songsGrid.innerHTML = '';
            dom.emptyState.style.display = 'block';
            return;
        }

        dom.emptyState.style.display = 'none';

        dom.songsGrid.innerHTML = filtered.map(song => {
            const tracksHtml = song.tracks.map(track => {
                const iconClass = getTrackIconClass(track);
                const emoji = getTrackEmoji(track);
                const isPlaying = currentTrack &&
                    currentTrack.song.id === song.id &&
                    currentTrack.track.file === track.file;
                const playingClass = isPlaying ? 'playing' : '';
                const typeBadge = track.type !== 'single'
                    ? `<span class="track-type-badge ${track.type}">${track.type}</span>`
                    : '';
                const description = track.description
                    ? `<div class="track-description">${track.description}</div>`
                    : '';

                return `
                    <div class="track-item ${playingClass}"
                         data-song-id="${song.id}"
                         data-file="${track.file}"
                         onclick="window.choirApp.playTrack('${song.id}', '${track.file}')">
                        <div class="track-icon ${iconClass}">
                            ${isPlaying ? '⏸' : emoji}
                        </div>
                        <div class="track-info">
                            <div class="track-label">${track.label}</div>
                            ${description}
                        </div>
                        ${typeBadge}
                    </div>
                `;
            }).join('');

            const tagsHtml = (song.tags || []).map(t => {
                const normalized = normalizeTag(t);
                return `<span class="tag" data-tag="${normalized}">${normalized}</span>`;
            }).join('');

            // W funkcji render(), w mapowaniu song → HTML, dodaj przed zamknięciem .song-card:

			const footerHtml = song.sheets && song.sheets.pages && song.sheets.pages.length > 0
				? `
					<div class="song-footer">
						<button class="show-sheets-btn" onclick="window.choirApp.openSheets(${JSON.stringify(song).replace(/"/g, '&quot;')})">
							📄 Pokaż nuty (${song.sheets.pages.length} str.)
						</button>
					</div>
				`
				: '';

			return `
				<div class="song-card">
					<div class="song-header">
						<div class="song-title">${song.title}</div>
						${song.composer ? `<div class="song-composer">${song.composer}</div>` : ''}
						<div class="song-tags">${tagsHtml}</div>
					</div>
					<div class="track-list">
						${tracksHtml}
					</div>
					${footerHtml}
				</div>
			`;
        }).join('');
    }

    // ==================== PLAYBACK ====================
    function playTrack(songId, file) {
        const song = songsData.find(s => s.id === songId);
        if (!song) return;

        const track = song.tracks.find(t => t.file === file);
        if (!track) return;

        if (currentTrack &&
            currentTrack.song.id === songId &&
            currentTrack.track.file === file) {
            if (dom.audioElement.paused) {
                dom.audioElement.play();
                dom.playerPlay.textContent = '⏸';
            } else {
                dom.audioElement.pause();
                dom.playerPlay.textContent = '▶';
            }
            return;
        }

        currentTrack = { song, track };
        dom.audioElement.src = file;
        dom.audioElement.play().catch(() => { });
        dom.playerTitle.textContent = song.title;
        dom.playerTrack.textContent = track.label + (track.description ? ` (${track.description})` : '');
        dom.playerPlay.textContent = '⏸';
        dom.audioPlayer.classList.add('visible');
        render();
    }

    function playPrevNext(direction) {
        if (!currentTrack || playableTracksList.length === 0) return;

        const idx = playableTracksList.findIndex(
            item => item.song.id === currentTrack.song.id &&
                item.track.file === currentTrack.track.file
        );

        let newIdx = idx + direction;
        if (newIdx < 0) newIdx = playableTracksList.length - 1;
        if (newIdx >= playableTracksList.length) newIdx = 0;

        const item = playableTracksList[newIdx];
        playTrack(item.song.id, item.track.file);
    }

    // ==================== FORMAT TIME ====================
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ==================== EVENT LISTENERS ====================
    function initEvents() {
        // Search
        let searchTimeout;
        dom.search.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = dom.search.value.trim();
                updateUrl();
                render();
            }, 200);
        });

        // Voice filter
        dom.voiceFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.voiceFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.voice = btn.dataset.voice;
            updateUrl();
            updateActiveFiltersDisplay();
            render();
        });

        // Type filter
        dom.typeFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.typeFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.type = btn.dataset.type;
            updateUrl();
            updateActiveFiltersDisplay();
            render();
        });

        // Tag filter
        dom.tagFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.tagFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.tag = btn.dataset.tag;
            updateUrl();
            updateActiveFiltersDisplay();
            render();
        });

        // Click on tag in song card
        dom.songsGrid.addEventListener('click', e => {
            const tag = e.target.closest('.tag');
            if (!tag) return;
            e.stopPropagation();
            const tagValue = tag.dataset.tag;
            if (tagValue) {
                currentFilters.tag = tagValue;
                setActiveFilterButton(dom.tagFilters, 'tag', tagValue);
                updateUrl();
                updateActiveFiltersDisplay();
                render();
            }
        });

        // Hide unisono
        dom.hideUnisono.addEventListener('change', () => {
            currentFilters.hideUnisono = dom.hideUnisono.checked;
            updateActiveFiltersDisplay();
            render();
        });

        // Hamburger menu
        dom.hamburger.addEventListener('click', () => {
            if (dom.filters.classList.contains('open')) {
                closeFiltersDrawer();
            } else {
                openFiltersDrawer();
            }
        });

        dom.filtersClose.addEventListener('click', closeFiltersDrawer);
        dom.filtersOverlay.addEventListener('click', closeFiltersDrawer);

        // Active filters - remove single
        dom.activeFiltersList.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const filterType = btn.dataset.filterType;
            if (filterType) {
                clearSingleFilter(filterType);
            }
        });

        // Clear all filters
        dom.clearFilters.addEventListener('click', clearAllFilters);

        // Player controls
        dom.playerPlay.addEventListener('click', () => {
            if (dom.audioElement.paused) {
                dom.audioElement.play();
                dom.playerPlay.textContent = '⏸';
            } else {
                dom.audioElement.pause();
                dom.playerPlay.textContent = '▶';
            }
        });

        dom.playerPrev.addEventListener('click', () => playPrevNext(-1));
        dom.playerNext.addEventListener('click', () => playPrevNext(1));

        dom.playerClose.addEventListener('click', () => {
            dom.audioElement.pause();
            dom.audioElement.src = '';
            dom.audioPlayer.classList.remove('visible');
            currentTrack = null;
            render();
        });

        dom.playerSeek.addEventListener('input', () => {
            if (dom.audioElement.duration) {
                dom.audioElement.currentTime = (dom.playerSeek.value / 100) * dom.audioElement.duration;
            }
        });

        dom.playerVolume.addEventListener('input', () => {
            dom.audioElement.volume = dom.playerVolume.value / 100;
        });
        dom.audioElement.volume = 0.8;

        dom.audioElement.addEventListener('timeupdate', () => {
            if (dom.audioElement.duration) {
                const pct = (dom.audioElement.currentTime / dom.audioElement.duration) * 100;
                dom.playerSeek.value = pct;
                dom.playerCurrentTime.textContent = formatTime(dom.audioElement.currentTime);
            }
        });

        dom.audioElement.addEventListener('loadedmetadata', () => {
            dom.playerDuration.textContent = formatTime(dom.audioElement.duration);
        });

        dom.audioElement.addEventListener('play', () => {
            dom.playerPlay.textContent = '⏸';
            render();
        });

        dom.audioElement.addEventListener('pause', () => {
            dom.playerPlay.textContent = '▶';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    dom.playerPlay.click();
                    break;
                case 'ArrowLeft':
                    if (dom.audioElement.duration) {
                        dom.audioElement.currentTime = Math.max(0, dom.audioElement.currentTime - 5);
                    }
                    break;
                case 'ArrowRight':
                    if (dom.audioElement.duration) {
                        dom.audioElement.currentTime = Math.min(dom.audioElement.duration, dom.audioElement.currentTime + 5);
                    }
                    break;
                case 'Escape':
                    closeFiltersDrawer();
                    break;
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            applyUrlParams();
            updateActiveFiltersDisplay();
            render();
        });
    }

    // ==================== SHEET MUSIC VIEWER ====================
    function openSheets(song) {
        if (!song.sheets?.pages?.length) return;

        currentSheets = song.sheets.pages;
        currentSheetPage = 0;

        dom.sheetsModalTitle.textContent = `${song.title} – Nuty`;
        dom.sheetsModal.classList.add('visible');
        document.body.style.overflow = 'hidden';

        renderCurrentSheet();
    }

    function closeSheets() {
        dom.sheetsModal.classList.remove('visible');
        document.body.style.overflow = '';
        currentSheets = null;
        sheetZoomed = false;
    }

    function renderCurrentSheet() {
        if (!currentSheets) return;
        const url = currentSheets[currentSheetPage];
        dom.sheetsImage.src = url;
        dom.sheetsCounter.textContent = `${currentSheetPage + 1} / ${currentSheets.length}`;

        dom.sheetsPrev.disabled = currentSheetPage === 0;
        dom.sheetsNext.disabled = currentSheetPage === currentSheets.length - 1;

        document.querySelectorAll('.sheets-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSheetPage);
        });
    }

    function nextSheet() {
        if (currentSheetPage < currentSheets.length - 1) {
            currentSheetPage++;
            renderCurrentSheet();
        }
    }

    function prevSheet() {
        if (currentSheetPage > 0) {
            currentSheetPage--;
            renderCurrentSheet();
        }
    }

    function toggleSheetZoom() {
        sheetZoomed = !sheetZoomed;
        dom.sheetsImage.classList.toggle('zoomed', sheetZoomed);
    }
    // ==================== EVENT LISTENERS ====================
    function initEvents() {
        // Search
        let searchTimeout;
        dom.search.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = dom.search.value.trim();
                updateUrl();
                render();
            }, 200);
        });

        // Voice filter
        dom.voiceFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.voiceFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.voice = btn.dataset.voice;
            updateUrl();
            updateActiveFiltersDisplay();
            render();
        });

        // Type filter
        dom.typeFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.typeFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.type = btn.dataset.type;
            updateUrl();
            updateActiveFiltersDisplay();
            render();
        });

        // Tag filter
        dom.tagFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.tagFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.tag = btn.dataset.tag;
            updateUrl();
            updateActiveFiltersDisplay();
            render();
        });

        // Click on tag in song card
        dom.songsGrid.addEventListener('click', e => {
            const tag = e.target.closest('.tag');
            if (!tag) return;
            e.stopPropagation();
            const tagValue = tag.dataset.tag;
            if (tagValue) {
                currentFilters.tag = tagValue;
                setActiveFilterButton(dom.tagFilters, 'tag', tagValue);
                updateUrl();
                updateActiveFiltersDisplay();
                render();
            }
        });

        // Hide unisono
        dom.hideUnisono.addEventListener('change', () => {
            currentFilters.hideUnisono = dom.hideUnisono.checked;
            updateActiveFiltersDisplay();
            render();
        });

        // Hamburger menu
        dom.hamburger.addEventListener('click', () => {
            if (dom.filters.classList.contains('open')) {
                closeFiltersDrawer();
            } else {
                openFiltersDrawer();
            }
        });

        dom.filtersClose.addEventListener('click', closeFiltersDrawer);
        dom.filtersOverlay.addEventListener('click', closeFiltersDrawer);

        // Active filters - remove single
        dom.activeFiltersList.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const filterType = btn.dataset.filterType;
            if (filterType) {
                clearSingleFilter(filterType);
            }
        });

        // Clear all filters
        dom.clearFilters.addEventListener('click', clearAllFilters);

        // Player controls
        dom.playerPlay.addEventListener('click', () => {
            if (dom.audioElement.paused) {
                dom.audioElement.play();
                dom.playerPlay.textContent = '⏸';
            } else {
                dom.audioElement.pause();
                dom.playerPlay.textContent = '▶';
            }
        });

        dom.playerPrev.addEventListener('click', () => playPrevNext(-1));
        dom.playerNext.addEventListener('click', () => playPrevNext(1));

        dom.playerClose.addEventListener('click', () => {
            dom.audioElement.pause();
            dom.audioElement.src = '';
            dom.audioPlayer.classList.remove('visible');
            currentTrack = null;
            render();
        });

        dom.playerSeek.addEventListener('input', () => {
            if (dom.audioElement.duration) {
                dom.audioElement.currentTime = (dom.playerSeek.value / 100) * dom.audioElement.duration;
            }
        });

        dom.playerVolume.addEventListener('input', () => {
            dom.audioElement.volume = dom.playerVolume.value / 100;
        });
        dom.audioElement.volume = 0.8;

        dom.audioElement.addEventListener('timeupdate', () => {
            if (dom.audioElement.duration) {
                const pct = (dom.audioElement.currentTime / dom.audioElement.duration) * 100;
                dom.playerSeek.value = pct;
                dom.playerCurrentTime.textContent = formatTime(dom.audioElement.currentTime);
            }
        });

        dom.audioElement.addEventListener('loadedmetadata', () => {
            dom.playerDuration.textContent = formatTime(dom.audioElement.duration);
        });

        dom.audioElement.addEventListener('play', () => {
            dom.playerPlay.textContent = '⏸';
            render();
        });

        dom.audioElement.addEventListener('pause', () => {
            dom.playerPlay.textContent = '▶';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    dom.playerPlay.click();
                    break;
                case 'ArrowLeft':
                    if (dom.audioElement.duration) {
                        dom.audioElement.currentTime = Math.max(0, dom.audioElement.currentTime - 5);
                    }
                    break;
                case 'ArrowRight':
                    if (dom.audioElement.duration) {
                        dom.audioElement.currentTime = Math.min(dom.audioElement.duration, dom.audioElement.currentTime + 5);
                    }
                    break;
                case 'Escape':
                    closeFiltersDrawer();
                    break;
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            applyUrlParams();
            updateActiveFiltersDisplay();
            render();
        });
    }

   // Sheet modal listeners
        dom.sheetsModalClose.addEventListener('click', closeSheets);
        dom.sheetsModal.addEventListener('click', e => {
            if (e.target === dom.sheetsModal) closeSheets();
        });
        dom.sheetsPrev.addEventListener('click', prevSheet);
        dom.sheetsNext.addEventListener('click', nextSheet);
        dom.sheetsImage.addEventListener('click', toggleSheetZoom);
        dom.sheetsPagination.addEventListener('click', e => {
            const dot = e.target.closest('.sheets-dot');
            if (dot) {
                currentSheetPage = parseInt(dot.dataset.page);
                renderCurrentSheet();
            }
        });

        // Keyboard
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT') return;

            if (currentSheets) {
                switch (e.code) {
                    case 'Escape': closeSheets(); break;
                    case 'ArrowLeft': prevSheet(); break;
                    case 'ArrowRight': nextSheet(); break;
                }
            } else {
                switch (e.code) {
                    case 'Space':
                        e.preventDefault();
                        dom.playerPlay.click();
                        break;
                    case 'ArrowLeft':
                        if (dom.audioElement.duration) dom.audioElement.currentTime = Math.max(0, dom.audioElement.currentTime - 5);
                        break;
                    case 'ArrowRight':
                        if (dom.audioElement.duration) dom.audioElement.currentTime = Math.min(dom.audioElement.duration, dom.audioElement.currentTime + 5);
                        break;
                }
            }
        });
    }

    // ==================== FINAL EXPOSE ====================
    window.choirApp = {
        playTrack,
        openSheets
    };

    initEvents();
    loadSongs();

})();