document.addEventListener("DOMContentLoaded", () => {
    // Instantiate map layer focusing on Kochi, Kerala area maps context
    const map = L.map('map').setView([10.0082, 76.3276], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const markerGroup = L.layerGroup().addTo(map);

    // Structural states tracking matrix
    let localIncidentsCache = [];
    let isFirstLoad = true;
    let isModalOpen = false; // Prevents background polling from breaking form interactions

    // Priority rank weighing mapping table
    const priorityWeights = { "critical": 3, "high": 2, "medium": 1, "low": 0 };

    // Cached DOM Element Handles
    const searchInput = document.getElementById('feedSearch');
    const sortSelect = document.getElementById('feedSort');
    const feedContainer = document.getElementById('incidentFeed');
    const summaryModal = document.getElementById('summaryModal');
    const modalContent = document.getElementById('modalContent');

    // Global toggle function made available to the interactive popup window scopes
    window.togglePopupHistory = function(locationKey, showAll) {
        const minimalView = document.getElementById(`min-view-${locationKey}`);
        const fullView = document.getElementById(`full-view-${locationKey}`);
        
        if (showAll) {
            if (minimalView) minimalView.style.display = 'none';
            if (fullView) fullView.style.display = 'block';
        } else {
            if (minimalView) minimalView.style.display = 'block';
            if (fullView) fullView.style.display = 'none';
        }
    };

    // =========================================================================
    // NEW ACTIVE MODAL COMPONENT ENGINE ACTIONS
    // =========================================================================
    window.closeSummaryModal = function() {
        if (summaryModal) summaryModal.style.display = 'none';
        isModalOpen = false;
        fetchLatestDataFromServer(); // Trigger an instant update refresh
    };

    window.revealActionFormFields = function() {
        const formConsole = document.getElementById('aiActionConsole');
        const triggerLink = document.getElementById('aiTriggerLink');
        if (formConsole) formConsole.style.display = 'block';
        if (triggerLink) triggerLink.style.display = 'none';
    };

    window.saveIncidentTriageChanges = async function(incidentId) {
        const statusSelect = document.getElementById(`modalStatusDropdown-${incidentId}`);
        if (!statusSelect) return;

        const currentStatus = statusSelect.value;
        let selectedTeams = [];
        let allocatedResources = [];

        // Check if the input form is currently visible or active
        const formConsole = document.getElementById('aiActionConsole');
        if (formConsole && formConsole.style.display !== 'none') {
            // Compile Job 1 Checklist Items
            if (document.getElementById('team-rescue')?.checked) selectedTeams.push('rescue');
            if (document.getElementById('team-medical')?.checked) selectedTeams.push('medical');
            if (document.getElementById('team-authority')?.checked) selectedTeams.push('authority');

            // Compile Job 2 Counter Inputs
            const foodVal = parseInt(document.getElementById('res-food').value) || 0;
            const waterVal = parseInt(document.getElementById('res-water').value) || 0;
            const aidVal = parseInt(document.getElementById('res-aid').value) || 0;
            const boatVal = parseInt(document.getElementById('res-boat').value) || 0;

            if (foodVal > 0) allocatedResources.push(`food:${foodVal}`);
            if (waterVal > 0) allocatedResources.push(`water:${waterVal}`);
            if (aidVal > 0) allocatedResources.push(`aid:${aidVal}`);
            if (boatVal > 0) allocatedResources.push(`boat:${boatVal}`);
        }

        try {
            const response = await fetch(`/api/incidents/${incidentId}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: currentStatus,
                    assigned_teams: selectedTeams.join(','),
                    requested_resources: allocatedResources.join(',')
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                window.closeSummaryModal();
            } else {
                alert("Error recording values: " + result.message);
            }
        } catch (err) {
            console.error("Failed transmission request updating triage:", err);
        }
    };

    window.openSummaryModal = function(item) {
        if (!summaryModal || !modalContent) return;
        isModalOpen = true; // Lock interval background script re-render iterations

        const status = item.status || 'Not Attended';
        const teamsList = item.assigned_teams ? item.assigned_teams.split(',') : [];
        
        // Parse raw resource counts mapping string safely
        const resourceMap = {};
        if (item.requested_resources) {
            item.requested_resources.split(',').forEach(entry => {
                const [resourceKey, resourceAmount] = entry.split(':');
                resourceMap[resourceKey] = resourceAmount;
            });
        }

        // Build presentation layouts based on attendance condition parameters
        let clickTriggerLinkHtml = '';
        let initialFormStyleState = 'display: none;';

        if (status === 'Not Attended') {
            clickTriggerLinkHtml = `
                <div id="aiTriggerLink" style="margin: 1rem 0; padding: 0.6rem; border: 1px dashed var(--primary); text-align: center; border-radius: 4px; background: rgba(239, 68, 68, 0.05);">
                    <a href="#" onclick="revealActionFormFields(); return false;" style="color: var(--primary); font-weight: bold; font-size: 0.88rem; text-decoration: underline;">
                        ⚠️ Scenario Not Attended: Click here to execute action configurations
                    </a>
                </div>
            `;
        } else if (status === 'Still on Working') {
            initialFormStyleState = 'display: block;';
        }

        modalContent.innerHTML = `
            <h3 style="margin-top: 0; color: var(--text-light); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1rem;">📋 Emergency Summary Profile</h3>
            
            <div style="font-size: 0.9rem; line-height: 1.5; color: var(--text-light); margin-bottom: 1rem;">
                <p style="margin: 0.4rem 0;"><strong>📍 Location Metrics:</strong> Latitude ${item.latitude}, Longitude ${item.longitude}</p>
                <p style="margin: 0.4rem 0;"><strong>📖 Crisis Core Assessment:</strong> ${item.analysis_summary || 'No backup summary summary profile extracted.'}</p>
            </div>
            
            <div style="margin: 1rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
                <strong>📊 Lifecycle Status:</strong>
                <select id="modalStatusDropdown-${item.id}" style="background: #0f0f11; border: 1px solid var(--border); color: white; padding: 0.35rem 0.5rem; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    <option value="Not Attended" ${status === 'Not Attended' ? 'selected' : ''}>🔴 Not Attended</option>
                    <option value="Still on Working" ${status === 'Still on Working' ? 'selected' : ''}>🟡 Still on Working</option>
                    <option value="Problem Solved" ${status === 'Problem Solved' ? 'selected' : ''}>🟢 Problem Solved</option>
                </select>
            </div>

            ${clickTriggerLinkHtml}

            <div id="aiActionConsole" style="${initialFormStyleState} margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                <h4 style="margin: 0 0 0.5rem 0; color: var(--accent); font-size: 0.95rem;">🤖 AI-Evaluated Mission Board</h4>
                
                <p style="margin: 0 0 0.4rem 0; font-size: 0.85rem; color: var(--text-muted);"><strong>1st Job:</strong> Assign Emergency Response Teams:</p>
                <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; padding-left: 0.2rem;">
                    <label style="cursor: pointer; font-size: 0.88rem;"><input type="checkbox" id="team-rescue" ${teamsList.includes('rescue') ? 'checked' : ''}> 🛠️ Rescue Teams</label>
                    <label style="cursor: pointer; font-size: 0.88rem;"><input type="checkbox" id="team-medical" ${teamsList.includes('medical') ? 'checked' : ''}> 🚑 Medical Team</label>
                    <label style="cursor: pointer; font-size: 0.88rem;"><input type="checkbox" id="team-authority" ${teamsList.includes('authority') ? 'checked' : ''}> 🏢 Local Authority</label>
                </div>

                <p style="margin: 0 0 0.4rem 0; font-size: 0.85rem; color: var(--text-muted);"><strong>2nd Job:</strong> Request Necessary Emergency Resources:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding: 0.6rem; background: #0f0f11; border: 1px solid var(--border); border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;"><label style="font-size: 0.82rem;">🍞 Food:</label><input type="number" id="res-food" value="${resourceMap['food'] || 0}" min="0" style="width: 50px; background: var(--card-dark); border: 1px solid var(--border); color:#fff; text-align: center; border-radius:4px; padding: 2px;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;"><label style="font-size: 0.82rem;">💧 Water:</label><input type="number" id="res-water" value="${resourceMap['water'] || 0}" min="0" style="width: 50px; background: var(--card-dark); border: 1px solid var(--border); color:#fff; text-align: center; border-radius:4px; padding: 2px;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;"><label style="font-size: 0.82rem;">📦 Med Aid:</label><input type="number" id="res-aid" value="${resourceMap['aid'] || 0}" min="0" style="width: 50px; background: var(--card-dark); border: 1px solid var(--border); color:#fff; text-align: center; border-radius:4px; padding: 2px;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;"><label style="font-size: 0.82rem;">🛶 Boats:</label><input type="number" id="res-boat" value="${resourceMap['boat'] || 0}" min="0" style="width: 50px; background: var(--card-dark); border: 1px solid var(--border); color:#fff; text-align: center; border-radius:4px; padding: 2px;"></div>
                </div>
            </div>

            <div style="margin-top: 1.5rem; text-align: right; display: flex; justify-content: flex-end; gap: 0.5rem;">
                <button onclick="closeSummaryModal()" style="background: #374151; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Cancel</button>
                <button onclick="saveIncidentTriageChanges(${item.id})" style="background: var(--primary); color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Save Adjustments</button>
            </div>
        `;

        summaryModal.style.display = 'flex';
    };

    // Main layout pipelines processing matrix
    function processAndRenderUI() {
        if (!feedContainer || isModalOpen) return; // Exit if an operator is modifying a form profile

        const searchKeyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const sortCriteria = sortSelect ? sortSelect.value : 'newest';

        // Pipeline phase 1: Filter incoming cache entries
        let recordsToRender = localIncidentsCache.filter(item => {
            if (item.category === "Verification Screen") return false;
            if (!searchKeyword) return true;

            return (
                (item.raw_text && item.raw_text.toLowerCase().includes(searchKeyword)) ||
                (item.translated_text && item.translated_text.toLowerCase().includes(searchKeyword)) ||
                (item.category && item.category.toLowerCase().includes(searchKeyword)) ||
                (item.priority && item.priority.toLowerCase().includes(searchKeyword))
            );
        });

        // Pipeline phase 2: Sort records matching parameters
        recordsToRender.sort((a, b) => {
            if (sortCriteria === 'oldest') {
                return a.id - b.id;
            } else if (sortCriteria === 'priority') {
                const weightA = priorityWeights[a.priority.toLowerCase()] || 0;
                const weightB = priorityWeights[b.priority.toLowerCase()] || 0;
                return weightB !== weightA ? weightB - weightA : b.id - a.id;
            } else {
                return b.id - a.id; // Default: 'newest'
            }
        });

        // Pipeline phase 3: Build text cards on left side feed
        feedContainer.innerHTML = '';
        if (recordsToRender.length === 0) {
            feedContainer.innerHTML = `<div style="color: var(--text-muted); padding: 2rem; text-align: center; font-size: 0.9rem;">No matching incidents found.</div>`;
        }

        recordsToRender.forEach(item => {
            const prioClass = item.priority.toLowerCase();
            const currentStatus = item.status || 'Not Attended';
            
            // Map corresponding triage colors for immediate scannability
            let statusIcon = '🔴';
            if (currentStatus === 'Still on Working') statusIcon = '🟡';
            if (currentStatus === 'Problem Solved') statusIcon = '🟢';

            const card = document.createElement('div');
            card.className = 'feed-item';
            card.style.cursor = 'pointer'; // Visual cue for interaction boundaries
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                    <div>
                        <span class="tag tag-${prioClass}">${item.priority}</span>
                        <strong>${item.category}</strong>
                    </div>
                    <span style="font-size: 0.95rem;" title="Triage Level: ${currentStatus}">${statusIcon}</span>
                </div>
                <p style="margin: 0.5rem 0; font-size: 0.9rem; color: var(--text-light);">${item.translated_text}</p>
                <small style="color: var(--text-muted); font-size: 0.75rem;">${item.timestamp}</small>
            `;
            
            // =========================================================================
            // NEW ACTION BINDING: Double-Click Event Listener Injection
            // =========================================================================
            card.addEventListener('dblclick', () => window.openSummaryModal(item));
            
            feedContainer.appendChild(card);
        });

        // Pipeline phase 4: Manage geospatial pins safely
        let baseMapHasOpenPopup = false;
        markerGroup.eachLayer(layer => {
            if (layer.getPopup() && layer.getPopup().isOpen()) {
                baseMapHasOpenPopup = true;
            }
        });

        // If an operation is inspecting a pop-up, exit map update execution to keep UI static
        if (baseMapHasOpenPopup && !isFirstLoad) return;

        markerGroup.clearLayers();

        // Structural compilation of coordinates
        const groupedLocations = {};
        recordsToRender.forEach(item => {
            if (item.latitude && item.longitude) {
                const locationKey = `${item.latitude}_${item.longitude}`;
                if (!groupedLocations[locationKey]) {
                    groupedLocations[locationKey] = [];
                }
                groupedLocations[locationKey].push(item);
            }
        });

        // Loop through locations and construct marker layers
        Object.keys(groupedLocations).forEach(locationKey => {
            const reportsAtLocation = groupedLocations[locationKey];
            const latestIncident = reportsAtLocation[0];
            const pinColor = latestIncident.priority === 'Critical' ? 'red' : latestIncident.priority === 'High' ? 'orange' : 'blue';
            
            const marker = L.circleMarker([latestIncident.latitude, latestIncident.longitude], {
                color: pinColor,
                fillColor: pinColor,
                fillOpacity: 0.6,
                radius: 8
            });

            const minimalHtml = `
                <div id="min-view-${locationKey}" style="font-size: 0.85rem; line-height: 1.4; min-width: 200px;">
                    <strong style="color: ${pinColor === 'blue' ? '#2563eb' : pinColor};">[${latestIncident.priority}] ${latestIncident.category}</strong><br>
                    <span style="color: #1f2937; font-weight: 500;">${latestIncident.analysis_summary || latestIncident.translated_text}</span><br>
                    <small style="color: #4b5563; display: block; margin-top: 4px; font-style: italic;">Source: "${latestIncident.raw_text}"</small>
                    ${reportsAtLocation.length > 1 ? `<a href="#" style="color: #d97706; font-weight: bold; display: block; margin-top: 6px; text-decoration: none;" onclick="togglePopupHistory('${locationKey}', true); return false;">📖 Show More (${reportsAtLocation.length - 1} logs)</a>` : ''}
                </div>
            `;

            let historyItemsHtml = '';
            reportsAtLocation.forEach((report) => {
                historyItemsHtml += `
                    <div style="border-bottom: 1px solid #e5e7eb; padding: 6px 0; font-size: 0.8rem; line-height: 1.3;">
                        <span style="color: #6b7280; font-size: 0.7rem; display: block;">${report.timestamp}</span>
                        <strong style="color: #1f2937; font-size: 0.75rem;">${report.category}:</strong> <span style="color: #374151;">${report.translated_text}</span>
                    </div>
                `;
            });

            const fullHtml = `
                <div id="full-view-${locationKey}" style="display: none; max-height: 180px; overflow-y: auto; min-width: 230px; padding-right: 4px;">
                    <strong style="color: #111827; font-size: 0.85rem; display: block; margin-bottom: 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px;">📋 Location Incident Timeline</strong>
                    ${historyItemsHtml}
                    <a href="#" style="color: #2563eb; font-weight: bold; display: block; margin-top: 6px; text-decoration: none; font-size: 0.8rem;" onclick="togglePopupHistory('${locationKey}', false); return false;">↩ Show Recent</a>
                </div>
            `;

            marker.bindPopup(`${minimalHtml}${fullHtml}`);
            markerGroup.addLayer(marker);
        });

        if (isFirstLoad && markerGroup.getLayers().length > 0) {
            const bounds = L.featureGroup(markerGroup.getLayers()).getBounds();
            map.fitBounds(bounds, { padding: [50, 50] }); 
            isFirstLoad = false; 
        }
    }

    async function fetchLatestDataFromServer() {
        if (isModalOpen) return; // Halt synchronization if an operator is updating properties
        try {
            const response = await fetch('/api/incidents');
            localIncidentsCache = await response.json();
            processAndRenderUI();
        } catch (err) {
            console.error("Dashboard synchronization error:", err);
        }
    }

    searchInput?.addEventListener('input', processAndRenderUI);
    sortSelect?.addEventListener('change', processAndRenderUI);

    fetchLatestDataFromServer();
    setInterval(fetchLatestDataFromServer, 5000);
});