import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

/* CLOUDINARY — keep the existing account and preset.
   Preset names are case-sensitive; use the exact preset name shown in Cloudinary. */
const CLOUDINARY_CLOUD_NAME = "t2lucsiv";
const CLOUDINARY_UPLOAD_PRESET = "Sciencehackacademy _pdfs";

/* IMPORTANT: replace this after creating the admin user in the NEW Firebase project.
   Firebase Console > Authentication > Users > copy the new user's UID.
   Client-side checks improve the UI only; Firestore Rules must enforce authorization. */
const ADMIN_UID = "RhuJSjZihFT7UMS3GKKezr5Ysao1";

const $ = (id) => document.getElementById(id);
const pdfList = $("pdf-list");
const searchInput = $("pdf-search");
const loginModal = $("login-modal");
const loginBtn = $("login-btn");
const loginEmail = $("login-email");
const loginPassword = $("login-password");
const loginMessage = $("login-message");
const adminLoginBtn = $("admin-login-btn");
const closeLogin = $("close-login");
const adminDashboard = $("admin-dashboard");
const logoutBtn = $("admin-logout-btn");
const pdfFile = $("pdf-file");
const pdfTitle = $("pdf-title");
const pdfSubject = $("pdf-subject");
const pdfGrade = $("pdf-grade");
const pdfDescription = $("pdf-description");
const uploadButton = $("upload-pdf-btn");
const uploadStatus = $("upload-status");
const adminPdfList = $("admin-pdf-list");

let allPDFs = [];
$("year").textContent = new Date().getFullYear();

function isAdmin(user = auth.currentUser) {
  return Boolean(user && ADMIN_UID !== "REPLACE_WITH_NEW_FIREBASE_ADMIN_UID" && user.uid === ADMIN_UID);
}
function showLoginModal() {
  loginModal.classList.remove("hidden");
  loginEmail.focus();
}
function hideLoginModal() { loginModal.classList.add("hidden"); }
function showAdminDashboard() {
  if (!isAdmin()) return;
  adminDashboard.classList.remove("hidden");
  loadAdminPDFs();
  adminDashboard.scrollIntoView({ behavior: "smooth", block: "start" });
}
function hideAdminDashboard() { adminDashboard.classList.add("hidden"); }

adminLoginBtn.addEventListener("click", () => {
  if (isAdmin()) showAdminDashboard();
  else showLoginModal();
});
closeLogin.addEventListener("click", hideLoginModal);
loginModal.addEventListener("click", (event) => {
  if (event.target === loginModal) hideLoginModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideLoginModal();
});

loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    loginMessage.textContent = "Enter your email and password.";
    return;
  }
  if (ADMIN_UID === "REPLACE_WITH_NEW_FIREBASE_ADMIN_UID") {
    loginMessage.textContent = "Setup needed: add your new admin UID in script.js first.";
    return;
  }
  loginBtn.disabled = true;
  loginMessage.textContent = "Signing in…";
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (credential.user.uid !== ADMIN_UID) {
      await signOut(auth);
      loginMessage.textContent = "This account is not authorized as the admin.";
      return;
    }
    loginMessage.textContent = "Signed in successfully.";
    hideLoginModal();
    adminLoginBtn.textContent = "Admin Dashboard";
    showAdminDashboard();
  } catch (error) {
    console.error("Login error:", error);
    loginMessage.textContent = friendlyAuthError(error);
  } finally {
    loginBtn.disabled = false;
  }
});

function friendlyAuthError(error) {
  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "auth/network-request-failed": "Network error. Check your connection."
  };
  return messages[error.code] || `Sign-in failed (${error.code || "unknown error"}).`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdmin(user)) {
    if (user && !isAdmin(user)) await signOut(auth);
    adminLoginBtn.textContent = "Admin Login";
    hideAdminDashboard();
    return;
  }
  adminLoginBtn.textContent = "Admin Dashboard";
  // Dashboard stays closed until the user taps its button.
});

logoutBtn.addEventListener("click", async () => {
  try { await signOut(auth); }
  catch (error) { console.error("Sign-out error:", error); }
  hideAdminDashboard();
  adminLoginBtn.textContent = "Admin Login";
});

searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  renderPDFs(allPDFs.filter((pdf) =>
    [pdf.title, pdf.subject, pdf.grade, pdf.description]
      .some((value) => String(value || "").toLowerCase().includes(term))
  ));
});

uploadButton.addEventListener("click", uploadPDF);

async function uploadPDF() {
  if (!isAdmin()) {
    uploadStatus.textContent = "Admin authentication required.";
    return;
  }
  const file = pdfFile.files[0];
  const title = pdfTitle.value.trim();
  const subject = pdfSubject.value.trim();
  const grade = pdfGrade.value.trim();
  const description = pdfDescription.value.trim();

  if (!file) { uploadStatus.textContent = "Choose a PDF file first."; return; }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    uploadStatus.textContent = "Only PDF files are allowed."; return;
  }
  
if (file.size > 100 * 1024 * 1024) {
  uploadStatus.textContent = "This file is over 100 MB.";
  return;
}

  if (!title) { uploadStatus.textContent = "Enter a PDF title."; return; }
  if (CLOUDINARY_UPLOAD_PRESET === "REPLACE_WITH_YOUR_UNSIGNED_PRESET") {
    uploadStatus.textContent = "Set the exact Cloudinary unsigned preset name in script.js."; return;
  }

  uploadButton.disabled = true;
  uploadStatus.textContent = "Uploading PDF to Cloudinary…";
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/t2lucsiv/raw/upload`, {
      method: "POST", body: formData
    });
    const cloudData = await response.json();
    if (!response.ok) throw new Error(cloudData?.error?.message || `Cloudinary error ${response.status}`);
    if (!cloudData.secure_url) throw new Error("Cloudinary did not return a secure file URL.");

    uploadStatus.textContent = "Saving PDF details…";
    await addDoc(collection(db, "pdfs"), {
      title, subject, grade, description,
      pdfUrl: cloudData.secure_url,
      cloudinaryPublicId: cloudData.public_id || "",
      originalFileName: file.name,
      createdAt: serverTimestamp(),
      uploadedBy: auth.currentUser.uid
    });

    uploadStatus.textContent = "PDF uploaded successfully.";
    pdfFile.value = "";
    pdfTitle.value = "";
    pdfSubject.value = "";
    pdfGrade.value = "";
    pdfDescription.value = "";
    await loadPDFs();
    await loadAdminPDFs();
  } catch (error) {
    console.error("Upload error:", error);
    uploadStatus.textContent = `Upload failed: ${error.message}`;
  } finally {
    uploadButton.disabled = false;
  }
}

async function getPDFRecords() {
  const pdfQuery = query(collection(db, "pdfs"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(pdfQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function loadPDFs() {
  try {
    allPDFs = await getPDFRecords();
    renderPDFs(allPDFs);
  } catch (error) {
    console.error("PDF loading error:", error);
    pdfList.innerHTML = `<div class="loading">Could not load PDFs. Check Firestore rules and connection.</div>`;
  }
}

function renderPDFs(pdfs) {
  pdfList.replaceChildren();
  if (!pdfs.length) {
    const empty = document.createElement("div");
    empty.className = "loading";
    empty.textContent = "No PDFs found.";
    pdfList.appendChild(empty);
    return;
  }
  for (const pdf of pdfs) {
    const card = document.createElement("article");
    card.className = "pdf-card";
    const title = document.createElement("h3");
    title.textContent = `▤ ${pdf.title || "Untitled PDF"}`;
    card.appendChild(title);
    if (pdf.description) {
      const description = document.createElement("p");
      description.textContent = pdf.description;
      card.appendChild(description);
    }
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [pdf.subject, pdf.grade ? `Class ${pdf.grade}` : ""].filter(Boolean).join(" • ");
    card.appendChild(meta);
    const actions = document.createElement("div");
    actions.className = "pdf-actions";
    const open = document.createElement("a");
    open.className = "open-pdf";
    open.href = safePDFUrl(pdf.pdfUrl);
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "Open PDF";
    const download = document.createElement("a");
    download.className = "download-pdf";
    download.href = safePDFUrl(pdf.pdfUrl);
    download.target = "_blank";
    download.rel = "noopener noreferrer";
    download.textContent = "View / Save";
    actions.append(open, download);
    card.appendChild(actions);
    pdfList.appendChild(card);
  }
}
function safePDFUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "#";
  } catch { return "#"; }
}

async function loadAdminPDFs() {
  if (!isAdmin()) return;
  adminPdfList.replaceChildren();
  try {
    const records = await getPDFRecords();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "admin-help";
      empty.textContent = "No PDFs have been uploaded yet.";
      adminPdfList.appendChild(empty);
      return;
    }
    for (const pdf of records) {
      const row = document.createElement("div");
      row.className = "admin-pdf-row";
      const details = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = pdf.title || "Untitled PDF";
      const small = document.createElement("small");
      small.textContent = [pdf.subject, pdf.grade ? `Class ${pdf.grade}` : ""].filter(Boolean).join(" • ");
      details.append(strong, small);
      const actions = document.createElement("div");
      actions.className = "admin-row-actions";
      const open = document.createElement("a");
      open.className = "small-open";
      open.href = safePDFUrl(pdf.pdfUrl);
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Open";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-pdf-button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => deletePDF(pdf.id, pdf.title || "this PDF"));
      actions.append(open, remove);
      row.append(details, actions);
      adminPdfList.appendChild(row);
    }
  } catch (error) {
    console.error("Admin PDF manager error:", error);
    adminPdfList.textContent = "Could not load manager. Check Firestore rules.";
  }
}

async function deletePDF(pdfId, title) {
  if (!isAdmin()) { alert("Admin authentication required."); return; }
  if (!confirm(`Remove “${title}” from the library? This removes the Firestore record, not the Cloudinary file.`)) return;
  try {
    await deleteDoc(doc(db, "pdfs", pdfId));
    await loadPDFs();
    await loadAdminPDFs();
  } catch (error) {
    console.error("Delete error:", error);
    alert("Could not remove this PDF. Check Firestore rules.");
  }
}

loadPDFs();
