// Admin Panel JavaScript

let currentScript = null;
let scripts = [];
let activities = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadScripts();
    loadActivity();
});

// ============================================
// AUTHENTICATION
// ============================================

async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/admin-login.html';
            return;
        }

        // Display admin email
        document.getElementById('adminEmail').textContent = data.email;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/admin-login.html';
    }
}

async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/admin-login.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // New script button
    document.getElementById('newScriptBtn').addEventListener('click', showScriptModal);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    // Script form
    document.getElementById('scriptForm').addEventListener('submit', saveScript);

    // Modal close on outside click
    document.getElementById('scriptModal').addEventListener('click', (e) => {
        if (e.target.id === 'scriptModal') {
            closeScriptModal();
        }
    });
}

// ============================================
// NAVIGATION
// ============================================

function switchSection(section) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}Section`).classList.add('active');

    // Update header
    const titles = {
        scripts: 'Scripts Management',
        activity: 'Activity Logs',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section];

    // Show/hide new script button
    document.getElementById('newScriptBtn').style.display =
        section === 'scripts' ? 'block' : 'none';

    // Load data if needed
    if (section === 'activity') {
        loadActivity();
    }
}

// ============================================
// SCRIPTS MANAGEMENT
// ============================================

async function loadScripts() {
    try {
        const response = await fetch('/api/admin/scripts', {
            credentials: 'include'
        });
        scripts = await response.json();
        renderScripts();
    } catch (error) {
        console.error('Failed to load scripts:', error);
    }
}

function renderScripts() {
    const container = document.getElementById('scriptsList');
    const emptyState = document.getElementById('emptyState');

    if (scripts.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'grid';
    emptyState.style.display = 'none';

    container.innerHTML = scripts.map(script => `
    <div class="script-card" data-id="${script.id}">
      <h3>${escapeHtml(script.title)}</h3>
      <div class="script-preview">${escapeHtml(script.content)}</div>
      <div class="script-meta">
        <span>Created: ${formatDate(script.createdAt)}</span>
        <span>${script.content.split(' ').length} words</span>
      </div>
      <div class="script-actions">
        <button class="btn-icon btn-edit" onclick="editScript('${script.id}')">
          ✏️ Edit
        </button>
        <button class="btn-icon btn-delete" onclick="deleteScript('${script.id}')">
          🗑️ Delete
        </button>
      </div>
    </div>
  `).join('');
}

function showScriptModal(scriptId = null) {
    const modal = document.getElementById('scriptModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('scriptForm');

    if (scriptId) {
        currentScript = scripts.find(s => s.id === scriptId);
        modalTitle.textContent = 'Edit Script';
        document.getElementById('scriptTitle').value = currentScript.title;
        document.getElementById('scriptContent').value = currentScript.content;
    } else {
        currentScript = null;
        modalTitle.textContent = 'New Script';
        form.reset();
    }

    modal.classList.add('show');
}

function closeScriptModal() {
    const modal = document.getElementById('scriptModal');
    modal.classList.remove('show');
    currentScript = null;
    document.getElementById('scriptForm').reset();
}

async function saveScript(e) {
    e.preventDefault();

    const title = document.getElementById('scriptTitle').value;
    const content = document.getElementById('scriptContent').value;
    const saveBtn = document.getElementById('saveScriptBtn');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const url = currentScript
            ? `/api/admin/scripts/${currentScript.id}`
            : '/api/admin/scripts';

        const method = currentScript ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ title, content })
        });

        if (response.ok) {
            closeScriptModal();
            await loadScripts();
        } else {
            alert('Failed to save script');
        }
    } catch (error) {
        console.error('Save failed:', error);
        alert('Failed to save script');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Script';
    }
}

function editScript(id) {
    showScriptModal(id);
}

async function deleteScript(id) {
    const script = scripts.find(s => s.id === id);
    if (!confirm(`Are you sure you want to delete "${script.title}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/scripts/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            await loadScripts();
        } else {
            alert('Failed to delete script');
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete script');
    }
}

// ============================================
// ACTIVITY LOGS
// ============================================

async function loadActivity() {
    try {
        const response = await fetch('/api/admin/activity', {
            credentials: 'include'
        });
        activities = await response.json();
        renderActivity();
    } catch (error) {
        console.error('Failed to load activity:', error);
    }
}

function renderActivity() {
    const container = document.getElementById('activityList');

    if (activities.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No activity logs yet</p></div>';
        return;
    }

    container.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <div class="activity-info">
        <h4>${escapeHtml(activity.action)}</h4>
        <p>${JSON.stringify(activity.details)}</p>
      </div>
      <div class="activity-time">
        ${formatDateTime(activity.timestamp)}
      </div>
    </div>
  `).join('');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
