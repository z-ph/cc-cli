const API_BASE = '';

export async function fetchConfig(scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/config?scope=${scope}`);
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function fetchProfiles(scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/profiles?scope=${scope}`);
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function fetchProfile(id, scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/profiles/${id}?scope=${scope}`);
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function createProfile(id, profile, scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/profiles?scope=${scope}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...profile }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function updateProfile(id, profile, scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/profiles/${id}?scope=${scope}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function deleteProfile(id, scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/profiles/${id}?scope=${scope}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function fetchBase(scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/base?scope=${scope}`);
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function updateBase(base, scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/base?scope=${scope}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(base),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function fetchRawYaml(scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/config/raw?scope=${scope}`);
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function importConfig(content, format, scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/config/import?scope=${scope}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, format }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function exportConfig(format, scope = 'local') {
  try {
    const response = await fetch(`${API_BASE}/api/config/export?scope=${scope}&format=${format}`);
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function launchProfile(id) {
  try {
    const response = await fetch(`${API_BASE}/api/launch/${id}`, {
      method: 'POST',
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function useProfile(id) {
  try {
    const response = await fetch(`${API_BASE}/api/use/${id}`, {
      method: 'POST',
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function startServe(id) {
  try {
    const response = await fetch(`${API_BASE}/api/serve/${id}`, {
      method: 'POST',
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function stopServe(id) {
  try {
    const response = await fetch(`${API_BASE}/api/serve/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
