/**
 * AdelaSocial IA V2 — Frontend Controller (Vanilla JS, Zero Dependencies)
 * Conexión estricta a Backend Local en 127.0.0.1:8089 (o same-origin)
 * Respeta CSP (sin eval, sin inline handlers) y controla errores reales.
 */
(() => {
  "use strict";

  // Determinación de backend URL según origen
  const IS_LOCAL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const BACKEND_BASE = IS_LOCAL ? window.location.origin : "http://127.0.0.1:8089";

  let sessionToken = null;
  let serverStatus = null;
  let selectedVideoId = null;
  let selectedVideoMetadata = null;
  let activeTab = "library";

  // Elementos DOM
  const dom = {
    badgeEnv: document.getElementById("badge-env"),
    badgeBackend: document.getElementById("badge-backend"),
    badgeAccount: document.getElementById("badge-account"),
    banner: document.getElementById("banner"),
    backendHelp: document.getElementById("backend-help"),
    accountSelect: document.getElementById("account-select"),
    accStatus: document.getElementById("acc-status"),
    accUser: document.getElementById("acc-user"),
    accScopes: document.getElementById("acc-scopes"),
    accToken: document.getElementById("acc-token"),
    accApp: document.getElementById("acc-app"),
    btnConnect: document.getElementById("btn-connect"),
    btnDisconnect: document.getElementById("btn-disconnect"),
    connectReason: document.getElementById("connect-reason"),
    tabLibrary: document.getElementById("tab-library"),
    tabLocal: document.getElementById("tab-local"),
    panelLibrary: document.getElementById("panel-library"),
    panelLocal: document.getElementById("panel-local"),
    library: document.getElementById("library"),
    dropZone: document.getElementById("drop"),
    fileInput: document.getElementById("file-input"),
    preview: document.getElementById("preview"),
    previewVideo: document.getElementById("preview-video"),
    previewName: document.getElementById("preview-name"),
    previewChecks: document.getElementById("preview-checks"),
    title: document.getElementById("title"),
    titleCounter: document.getElementById("title-counter"),
    privacy: document.getElementById("privacy"),
    privacyNote: document.getElementById("privacy-note"),
    allowComment: document.getElementById("allow-comment"),
    allowDuet: document.getElementById("allow-duet"),
    allowStitch: document.getElementById("allow-stitch"),
    disclose: document.getElementById("disclose"),
    discloseOpts: document.getElementById("disclose-opts"),
    brandOrganic: document.getElementById("brand-organic"),
    brandContent: document.getElementById("brand-content"),
    consent: document.getElementById("consent"),
    btnDraft: document.getElementById("btn-draft"),
    btnPublish: document.getElementById("btn-publish"),
    publishReasons: document.getElementById("publish-reasons"),
    resMode: document.getElementById("res-mode"),
    resId: document.getElementById("res-id"),
    resStatus: document.getElementById("res-status"),
    resDetail: document.getElementById("res-detail"),
    resProgress: document.getElementById("res-progress"),
    btnPoll: document.getElementById("btn-poll"),
    history: document.getElementById("history"),
    historyEmpty: document.getElementById("history-empty"),
    btnClearHistory: document.getElementById("btn-clear-history"),
    pendingList: document.getElementById("pending")
  };

  // Mostrar mensaje tipo banner
  function showBanner(msg, type = "ok") {
    if (!dom.banner) return;
    dom.banner.className = `banner ${type}`;
    dom.banner.textContent = msg;
    dom.banner.classList.remove("hidden");
  }

  function hideBanner() {
    if (dom.banner) dom.banner.classList.add("hidden");
  }

  // Peticiones fetch seguras con cabecera de sesión
  async function apiFetch(endpoint, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (sessionToken) {
      headers["X-Adela-Session"] = sessionToken;
    }
    const url = `${BACKEND_BASE}${endpoint}`;
    return fetch(url, { ...options, headers });
  }

  // Obtener sesión de API local
  async function initSession() {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/session`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.session) {
          sessionToken = data.session;
          return true;
        }
      }
    } catch (e) {
      // Backend no disponible o bloqueado por navegador
    }
    return false;
  }

  // Comprobar estado del backend y cuentas
  async function checkBackendStatus() {
    dom.badgeBackend.textContent = "Backend: comprobando…";
    dom.badgeBackend.className = "badge";

    const hasSession = await initSession();
    if (!hasSession) {
      dom.badgeBackend.textContent = "Backend: Desconectado";
      dom.badgeBackend.className = "badge err";
      if (dom.backendHelp) dom.backendHelp.classList.remove("hidden");
      renderPending({
        "backend_gateway": false,
        "browser_file_upload": false,
        "creator_info_query": false
      });
      return false;
    }

    try {
      const res = await apiFetch("/api/status");
      if (res.ok) {
        serverStatus = await res.json();
        dom.badgeBackend.textContent = "Backend: Conectado (127.0.0.1:8089)";
        dom.badgeBackend.className = "badge ok";
        if (dom.backendHelp) dom.backendHelp.classList.add("hidden");

        if (serverStatus.environment) {
          dom.badgeEnv.textContent = `Entorno: ${serverStatus.environment.toUpperCase()}`;
        }
        renderAccountInfo();
        renderPending(serverStatus.features || {});
        loadLibrary();
        return true;
      }
    } catch (e) {
      dom.badgeBackend.textContent = "Backend: Error de red";
      dom.badgeBackend.className = "badge err";
      if (dom.backendHelp) dom.backendHelp.classList.remove("hidden");
    }
    return false;
  }

  // Renderizar información de la cuenta seleccionada
  function renderAccountInfo() {
    if (!serverStatus || !serverStatus.connections) return;
    const selectedCode = dom.accountSelect ? dom.accountSelect.value : "TIKTOK_FR";
    const conn = serverStatus.connections.find(c => c.account_code === selectedCode);

    if (dom.accountSelect) dom.accountSelect.disabled = false;

    if (!conn || conn.connection_status !== "CONNECTED") {
      dom.badgeAccount.textContent = `${selectedCode}: No conectada`;
      dom.badgeAccount.className = "badge warn";
      dom.accStatus.textContent = conn ? conn.connection_status : "NOT_CONNECTED";
      dom.accUser.textContent = "—";
      dom.accScopes.innerHTML = '<span class="chip">—</span>';
      dom.accToken.textContent = "No emitido";
      dom.accApp.textContent = serverStatus.tiktok.app_configured ? "Configurada" : "Faltan credenciales";

      dom.btnConnect.disabled = !serverStatus.tiktok.app_configured;
      dom.btnDisconnect.disabled = true;

      if (!serverStatus.tiktok.app_configured) {
        dom.connectReason.textContent = "Requiere TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en .env local.";
        dom.connectReason.classList.remove("hidden");
      } else {
        dom.connectReason.classList.add("hidden");
      }
    } else {
      dom.badgeAccount.textContent = `${selectedCode}: @${conn.platform_username || 'conectado'}`;
      dom.badgeAccount.className = "badge ok";
      dom.accStatus.textContent = "CONNECTED (Autorizado)";
      dom.accUser.textContent = conn.platform_username ? `@${conn.platform_username}` : "Usuario verificado";

      const scopes = conn.scopes || [];
      dom.accScopes.innerHTML = scopes.length
        ? scopes.map(s => `<span class="chip">${s}</span>`).join("")
        : '<span class="chip">user.info.basic</span>';

      dom.accToken.textContent = conn.token_valid === true ? "Válido (Bóveda AES-128)" : (conn.token_valid === false ? "Expirado" : "Activo");
      dom.accApp.textContent = "Conectada";

      dom.btnConnect.disabled = true;
      dom.btnDisconnect.disabled = false;
      dom.connectReason.classList.add("hidden");
    }
    updatePublishButtons();
  }

  // Cargar lista de vídeos de la biblioteca local
  async function loadLibrary() {
    if (!dom.library) return;
    dom.library.innerHTML = '<p class="empty">Consultando biblioteca autorizada…</p>';

    try {
      const res = await apiFetch("/api/videos");
      if (res.ok) {
        const data = await res.json();
        const vids = data.videos || [];
        if (vids.length === 0) {
          dom.library.innerHTML = '<p class="empty">No hay vídeos MP4 listos en data/output/ o output/.</p>';
          return;
        }

        dom.library.innerHTML = "";
        vids.forEach(v => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "vid";
          btn.setAttribute("aria-pressed", selectedVideoId === v.id ? "true" : "false");
          btn.innerHTML = `<span>${v.filename}</span><span class="meta">${v.size_mb} MB (${v.group})</span>`;
          btn.addEventListener("click", () => selectLibraryVideo(v));
          dom.library.appendChild(btn);
        });
      } else {
        dom.library.innerHTML = '<p class="empty">Error al cargar la biblioteca desde el backend.</p>';
      }
    } catch (e) {
      dom.library.innerHTML = '<p class="empty">No se pudo contactar con la biblioteca local.</p>';
    }
  }

  // Seleccionar vídeo de biblioteca
  function selectLibraryVideo(v) {
    selectedVideoId = v.id;
    // Actualizar estados visuales
    const all = dom.library.querySelectorAll(".vid");
    all.forEach(b => b.setAttribute("aria-pressed", "false"));
    event.currentTarget.setAttribute("aria-pressed", "true");

    inspectVideoUrl(`${BACKEND_BASE}${v.url}`, v.filename, v.size_mb, v.size_bytes);
  }

  // Inspeccionar propiedades del vídeo mediante elemento HTML5
  function inspectVideoUrl(srcUrl, filename, sizeMb, sizeBytes) {
    if (!dom.preview || !dom.previewVideo) return;

    dom.preview.classList.remove("hidden");
    dom.previewName.textContent = `${filename} (${sizeMb} MB)`;
    dom.previewChecks.innerHTML = '<li>Cargando metadatos del vídeo…</li>';

    dom.previewVideo.src = srcUrl;
    dom.previewVideo.onloadedmetadata = () => {
      const w = dom.previewVideo.videoWidth;
      const h = dom.previewVideo.videoHeight;
      const dur = Math.round(dom.previewVideo.duration);
      const is916 = (h > w) && (Math.abs((w / h) - (9 / 16)) < 0.05 || (w === 1080 && h === 1920));
      const sizeOk = sizeBytes <= (50 * 1024 * 1024);

      selectedVideoMetadata = { width: w, height: h, duration: dur, is916, sizeOk, filename };

      const checks = [];
      checks.push(is916
        ? `<li class="ok">Resolución vertical 9:16 (${w}×${h}px)</li>`
        : `<li class="warn">Resolución detectada: ${w}×${h}px (se recomienda vertical 1080×1920 9:16)</li>`);

      checks.push(dur >= 3 && dur <= 600
        ? `<li class="ok">Duración adecuada: ${dur}s</li>`
        : `<li class="warn">Duración: ${dur}s</li>`);

      checks.push(sizeOk
        ? `<li class="ok">Tamaño dentro del límite de consola (${sizeMb} MB &le; 50 MB)</li>`
        : `<li class="err">Tamaño excede límite (${sizeMb} MB &gt; 50 MB)</li>`);

      dom.previewChecks.innerHTML = checks.join("");
      updatePublishButtons();
    };

    dom.previewVideo.onerror = () => {
      dom.previewChecks.innerHTML = '<li class="err">No se pudo cargar o reproducir el archivo de vídeo.</li>';
      selectedVideoMetadata = null;
      updatePublishButtons();
    };
  }

  // Inspección de archivo arrastrado/seleccionado localmente
  function handleLocalFile(file) {
    if (!file || !file.name.toLowerCase().endsWith(".mp4")) {
      showBanner("El archivo debe ser un contenedor MP4 (.mp4).", "warn");
      return;
    }
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const objUrl = URL.createObjectURL(file);
    selectedVideoId = null; // No está en la biblioteca local del backend
    inspectVideoUrl(objUrl, file.name, sizeMb, file.size);
  }

  // Renderizar estado de funciones pendientes
  function renderPending(features) {
    if (!dom.pendingList) return;
    const items = [];
    if (!features.browser_file_upload) {
      items.push("<li><b>Subida directa desde navegador a TikTok:</b> Requiere subir mediante la biblioteca de la fábrica en servidor.</li>");
    }
    if (!features.creator_info_query) {
      items.push("<li><b>Consulta de identidad avanzada en Sandbox:</b> Limitada a cuenta autorizada.</li>");
    }
    if (features.publish_locked) {
      items.push("<li><b>Interruptor de publicación en producción:</b> Bloqueado por seguridad local (<span class=\"mono\">ADELA_PUBLISH_ENABLED=false</span>).</li>");
    }
    dom.pendingList.innerHTML = items.length ? items.join("") : "<li>Todas las funciones habilitadas.</li>";
  }

  // Evaluar estado para habilitar botones de publicación
  function updatePublishButtons() {
    const reasons = [];
    const selectedCode = dom.accountSelect ? dom.accountSelect.value : "TIKTOK_FR";
    const conn = serverStatus && serverStatus.connections
      ? serverStatus.connections.find(c => c.account_code === selectedCode)
      : null;

    const isConnected = conn && conn.connection_status === "CONNECTED";
    if (!isConnected) reasons.push("Cuenta TikTok no conectada.");

    if (!selectedVideoId) {
      reasons.push("Selecciona un vídeo de la biblioteca de la fábrica (los archivos locales arrastrados son solo para inspección).");
    }

    const titleVal = dom.title ? dom.title.value.trim() : "";
    if (!titleVal) {
      reasons.push("Se requiere un título/descripción para publicación directa.");
    }

    if (dom.consent && !dom.consent.checked) {
      reasons.push("Debes aceptar la confirmación de derechos y uso de música.");
    }

    const publishLocked = serverStatus && serverStatus.features && serverStatus.features.publish_locked;
    if (publishLocked) {
      reasons.push("Publicación real bloqueada en servidor (ADELA_PUBLISH_ENABLED=false).");
    }

    // Botón borrador
    const canDraft = isConnected && selectedVideoId && dom.consent.checked && !publishLocked;
    if (dom.btnDraft) dom.btnDraft.disabled = !canDraft;

    // Botón directo
    const canPublish = canDraft && !!titleVal;
    if (dom.btnPublish) dom.btnPublish.disabled = !canPublish;

    if (dom.publishReasons) {
      dom.publishReasons.innerHTML = reasons.map(r => `<li>${r}</li>`).join("");
    }
  }

  // Enviar orden de publicación al backend
  async function submitPublish(isDraft) {
    hideBanner();
    const payload = {
      account: dom.accountSelect.value,
      video_id: selectedVideoId,
      title: dom.title.value.trim(),
      privacy_level: dom.privacy.value,
      is_draft: isDraft,
      disable_comment: !dom.allowComment.checked,
      disable_duet: !dom.allowDuet.checked,
      disable_stitch: !dom.allowStitch.checked,
      brand_organic_toggle: dom.brandOrganic ? dom.brandOrganic.checked : false,
      brand_content_toggle: dom.brandContent ? dom.brandContent.checked : false
    };

    dom.resMode.textContent = isDraft ? "Borrador (video.upload)" : "Directo (video.publish)";
    dom.resStatus.textContent = "Enviando solicitud a backend local…";
    dom.resDetail.textContent = "Procesando...";
    dom.resProgress.style.width = "25%";

    try {
      const res = await apiFetch("/api/tiktok/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      dom.resProgress.style.width = "100%";

      if (res.ok && result.success) {
        dom.resId.textContent = result.publication_id || result.publish_id || "Recibido";
        dom.resStatus.textContent = result.status || "PROCESADO";
        dom.resDetail.textContent = result.publication_url ? `URL: ${result.publication_url}` : "Subida completada en TikTok.";
        showBanner(`Operación enviada con éxito (${result.status}).`, "ok");
        saveHistory({
          date: new Date().toLocaleTimeString(),
          account: payload.account,
          mode: isDraft ? "Borrador" : "Directo",
          id: result.publication_id || "N/A",
          status: result.status
        });
      } else {
        dom.resStatus.textContent = result.status || "RECHAZADO";
        dom.resDetail.textContent = result.error || "Fallo en la llamada a Content Posting API.";
        showBanner(`No se pudo enviar: ${result.error || 'Error desconocido'}`, "err");
      }
    } catch (e) {
      dom.resProgress.style.width = "0%";
      dom.resStatus.textContent = "ERROR_RED";
      dom.resDetail.textContent = "No se pudo conectar con el endpoint de publicación local.";
      showBanner("Error de comunicación con el backend local.", "err");
    }
  }

  // Guardar en historial local
  function saveHistory(item) {
    try {
      const cur = JSON.parse(localStorage.getItem("adela_history") || "[]");
      cur.unshift(item);
      localStorage.setItem("adela_history", JSON.stringify(cur.slice(0, 15)));
      renderHistory();
    } catch (e) {}
  }

  function renderHistory() {
    if (!dom.history) return;
    try {
      const list = JSON.parse(localStorage.getItem("adela_history") || "[]");
      if (list.length === 0) {
        dom.history.innerHTML = "";
        if (dom.historyEmpty) dom.historyEmpty.classList.remove("hidden");
        return;
      }
      if (dom.historyEmpty) dom.historyEmpty.classList.add("hidden");
      dom.history.innerHTML = list.map(item => `
        <tr>
          <td>${item.date}</td>
          <td>${item.account}</td>
          <td>${item.mode}</td>
          <td class="mono">${item.id}</td>
          <td>${item.status}</td>
        </tr>
      `).join("");
    } catch (e) {}
  }

  // Inicialización de escuchadores de eventos
  function setupEvents() {
    if (dom.accountSelect) {
      dom.accountSelect.addEventListener("change", () => renderAccountInfo());
    }

    if (dom.btnConnect) {
      dom.btnConnect.addEventListener("click", () => {
        const acc = dom.accountSelect.value;
        // Navegación de nivel superior hacia el endpoint de autorización
        window.location.href = `${BACKEND_BASE}/oauth/tiktok/authorize?account=${encodeURIComponent(acc)}`;
      });
    }

    if (dom.btnDisconnect) {
      dom.btnDisconnect.addEventListener("click", async () => {
        if (!confirm("¿Deseas desvincular esta cuenta de TikTok de la fábrica local?")) return;
        const acc = dom.accountSelect.value;
        try {
          const res = await apiFetch("/api/tiktok/disconnect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account: acc })
          });
          if (res.ok) {
            showBanner(`Cuenta ${acc} desconectada.`, "ok");
            checkBackendStatus();
          } else {
            showBanner("Error al desconectar la cuenta.", "err");
          }
        } catch (e) {
          showBanner("Fallo de red al solicitar desconexión.", "err");
        }
      });
    }

    // Pestañas
    if (dom.tabLibrary && dom.tabLocal) {
      dom.tabLibrary.addEventListener("click", () => {
        dom.tabLibrary.setAttribute("aria-selected", "true");
        dom.tabLocal.setAttribute("aria-selected", "false");
        dom.panelLibrary.classList.remove("hidden");
        dom.panelLocal.classList.add("hidden");
        activeTab = "library";
      });
      dom.tabLocal.addEventListener("click", () => {
        dom.tabLocal.setAttribute("aria-selected", "true");
        dom.tabLibrary.setAttribute("aria-selected", "false");
        dom.panelLocal.classList.remove("hidden");
        dom.panelLibrary.classList.add("hidden");
        activeTab = "local";
      });
    }

    // Drag and drop local
    if (dom.dropZone) {
      dom.dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dom.dropZone.classList.add("over");
      });
      dom.dropZone.addEventListener("dragleave", () => dom.dropZone.classList.remove("over"));
      dom.dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dom.dropZone.classList.remove("over");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleLocalFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (dom.fileInput) {
      dom.fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleLocalFile(e.target.files[0]);
        }
      });
    }

    // Título y contador
    if (dom.title) {
      dom.title.addEventListener("input", () => {
        const len = dom.title.value.length;
        dom.titleCounter.textContent = `${len} / 150`;
        dom.titleCounter.className = len > 150 ? "counter over" : "counter";
        updatePublishButtons();
      });
    }

    if (dom.consent) dom.consent.addEventListener("change", updatePublishButtons);

    // Divulgación comercial
    if (dom.disclose) {
      dom.disclose.addEventListener("change", () => {
        if (dom.disclose.checked) {
          dom.discloseOpts.classList.remove("hidden");
        } else {
          dom.discloseOpts.classList.add("hidden");
          if (dom.brandOrganic) dom.brandOrganic.checked = false;
          if (dom.brandContent) dom.brandContent.checked = false;
        }
      });
    }

    // Acciones de envío
    if (dom.btnDraft) dom.btnDraft.addEventListener("click", () => submitPublish(true));
    if (dom.btnPublish) dom.btnPublish.addEventListener("click", () => submitPublish(false));

    // Consultar estado de publicación
    if (dom.btnPoll) {
      dom.btnPoll.addEventListener("click", async () => {
        const pubId = dom.resId.textContent.trim();
        if (!pubId || pubId === "—" || pubId === "Recibido") return;
        try {
          const res = await apiFetch("/api/tiktok/publish-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account: dom.accountSelect.value, publish_id: pubId })
          });
          const d = await res.json();
          if (res.ok && d.success) {
            dom.resStatus.textContent = d.status || "COMPLETADO";
            dom.resDetail.textContent = d.fail_reason || "Estado actualizado de TikTok.";
          }
        } catch (e) {}
      });
    }

    if (dom.btnClearHistory) {
      dom.btnClearHistory.addEventListener("click", () => {
        localStorage.removeItem("adela_history");
        renderHistory();
      });
    }

    // Detectar retorno de OAuth mediante query params (?result=...)
    const params = new URLSearchParams(window.location.search);
    if (params.has("result")) {
      const resVal = params.get("result");
      const accVal = params.get("account") || "";
      if (resVal === "tiktok_success") {
        showBanner(`¡Autorización OAuth exitosa para ${accVal}! Cuenta vinculada correctamente.`, "ok");
      } else if (resVal === "error") {
        showBanner(`Error en la vinculación OAuth: ${params.get("error_description") || 'Rechazado por TikTok'}`, "err");
      }
      // Limpiar query params de la barra de direcciones sin recargar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Arranque inicial
  document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    renderHistory();
    checkBackendStatus();
  });
})();
