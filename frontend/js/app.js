document.addEventListener("DOMContentLoaded", () => {
    // Coordinate states variables
    let currentLat = 10.0082;
    let currentLng = 76.3276;
    let addressResolvedSuccessfully = false;

    // DOM Hook Handles
    const incidentForm = document.getElementById('incidentForm');
    const incidentText = document.getElementById('incidentText');
    const geoBtn = document.getElementById('geoBtn');
    const geoStatus = document.getElementById('geoStatus');
    const reportResponse = document.getElementById('reportResponse');

    const manualLocationInput = document.getElementById('manualLocationInput');
    const verifyAddressBtn = document.getElementById('verifyAddressBtn');
    const addressResolutionStatus = document.getElementById('addressResolutionStatus');

    const verifyForm = document.getElementById('verifyForm');
    const verifyText = document.getElementById('verifyText');
    const verifyResponse = document.getElementById('verifyResponse');

    // -------------------------------------------------------------------------
    // MUTUAL EXCLUSION LOCK RULE 1: Typing text disables GPS button functionality
    // -------------------------------------------------------------------------
    manualLocationInput?.addEventListener('input', () => {
        if (manualLocationInput.value.trim().length > 0) {
            geoBtn.disabled = true;
            geoBtn.style.opacity = "0.4";
            geoBtn.style.cursor = "not-allowed";
            geoStatus.innerHTML = "<span style='color: #fbbf24;'>⚠️ Switched to Manual Address Field. GPS Button Locked.</span>";
        } else {
            // Re-engage defaults if the user wipes out the written text area entirely
            geoBtn.disabled = false;
            geoBtn.style.opacity = "1";
            geoBtn.style.cursor = "pointer";
            geoStatus.textContent = "Default Coordinates Loaded";
            addressResolutionStatus.textContent = "";
            addressResolvedSuccessfully = false;
            currentLat = 10.0082;
            currentLng = 76.3276;
        }
    });

    // -------------------------------------------------------------------------
    // WORKING ACTION ENGINE: Geocode address names to spatial map variables
    // -------------------------------------------------------------------------
    verifyAddressBtn?.addEventListener('click', async () => {
        const addressQuery = manualLocationInput.value.trim();
        if (!addressQuery) {
            addressResolutionStatus.innerHTML = "<span style='color: #ef4444;'>❌ Please enter a valid location description first.</span>";
            return;
        }

        addressResolutionStatus.innerHTML = "⏳ AI Engine looking up geospatial coordinates metrics...";
        
        try {
            // Free, lightweight lookup vector using OpenStreetMap Open Nominatim Endpoint
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                currentLat = parseFloat(data[0].lat);
                currentLng = parseFloat(data[0].lon);
                addressResolvedSuccessfully = true;

                addressResolutionStatus.innerHTML = `
                    <span style='color: #10b981; font-weight: bold;'>
                        🟢 Location Identified! Coordinates mapped: (${currentLat.toFixed(4)}, ${currentLng.toFixed(4)})
                    </span>
                `;
            } else {
                addressResolutionStatus.innerHTML = "<span style='color: #f59e0b;'>⚠️ Specific location text unrecognized. Defaulting to regional operation center nodes.</span>";
                currentLat = 10.0082;
                currentLng = 76.3276;
                addressResolvedSuccessfully = true; // Fallback to avoid outright operational failure
            }
        } catch (err) {
            console.error("Geocoding transaction failure:", err);
            addressResolutionStatus.innerHTML = "<span style='color: #ef4444;'>❌ External Geocoding verification node timed out.</span>";
        }
    });

    // -------------------------------------------------------------------------
    // MUTUAL EXCLUSION LOCK RULE 2: Clicking GPS coordinates disables typing block
    // -------------------------------------------------------------------------
    geoBtn?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            geoStatus.textContent = "❌ Geolocation is completely unsupported by your terminal browser.";
            return;
        }
        
        geoStatus.textContent = "⏳ Fetching sat-position metrics...";

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
                geoStatus.innerHTML = `<span style='color: #10b981;'>✅ GPS Locked: (${currentLat.toFixed(4)}, ${currentLng.toFixed(4)})</span>`;
                
                // Absolute lock applied over text field parameter boundaries
                manualLocationInput.disabled = true;
                manualLocationInput.style.opacity = "0.4";
                manualLocationInput.style.cursor = "not-allowed";
                manualLocationInput.value = "";
                verifyAddressBtn.disabled = true;
                verifyAddressBtn.style.opacity = "0.4";
                addressResolutionStatus.innerHTML = "<span style='color: #fbbf24;'>⚠️ Switched to High-Accuracy GPS tracking. Address Entry Field Locked.</span>";
            },
            (error) => {
                geoStatus.textContent = "❌ Permission denied or timeout. Using baseline city fallback grids.";
            },
            { enableHighAccuracy: true, timeout: 7000 }
        );
    });

    // -------------------------------------------------------------------------
    // SECURE REPORT TRANSMISSION ROUTINE
    // -------------------------------------------------------------------------
    incidentForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reportContent = incidentText.value.trim();
        const typedLocationString = manualLocationInput ? manualLocationInput.value.trim() : '';

        // If user typed something but skipped parsing it, run a quick auto-resolve sequence
        if (typedLocationString && !addressResolvedSuccessfully) {
            addressResolutionStatus.innerHTML = "⏳ Resolving address bounds before secure dispatch...";
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(typedLocationString)}&limit=1`);
                const data = await res.json();
                if (data && data.length > 0) {
                    currentLat = parseFloat(data[0].lat);
                    currentLng = parseFloat(data[0].lon);
                }
            } catch (err) { console.error(err); }
        }

        reportResponse.classList.remove('hidden');
        reportResponse.innerHTML = "⏳ Broadcasting situational details to emergency operational streams...";

        try {
            const response = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: reportContent,
                    latitude: currentLat,
                    longitude: currentLng,
                    typed_location: typedLocationString
                })
            });

            const result = await response.json();
            if (response.ok) {
                reportResponse.innerHTML = `
                    <div style="color: #10b981; font-weight: bold; margin-bottom: 0.5rem;">✅ Report Lodged into Operational Feeds Successfully!</div>
                    📌 <strong>Category:</strong> ${result.data.category}<br>
                    🔥 <strong>Priority Rank:</strong> ${result.data.priority} (${result.data.severity})<br>
                    📖 <strong>AI Overview:</strong> ${result.data.analysis_summary}
                `;
                
                // Clear state variables and unlock UI fields cleanly
                incidentForm.reset();
                manualLocationInput.disabled = false;
                manualLocationInput.style.opacity = "1";
                manualLocationInput.style.cursor = "text";
                verifyAddressBtn.disabled = false;
                verifyAddressBtn.style.opacity = "1";
                geoBtn.disabled = false;
                geoBtn.style.opacity = "1";
                geoBtn.style.cursor = "pointer";
                geoStatus.textContent = "Default Coordinates Loaded";
                addressResolutionStatus.textContent = "";
                addressResolvedSuccessfully = false;
                currentLat = 10.0082;
                currentLng = 76.3276;
            } else {
                reportResponse.innerHTML = `<span style="color: #ef4444;">❌ Server rejected request: ${result.error}</span>`;
            }
        } catch (err) {
            reportResponse.innerHTML = '<span style="color: #ef4444;">❌ Critical network transport communication anomaly.</span>';
        }
    });

    // Fact Checking Radar Engine Interface Hooks (Kept completely functional and untouched)
    verifyForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const verificationBody = verifyText.value.trim();

        verifyResponse.classList.remove('hidden');
        verifyResponse.textContent = "🔍 Correlating community credibility scores matrix attributes...";

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: verificationBody })
            });
            const result = await response.json();
            if (response.ok) {
                const alertStatusTag = result.data.is_scam ? "⚠️ Warning: Detected Fraud/Misinformation Signature" : "✅ Validated Verified Update Context Pattern";
                verifyResponse.innerHTML = `
                    <strong>${alertStatusTag}</strong><br>
                    🛡️ <strong>Safety Credibility Score:</strong> ${result.data.credibility_score}% Match Consistency Rate.<br>
                    📖 <strong>Evaluation Analysis:</strong> ${result.data.analysis_summary}
                `;
                verifyText.value = '';
            } else {
                verifyResponse.textContent = `❌ Verification returned error code attributes: ${result.error}`;
            }
        } catch (err) {
            verifyResponse.textContent = "❌ Transmission system transport fault checking credentials.";
        }
    });
});