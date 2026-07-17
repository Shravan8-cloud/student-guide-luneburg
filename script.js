const sheetURL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vTTG51nISwWfFXl9pi4krQKLhwVzqSWDffB3yVd0P5IwzmbwgciLPpsDTMqamorZYlKGcCl-hFFjXQT/pub?output=csv";

let resources = [];
let dataLoaded = false;
let pendingAction = null;
let currentList = [];
let currentShowCategoryTag = false;

// Single source of truth for category emoji + display label.
// Update here to change emoji/wording everywhere (buttons, titles, badges).
const CATEGORIES = [
    { id: "Accommodation", emoji: "🏠", label: "Accommodation" },
    { id: "Communication Groups", emoji: "💬", label: "Communication Groups" },
    { id: "University", emoji: "🎓", label: "University" },
    { id: "Bureaucracy", emoji: "🏛", label: "Bureaucracy" },
    { id: "Transport", emoji: "🚌", label: "Transport" },
    { id: "Banking, Insurance & Bureaucracy", emoji: "🏦", label: "Banking, Insurance & Bureaucracy" },
    { id: "Food & Shopping", emoji: "🥗", label: "Food & Shopping" },
    { id: "Jobs & Careers", emoji: "💼", label: "Jobs & Careers" },
    { id: "Services", emoji: "🛠️", label: "Services (Mobile Plans, Internet, Gyms, Student Discounts)" },
    { id: "Other", emoji: "📦", label: "Other" }
];

// Given raw category text (from a button id or a sheet value), returns "emoji Label"
function getCategoryDisplay(rawCategoryText) {
    let text = (rawCategoryText || "").trim();
    let match = CATEGORIES.find(c => text.includes(c.id));
    if (match) {
        return `${match.emoji} ${match.label}`;
    }
    return text || "Uncategorized";
}

Papa.parse(sheetURL, {
    download: true,
    header: true,
    transformHeader: function (header) {
        return header.trim();
    },
    complete: function (results) {
        console.log("Sheet loaded");

        resources = results.data.filter(
            item => item["Approved"]?.trim() === "Yes"
        );

        console.log(resources);

        dataLoaded = true;

        if (pendingAction) {
            pendingAction();
            pendingAction = null;
        }
    },
    error: function (err) {
        console.error("Failed to load sheet:", err);
        document.getElementById("resource-list").innerHTML =
            "<p>Could not load resources. Please refresh.</p>";
    }
});

function openCategory(category) {
    if (!dataLoaded) {
        pendingAction = () => openCategory(category);
        showLoadingState(category);
        return;
    }

    document.getElementById("home-page").classList.add("hidden");
    document.getElementById("detail-page").classList.add("hidden");
    document.getElementById("resource-page").classList.remove("hidden");
    document.getElementById("page-title").textContent = getCategoryDisplay(category);

    currentList = resources.filter(resource => {
        let sheetCategory = resource["Which category does it belong to?"]?.trim() || "";
        return sheetCategory.includes(category);
    });

    currentShowCategoryTag = false;
    showResources(currentList, currentShowCategoryTag);
}

function showAllResources() {
    if (!dataLoaded) {
        pendingAction = () => showAllResources();
        showLoadingState("All Resources");
        return;
    }

    document.getElementById("home-page").classList.add("hidden");
    document.getElementById("detail-page").classList.add("hidden");
    document.getElementById("resource-page").classList.remove("hidden");
    document.getElementById("page-title").textContent = "All Resources";

    currentList = resources.slice();
    currentShowCategoryTag = true;
    showResources(currentList, currentShowCategoryTag);
}

function showLoadingState(title) {
    document.getElementById("home-page").classList.add("hidden");
    document.getElementById("detail-page").classList.add("hidden");
    document.getElementById("resource-page").classList.remove("hidden");
    document.getElementById("page-title").textContent = title;
    document.getElementById("resource-list").innerHTML = "<p>Loading resources...</p>";
}

// Converts "7/16/2026 14:49:31" -> "16 Jul 2026"
function formatDate(rawDate) {
    if (!rawDate) return "Unknown date";
    let d = new Date(rawDate);
    if (isNaN(d)) return rawDate;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
}

function showResources(resourceList, showCategoryTag = false) {
    let container = document.getElementById("resource-list");
    container.innerHTML = "";

    if (resourceList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No resources have been shared in this category yet.</p>
                <a class="contribute-button" href="https://forms.gle/LGiA22iRvH5nEtfF7" target="_blank" rel="noopener">
                    ➕ Contribute the First Resource
                </a>
            </div>
        `;
        return;
    }

    resourceList.forEach(resource => {
        let card = document.createElement("div");
        card.className = "resource-card";

        let typeBadge = resource["What would you like to share?"]?.trim() || "📌 Resource";
        let title = resource["Title"] || "Untitled";
        let dateFormatted = formatDate(resource["Timestamp"]);
        let preview = truncateText(resource["Useful Link / Advice"] || "", 140);

        let categoryBadgeHTML = "";
        if (showCategoryTag) {
            let categoryText = getCategoryDisplay(resource["Which category does it belong to?"]);
            categoryBadgeHTML = `<span class="card-badge card-badge-category">${categoryText}</span>`;
        }

        card.innerHTML = `
            <span class="card-badge">${typeBadge}</span>${categoryBadgeHTML}
            <h3 class="card-title">${title}</h3>
            <p class="card-date">${dateFormatted}</p>
            <p class="card-preview">${preview}</p>
        `;

        card.addEventListener("click", () => showDetail(resource));

        container.appendChild(card);
    });
}

function sortResources(order) {
    let sorted = currentList.slice().sort((a, b) => {
        let dateA = new Date(a["Timestamp"]);
        let dateB = new Date(b["Timestamp"]);
        return order === "newest" ? dateB - dateA : dateA - dateB;
    });

    currentList = sorted;
    showResources(currentList, currentShowCategoryTag);
}

// Splits advice text into a leading URL (if present) and the rest
function renderContent(rawText) {
    if (!rawText) return "<p>No details provided.</p>";

    let text = rawText.trim();
    let urlPattern = /^(https?:\/\/\S+)/;
    let match = text.match(urlPattern);

    if (match) {
        let url = match[1];
        let remaining = text.slice(url.length).trim();

        let html = `<p><a href="${url}" target="_blank" rel="noopener">${url}</a></p>`;
        if (remaining) {
            html += `<p>${remaining}</p>`;
        }
        return html;
    }

    return `<p>${text}</p>`;
}

function showDetail(resource) {
    document.getElementById("resource-page").classList.add("hidden");
    document.getElementById("detail-page").classList.remove("hidden");

    document.getElementById("detail-title").textContent = resource["Title"] || "Untitled";
    document.getElementById("detail-date").textContent = formatDate(resource["Timestamp"]);

    document.getElementById("detail-type-badge").textContent =
        resource["What would you like to share?"]?.trim() || "📌 Resource";

    document.getElementById("detail-category-badge").textContent =
        getCategoryDisplay(resource["Which category does it belong to?"]);

    document.getElementById("detail-content").innerHTML =
        renderContent(resource["Useful Link / Advice"]);

    document.getElementById("detail-user").textContent =
        "Shared by: " + (resource["Name (Optional)"]?.trim() || "Anonymous");

    document.getElementById("detail-id").textContent =
        "Resource ID: " + (resource["Resource ID"] || "N/A");
}

function goHome() {
    document.getElementById("resource-page").classList.add("hidden");
    document.getElementById("detail-page").classList.add("hidden");
    document.getElementById("home-page").classList.remove("hidden");
}

function goBackToResources() {
    document.getElementById("detail-page").classList.add("hidden");
    document.getElementById("resource-page").classList.remove("hidden");
}

// Theme handling

function applyThemeIcon(theme) {
    let toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
        toggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
    }
}

function toggleTheme() {
    let current = document.documentElement.getAttribute("data-theme") || "light";
    let next = current === "light" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    applyThemeIcon(next);
}

// Set correct icon on initial load (theme itself is already applied via inline head script)
document.addEventListener("DOMContentLoaded", () => {
    let currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    applyThemeIcon(currentTheme);
});