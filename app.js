(function () {
    'use strict';

    let songsData = [];
    let baseUrl = '';
    let currentFilters = {
        voice: 'all',
        type: 'all',
        tag: null,
        search: '',
        hideUnisono: false
    };
    let currentTrack = null;
    let currentSong = null;
    let playableTracksList = [];

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
        playerSheetsBtn: document.getElementById('player-sheets-btn'),
        hamburger: document.getElementById('hamburger'),
        hamburgerBadge: document.getElementById('hamburger-badge'),
        filters: document.getElementById('filters'),
        filtersClose: document.getElementById('filters-close'),
        filtersOverlay: document.getElementById('filters-overlay'),
        activeFilters: document.getElementById('active-filters'),
        activeFiltersList: document.getElementById('active-filters-list'),
        clearFilters: document.getElementById('clear-filters'),
        sheetsModal: document.getElementById('sheets-modal'),
        sheetsModalTitle: document.getElementById('sheets-modal-title'),
        sheetsModalClose: document.getElementById('sheets-modal-close'),
        sheetsImage: document.getElementById('sheets-image'),
        sheetsImageContainer: document.getElementById('sheets-image-container'),
        sheetsCounter: document.getElementById('sheets-counter'),
        sheetsPrev: document.getElementById('sheets-prev'),
        sheetsNext: document.getElementById('sheets-next'),
        sheetsPagination: document.getElementById('sheets-pagination'),
        sheetsTracks: document.getElementById('sheets-tracks'),
        sheetsPlayerTitle: document.getElementById('sheets-player-title'),
        sheetsPlayerTrack: document.getElementById('sheets-player-track'),
        sheetsPlayerPlay: document.getElementById('sheets-player-play'),
        sheetsPlayerPrev: document.getElementById('sheets-player-prev'),
        sheetsPlayerNext: document.getElementById('sheets-player-next'),
        sheetsPlayerSeek: document.getElementById('sheets-player-seek'),
        sheetsPlayerCurrentTime: document.getElementById('sheets-player-current-time'),
        sheetsPlayerDuration: document.getElementById('sheets-player-duration'),
        sheetsPlayerVolume: document.getElementById('sheets-player-volume'),
        toolbar: document.getElementById('toolbar'),
        sheetsNextPageHint: document.getElementById('sheets-next-page-hint')
    };

    const voiceConfig = {
        soprano: { emoji: '🎤', label: 'Sopran', cssClass: 'soprano' },
        soprano1: { emoji: '🎤', label: 'Sopran 1', cssClass: 'soprano1' },
        soprano2: { emoji: '🎤', label: 'Sopran 2', cssClass: 'soprano2' },
        alto: { emoji: '🎙️', label: 'Alt', cssClass: 'alto' },
        alto1: { emoji: '🎙️', label: 'Alt 1', cssClass: 'alto' },
        alto2: { emoji: '🎙️', label: 'Alt 2', cssClass: 'alto' },
        tenor: { emoji: '🎶', label: 'Tenor', cssClass: 'tenor' },
        tenor1: { emoji: '🎶', label: 'Tenor 1', cssClass: 'tenor' },
        tenor2: { emoji: '🎶', label: 'Tenor 2', cssClass: 'tenor' },
        bass: { emoji: '🔊', label: 'Bas', cssClass: 'bass' },
        bass1: { emoji: '🔊', label: 'Bas 1', cssClass: 'bass' },
        bass2: { emoji: '🔊', label: 'Bas 2', cssClass: 'bass' },
        unisono: { emoji: '👥', label: 'Unisono', cssClass: 'unisono' }
    };

    const voiceOrder = {
        soprano: 0, soprano1: 1, soprano2: 2,
        alto: 10, alto1: 11, alto2: 12,
        tenor: 20, tenor1: 21, tenor2: 22,
        bass: 30, bass1: 31, bass2: 32,
        unisono: 100
    };

    function resolveUrl(path) {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        return baseUrl + path;
    }

    function isMobile() {
        return window.innerWidth <= 768;
    }

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

    function normalizeTag(tag) {
        return tag.toLowerCase().replace(/[^a-z0-9ąćęłńóśźżàâäéèêëïîôùûüÿœæ]/gi, '').toLowerCase();
    }

    function getNormalizedTags(song) {
        return (song.tags || []).map(t => normalizeTag(t));
    }

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
        if (currentFilters.tag && currentFilters.tag !== 'all') params.set('tag', currentFilters.tag);
        if (currentFilters.voice && currentFilters.voice !== 'all') params.set('voice', currentFilters.voice);
        if (currentFilters.type && currentFilters.type !== 'all') params.set('type', currentFilters.type);
        if (currentFilters.search) params.set('q', currentFilters.search);
        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }

    function applyUrlParams() {
        const params = getUrlParams();
        if (params.tag) {
            currentFilters.tag = normalizeTag(params.tag);
            setActiveFilterButton(dom.tagFilters, 'tag', currentFilters.tag);
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
            if (btn.dataset[dataAttr] === value) btn.classList.add('active');
        });
    }

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
            activeFilters.push({ type: 'voice', label: `Głos: ${info.label}` });
        }
        if (currentFilters.type && currentFilters.type !== 'all') {
            const labels = { single: 'Pojedyncze', mix: 'Miksy', unisono: 'Unisono' };
            activeFilters.push({ type: 'type', label: `Typ: ${labels[currentFilters.type] || currentFilters.type}` });
        }
        if (currentFilters.tag && currentFilters.tag !== 'all') {
            activeFilters.push({ type: 'tag', label: `Tag: ${currentFilters.tag}` });
        }
        if (currentFilters.hideUnisono) {
            activeFilters.push({ type: 'hideUnisono', label: 'Ukryte unisono' });
        }
        updateHamburgerBadge();
        if (activeFilters.length === 0) {
            dom.activeFilters.style.display = 'none';
            return;
        }
        dom.activeFilters.style.display = 'flex';
        dom.activeFiltersList.innerHTML = activeFilters.map(f =>
            `<span class="active-filter-tag">${f.label}<button data-filter-type="${f.type}" aria-label="Usuń filtr">✕</button></span>`
        ).join('');
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

    async function loadSongs() {
        try {
            const resp = await fetch('songs.json?v=' + Date.now());
            const data = await resp.json();
            baseUrl = data.baseUrl || '';
            songsData = data.songs || [];
            buildFilters();
            applyUrlParams();
            updateActiveFiltersDisplay();
            render();
        } catch (e) {
            console.error('Błąd ładowania songs.json:', e);
            dom.songsGrid.innerHTML = '<p style="color: var(--text-dim); padding: 40px; text-align:center;">Nie udało się załadować danych.</p>';
        }
    }

function buildFilters() {
    const voices = new Set();
    const tagsSet = new Set();
    songsData.forEach(song => {
        song.tracks.forEach(t => {
            // Grupuj głosy - dodaj tylko główny głos (bez numerów)
            const baseVoice = t.voice.replace(/[0-9]/g, '');
            voices.add(baseVoice);
        });
        (song.tags || []).forEach(t => tagsSet.add(normalizeTag(t)));
    });
    
    // Sortuj tylko główne głosy
    const sortedVoices = Array.from(voices).sort((a, b) => {
        const order = ['soprano', 'alto', 'tenor', 'bass', 'unisono'];
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

function filterTracks(tracks) {
    return tracks.filter(track => {
        const isUnisono = track.type === 'unisono' || track.voice === 'unisono';
        
        if (isUnisono) {
            return !currentFilters.hideUnisono;
        }
        
        // Filtrowanie po głosie - grupuj S/S1/S2 itd.
        if (currentFilters.voice !== 'all') {
            const trackBaseVoice = track.voice.replace(/[0-9]/g, '');
            if (trackBaseVoice !== currentFilters.voice) {
                return false;
            }
        }
        
        if (currentFilters.type !== 'all' && track.type !== currentFilters.type) return false;
        
        return true;
    });
}

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
                const songNormalizedTags = getNormalizedTags(song);
                if (!songNormalizedTags.includes(currentFilters.tag)) return null;
            }
            let tracks = filterTracks(song.tracks);
            tracks.sort(compareTracks);
            if (tracks.length === 0) return null;
            return { ...song, tracks };
        }).filter(Boolean);
        filtered.sort(compareSongs);
        return filtered;
    }

function getVoiceComposition(tracks) {
    // Wyciągnij unikalne głosy
    const voices = [...new Set(tracks.map(t => t.voice))];
    
    // Sortuj według voiceOrder
    voices.sort((a, b) => (voiceOrder[a] ?? 999) - (voiceOrder[b] ?? 999));
    
    // Jeśli tylko unisono
    if (voices.length === 1 && voices[0] === 'unisono') {
        return 'Unisono';
    }
    
    // Skróty dla głosów
    const shortNames = {
        soprano: 'S',
        soprano1: 'S1',
        soprano2: 'S2',
        alto: 'A',
        alto1: 'A1',
        alto2: 'A2',
        tenor: 'T',
        tenor1: 'T1',
        tenor2: 'T2',
        bass: 'B',
        bass1: 'B1',
        bass2: 'B2',
        unisono: 'Uni'
    };
    
    // Filtruj unisono z głównej listy i zamień na skróty
    return voices
        .filter(v => v !== 'unisono')
        .map(v => shortNames[v] || v.toUpperCase())
        .join(' ');
}


function render(scrollToResults = false) {
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
            const isPlaying = currentTrack && currentSong && currentSong.id === song.id && currentTrack.file === track.file;
            const playingClass = isPlaying ? 'playing' : '';
            const typeBadge = track.type !== 'single' ? `<span class="track-type-badge ${track.type}">${track.type}</span>` : '';
            const description = track.description ? `<div class="track-description">${track.description}</div>` : '';
            return `
                <div class="track-item ${playingClass}" data-song-id="${song.id}" data-file="${track.file}">
                    <div class="track-icon ${iconClass}">${isPlaying ? '⏸' : emoji}</div>
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
        const hasSheets = song.sheets && song.sheets.pages && song.sheets.pages.length > 0;
        const footerHtml = hasSheets ? `
            <div class="song-footer">
                <button class="show-sheets-btn" data-song-id="${song.id}">📄 Pokaż nuty</button>
            </div>
        ` : '';
        
        // Skład głosowy (z oryginalnych tracks, nie filtrowanych)
        const originalSong = songsData.find(s => s.id === song.id);
        const voiceComposition = getVoiceComposition(originalSong ? originalSong.tracks : song.tracks);
        
        return `
            <div class="song-card" data-song-id="${song.id}">
                <div class="song-header">
                    <div class="song-header-row">
                        <div class="song-header-info" data-song-id="${song.id}">
                            <div class="song-title">${song.title}</div>
                            ${song.composer ? `<div class="song-composer">${song.composer}</div>` : ''}
                            <div class="song-voices">${voiceComposition}</div>
                            <div class="song-tags">${tagsHtml}</div>
                        </div>
                        <button class="song-expand-btn" data-song-id="${song.id}" aria-label="Rozwiń utwór">
                            <span class="arrow">▼</span>
                        </button>
                    </div>
                </div>
                <div class="song-collapsible">
                    <div class="track-list">${tracksHtml}</div>
                    ${footerHtml}
                </div>
            </div>
        `;
    }).join('');

    if (scrollToResults && filtered.length > 0) {
        const toolbarHeight = dom.toolbar ? dom.toolbar.offsetHeight : 70;
        const targetScrollTop = dom.songsGrid.offsetTop - toolbarHeight - 10;
        window.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }
}

	function playTrack(songId, file) {
		const song = songsData.find(s => s.id === songId);
		if (!song) return;
		const track = song.tracks.find(t => t.file === file);
		if (!track) return;
		if (currentTrack && currentSong && currentSong.id === songId && currentTrack.file === file) {
			if (dom.audioElement.paused) {
				dom.audioElement.play();
			} else {
				dom.audioElement.pause();
			}
			return;
		}
		currentSong = song;
		currentTrack = track;
		dom.audioElement.src = resolveUrl(file);
		dom.audioElement.play().catch(() => {});
		updatePlayerUI();
		updateSheetsPlayerUI();
		
		// ZMIANA: Pokaż główny panel tylko gdy nuty NIE są otwarte
		const sheetsOpen = dom.sheetsModal.classList.contains('visible');
		if (!sheetsOpen) {
			dom.audioPlayer.classList.add('visible');
		}
		
		const hasSheets = song.sheets && song.sheets.pages && song.sheets.pages.length > 0;
		dom.playerSheetsBtn.style.display = hasSheets ? 'flex' : 'none';
		render();
		if (sheetsOpen) {
			renderSheetsTracks();
		}
	}
	
    function playPrevNext(direction) {
        if (!currentTrack || playableTracksList.length === 0) return;
        const idx = playableTracksList.findIndex(item => item.song.id === currentSong.id && item.track.file === currentTrack.file);
        let newIdx = idx + direction;
        if (newIdx < 0) newIdx = playableTracksList.length - 1;
        if (newIdx >= playableTracksList.length) newIdx = 0;
        const item = playableTracksList[newIdx];
        playTrack(item.song.id, item.track.file);
    }

    function updatePlayerUI() {
        if (!currentSong || !currentTrack) return;
        dom.playerTitle.textContent = currentSong.title;
        dom.playerTrack.textContent = currentTrack.label + (currentTrack.description ? ` (${currentTrack.description})` : '');
        dom.playerPlay.textContent = dom.audioElement.paused ? '▶' : '⏸';
    }

    function updateSheetsPlayerUI() {
        if (!currentSong || !currentTrack) {
            if (currentSheetsSong) {
                dom.sheetsPlayerTitle.textContent = currentSheetsSong.title;
                dom.sheetsPlayerTrack.textContent = 'Wybierz ścieżkę lub kliknij ▶';
            } else {
                dom.sheetsPlayerTitle.textContent = '-';
                dom.sheetsPlayerTrack.textContent = '-';
            }
            dom.sheetsPlayerPlay.textContent = '▶';
            return;
        }
        dom.sheetsPlayerTitle.textContent = currentSong.title;
        dom.sheetsPlayerTrack.textContent = currentTrack.label;
        dom.sheetsPlayerPlay.textContent = dom.audioElement.paused ? '▶' : '⏸';
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    let currentSheetsSong = null;
    let currentSheetPages = [];
    let currentSheetPage = 0;

    function getMobileUrl(path) {
        const match = path.match(/^(.+)-(\d+)\.(\w+)$/);
        if (match) {
            return `${match[1]}-mobile-${match[2]}.${match[3]}`;
        }
        const lastDot = path.lastIndexOf('.');
        if (lastDot === -1) return path + '-mobile';
        return path.substring(0, lastDot) + '-mobile' + path.substring(lastDot);
    }

    function getSheetPages(song) {
        if (!song.sheets || !song.sheets.pages) return [];

        const pages = song.sheets.pages;

        if (isMobile() && song.sheets.mobilePages && song.sheets.mobilePages.length > 0) {
            return song.sheets.mobilePages.map(p => resolveUrl(p));
        }

        if (isMobile()) {
            return pages.map(p => resolveUrl(getMobileUrl(p)));
        }

        return pages.map(p => resolveUrl(p));
    }

    // Sprawdza czy użytkownik doscrollował do końca strony nut
function checkScrollForNextPageHint() {
    if (!currentSheetsSong || currentSheetPages.length === 0) {
        hideNextPageHint();
        return;
    }

    // Ukryj na ostatniej stronie
    if (currentSheetPage >= currentSheetPages.length - 1) {
        hideNextPageHint();
        return;
    }

    const container = dom.sheetsImageContainer;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Na mobile 200px, na desktop 100px
    const threshold = isMobile() ? 200 : 100;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;

    if (isNearBottom) {
        showNextPageHint();
    } else {
        hideNextPageHint();
    }
}
    function showNextPageHint() {
        if (dom.sheetsNextPageHint) {
            dom.sheetsNextPageHint.classList.add('visible');
            dom.sheetsNextPageHint.classList.remove('hidden');
        }
    }

    function hideNextPageHint() {
        if (dom.sheetsNextPageHint) {
            dom.sheetsNextPageHint.classList.remove('visible');
        }
    }

function openSheets(songId) {
    const song = songsData.find(s => s.id === songId);
    if (!song || !song.sheets || !song.sheets.pages || song.sheets.pages.length === 0) return;

    currentSheetsSong = song;
    currentSheetPages = getSheetPages(song);
    currentSheetPage = 0;

    dom.sheetsModalTitle.textContent = song.title + ' – Nuty';
    dom.sheetsModal.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // ZMIANA 2: Ukryj główny panel odtwarzania gdy otwarte nuty
    dom.audioPlayer.classList.remove('visible');

    renderSheet();
    renderSheetsPagination();
    renderSheetsTracks();
    updateSheetsPlayerUI();
    updateNextPageHintVisibility();
}

function closeSheets() {
    dom.sheetsModal.classList.remove('visible');
    document.body.style.overflow = '';
    currentSheetsSong = null;
    currentSheetPages = [];
    hideNextPageHint();

    // Przywróć główny panel odtwarzania jeśli coś jest odtwarzane
    if (currentTrack && currentSong) {
        dom.audioPlayer.classList.add('visible');
    }
}
    function handleSheetImageError() {
        if (!currentSheetsSong) return;

        const currentUrl = dom.sheetsImage.src;

        if (currentUrl.includes('-mobile')) {
            const originalPath = currentSheetsSong.sheets.pages[currentSheetPage];
            const originalUrl = resolveUrl(originalPath);
            if (originalUrl && currentUrl !== originalUrl) {
                dom.sheetsImage.src = originalUrl;
            }
        }
    }

    // Aktualizuje widoczność przycisku hint w zależności od strony
    function updateNextPageHintVisibility() {
        if (!currentSheetsSong || currentSheetPages.length === 0) {
            hideNextPageHint();
            return;
        }

        // Ukryj na ostatniej stronie
        if (currentSheetPage >= currentSheetPages.length - 1) {
            if (dom.sheetsNextPageHint) {
                dom.sheetsNextPageHint.classList.add('hidden');
            }
            hideNextPageHint();
        } else {
            if (dom.sheetsNextPageHint) {
                dom.sheetsNextPageHint.classList.remove('hidden');
            }
            // Sprawdź scroll dopiero po załadowaniu obrazu
            hideNextPageHint();
        }
    }

    function renderSheet() {
        if (!currentSheetsSong || currentSheetPages.length === 0) return;

        const page = currentSheetPages[currentSheetPage];
        dom.sheetsImage.src = page;

        dom.sheetsCounter.textContent = `${currentSheetPage + 1} / ${currentSheetPages.length}`;
        dom.sheetsPrev.disabled = currentSheetPage === 0;
        dom.sheetsNext.disabled = currentSheetPage === currentSheetPages.length - 1;

        dom.sheetsImageContainer.scrollTop = 0;

        document.querySelectorAll('.sheets-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSheetPage);
        });

        // Ukryj hint przy zmianie strony, potem sprawdź po załadowaniu obrazu
        hideNextPageHint();
        updateNextPageHintVisibility();
    }

    function renderSheetsPagination() {
        if (!currentSheetsSong || currentSheetPages.length === 0) return;

        dom.sheetsPagination.innerHTML = currentSheetPages.map((_, i) =>
            `<div class="sheets-dot ${i === currentSheetPage ? 'active' : ''}" data-page="${i}"></div>`
        ).join('');
    }

    function renderSheetsTracks() {
        if (!currentSheetsSong) return;
        const tracks = filterTracks(currentSheetsSong.tracks).sort(compareTracks);
        dom.sheetsTracks.innerHTML = tracks.map(track => {
            const emoji = getTrackEmoji(track);
            const isPlaying = currentTrack && currentSong && currentSong.id === currentSheetsSong.id && currentTrack.file === track.file;
            return `
                <button class="sheets-track-btn ${isPlaying ? 'playing' : ''}" data-file="${track.file}">
                    <span class="track-emoji">${emoji}</span>
                    <span>${track.label}</span>
                </button>
            `;
        }).join('');
    }

    function nextSheet() {
        if (!currentSheetsSong || currentSheetPages.length === 0) return;
        if (currentSheetPage < currentSheetPages.length - 1) {
            currentSheetPage++;
            renderSheet();
        }
    }

    function prevSheet() {
        if (!currentSheetsSong || currentSheetPages.length === 0) return;
        if (currentSheetPage > 0) {
            currentSheetPage--;
            renderSheet();
        }
    }

    function playFirstTrackOfSong(song) {
        if (!song || !song.tracks || song.tracks.length === 0) return false;
        
        const availableTracks = filterTracks(song.tracks).sort(compareTracks);
        if (availableTracks.length === 0) {
            const allTracks = [...song.tracks].sort(compareTracks);
            if (allTracks.length > 0) {
                playTrack(song.id, allTracks[0].file);
                return true;
            }
            return false;
        }
        
        playTrack(song.id, availableTracks[0].file);
        return true;
    }

    function initEvents() {
        let searchTimeout;
        dom.search.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = dom.search.value.trim();
                updateUrl();
                render(true);
            }, 200);
        });

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

dom.songsGrid.addEventListener('click', e => {
    const tag = e.target.closest('.tag');
    if (tag) {
        e.stopPropagation();
        currentFilters.tag = tag.dataset.tag;
        setActiveFilterButton(dom.tagFilters, 'tag', tag.dataset.tag);
        updateUrl();
        updateActiveFiltersDisplay();
        render();
        return;
    }

    // ZMIANA 1: Obsługa przycisku rozwijania na mobile
    const expandBtn = e.target.closest('.song-expand-btn');
    if (expandBtn) {
        e.stopPropagation();
        const songCard = expandBtn.closest('.song-card');
        if (songCard) {
            songCard.classList.toggle('expanded');
        }
        return;
    }

    // ZMIANA 2: Kliknięcie na tytuł/header info - otwiera nuty i puszcza pierwszy track
    const headerInfo = e.target.closest('.song-header-info');
    if (headerInfo) {
        e.stopPropagation();
        const songId = headerInfo.dataset.songId;
        const song = songsData.find(s => s.id === songId);
        if (song) {
            // Otwórz nuty jeśli są dostępne
            const hasSheets = song.sheets && song.sheets.pages && song.sheets.pages.length > 0;
            if (hasSheets) {
                openSheets(songId);
            }
            // Odtwórz pierwszy dostępny track
            playFirstTrackOfSong(song);
        }
        return;
    }

    const trackItem = e.target.closest('.track-item');
    if (trackItem) {
        playTrack(trackItem.dataset.songId, trackItem.dataset.file);
        return;
    }

    const sheetsBtn = e.target.closest('.show-sheets-btn');
    if (sheetsBtn) {
        openSheets(sheetsBtn.dataset.songId);
        return;
    }
});

        dom.hideUnisono.addEventListener('change', () => {
            currentFilters.hideUnisono = dom.hideUnisono.checked;
            updateActiveFiltersDisplay();
            render();
        });

        dom.hamburger.addEventListener('click', () => {
            if (dom.filters.classList.contains('open')) {
                closeFiltersDrawer();
            } else {
                openFiltersDrawer();
            }
        });

        dom.filtersClose.addEventListener('click', closeFiltersDrawer);
        dom.filtersOverlay.addEventListener('click', closeFiltersDrawer);

        dom.activeFiltersList.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (btn && btn.dataset.filterType) {
                clearSingleFilter(btn.dataset.filterType);
            }
        });

        dom.clearFilters.addEventListener('click', clearAllFilters);

        dom.playerPlay.addEventListener('click', () => {
            if (dom.audioElement.paused) {
                dom.audioElement.play();
            } else {
                dom.audioElement.pause();
            }
        });

        dom.playerPrev.addEventListener('click', () => playPrevNext(-1));
        dom.playerNext.addEventListener('click', () => playPrevNext(1));

        dom.playerClose.addEventListener('click', () => {
            dom.audioElement.pause();
            dom.audioElement.src = '';
            dom.audioPlayer.classList.remove('visible');
            currentTrack = null;
            currentSong = null;
            render();
        });

        dom.playerSheetsBtn.addEventListener('click', () => {
            if (currentSong) {
                openSheets(currentSong.id);
            }
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
                dom.sheetsPlayerSeek.value = pct;
                dom.playerCurrentTime.textContent = formatTime(dom.audioElement.currentTime);
                dom.sheetsPlayerCurrentTime.textContent = formatTime(dom.audioElement.currentTime);
            }
        });

        dom.audioElement.addEventListener('loadedmetadata', () => {
            dom.playerDuration.textContent = formatTime(dom.audioElement.duration);
            dom.sheetsPlayerDuration.textContent = formatTime(dom.audioElement.duration);
        });

        dom.audioElement.addEventListener('play', () => {
            dom.playerPlay.textContent = '⏸';
            dom.sheetsPlayerPlay.textContent = '⏸';
            render();
            if (dom.sheetsModal.classList.contains('visible')) {
                renderSheetsTracks();
            }
        });

        dom.audioElement.addEventListener('pause', () => {
            dom.playerPlay.textContent = '▶';
            dom.sheetsPlayerPlay.textContent = '▶';
        });

        dom.sheetsModalClose.addEventListener('click', closeSheets);
        dom.sheetsPrev.addEventListener('click', prevSheet);
        dom.sheetsNext.addEventListener('click', nextSheet);
        dom.sheetsImage.addEventListener('error', handleSheetImageError);

        // Sprawdź scroll po załadowaniu obrazu nut
        dom.sheetsImage.addEventListener('load', () => {
            // Daj chwilę na wyrenderowanie
            setTimeout(() => {
                checkScrollForNextPageHint();
            }, 100);
        });

        // Obsługa scrollowania w kontenerze nut
        dom.sheetsImageContainer.addEventListener('scroll', () => {
            checkScrollForNextPageHint();
        });

        // Kliknięcie w strzałkę "następna strona"
        if (dom.sheetsNextPageHint) {
            dom.sheetsNextPageHint.addEventListener('click', () => {
                nextSheet();
            });
        }

        dom.sheetsPagination.addEventListener('click', e => {
            const dot = e.target.closest('.sheets-dot');
            if (dot) {
                currentSheetPage = parseInt(dot.dataset.page);
                renderSheet();
            }
        });

        dom.sheetsTracks.addEventListener('click', e => {
            const btn = e.target.closest('.sheets-track-btn');
            if (btn && currentSheetsSong) {
                playTrack(currentSheetsSong.id, btn.dataset.file);
            }
        });

        dom.sheetsPlayerPlay.addEventListener('click', () => {
            const isCurrentSongPlaying = currentSong && currentSheetsSong && currentSong.id === currentSheetsSong.id;
            
            if (!currentTrack || !isCurrentSongPlaying) {
                if (currentSheetsSong) {
                    playFirstTrackOfSong(currentSheetsSong);
                }
                return;
            }
            
            if (dom.audioElement.paused) {
                dom.audioElement.play();
            } else {
                dom.audioElement.pause();
            }
        });

        dom.sheetsPlayerPrev.addEventListener('click', () => playPrevNext(-1));
        dom.sheetsPlayerNext.addEventListener('click', () => playPrevNext(1));

        dom.sheetsPlayerSeek.addEventListener('input', () => {
            if (dom.audioElement.duration) {
                dom.audioElement.currentTime = (dom.sheetsPlayerSeek.value / 100) * dom.audioElement.duration;
            }
        });

        dom.sheetsPlayerVolume.addEventListener('input', () => {
            dom.audioElement.volume = dom.sheetsPlayerVolume.value / 100;
            dom.playerVolume.value = dom.sheetsPlayerVolume.value;
        });

        let touchStartX = 0;
        let touchStartY = 0;
        dom.sheetsImageContainer.addEventListener('touchstart', e => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        dom.sheetsImageContainer.addEventListener('touchend', e => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchStartX - touchEndX;
            const diffY = touchStartY - touchEndY;

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    nextSheet();
                } else {
                    prevSheet();
                }
            }
        });

        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT') return;

            if (dom.sheetsModal.classList.contains('visible')) {
                switch (e.code) {
                    case 'Escape':
                        closeSheets();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        prevSheet();
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        nextSheet();
                        break;
                    case 'Space':
                        e.preventDefault();
                        if (dom.audioElement.paused) {
                            dom.audioElement.play();
                        } else {
                            dom.audioElement.pause();
                        }
                        break;
                }
                return;
            }

            switch (e.code) {
                case 'Escape':
                    closeFiltersDrawer();
                    break;
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
            }
        });

        window.addEventListener('popstate', () => {
            applyUrlParams();
            updateActiveFiltersDisplay();
            render();
        });

        window.addEventListener('resize', () => {
            if (currentSheetsSong && dom.sheetsModal.classList.contains('visible')) {
                const newPages = getSheetPages(currentSheetsSong);
                if (JSON.stringify(newPages) !== JSON.stringify(currentSheetPages)) {
                    currentSheetPages = newPages;
                    if (currentSheetPage >= currentSheetPages.length) {
                        currentSheetPage = currentSheetPages.length - 1;
                    }
                    renderSheet();
                    renderSheetsPagination();
                }
            }
        });
    }

    initEvents();
    loadSongs();

})();