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
        playerClose: document.getElementById('player-close')
    };

    // ==================== VOICE CONFIG ====================
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
        soprano: 0,
        soprano1: 1,
        soprano2: 2,
        alto: 10,
        alto1: 11,
        alto2: 12,
        tenor: 20,
        tenor1: 21,
        tenor2: 22,
        bass: 30,
        bass1: 31,
        bass2: 32,
        unisono: 100
    };

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
        return tag
            .toLowerCase()
            .replace(/[^a-z0-9ąćęłńóśźżàâäéèêëïîôùûüÿœæ]/gi, '')
            .toLowerCase();
    }

    function getNormalizedTags(song) {
        return (song.tags || []).map(t => normalizeTag(t));
    }

    // ==================== SORTING ====================
    function compareTracks(a, b) {
        const groupA = a.type === 'mix' ? 1 : 0;
        const groupB = b.type === 'mix' ? 1 : 0;

        if (groupA !== groupB) {
            return groupA - groupB;
        }

        const orderA = voiceOrder[a.voice] ?? 999;
        const orderB = voiceOrder[b.voice] ?? 999;

        return orderA - orderB;
    }

    function compareSongs(a, b) {
        return a.title.localeCompare(b.title, 'pl', { sensitivity: 'base' });
    }

    // ==================== LOAD DATA ====================
    async function loadSongs() {
        try {
            const resp = await fetch('songs.json?v=' + Date.now());
            const data = await resp.json();
            songsData = data.songs || [];
            buildFilters();
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

        // Sortowanie utworów alfabetycznie po tytule
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

            const tagsHtml = (song.tags || []).map(t =>
                `<span class="tag">${normalizeTag(t)}</span>`
            ).join('');

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
        let searchTimeout;
        dom.search.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = dom.search.value.trim();
                render();
            }, 200);
        });

        dom.voiceFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.voiceFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.voice = btn.dataset.voice;
            render();
        });

        dom.typeFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.typeFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.type = btn.dataset.type;
            render();
        });

        dom.tagFilters.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            dom.tagFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.tag = btn.dataset.tag;
            render();
        });

        dom.hideUnisono.addEventListener('change', () => {
            currentFilters.hideUnisono = dom.hideUnisono.checked;
            render();
        });

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
            }
        });
    }

    window.choirApp = { playTrack };

    initEvents();
    loadSongs();

})();